package space.manus.shorts.detox.appdetector

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.SharedPreferences
import android.view.accessibility.AccessibilityEvent

class ShortsScrollService : AccessibilityService() {

    private lateinit var prefs: SharedPreferences
    private var lastScrollTime = 0L

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(AppMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return
        val now = System.currentTimeMillis()
        if (now - lastScrollTime < 300L) return
        lastScrollTime = now
        val count = prefs.getInt(AppMonitorService.KEY_SCROLL_COUNT, 0)
        prefs.edit().putInt(AppMonitorService.KEY_SCROLL_COUNT, count + 1).apply()
    }

    override fun onInterrupt() {}

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_VIEW_SCROLLED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 300
            packageNames = AppMonitorService.SHORTS_PACKAGES.toTypedArray()
        }
    }
}
