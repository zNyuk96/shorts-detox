package space.manus.shorts.detox.appdetector

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
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Timer
import java.util.TimerTask

class AppMonitorService : Service() {

    companion object {
        const val PREFS_NAME = "AppDetectorPrefs"
        const val KEY_PENDING_SESSIONS = "pendingSessions"
        const val KEY_CURRENT_PKG = "currentPkg"
        const val KEY_SESSION_START = "sessionStart"
        const val KEY_IS_RUNNING = "isRunning"
        const val KEY_ALERT_THRESHOLD_MS = "alertThresholdMs"
        const val KEY_TODAY_DATE_ALERT = "todayDateAlert"
        const val KEY_TODAY_TOTAL_MS = "todayTotalMs"
        const val KEY_LAST_ALERT_TIME = "lastAlertTime"
        const val CHANNEL_ID = "shorts_monitor"
        const val ALERT_CHANNEL_ID = "shorts_alert"
        const val NOTIF_ID = 7001
        const val ALERT_NOTIF_ID = 7002
        const val MIN_SESSION_MS = 30_000L // 30초 미만 세션 제외
        const val ALERT_MIN_INTERVAL_MS = 5 * 60_000L // 5분 이내 중복 알림 방지

        // 쇼츠 앱 패키지 (사용량 통계 조회 대상)
        val SHORTS_PACKAGES = setOf(
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.tiktok",
            "com.instagram.android",
            "com.facebook.katana"
        )

        // YouTube에서 쇼츠 탭임을 나타내는 Activity 클래스명 키워드
        private val YOUTUBE_SHORTS_CLASS_KEYWORDS = listOf(
            "short", "reel"  // ShortsActivity, ShortsPagerActivity 등 포함
        )
    }

