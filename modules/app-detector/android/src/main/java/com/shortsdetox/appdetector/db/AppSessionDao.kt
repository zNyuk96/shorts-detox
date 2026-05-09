package com.shortsdetox.appdetector.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface AppSessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: AppSessionEntity): Long

    @Query("SELECT * FROM app_sessions WHERE date = :date ORDER BY startTime DESC")
    suspend fun getSessionsByDate(date: String): List<AppSessionEntity>

    @Query("SELECT * FROM app_sessions WHERE packageName = :pkg AND date = :date ORDER BY startTime DESC")
    suspend fun getSessionsByPackageAndDate(pkg: String, date: String): List<AppSessionEntity>

    @Query("SELECT COALESCE(SUM(durationMs), 0) FROM app_sessions WHERE packageName = :pkg AND date = :date")
    suspend fun getTotalDurationMs(pkg: String, date: String): Long

    @Query("SELECT COALESCE(SUM(durationMs), 0) FROM app_sessions WHERE date = :date")
    suspend fun getTotalDurationMsForDate(date: String): Long

    @Query("SELECT * FROM app_sessions WHERE date >= :fromDate ORDER BY date DESC, startTime DESC")
    suspend fun getSessionsFrom(fromDate: String): List<AppSessionEntity>

    @Query("DELETE FROM app_sessions WHERE date < :cutoffDate")
    suspend fun deleteOlderThan(cutoffDate: String)
}
