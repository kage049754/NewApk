package com.kage049754.newapk

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BackupModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), ActivityEventListener {

    private var pendingPromise: Promise? = null
    private var pendingJson: String? = null
    private var pendingMode: String? = null
    private val requestCode = 4820
    private val maximumImportBytes = 20L * 1024L * 1024L

    init { context.addActivityEventListener(this) }

    override fun getName(): String = "LocalBackup"

    @ReactMethod
    fun saveBackup(json: String, promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("E_BACKUP_BUSY", "Another backup document operation is already open.")
            return
        }
        if (json.toByteArray(Charsets.UTF_8).size > maximumImportBytes) {
            promise.reject("E_BACKUP_TOO_LARGE", "The JSON backup is larger than 20 MB.")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "The Android document picker cannot open right now.")
            return
        }
        val stamp = SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(Date())
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "NewApk_Backup_$stamp.json")
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
        pendingPromise = promise
        pendingJson = json
        pendingMode = "save"
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            clearPending()
            promise.reject("E_BACKUP_PICKER", "Could not open the save-location picker.", error)
        }
    }

    @ReactMethod
    fun pickBackup(promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("E_BACKUP_BUSY", "Another backup document operation is already open.")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "The Android document picker cannot open right now.")
            return
        }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "text/plain"))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        pendingPromise = promise
        pendingMode = "pick"
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            clearPending()
            promise.reject("E_BACKUP_PICKER", "Could not open the backup file picker.", error)
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != this.requestCode) return
        val promise = pendingPromise ?: return
        val mode = pendingMode
        val json = pendingJson
        clearPending()
        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            promise.resolve(null)
            return
        }

        val uri: Uri = data.data!!
        try {
            when (mode) {
                "save" -> {
                    val payload = json ?: throw IllegalStateException("Backup content is unavailable.")
                    val output = context.contentResolver.openOutputStream(uri, "wt")
                        ?: throw IllegalStateException("Could not write to the selected location.")
                    output.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                    promise.resolve(uri.toString())
                }
                "pick" -> {
                    val input = context.contentResolver.openInputStream(uri)
                        ?: throw IllegalStateException("The selected backup file cannot be read.")
                    val bytes = ByteArrayOutputStream()
                    input.use { stream ->
                        val buffer = ByteArray(8192)
                        var total = 0L
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            total += count
                            if (total > maximumImportBytes) {
                                throw IllegalStateException("Backup files larger than 20 MB are not supported.")
                            }
                            bytes.write(buffer, 0, count)
                        }
                    }
                    promise.resolve(bytes.toString(Charsets.UTF_8.name()))
                }
                else -> promise.reject("E_BACKUP_STATE", "The backup operation state is invalid.")
            }
        } catch (error: Exception) {
            promise.reject("E_BACKUP_IO", error.message ?: "The backup document could not be processed.", error)
        }
    }

    override fun onNewIntent(intent: Intent?) = Unit

    private fun clearPending() {
        pendingPromise = null
        pendingJson = null
        pendingMode = null
    }
}
