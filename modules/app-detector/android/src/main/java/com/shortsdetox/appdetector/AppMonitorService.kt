package com.shortsdetox.appdetector

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import com.shortsdetox.appdetector.db.AppDatabase
import com.shortsdetox.appdetector.db.AppSessionEntity
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Timer
import java.util.TimerTask



class AppMonitorService : Service() {

    companion object {
        const val PREFS_NAME = "AppDetectorPrefs"
        const val KEY_CURRENT_PKG = "currentPkg"
        const val KEY_SESSION_START = "sessionStart"
        const val KEY_IS_RUNNING = "isRunning"
        const val KEY_ALERT_THRESHOLD_MS = "alertThresholdMs"
        const val KEY_TODAY_DATE_ALERT = "todayDateAlert"
        const val KEY_TODAY_TOTAL_MS = "todayTotalMs"
        const val KEY_LAST_ALERT_TIME = "lastAlertTime"
        const val KEY_ALERT_PENDING = "alertPending"
        const val KEY_ALERT_TOTAL_MS_NATIVE = "alertTotalMsNative"
        const val KEY_ALERT_THRESHOLD_MS_NATIVE = "alertThresholdMsNative"
        const val CHANNEL_ID = "shorts_monitor"
        const val NOTIF_ID = 7001
        const val TAG_SVC = "ShortsDetox"
        const val MIN_SESSION_MS = 30_000L // 30초 미만 세션 제외
        const val ALERT_MIN_INTERVAL_MS = 5 * 60_000L // 5분 이내 중복 포그라운드 전환 방지

        // 쇼츠 앱 패키지 (사용량 통계 조회 대상)
        val SHORTS_PACKAGES = setOf(
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.tiktok",
            "com.instagram.android",
            "com.facebook.katana"
        )

    }

