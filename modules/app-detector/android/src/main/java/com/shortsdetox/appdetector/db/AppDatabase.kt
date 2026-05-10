package com.shortsdetox.appdetector.db

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AppDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "shorts_detox.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS app_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                packageName TEXT NOT NULL,
                platform TEXT NOT NULL,
                startTime INTEGER NOT NULL,
                endTime INTEGER NOT NULL,
                durationMs INTEGER NOT NULL,
                date TEXT NOT NULL,
                isAutoDetected INTEGER NOT NULL DEFAULT 1
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_date ON app_sessions(date)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pkg_date ON app_sessions(packageName, date)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    fun insert(entity: AppSessionEntity): Long {
        val values = ContentValues().apply {
            put("packageName", entity.packageName)
            put("platform", entity.platform)
            put("startTime", entity.startTime)
            put("endTime", entity.endTime)
            put("durationMs", entity.durationMs)
            put("date", entity.date)
            put("isAutoDetected", if (entity.isAutoDetected) 1 else 0)
        }
        return writableDatabase.insertOrThrow("app_sessions", null, values)
    }

    fun getSessionsByDate(date: String): List<AppSessionEntity> {
        val result = mutableListOf<AppSessionEntity>()
        readableDatabase.rawQuery(
            "SELECT * FROM app_sessions WHERE date = ? ORDER BY startTime DESC",
            arrayOf(date)
        ).use { cursor -> while (cursor.moveToNext()) result.add(cursor.toEntity()) }
        return result
    }

    fun getTotalDurationMs(pkg: String, date: String): Long {
        readableDatabase.rawQuery(
            "SELECT COALESCE(SUM(durationMs), 0) FROM app_sessions WHERE packageName = ? AND date = ?",
            arrayOf(pkg, date)
        ).use { cursor -> return if (cursor.moveToFirst()) cursor.getLong(0) else 0L }
    }

    private fun Cursor.toEntity() = AppSessionEntity(
        id = getLong(getColumnIndexOrThrow("id")),
        packageName = getString(getColumnIndexOrThrow("packageName")),
        platform = getString(getColumnIndexOrThrow("platform")),
        startTime = getLong(getColumnIndexOrThrow("startTime")),
        endTime = getLong(getColumnIndexOrThrow("endTime")),
        durationMs = getLong(getColumnIndexOrThrow("durationMs")),
        date = getString(getColumnIndexOrThrow("date")),
        isAutoDetected = getInt(getColumnIndexOrThrow("isAutoDetected")) == 1
    )

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: AppDatabase(context).also { INSTANCE = it }
            }
    }
}
