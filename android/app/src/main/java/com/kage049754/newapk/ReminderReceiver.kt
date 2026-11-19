package com.kage049754.newapk

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ReminderScheduler.ACTION_ALARM -> {
                val id = intent.getStringExtra(ReminderScheduler.EXTRA_ID) ?: return
                ReminderScheduler.handleAlarm(context, id)
            }
            ReminderScheduler.ACTION_SNOOZE -> ReminderScheduler.handleSnooze(context, intent)
            ReminderScheduler.ACTION_DISMISS -> ReminderScheduler.handleDismiss(context, intent)
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> ReminderScheduler.restore(context)
        }
    }
}
