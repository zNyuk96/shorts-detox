package com.shortsdetox.appdetector.db

data class AppSessionEntity(
    val id: Long = 0,
    val packageName: String,
    val platform: String,
    val startTime: Long,
    val endTime: Long,
    val durationMs: Long,
    val date: String,
    val isAutoDetected: Boolean = true
)
