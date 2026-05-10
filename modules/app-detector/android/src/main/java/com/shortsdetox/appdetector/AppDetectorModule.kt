package com.shortsdetox.appdetector

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.json.JSONArray
import org.json.JSONObject
import com.shortsdetox.appdetector.db.AppDatabase
import com.shortsdetox.appdetector.vpn.ShortsVpnService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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

    // ── 사용량 접근 권한 확인 (상세 로그 포함) ──
    AsyncFunction("hasUsageStatsPermission") { promise: Promise ->
      try {
        val ctx = appContext.reactContext
        if (ctx == null) {
          android.util.Log.e("ShortsDetox", "[PERM-CHK] reactContext NULL!")
          promise.resolve(false)
          return@AsyncFunction
        }
        android.util.Log.d("ShortsDetox", "[PERM-CHK] ctx OK, pkg=${ctx.packageName}")
        val result = hasUsageStatsPermission(ctx)
        android.util.Log.d("ShortsDetox", "[PERM-CHK] result=$result")
        promise.resolve(result)
      } catch (e: Exception) {
        android.util.Log.e("ShortsDetox", "[PERM-CHK] exception: ${e.javaClass.name}: ${e.message}")
        promise.resolve(false)
      }
    }

    // ── 전체 진단 정보 반환 (JSON string) ──
    AsyncFunction("getPermissionDiagnostics") { promise: Promise ->
      try {
        val json = org.json.JSONObject()

        // 1. reactContext 상태
        val ctx = appContext.reactContext
        json.put("reactContextNull", ctx == null)
        if (ctx == null) {
          promise.resolve(json.toString())
          return@AsyncFunction
        }

        // 2. 기본 정보
        json.put("packageName", ctx.packageName)
        json.put("sdkVersion", Build.VERSION.SDK_INT)
        json.put("manufacturer", Build.MANUFACTURER)
        json.put("model", Build.MODEL)

        // 3. currentActivity 상태
        val activity = appContext.currentActivity
        json.put("currentActivityNull", activity == null)
        if (activity != null) {
          json.put("activityClass", activity.javaClass.simpleName)
          json.put("activityFinishing", activity.isFinishing)
        }

        // 4. AppOpsManager 권한 (raw mode 값)
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
            val uid = android.os.Process.myUid()
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
              appOps.unsafeCheckOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, uid, ctx.packageName)
            } else {
              @Suppress("DEPRECATION")
              appOps.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, uid, ctx.packageName)
            }
            json.put("appOpsMode", mode)
            json.put("appOpsModeLabel", when(mode) {
              android.app.AppOpsManager.MODE_ALLOWED -> "ALLOWED(0)"
              android.app.AppOpsManager.MODE_IGNORED -> "IGNORED(1)"
              android.app.AppOpsManager.MODE_ERRORED -> "ERRORED(2)"
              android.app.AppOpsManager.MODE_DEFAULT -> "DEFAULT(3)"
              else -> "UNKNOWN($mode)"
            })
            json.put("uid", uid)
          }
        } catch (e: Exception) {
          json.put("appOpsError", "${e.javaClass.simpleName}: ${e.message}")
        }

        // 5. UsageStatsManager 실제 쿼리
        try {
          val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
          val now = System.currentTimeMillis()
          val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 86_400_000L, now)
          json.put("usageStatsNull", stats == null)
          json.put("usageStatsCount", stats?.size ?: -1)
          if (stats != null && stats.isNotEmpty()) {
            val sample = stats.take(3).map { "${it.packageName}(${it.totalTimeInForeground}ms)" }
            json.put("usageStatsSample", sample.joinToString(", "))
          }
        } catch (e: SecurityException) {
          json.put("usageStatsError", "SecurityException: ${e.message}")
        } catch (e: Exception) {
          json.put("usageStatsError", "${e.javaClass.simpleName}: ${e.message}")
        }

        // 6. queryEvents 테스트 (최근 1분)
        try {
          val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
          val now = System.currentTimeMillis()
          val events = usm.queryEvents(now - 60_000L, now)
          var eventCount = 0
          val event = UsageEvents.Event()
          while (events.hasNextEvent()) { events.getNextEvent(event); eventCount++ }
          json.put("recentEventsCount", eventCount)
        } catch (e: Exception) {
          json.put("recentEventsError", "${e.javaClass.simpleName}: ${e.message}")
        }

        // 7. hasUsageStatsPermission() 최종 결과
        json.put("hasPermResult", hasUsageStatsPermission(ctx))

        // 8. SharedPreferences (서비스 상태)
        try {
          val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
          json.put("svcRunning", prefs.getBoolean(AppMonitorService.KEY_IS_RUNNING, false))
          json.put("svcPkg", prefs.getString(AppMonitorService.KEY_CURRENT_PKG, null) ?: "null")
        } catch (e: Exception) {
          json.put("svcError", "${e.javaClass.simpleName}: ${e.message}")
        }

        // 9. Intent resolve 테스트
        try {
          val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
          val resolveInfo = ctx.packageManager.resolveActivity(intent, 0)
          json.put("settingsResolvable", resolveInfo != null)
          if (resolveInfo != null) {
            json.put("settingsTarget", "${resolveInfo.activityInfo.packageName}/${resolveInfo.activityInfo.name}")
          }
        } catch (e: Exception) {
          json.put("settingsResolveError", "${e.javaClass.simpleName}: ${e.message}")
        }

        promise.resolve(json.toString())
      } catch (e: Exception) {
        promise.resolve("{\"fatalError\":\"${e.javaClass.name}: ${e.message}\"}")
      }
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

    // ── 백그라운드 모니터링 시작 (권한 없으면 서비스 시작 안 함) ──
    AsyncFunction("startBackgroundMonitoring") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        if (!hasUsageStatsPermission(ctx)) {
          android.util.Log.w("ShortsDetox", "[SVC] startBgMonitoring 거부: 권한 없음")
          promise.resolve(false)
          return@AsyncFunction
        }
        val intent = Intent(ctx, AppMonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
        android.util.Log.d("ShortsDetox", "[SVC] startBgMonitoring 성공")
        promise.resolve(true)
      } catch (e: Exception) {
        android.util.Log.e("ShortsDetox", "[SVC] startBgMonitoring 실패: ${e.message}")
        promise.resolve(false)
      }
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

    // ── 현재 진행 중인 쇼츠 세션 조회 (JSON string | null) ──
    // KEY_SESSION_START > 0 이면 현재 쇼츠 앱 시청 중 (poll()에서 isShortsNow일 때만 non-zero)
    AsyncFunction("getLiveSession") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(null); return@AsyncFunction }
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        val isRunning = prefs.getBoolean(AppMonitorService.KEY_IS_RUNNING, false)
        if (!isRunning) { promise.resolve(null); return@AsyncFunction }
        val pkg = prefs.getString(AppMonitorService.KEY_CURRENT_PKG, null)
        val start = prefs.getLong(AppMonitorService.KEY_SESSION_START, 0L)
        if (pkg == null || start == 0L) { promise.resolve(null); return@AsyncFunction }
        val json = org.json.JSONObject().apply {
          put("pkg", pkg)
          put("startTime", start)
        }
        promise.resolve(json.toString())
      } catch (e: Exception) { promise.resolve(null) }
    }

    // ── 저장된 세션 조회 (Room DB → JSON string, JS 호환 포맷) ──
    AsyncFunction("getPendingSessions") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve("[]"); return@AsyncFunction }
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val sessions = AppDatabase.getInstance(ctx).getSessionsByDate(today)
        val arr = JSONArray()
        sessions.forEach { entity ->
          arr.put(JSONObject().apply {
            put("id", "bg-${entity.startTime}-${entity.id}")
            put("platform", entity.platform)
            put("startTime", entity.startTime)
            put("endTime", entity.endTime)
            put("durationMs", entity.durationMs)
            put("date", entity.date)
            put("scrollFrequency", 0.0)
            put("isAutoDetected", true)
          })
        }
        promise.resolve(arr.toString())
      } catch (e: Exception) { promise.resolve("[]") }
    }

    // ── Room DB 기반: id 중복 처리는 JS addSession에서 수행하므로 no-op ──
    AsyncFunction("clearPendingSessions") { promise: Promise ->
      promise.resolve(true)
    }

    // ── 날짜별 세션 조회 (JSON string) ──
    AsyncFunction("getSessionsByDate") { date: String, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve("[]"); return@AsyncFunction }
        val sessions = AppDatabase.getInstance(ctx).getSessionsByDate(date)
        val arr = JSONArray()
        sessions.forEach { entity ->
          arr.put(JSONObject().apply {
            put("id", "bg-${entity.startTime}-${entity.id}")
            put("platform", entity.platform)
            put("packageName", entity.packageName)
            put("startTime", entity.startTime)
            put("endTime", entity.endTime)
            put("durationMs", entity.durationMs)
            put("date", entity.date)
            put("isAutoDetected", entity.isAutoDetected)
          })
        }
        promise.resolve(arr.toString())
      } catch (e: Exception) { promise.resolve("[]") }
    }

    // ── 날짜별 총 사용시간 조회 (ms) ──
    AsyncFunction("getTotalDurationMs") { pkg: String, date: String, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(0L); return@AsyncFunction }
        val total = AppDatabase.getInstance(ctx).getTotalDurationMs(pkg, date)
        promise.resolve(total)
      } catch (e: Exception) { promise.resolve(0L) }
    }

    // ── VPN 차단 시작 (YouTube Shorts DNS 차단) ──
    AsyncFunction("startVpnBlocking") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val activity = appContext.currentActivity
        if (activity != null) {
          val vpnIntent = android.net.VpnService.prepare(ctx)
          if (vpnIntent != null) {
            // VPN 권한 동의 필요 → JS에서 IntentLauncher로 처리
            promise.resolve(false)
            return@AsyncFunction
          }
        }
        val intent = Intent(ctx, ShortsVpnService::class.java).apply {
          action = ShortsVpnService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent)
        else ctx.startService(intent)
        promise.resolve(true)
      } catch (e: Exception) {
        android.util.Log.e("ShortsDetox", "[VPN] startVpnBlocking error: ${e.message}")
        promise.resolve(false)
      }
    }

    // ── VPN 차단 중지 ──
    AsyncFunction("stopVpnBlocking") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val intent = Intent(ctx, ShortsVpnService::class.java).apply {
          action = ShortsVpnService.ACTION_STOP
        }
        ctx.startService(intent)
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── VPN 상태 확인 ──
    AsyncFunction("isVpnActive") { promise: Promise ->
      promise.resolve(ShortsVpnService.isRunning)
    }

    // ── 알림 임계값 설정 (네이티브 백그라운드 알림용) ──
    AsyncFunction("setAlertThreshold") { minutes: Int, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run { promise.resolve(false); return@AsyncFunction }
        val prefs = ctx.getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putLong(AppMonitorService.KEY_ALERT_THRESHOLD_MS, minutes * 60_000L).commit()
        promise.resolve(true)
      } catch (e: Exception) { promise.resolve(false) }
    }

    // ── 사용량 접근 설정 화면 열기 ──
    // 1차: Activity에서 앱별 딥링크 → 2차: Activity에서 전체 목록
    // 3차: Context + FLAG_ACTIVITY_NEW_TASK → 4차: 앱 정보 화면 fallback
    AsyncFunction("openUsageStatsSettings") { promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: run {
          android.util.Log.e("ShortsDetox", "[PERM] reactContext null")
          promise.resolve(false)
          return@AsyncFunction
        }

        val activity = appContext.currentActivity
        android.util.Log.d("ShortsDetox", "[PERM] openSettings: activity=${activity != null}, pkg=${ctx.packageName}")

        if (activity != null) {
          activity.runOnUiThread {
            try {
              // 1차: 앱별 딥링크
              val directIntent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                data = Uri.parse("package:${ctx.packageName}")
              }
              activity.startActivity(directIntent)
              android.util.Log.d("ShortsDetox", "[PERM] direct intent 성공")
              promise.resolve(true)
            } catch (e1: Exception) {
              android.util.Log.w("ShortsDetox", "[PERM] direct intent 실패: ${e1.message}")
              try {
                // 2차: 전체 목록
                activity.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                android.util.Log.d("ShortsDetox", "[PERM] list intent 성공")
                promise.resolve(true)
              } catch (e2: Exception) {
                android.util.Log.e("ShortsDetox", "[PERM] list intent도 실패: ${e2.message}")
                promise.resolve(false)
              }
            }
          }
        } else {
          android.util.Log.w("ShortsDetox", "[PERM] activity null, FLAG_ACTIVITY_NEW_TASK 시도")
          try {
            // 3차: Context + FLAG_ACTIVITY_NEW_TASK
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            android.util.Log.d("ShortsDetox", "[PERM] context intent 성공")
            promise.resolve(true)
          } catch (e: Exception) {
            android.util.Log.e("ShortsDetox", "[PERM] context intent 실패: ${e.message}")
            try {
              // 4차: 앱 정보 화면 fallback
              val appSettingsIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${ctx.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
              }
              ctx.startActivity(appSettingsIntent)
              android.util.Log.d("ShortsDetox", "[PERM] 앱 정보 fallback 성공")
              promise.resolve(true)
            } catch (e3: Exception) {
              android.util.Log.e("ShortsDetox", "[PERM] 모든 intent 실패: ${e3.message}")
              promise.resolve(false)
            }
          }
        }
      } catch (e: Exception) {
        android.util.Log.e("ShortsDetox", "[PERM] openUsageStatsSettings 전체 실패: ${e.message}")
        promise.resolve(false)
      }
    }

  }

  private fun hasUsageStatsPermission(context: Context): Boolean {
    val tag = "ShortsDetox"
    // 1차: 실제 UsageStats 데이터 조회 (OEM 관계없이 가장 신뢰성 높음)
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val now = System.currentTimeMillis()
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 86_400_000L, now)
      android.util.Log.d(tag, "[PERM-FN] queryUsageStats: null=${stats == null}, count=${stats?.size ?: -1}")
      if (stats != null && stats.isNotEmpty()) {
        android.util.Log.d(tag, "[PERM-FN] → TRUE (usageStats has data)")
        return true
      }
    } catch (e: SecurityException) {
      android.util.Log.w(tag, "[PERM-FN] SecurityException: ${e.message}")
      return false
    } catch (e: Exception) {
      android.util.Log.w(tag, "[PERM-FN] queryUsageStats error: ${e.javaClass.simpleName}: ${e.message}")
    }

    // 2차: AppOpsManager fallback
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
      val uid = android.os.Process.myUid()
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, uid, context.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, uid, context.packageName)
      }
      val result = mode == android.app.AppOpsManager.MODE_ALLOWED || mode == android.app.AppOpsManager.MODE_DEFAULT
      android.util.Log.d(tag, "[PERM-FN] AppOps: mode=$mode, uid=$uid, pkg=${context.packageName} → $result")
      result
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
