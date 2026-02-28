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
        const val KEY_SCROLL_COUNT = "scrollCount"
        const val KEY_IS_RUNNING = "isRunning"
        const val CHANNEL_ID = "shorts_monitor"
        const val NOTIF_ID = 7001

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
    private var sessionStartTime = 0L

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        createNotifChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ID, notif)
        }
        prefs.edit().putBoolean(KEY_IS_RUNNING, true).apply()
        // Restore state across restarts
        currentPkg = prefs.getString(KEY_CURRENT_PKG, null)
        sessionStartTime = prefs.getLong(KEY_SESSION_START, 0L)
        startPolling()
        return START_STICKY
    }

    private fun startPolling() {
        timer?.cancel()
        timer = Timer("AppMonitor", true)
        timer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() { try { poll() } catch (_: Exception) {} }
        }, 0L, 2000L)
    }

    private fun poll() {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
        val now = System.currentTimeMillis()
        val pkg = queryForeground(usm, now) ?: return
        if (pkg == packageName) return // skip our own app

        val isShorts = isShorts(pkg)
        if (pkg != currentPkg) {
            currentPkg?.let { prev ->
                if (sessionStartTime > 0L && isShorts(prev)) {
                    saveSession(prev, sessionStartTime, now)
                }
            }
            currentPkg = pkg
            sessionStartTime = if (isShorts) now else 0L
            prefs.edit()
                .putString(KEY_CURRENT_PKG, pkg)
                .putLong(KEY_SESSION_START, sessionStartTime)
                .apply()
        }
    }

    private fun queryForeground(usm: UsageStatsManager, now: Long): String? {
        fun q(begin: Long): String? {
            val events = usm.queryEvents(begin, now)
            val ev = UsageEvents.Event()
            var pkg: String? = null; var t = 0L
            while (events.hasNextEvent()) {
                events.getNextEvent(ev)
                val fg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                    ev.eventType == UsageEvents.Event.ACTIVITY_RESUMED
                else @Suppress("DEPRECATION") ev.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
                if (fg && ev.timeStamp > t) { t = ev.timeStamp; pkg = ev.packageName }
            }
            return pkg
        }
        return q(now - 10_000L) ?: q(now - 3 * 60_000L)
    }

    private fun isShorts(pkg: String) =
        SHORTS_PACKAGES.any { pkg == it || pkg.startsWith("$it.") }

    private fun saveSession(pkg: String, start: Long, end: Long) {
        val dur = end - start
        if (dur < 3000L) return
        val scrollCount = prefs.getInt(KEY_SCROLL_COUNT, 0)
        prefs.edit().putInt(KEY_SCROLL_COUNT, 0).apply()
        val platform = when {
            pkg.contains("youtube") -> "youtube"
            pkg.contains("musically") || pkg.contains("tiktok") -> "tiktok"
            pkg.contains("instagram") -> "instagram"
            else -> "other"
        }
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(start))
        val session = JSONObject().apply {
            put("id", "bg-$start")
            put("platform", platform)
            put("startTime", start)
            put("endTime", end)
            put("durationMs", dur)
            put("date", date)
            put("scrollFrequency", if (scrollCount > 0) scrollCount.toDouble() / (dur / 1000.0) else 0.0)
            put("isAutoDetected", true)
        }
        val arr = try {
            JSONArray(prefs.getString(KEY_PENDING_SESSIONS, "[]") ?: "[]")
        } catch (_: Exception) { JSONArray() }
        while (arr.length() >= 100) arr.remove(0)
        arr.put(session)
        prefs.edit().putString(KEY_PENDING_SESSIONS, arr.toString()).apply()
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
        timer?.cancel()
        prefs.edit().putBoolean(KEY_IS_RUNNING, false).apply()
        val now = System.currentTimeMillis()
        currentPkg?.let { pkg ->
            if (sessionStartTime > 0L && isShorts(pkg)) saveSession(pkg, sessionStartTime, now)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