    private var timer: Timer? = null
    private lateinit var prefs: SharedPreferences
    private var currentPkg: String? = null
    private var currentCls: String? = null  // Activity 클래스명 추적
    private var sessionStartTime = 0L

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotifChannel()
        createAlertChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notif)
        }
        prefs.edit().putBoolean(KEY_IS_RUNNING, true).apply()
        currentPkg = prefs.getString(KEY_CURRENT_PKG, null)
        sessionStartTime = prefs.getLong(KEY_SESSION_START, 0L)
        startPolling()
        return START_STICKY
    }

    private fun startPolling() {
        timer?.cancel()
        timer = Timer("AppMonitor", true)
        timer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() { try { poll() } catch (e: Exception) {} }
        }, 0L, 2000L)
    }

    private fun poll() {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
        val now = System.currentTimeMillis()
        val (pkg, cls) = queryForeground(usm, now) ?: return
        if (pkg == packageName) return

        val isShortsNow = isShorts(pkg, cls)
        val changed = pkg != currentPkg || cls != currentCls

        if (changed) {
            // 이전 세션 저장 (쇼츠였을 경우)
            currentPkg?.let { prev ->
                if (sessionStartTime > 0L && isShorts(prev, currentCls)) {
                    saveSession(prev, sessionStartTime, now)
                }
            }
            currentPkg = pkg
            currentCls = cls
            sessionStartTime = if (isShortsNow) now else 0L
            prefs.edit()
                .putString(KEY_CURRENT_PKG, pkg)
                .putLong(KEY_SESSION_START, sessionStartTime)
                .apply()
        }
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
     * 쇼츠 여부 판단:
     * - TikTok: 앱 전체가 쇼츠 형태
     * - Instagram / Facebook: Reels 중심 (앱 전체 카운트)
     * - YouTube: Activity 클래스명에 "short" 또는 "reel" 포함 시에만 Shorts 탭
     */
    private fun isShorts(pkg: String, cls: String? = null): Boolean {
        return when {
            pkg.contains("musically") || pkg.contains("tiktok") -> true
            pkg == "com.instagram.android" || pkg == "com.facebook.katana" -> true
            pkg == "com.google.android.youtube" -> {
                val clsLower = cls?.lowercase() ?: ""
                YOUTUBE_SHORTS_CLASS_KEYWORDS.any { clsLower.contains(it) }
            }
            else -> false
        }
    }

    private fun saveSession(pkg: String, start: Long, end: Long) {
        val dur = end - start
        if (dur < MIN_SESSION_MS) return  // 30초 미만 제외
        val platform = when (pkg) {
            "com.google.android.youtube" -> "youtube"
            "com.zhiliaoapp.musically", "com.ss.android.ugc.tiktok" -> "tiktok"
            "com.instagram.android" -> "instagram"
            "com.facebook.katana" -> "facebook"
            else -> "other"
        }
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(start))
        val session = JSONObject().apply {
            put("id", "bg-${start}-${(Math.random() * 9999).toInt()}")
            put("platform", platform)
            put("startTime", start)
            put("endTime", end)
            put("durationMs", dur)
            put("date", date)
            put("scrollFrequency", 0.0)
            put("isAutoDetected", true)
        }
        val arr = try {
            JSONArray(prefs.getString(KEY_PENDING_SESSIONS, "[]") ?: "[]")
        } catch (e: Exception) { JSONArray() }
        while (arr.length() >= 100) arr.remove(0)
        arr.put(session)
        prefs.edit().putString(KEY_PENDING_SESSIONS, arr.toString()).apply()

        // 백그라운드에서도 임계값 초과 시 즉시 알림 발송
        checkAndSendAlertNotification(dur)
    }

    // ── 백그라운드 알림 임계값 체크 ──
    private fun checkAndSendAlertNotification(newDurMs: Long) {
        try {
            val thresholdMs = prefs.getLong(KEY_ALERT_THRESHOLD_MS, 30 * 60_000L)
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

            // 날짜가 바뀌면 누적값 초기화
            if (prefs.getString(KEY_TODAY_DATE_ALERT, "") != today) {
                prefs.edit()
                    .putString(KEY_TODAY_DATE_ALERT, today)
                    .putLong(KEY_TODAY_TOTAL_MS, 0L)
                    .putLong(KEY_LAST_ALERT_TIME, 0L)
                    .apply()
            }

            val newTotal = prefs.getLong(KEY_TODAY_TOTAL_MS, 0L) + newDurMs
            prefs.edit().putLong(KEY_TODAY_TOTAL_MS, newTotal).apply()

            if (newTotal < thresholdMs) return

            // 5분 이내 중복 알림 방지
            val now = System.currentTimeMillis()
            val lastAlertTime = prefs.getLong(KEY_LAST_ALERT_TIME, 0L)
            if (now - lastAlertTime < ALERT_MIN_INTERVAL_MS) return

            prefs.edit().putLong(KEY_LAST_ALERT_TIME, now).apply()
            sendAlertNotification(newTotal, thresholdMs)
        } catch (e: Exception) {}
    }

    private fun sendAlertNotification(totalMs: Long, thresholdMs: Long) {
        val nm = getSystemService(NotificationManager::class.java) ?: return
        val totalMin = totalMs / 60_000L
        val thresholdMin = thresholdMs / 60_000L

        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 1, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notif = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("숏츠 디톡스")
                .setContentText("${totalMin}분 시청했어요! 목표 ${thresholdMin}분 초과. 잠깐 쉬어가세요 🧘")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("숏츠 디톡스")
                .setContentText("${totalMin}분 시청했어요! 목표 ${thresholdMin}분 초과. 잠깐 쉬어가세요 🧘")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setPriority(Notification.PRIORITY_HIGH)
                .build()
        }

        nm.notify(ALERT_NOTIF_ID, notif)
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

    private fun createAlertChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(ALERT_CHANNEL_ID, "숏츠 시청 알림", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "쇼츠 시청 시간 초과 알림"
                setShowBadge(true)
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
        timer?.cancel()
        prefs.edit().putBoolean(KEY_IS_RUNNING, false).apply()
        val now = System.currentTimeMillis()
        currentPkg?.let { pkg ->
            if (sessionStartTime > 0L && isShorts(pkg, currentCls)) saveSession(pkg, sessionStartTime, now)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
