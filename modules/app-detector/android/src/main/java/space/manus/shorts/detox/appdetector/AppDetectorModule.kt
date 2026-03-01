package space.manus.shorts.detox.appdetector

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class AppDetectorModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("AppDetector")

    // ── 현재 포그라운드 앱 조회 ──
    AsyncFunction("getCurrentApp") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(null); return@AsyncFunction }
        if (!hasUsageStatsPermission(ctx)) { promise.resolve(null); return@AsyncFunction }
        promise.resolve(getForegroundApp(ctx))
      } catch (e: Exception) { promise.resolve(null) }
    }

    // ── 사용량 접근 권한 확인 ──
    AsyncFunction("hasUsageStatsPermission") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        promise.resolve(hasUsageStatsPermission(ctx))
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 사용량 통계 조회 ──
    AsyncFunction("getUsageStats") { minutes: Int, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(emptyMap<String, Long>()); return@AsyncFunction }
        if (!hasUsageStatsPermission(ctx)) { promise.resolve(emptyMap<String, Long>()); return@AsyncFunction }
        promise.resolve(getUsageStatsMap(ctx, minutes))
      } catch (e: Exception) { promise.resolve(emptyMap<String, Long>()) }
    }

    // ── 앱 이름 조회 ──
    AsyncFunction("getAppName") { packageName: String, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(packageName); return@AsyncFunction }
        val label = try {
          val info = ctx.packageManager.getApplicationInfo(packageName, 0)
          ctx.packageManager.getApplicationLabel(info).toString()
        } catch (e: PackageManager.NameNotFoundException) { packageName }
        promise.resolve(label)
      } catch (e: Exception) { promise.resolve(packageName) }
    }

    // ── 백그라운드 모니터링 시작 ──
    AsyncFunction("startBackgroundMonitoring") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val intent = Intent(ctx, AppMonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 백그라운드 모니터링 중지 ──
    AsyncFunction("stopBackgroundMonitoring") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        ctx.stopService(Intent(ctx, AppMonitorService::class.java))
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(AppMonitorService.KEY_IS_RUNNING, false).apply()
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 백그라운드 모니터링 상태 ──
    AsyncFunction("isBackgroundMonitoringActive") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        promise.resolve(prefs.getBoolean(AppMonitorService.KEY_IS_RUNNING, false))
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 저장된 세션 조회 (JSON string) ──
    AsyncFunction("getPendingSessions") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve("[]"); return@AsyncFunction }
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        promise.resolve(prefs.getString(AppMonitorService.KEY_PENDING_SESSIONS, "[]") ?: "[]")
      } catch (e: Exception) { promise.resolve("[]") }
    }

    // ── 저장된 세션 초기화 ──
    AsyncFunction("clearPendingSessions") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(AppMonitorService.KEY_PENDING_SESSIONS, "[]").apply()
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 사용량 접근 설정 화면 열기 ──
    AsyncFunction("openUsageStatsSettings") { promise: Promise ->
      try {
        val activity = appContext.currentActivity ?: run { promise.resolve(false); return@AsyncFunction }
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

  }

  private fun hasUsageStatsPermission(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
      }
      mode == android.app.AppOpsManager.MODE_ALLOWED
    } else { true }
  }

  private fun getForegroundApp(context: Context): String? {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    return queryRecentForegroundEvent(usm, now - 10_000L, now)
      ?: queryRecentForegroundEvent(usm, now - 3 * 60_000L, now)
  }

  private fun queryRecentForegroundEvent(usm: UsageStatsManager, beginTime: Long, endTime: Long): String? {
    val usageEvents = usm.queryEvents(beginTime, endTime)
    val event = UsageEvents.Event()
    var lastPkg: String? = null
    var lastTime = 0L
    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val isFg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED
      else
        @Suppress("DEPRECATION") event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
      if (isFg && event.timeStamp > lastTime) { lastTime = event.timeStamp; lastPkg = event.packageName }
    }
    return lastPkg
  }

  private fun getUsageStatsMap(context: Context, minutes: Int): Map<String, Long> {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, now - minutes * 60_000L, now)
    return stats.filter { it.totalTimeInForeground > 0 }.associate { it.packageName to it.totalTimeInForeground }
  }
}
