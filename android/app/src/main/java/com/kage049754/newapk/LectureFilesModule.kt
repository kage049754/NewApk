package com.kage049754.newapk

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class LectureFilesModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context), ActivityEventListener {

    private var pendingPickerPromise: Promise? = null
    private val requestCode = 4817
    private val maximumFileBytes = 100L * 1024L * 1024L

    init {
        context.addActivityEventListener(this)
    }

    override fun getName(): String = "LectureFiles"

    @ReactMethod
    fun pickFile(promise: Promise) {
        if (pendingPickerPromise != null) {
            promise.reject("E_PICKER_BUSY", "A file picker is already open.")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "The file picker cannot open right now.")
            return
        }

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(
                Intent.EXTRA_MIME_TYPES,
                arrayOf(
                    "application/pdf",
                    "image/*",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.oasis.opendocument.text",
                    "application/vnd.oasis.opendocument.presentation",
                    "text/plain",
                    "text/rtf"
                )
            )
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }

        pendingPickerPromise = promise
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            pendingPickerPromise = null
            promise.reject("E_PICKER_LAUNCH", "Could not open the Android file picker.", error)
        }
    }

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != this.requestCode) return
        val promise = pendingPickerPromise ?: return
        pendingPickerPromise = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            promise.resolve(null)
            return
        }

        val sourceUri = data.data!!
        try {
            try {
                activity?.contentResolver?.takePersistableUriPermission(
                    sourceUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: SecurityException) {
                // The file is copied immediately, so a persistable grant is optional.
            }

            val resolver = context.contentResolver
            val displayName = queryDisplayName(sourceUri) ?: "lecture-file"
            val declaredSize = querySize(sourceUri)
            if (declaredSize != null && declaredSize > maximumFileBytes) {
                promise.reject("E_FILE_TOO_LARGE", "Files larger than 100 MB cannot be imported.")
                return
            }

            val folder = File(context.filesDir, "lecture_files")
            if (!folder.exists() && !folder.mkdirs()) {
                promise.reject("E_STORAGE", "Could not create private lecture-file storage.")
                return
            }

            val extension = displayName.substringAfterLast('.', "").takeIf { it.isNotBlank() }
                ?.filter { it.isLetterOrDigit() }
                ?.take(12)
            val destination = File(folder, UUID.randomUUID().toString() + (extension?.let { ".$it" } ?: ""))

            var copiedBytes = 0L
            try {
                val input = resolver.openInputStream(sourceUri)
                    ?: throw IllegalStateException("The selected file could not be read.")
                input.use { stream ->
                    FileOutputStream(destination).use { output ->
                        val buffer = ByteArray(16 * 1024)
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            copiedBytes += count
                            if (copiedBytes > maximumFileBytes) {
                                throw IllegalStateException("Files larger than 100 MB cannot be imported.")
                            }
                            output.write(buffer, 0, count)
                        }
                    }
                }
            } catch (error: Exception) {
                destination.delete()
                throw error
            }

            val mimeType = resolver.getType(sourceUri)
                ?: extension?.let { MimeTypeMap.getSingleton().getMimeTypeFromExtension(it.lowercase()) }
                ?: "application/octet-stream"
            val result = Arguments.createMap().apply {
                putString("name", displayName)
                putString("path", destination.absolutePath)
                putString("mimeType", mimeType)
                putDouble("sizeBytes", copiedBytes.toDouble())
            }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("E_FILE_IMPORT", error.message ?: "Could not import the selected file.", error)
        }
    }

    override fun onNewIntent(intent: Intent?) = Unit

    @ReactMethod
    fun openFile(path: String, promise: Promise) {
        try {
            val file = validatedPrivateFile(path)
            if (!file.exists() || !file.isFile) {
                promise.reject("E_FILE_MISSING", "The saved file is no longer available.")
                return
            }
            val extension = file.extension.lowercase()
            val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
                ?: "application/octet-stream"
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (intent.resolveActivity(context.packageManager) == null) {
                promise.reject("E_NO_VIEWER", "No installed app can open this file type.")
                return
            }
            context.startActivity(Intent.createChooser(intent, "Open lecture file").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("E_FILE_OPEN", error.message ?: "Could not open the saved file.", error)
        }
    }

    @ReactMethod
    fun deleteFile(path: String, promise: Promise) {
        try {
            val file = validatedPrivateFile(path)
            if (!file.exists()) {
                promise.resolve(false)
                return
            }
            promise.resolve(file.delete())
        } catch (error: Exception) {
            promise.reject("E_FILE_DELETE", error.message ?: "Could not delete the saved file.", error)
        }
    }

    private fun validatedPrivateFile(path: String): File {
        val root = File(context.filesDir, "lecture_files").canonicalFile
        val file = File(path).canonicalFile
        if (!file.path.startsWith(root.path + File.separator)) {
            throw SecurityException("The requested file is outside NewApk's private lecture storage.")
        }
        return file
    }

    private fun queryDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
            } else null
        } finally {
            cursor?.close()
        }
    }

    private fun querySize(uri: Uri): Long? {
        var cursor: Cursor? = null
        return try {
            cursor = context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (index >= 0 && !cursor.isNull(index)) cursor.getLong(index) else null
            } else null
        } finally {
            cursor?.close()
        }
    }
}
