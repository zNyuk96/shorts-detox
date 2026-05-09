package com.shortsdetox.appdetector.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "app_sessions",
    indices = [Index(value = ["date"]), Index(value = ["packageName", "date"])]
)
data class AppSessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val packageName: String,
    val platform: String,
    val startTime: Long,
    val endTime: Long,
    val durationMs: Long,
    val date: String,
    val isAutoDetected: Boolean = true
)
