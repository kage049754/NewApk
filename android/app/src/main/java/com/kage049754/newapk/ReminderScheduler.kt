package com.kage049754.newapk

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

internal data class ReminderEntry(
    val id: String,
    val rootId: String,
    val title: String,
    val body: String,
    val wallTime: String,
    val repeatWeekly: Boolean,
    val sound: Boolean,
    val vibrate: Boolean,
    val snoozeMinutes: Int
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("rootId", rootId)
        put("title", title)
        put("body", body)
        put("wallTime", wallTime)
        put("repeatWeekly", repeatWeekly)
        put("sound", sound)
        put("vibrate", vibrate)
        put("snoozeMinutes", snoozeMinutes)
    }

    companion object {
        fun fromJson(json: JSONObject): ReminderEntry {
            val id = json.optString("id")
            return ReminderEntry(
                id = id,
                rootId = json.optString("rootId", id),
                title = json.optString("title", "NewApk reminder"),
                body = json.optString("body", ""),
                wallTime = json.optString("wallTime", ""),
                repeatWeekly = json.optBoolean("repeatWeekly", false),
                sound = json.optBoolean("sound", true),
                vibrate = json.optBoolean("vibrate", true),
                snoozeMinutes = json.optInt("snoozeMinutes", 5).coerceIn(1, 60)
            )
        }
    }
}

internal object ReminderScheduler {
    const val ACTION_ALARM = "com.kage049754.newapk.REMINDER_ALARM"
    const val ACTION_SNOOZE = "com.kage049754.newapk.REMINDER_SNOOZE"
    const val ACTION_DISMISS = "com.kage049754.newapk.REMINDER_DISMISS"
    const val EXTRA_ID = "reminder_id"
    const val EXTRA_ROOT_ID = "reminder_root_id"
    const val EXTRA_TITLE = "reminder_title"
    const val EXTRA_BODY = "reminder_body"
    const val EXTRA_SOUND = "reminder_sound"
    const val EXTRA_VIBRATE = "reminder_vibrate"
    const val EXTRA_SNOOZE = "reminder_snooze"

    private const val PREFS_NAME = "newapk_reminder_store"
    private const val PREFS_ENTRIES = "entries"
    // Versioned IDs create fresh Android channels so existing installs receive alarm tones.
    private const val CHANNEL_SOUND_VIBRATE = "newapk_reminders_alarm_sound_vibrate_v2"
    private const val CHANNEL_SOUND = "newapk_reminders_alarm_sound_v2"
    private const val CHANNEL_VIBRATE = "newapk_reminders_alarm_vibrate_v2"
    private const val CHANNEL_SILENT = "newapk_reminders_alarm_silent_v2"

    fun replaceReminders(context: Context, payload: String, preserveSnoozes: Boolean) {
        val oldEntries = loadEntries(context)
        oldEntries.forEach { cancelAlarm(context, it.id) }

        val input = JSONArray(payload)
        val seen = HashSet<String>()
        val entries = mutableListOf<ReminderEntry>()
        val now = System.currentTimeMillis()
        for (index in 0 until input.length()) {
            val json = input.optJSONObject(index) ?: continue
            val entry = ReminderEntry.fromJson(json)
            if (entry.id.isBlank() || !seen.add(entry.id)) continue
            val normalized = normalizeEntry(entry, now) ?: continue
            entries.add(normalized)
        }

        val snoozes = if (preserveSnoozes) {
            oldEntries.asSequence()
                .filter { it.id.startsWith("snooze-") }
                .mapNotNull { normalizeEntry(it, now) }
                .toList()
        } else {
            emptyList()
        }
        val combinedEntries = (entries + snoozes).distinctBy { it.id }
        saveEntries(context, combinedEntries)
        createNotificationChannels(context)
        combinedEntries.forEach { scheduleAlarm(context, it) }
    }

    fun restore(context: Context) {
        val existing = loadEntries(context)
        existing.forEach { cancelAlarm(context, it.id) }
        val now = System.currentTimeMillis()
        val restored = existing.mapNotNull { normalizeEntry(it, now) }
        saveEntries(context, restored)
        createNotificationChannels(context)
        restored.forEach { scheduleAlarm(context, it) }
    }

