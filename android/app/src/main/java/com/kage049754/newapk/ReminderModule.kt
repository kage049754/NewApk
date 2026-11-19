package com.kage049754.newapk

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ReminderModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName(): String = "Reminders"

    @ReactMethod
    fun replaceReminders(payload: String, promise: Promise) {
        try {
            ReminderScheduler.replaceReminders(context, payload)
            promise.resolve(statusMap())
        } catch (error: Exception) {
            promise.reject("E_REMINDER_SCHEDULE", error.message ?: "Could not schedule reminders.", error)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(statusMap())
    }

    @ReactMethod
    fun openExactAlarmSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !ReminderScheduler.exactAlarmAllowed(context)) {
                val request = Intent(
                    Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + context.packageName)
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(request)
            }
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("E_EXACT_ALARM_SETTINGS", error.message ?: "Could not open exact-alarm settings.", error)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("E_NOTIFICATION_SETTINGS", error.message ?: "Could not open notification settings.", error)
        }
    }

    private fun statusMap() = Arguments.createMap().apply {
        putBoolean("notificationsEnabled", ReminderScheduler.notificationPermissionAllowed(context))
        putBoolean("exactAlarmAllowed", ReminderScheduler.exactAlarmAllowed(context))
    }
}