    private var timer: Timer? = null
    private lateinit var prefs: SharedPreferences
    private var currentPkg: String? = null
    private var currentCls: String? = null
    private var sessionStartTime = 0L
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotifChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.i("ShortsDetox", "[SVC] onStartCommand called")
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notif)
        }
        prefs.edit().putBoolean(KEY_IS_RUNNING, true).apply()
        currentPkg = prefs.getString(KEY_CURRENT_PKG, null)
        sessionStartTime = prefs.getLong(KEY_SESSION_START, 0L)
        android.util.Log.i("ShortsDetox", "[SVC] restored: pkg=$currentPkg sessionStart=$sessionStartTime")
        // 복원된 세션이 비정상적으로 오래됐으면 리셋 (1시간 이상)
        if (sessionStartTime > 0L && System.currentTimeMillis() - sessionStartTime > 3_600_000L) {
            android.util.Log.w("ShortsDetox", "[SVC] stale session detected (>${(System.currentTimeMillis() - sessionStartTime)/1000}s), resetting")
            sessionStartTime = 0L
            prefs.edit().putLong(KEY_SESSION_START, 0L).apply()
        }
        startPolling()
        return START_STICKY
    }

    private fun startPolling() {
        timer?.cancel()
        timer = Timer("AppMonitor", true)
        timer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() { try { poll() } catch (e: Exception) {
                android.util.Log.e("ShortsDetox", "[SVC-POLL] poll() exception: ${e.javaClass.simpleName}: ${e.message}")
            } }
        }, 0L, 2000L)
    }

    private var pollCount = 0L

    private fun poll() {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        if (usm == null) {
            if (pollCount % 30 == 0L) android.util.Log.w("ShortsDetox", "[SVC-POLL] UsageStatsManager is null!")
            pollCount++
            return
        }
        val now = System.currentTimeMillis()
        val result = queryForeground(usm, now)
        if (result == null) {
            if (pollCount % 30 == 0L) android.util.Log.d("ShortsDetox", "[SVC-POLL] #$pollCount queryForeground=null (no fg event)")
            pollCount++
            return
        }
        val (pkg, cls) = result
        if (pkg == packageName) { pollCount++; return }

        val isShortsNow = isShorts(pkg, cls)
        val changed = pkg != currentPkg || cls != currentCls

        if (changed) {
            android.util.Log.d("ShortsDetox", "[SVC-POLL] #$pollCount APP_CHANGED: ${currentPkg}→${pkg} cls=${cls} isShorts=${isShortsNow}")
            // 이전 세션 저장 (쇼츠였을 경우)
            currentPkg?.let { prev ->
                if (sessionStartTime > 0L && isShorts(prev, currentCls)) {
                    val dur = now - sessionStartTime
                    android.util.Log.d("ShortsDetox", "[SVC-POLL] SAVING prev session: pkg=$prev start=$sessionStartTime dur=${dur}ms (${dur/1000}s)")
                    saveSession(prev, sessionStartTime, now)
                } else {
                    android.util.Log.d("ShortsDetox", "[SVC-POLL] prev=$prev NOT saved: sessionStart=$sessionStartTime isShorts=${isShorts(prev, currentCls)}")
                }
            }
            currentPkg = pkg
            currentCls = cls
            sessionStartTime = if (isShortsNow) now else 0L
            prefs.edit()
                .putString(KEY_CURRENT_PKG, pkg)
                .putLong(KEY_SESSION_START, sessionStartTime)
                .apply()
            if (isShortsNow) {
                android.util.Log.d("ShortsDetox", "[SVC-POLL] NEW SHORTS session started: pkg=$pkg cls=$cls startTime=$now")
            }
        } else if (isShortsNow && sessionStartTime > 0L && pollCount % 15 == 0L) {
            // 30초마다 현재 진행 중인 쇼츠 세션 상태 로깅
            val elapsed = now - sessionStartTime
            android.util.Log.d("ShortsDetox", "[SVC-POLL] #$pollCount ONGOING shorts: pkg=$pkg elapsed=${elapsed/1000}s")
        }
        pollCount++
    }

    // (packageName, className?) 반환
    private fun queryForeground(usm: UsageStatsManager, now: Long): Pair<String, String?>? {
        fun q(begin: Long): Pair<String, String?>? {
            val events = usm.queryEvents(begin, now)
            val ev = UsageEvents.Event()
            var result: Pair<String, String?>? = null
            var t = 0L
            while (events.hasNextEvent()) {
                events.getNextEvent(ev)
                val fg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                    ev.eventType == UsageEvents.Event.ACTIVITY_RESUMED
                else @Suppress("DEPRECATION") ev.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                if (fg && ev.timeStamp > t) {
                    t = ev.timeStamp
                    result = Pair(ev.packageName, ev.className)
                }
            }
            return result
        }
        return q(now - 10_000L) ?: q(now - 3 * 60_000L)
    }

    /**
     * 숏츠/릴스 앱 여부 판단:
     * - YouTube: 전체 사용시간 추적 (Shorts 탭만 분리 감지 불가)
     * - TikTok: 앱 전체
     * - Instagram: 앱 전체 (Reels 포함)
     * - Facebook: 앱 전체 (Reels 포함)
     */
    private fun isShorts(pkg: String, cls: String? = null): Boolean {
        return SHORTS_PACKAGES.contains(pkg)
    }

    private fun saveSession(pkg: String, start: Long, end: Long) {
        val dur = end - start
        if (dur < MIN_SESSION_MS) {
            android.util.Log.d("ShortsDetox", "[SVC-SAVE] SKIPPED: dur=${dur}ms < ${MIN_SESSION_MS}ms pkg=$pkg")
            return
        }
        val platform = when (pkg) {
            "com.google.android.youtube" -> "youtube"
            "com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok" -> "tiktok"
            "com.instagram.android" -> "instagram"
            "com.facebook.katana" -> "facebook"
            else -> "other"
        }
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(start))
        val entity = AppSessionEntity(
            packageName = pkg,
            platform = platform,
            startTime = start,
            endTime = end,
            durationMs = dur,
            date = date,
            isAutoDetected = true
        )
        serviceScope.launch {
            try {
                val id = AppDatabase.getInstance(applicationContext).insert(entity)
                android.util.Log.i("ShortsDetox", "[SVC-SAVE] ✓ SAVED id=$id platform=$platform date=$date dur=${dur/1000}s")
            } catch (e: Exception) {
                android.util.Log.e("ShortsDetox", "[SVC-SAVE] DB insert failed: ${e.message}")
            }
        }
        checkAndSendAlertNotification(dur)
    }

    // ── 백그라운드 알림 임계값 체크 ──
    @Synchronized
    private fun checkAndSendAlertNotification(newDurMs: Long) {
        try {
            val thresholdMs = prefs.getLong(KEY_ALERT_THRESHOLD_MS, 30 * 60_000L)
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val now = System.currentTimeMillis()

            val currentDate = prefs.getString(KEY_TODAY_DATE_ALERT, "")
            val currentTotal = if (currentDate == today) prefs.getLong(KEY_TODAY_TOTAL_MS, 0L) else 0L
            val lastAlertTime = if (currentDate == today) prefs.getLong(KEY_LAST_ALERT_TIME, 0L) else 0L
            val newTotal = currentTotal + newDurMs

            val shouldAlert = newTotal >= thresholdMs && (now - lastAlertTime >= ALERT_MIN_INTERVAL_MS)

            // 단일 트랜잭션으로 모든 값 저장
            val editor = prefs.edit()
                .putString(KEY_TODAY_DATE_ALERT, today)
                .putLong(KEY_TODAY_TOTAL_MS, newTotal)
            if (shouldAlert) editor.putLong(KEY_LAST_ALERT_TIME, now)
            editor.apply()

            if (shouldAlert) bringAppToForeground(newTotal, thresholdMs)
        } catch (e: Exception) {}
    }

    private fun bringAppToForeground(totalMs: Long, thresholdMs: Long) {
        try {
            val totalMin = totalMs / 60_000L
            val thresholdMin = thresholdMs / 60_000L
            android.util.Log.i(TAG_SVC, "[ALERT] 임계값 초과: ${totalMin}분/${thresholdMin}분 → 앱 포그라운드 전환")
            // JS PendingDetoxHandler가 읽어서 detox 화면으로 이동
            prefs.edit()
                .putBoolean(KEY_ALERT_PENDING, true)
                .putLong(KEY_ALERT_TOTAL_MS_NATIVE, totalMs)
                .putLong(KEY_ALERT_THRESHOLD_MS_NATIVE, thresholdMs)
                .apply()
            val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            } ?: run {
                android.util.Log.e(TAG_SVC, "[ALERT] getLaunchIntent 실패")
                return
            }
            startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e(TAG_SVC, "[ALERT] bringAppToForeground 실패: ${e.message}")
        }
    }

    private fun createNotifChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "숏츠 모니터링", NotificationManager.IMPORTANCE_LOW).apply {
                description = "백그라운드 쇼츠 시청 추적"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }


    private fun buildNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("숏츠 디톡스")
                .setContentText("쇼츠 시청 시간 추적 중")
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setContentIntent(pi)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("숏츠 디톡스")
                .setContentText("쇼츠 시청 시간 추적 중")
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setContentIntent(pi)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW)
                .build()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        android.util.Log.i("ShortsDetox", "[SVC] onDestroy called, saving final session if needed")
        timer?.cancel()
        prefs.edit().putBoolean(KEY_IS_RUNNING, false).apply()
        val now = System.currentTimeMillis()
        currentPkg?.let { pkg ->
            if (sessionStartTime > 0L && isShorts(pkg, currentCls)) {
                val dur = now - sessionStartTime
                android.util.Log.i("ShortsDetox", "[SVC] onDestroy: saving final session pkg=$pkg dur=${dur/1000}s")
                if (dur >= MIN_SESSION_MS) {
                    try {
                        val platform = when (pkg) {
                            "com.google.android.youtube" -> "youtube"
                            "com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok" -> "tiktok"
                            "com.instagram.android" -> "instagram"
                            "com.facebook.katana" -> "facebook"
                            else -> "other"
                        }
                        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(sessionStartTime))
                        val entity = com.shortsdetox.appdetector.db.AppSessionEntity(
                            packageName = pkg, platform = platform,
                            startTime = sessionStartTime, endTime = now,
                            durationMs = dur, date = date, isAutoDetected = true
                        )
                        val id = com.shortsdetox.appdetector.db.AppDatabase.getInstance(applicationContext).insert(entity)
                        android.util.Log.i("ShortsDetox", "[SVC] onDestroy: ✓ saved id=$id dur=${dur/1000}s")
                    } catch (e: Exception) {
                        android.util.Log.e("ShortsDetox", "[SVC] onDestroy: DB insert failed: ${e.message}")
                    }
                } else {
                    android.util.Log.d("ShortsDetox", "[SVC] onDestroy: dur=${dur}ms < min, skipped")
                }
            } else {
                android.util.Log.d("ShortsDetox", "[SVC] onDestroy: no active shorts session to save (pkg=$pkg sessionStart=$sessionStartTime)")
            }
        } ?: android.util.Log.d("ShortsDetox", "[SVC] onDestroy: currentPkg=null, nothing to save")
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