    fun notificationPermissionAllowed(context: Context): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= 33) {
            return context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    fun exactAlarmAllowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return manager.canScheduleExactAlarms()
    }

    fun handleAlarm(context: Context, id: String) {
        val entries = loadEntries(context)
        val entry = entries.firstOrNull { it.id == id } ?: return
        if (entry.repeatWeekly) {
            val next = nextWeeklyWallTime(entry.wallTime) ?: return
            val updated = entry.copy(wallTime = next)
            val replaced = entries.map { if (it.id == id) updated else it }
            saveEntries(context, replaced)
            scheduleAlarm(context, updated)
        } else {
            saveEntries(context, entries.filterNot { it.id == id })
        }
        showNotification(context, entry)
    }

    fun handleSnooze(context: Context, intent: Intent) {
        val rootId = intent.getStringExtra(EXTRA_ROOT_ID) ?: return
        cancelNotification(context, rootId)
        val existingEntries = loadEntries(context)
        existingEntries.filter { it.rootId == rootId && it.id.startsWith("snooze-") }.forEach { cancelAlarm(context, it.id) }
        val entries = existingEntries.filterNot { it.rootId == rootId && it.id.startsWith("snooze-") }

        val snoozeMinutes = intent.getIntExtra(EXTRA_SNOOZE, 5).coerceIn(1, 60)
        val wallTime = formatWallTime(Date(System.currentTimeMillis() + snoozeMinutes * 60L * 1000L))
        val snooze = ReminderEntry(
            id = "snooze-" + UUID.randomUUID().toString(),
            rootId = rootId,
            title = intent.getStringExtra(EXTRA_TITLE) ?: "NewApk reminder",
            body = intent.getStringExtra(EXTRA_BODY) ?: "",
            wallTime = wallTime,
            repeatWeekly = false,
            sound = intent.getBooleanExtra(EXTRA_SOUND, true),
            vibrate = intent.getBooleanExtra(EXTRA_VIBRATE, true),
            snoozeMinutes = snoozeMinutes
        )
        val nextEntries = entries + snooze
        saveEntries(context, nextEntries)
        scheduleAlarm(context, snooze)
    }

    fun handleDismiss(context: Context, intent: Intent) {
        val rootId = intent.getStringExtra(EXTRA_ROOT_ID) ?: return
        cancelNotification(context, rootId)
        val entries = loadEntries(context)
        entries.filter { it.rootId == rootId && it.id.startsWith("snooze-") }.forEach { cancelAlarm(context, it.id) }
        saveEntries(context, entries.filterNot { it.rootId == rootId && it.id.startsWith("snooze-") })
    }

    private fun loadEntries(context: Context): List<ReminderEntry> {
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREFS_ENTRIES, "[]") ?: "[]"
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { ReminderEntry.fromJson(it) }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveEntries(context: Context, entries: List<ReminderEntry>) {
        val array = JSONArray()
        entries.forEach { array.put(it.toJson()) }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREFS_ENTRIES, array.toString())
            .apply()
    }

    private fun normalizeEntry(entry: ReminderEntry, now: Long): ReminderEntry? {
        var date = parseWallTime(entry.wallTime) ?: return null
        if (entry.repeatWeekly) {
            while (date.time <= now) {
                val calendar = Calendar.getInstance().apply { time = date; add(Calendar.DAY_OF_YEAR, 7) }
                date = calendar.time
            }
            return entry.copy(wallTime = formatWallTime(date))
        }
        return if (date.time > now) entry else null
    }

    private fun nextWeeklyWallTime(wallTime: String): String? {
        val date = parseWallTime(wallTime) ?: return null
        val calendar = Calendar.getInstance().apply { time = date; add(Calendar.DAY_OF_YEAR, 7) }
        val now = System.currentTimeMillis()
        while (calendar.timeInMillis <= now) calendar.add(Calendar.DAY_OF_YEAR, 7)
        return formatWallTime(calendar.time)
    }

    private fun parseWallTime(value: String): Date? {
        return try {
            val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).apply {
                isLenient = false
                timeZone = TimeZone.getDefault()
            }
            formatter.parse(value)
        } catch (_: Exception) {
            null
        }
    }

    private fun formatWallTime(date: Date): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).apply {
            timeZone = TimeZone.getDefault()
        }.format(date)
    }

    private fun scheduleAlarm(context: Context, entry: ReminderEntry) {
        val time = parseWallTime(entry.wallTime)?.time ?: return
        if (time <= System.currentTimeMillis()) return
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_ALARM
            putExtra(EXTRA_ID, entry.id)
        }
        val operation = PendingIntent.getBroadcast(
            context,
            requestCode(entry.id),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.canScheduleExactAlarms()) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation)
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation)
        }
    }

    private fun cancelAlarm(context: Context, id: String) {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_ALARM
            putExtra(EXTRA_ID, id)
        }
        val operation = PendingIntent.getBroadcast(
            context,
            requestCode(id),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        ) ?: return
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        manager.cancel(operation)
        operation.cancel()
    }

    private fun requestCode(value: String): Int {
        val code = value.hashCode() and 0x7fffffff
        return if (code == 0) 1 else code
    }

    private fun notificationId(rootId: String): Int = requestCode(rootId)

    private fun cancelNotification(context: Context, rootId: String) {
        NotificationManagerCompat.from(context).cancel(notificationId(rootId))
    }

    private fun channelId(entry: ReminderEntry): String {
        return when {
            entry.sound && entry.vibrate -> CHANNEL_SOUND_VIBRATE
            entry.sound -> CHANNEL_SOUND
            entry.vibrate -> CHANNEL_VIBRATE
            else -> CHANNEL_SILENT
        }
    }

    private fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val definitions = listOf(
            Triple(CHANNEL_SOUND_VIBRATE, "Reminders: sound and vibration", true to true),
            Triple(CHANNEL_SOUND, "Reminders: sound only", true to false),
            Triple(CHANNEL_VIBRATE, "Reminders: vibration only", false to true),
            Triple(CHANNEL_SILENT, "Reminders: silent", false to false)
        )
        definitions.forEach { definition ->
            if (manager.getNotificationChannel(definition.first) == null) {
                val sound = definition.third.first
                val vibrate = definition.third.second
                val channel = NotificationChannel(definition.first, definition.second, NotificationManager.IMPORTANCE_HIGH).apply {
                    enableVibration(vibrate)
                    vibrationPattern = if (vibrate) longArrayOf(0, 250, 120, 250) else null
                    setSound(if (sound) soundUri else null, audioAttributes)
                    description = "Local class, task and activity reminders"
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun showNotification(context: Context, entry: ReminderEntry) {
        if (!notificationPermissionAllowed(context)) return
        createNotificationChannels(context)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("newapk_open_reminders", true)
        }
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context,
                requestCode(entry.rootId + ":open"),
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val snoozeIntent = actionIntent(context, ACTION_SNOOZE, entry)
        val dismissIntent = actionIntent(context, ACTION_DISMISS, entry)
        val builder = NotificationCompat.Builder(context, channelId(entry))
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(entry.title)
            .setContentText(entry.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(entry.body))
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setCategory("alarm")
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze", snoozeIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissIntent)

        if (contentIntent != null) builder.setContentIntent(contentIntent)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            var defaults = 0
            if (entry.sound) defaults = defaults or android.app.Notification.DEFAULT_SOUND
            if (entry.vibrate) defaults = defaults or android.app.Notification.DEFAULT_VIBRATE
            builder.setDefaults(defaults)
        }

        try {
            NotificationManagerCompat.from(context).notify(notificationId(entry.rootId), builder.build())
        } catch (_: SecurityException) {
            // The notification permission may have been revoked after the alarm was scheduled.
        }
    }

    private fun actionIntent(context: Context, action: String, entry: ReminderEntry): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_ROOT_ID, entry.rootId)
            putExtra(EXTRA_TITLE, entry.title)
            putExtra(EXTRA_BODY, entry.body)
            putExtra(EXTRA_SOUND, entry.sound)
            putExtra(EXTRA_VIBRATE, entry.vibrate)
            putExtra(EXTRA_SNOOZE, entry.snoozeMinutes)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode(entry.rootId + ":" + action),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
