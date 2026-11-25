package com.jaiz.jivanos

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.dropbox.core.v2.files.FileMetadata
import com.dropbox.core.v2.files.GetMetadataErrorException
import com.dropbox.core.v2.files.DownloadErrorException
import com.dropbox.core.v2.files.WriteMode
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

data class DropboxSyncInfo(
    val lastModified: String,
    val fileSizeBytes: Long
)

data class DropboxRestoreResult(
    val found: Boolean,
    val content: String,
    val lastModified: String,
    val fileSizeBytes: Long
)

/**
 * Phase 4 — Dropbox Sync Provider for JivanOS.
 *
 * Because the Dropbox app uses "App folder" access type, Dropbox automatically
 * sandboxes all API paths to /Apps/JivanOS/. Therefore BACKUP_FILE_PATH = "/backup.json"
 * reads and writes /Apps/JivanOS/backup.json exclusively.
 */
object DropboxSyncProvider {

    const val BACKUP_FILE_PATH: String = "/backup.json"
    const val UNIQUE_WORK_NAME: String = "jivanos_dropbox_auto_sync"
    const val CACHED_ENVELOPE_FILE: String = "dropbox-pending-backup.json"

    private const val META_PREFS_NAME = "jivanos_dropbox_sync_meta"
    private const val KEY_LAST_MODIFIED = "last_modified_iso"
    private const val KEY_LAST_SIZE = "last_size_bytes"
    private const val KEY_AUTO_INTERVAL = "auto_sync_interval_minutes"

    private fun formatIsoUtc(date: Date?): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(date ?: Date())
    }

    /**
     * Upload and overwrite /Apps/JivanOS/backup.json.
     */
    @Throws(Exception::class)
    fun backupToDropbox(context: Context, payloadJson: String): DropboxSyncInfo {
        val bytes = payloadJson.toByteArray(StandardCharsets.UTF_8)
        cacheLocalPayloadForBackgroundSync(context, payloadJson)

        val client = DropboxAuth.createAuthenticatedClient(context)
        val metadata: FileMetadata = ByteArrayInputStream(bytes).use { stream ->
            client.files()
                .uploadBuilder(BACKUP_FILE_PATH)
                .withMode(WriteMode.OVERWRITE)
                .withMute(true)
                .uploadAndFinish(stream)
        }

        val lastModified = formatIsoUtc(metadata.serverModified ?: metadata.clientModified)
        val sizeBytes = if (metadata.size > 0L) metadata.size else bytes.size.toLong()
        saveSyncMetadata(context, lastModified, sizeBytes)
        return DropboxSyncInfo(lastModified = lastModified, fileSizeBytes = sizeBytes)
    }

    /**
     * Download /Apps/JivanOS/backup.json and return raw JSON envelope + metadata.
     */
    @Throws(Exception::class)
    fun restoreFromDropbox(context: Context): DropboxRestoreResult {
        val client = DropboxAuth.createAuthenticatedClient(context)
        return try {
            val output = ByteArrayOutputStream()
            val metadata: FileMetadata = client.files()
                .downloadBuilder(BACKUP_FILE_PATH)
                .download(output)
            val content = output.toString(StandardCharsets.UTF_8.name())
            val lastModified = formatIsoUtc(metadata.serverModified ?: metadata.clientModified)
            val sizeBytes = if (metadata.size > 0L) metadata.size else content.toByteArray(StandardCharsets.UTF_8).size.toLong()
            saveSyncMetadata(context, lastModified, sizeBytes)
            DropboxRestoreResult(
                found = true,
                content = content,
                lastModified = lastModified,
                fileSizeBytes = sizeBytes
            )
        } catch (e: DownloadErrorException) {
            if (e.errorValue?.isPath == true && e.errorValue.pathValue?.isNotFound == true) {
                DropboxRestoreResult(found = false, content = "", lastModified = "", fileSizeBytes = 0L)
            } else {
                throw e
            }
        }
    }

    /**
     * Inspect remote /Apps/JivanOS/backup.json metadata without downloading full content.
     * Returns null if backup.json does not exist yet.
     */
    @Throws(Exception::class)
    fun getLastSyncInfo(context: Context): DropboxSyncInfo? {
        if (!DropboxAuth.hasStoredTokens(context)) return null
        val client = DropboxAuth.createAuthenticatedClient(context)
        return try {
            val meta = client.files().getMetadata(BACKUP_FILE_PATH)
            if (meta is FileMetadata) {
                val lastModified = formatIsoUtc(meta.serverModified ?: meta.clientModified)
                saveSyncMetadata(context, lastModified, meta.size)
                DropboxSyncInfo(lastModified = lastModified, fileSizeBytes = meta.size)
            } else {
                null
            }
        } catch (e: GetMetadataErrorException) {
            if (e.errorValue?.isPath == true && e.errorValue.pathValue?.isNotFound == true) {
                null
            } else {
                throw e
            }
        }
    }

    fun getCachedSyncInfo(context: Context): DropboxSyncInfo? {
        val prefs = context.getSharedPreferences(META_PREFS_NAME, Context.MODE_PRIVATE)
        val lastModified = prefs.getString(KEY_LAST_MODIFIED, "") ?: ""
        val sizeBytes = prefs.getLong(KEY_LAST_SIZE, 0L)
        return if (lastModified.isNotEmpty()) {
            DropboxSyncInfo(lastModified = lastModified, fileSizeBytes = sizeBytes)
        } else {
            null
        }
    }

    /**
     * Schedule or cancel periodic WorkManager background sync.
     * intervalMinutes <= 0 cancels background sync (Manual mode).
     */
    fun autoSync(context: Context, intervalMinutes: Int) {
        try {
            val prefs = context.getSharedPreferences(META_PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putInt(KEY_AUTO_INTERVAL, intervalMinutes).apply()

            val workManager = WorkManager.getInstance(context.applicationContext)
            if (intervalMinutes <= 0) {
                workManager.cancelUniqueWork(UNIQUE_WORK_NAME)
                return
            }

            val clampedMinutes = maxOf(15L, intervalMinutes.toLong())
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<DropboxAutoSyncWorker>(
                clampedMinutes,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            workManager.enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        } catch (_: Throwable) {
        }
    }

    fun cacheLocalPayloadForBackgroundSync(context: Context, payloadJson: String) {
        try {
            val tmp = File(context.filesDir, "$CACHED_ENVELOPE_FILE.tmp")
            val target = File(context.filesDir, CACHED_ENVELOPE_FILE)
            FileOutputStream(tmp).use { fos ->
                fos.write(payloadJson.toByteArray(StandardCharsets.UTF_8))
                fos.flush()
            }
            if (target.exists()) target.delete()
            tmp.renameTo(target)
        } catch (_: Throwable) {
            // Never interrupt UI on background cache error
        }
    }

    fun clearAllLocalState(context: Context) {
        try {
            WorkManager.getInstance(context.applicationContext).cancelUniqueWork(UNIQUE_WORK_NAME)
        } catch (_: Throwable) {}
        try {
            val cached = File(context.filesDir, CACHED_ENVELOPE_FILE)
            if (cached.exists()) cached.delete()
        } catch (_: Throwable) {}
        try {
            context.getSharedPreferences(META_PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        } catch (_: Throwable) {}
    }

    private fun saveSyncMetadata(context: Context, lastModifiedIso: String, sizeBytes: Long) {
        try {
            context.getSharedPreferences(META_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LAST_MODIFIED, lastModifiedIso)
                .putLong(KEY_LAST_SIZE, sizeBytes)
                .apply()
        } catch (_: Throwable) {}
    }
}

/**
 * Android WorkManager periodic worker that silently backs up the latest cached
 * JivanOS envelope to /Apps/JivanOS/backup.json when network is available.
 */
class DropboxAutoSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        return try {
            if (!DropboxAuth.hasStoredTokens(applicationContext)) {
                return Result.success()
            }
            val cachedFile = File(applicationContext.filesDir, DropboxSyncProvider.CACHED_ENVELOPE_FILE)
            if (!cachedFile.exists() || cachedFile.length() == 0L) {
                return Result.success()
            }
            val payloadJson = cachedFile.readText(StandardCharsets.UTF_8)
            if (payloadJson.isBlank()) {
                Result.success()
            } else {
                DropboxSyncProvider.backupToDropbox(applicationContext, payloadJson)
                Result.success()
            }
        } catch (_: Throwable) {
            Result.retry()
        }
    }
}

/**
 * Capacitor Plugin exposing DropboxAuth & DropboxSyncProvider to the JivanOS WebView.
 */
@CapacitorPlugin(name = "JivanDropbox")
class JivanDropboxPlugin : Plugin() {

    private val ioExecutor = Executors.newSingleThreadExecutor()

    @Volatile
    private var awaitingAuthResume = false

    @Volatile
    private var pendingConnectCall: PluginCall? = null

    private fun toAccountJSObject(info: DropboxAccountInfo?): JSObject {
        val ret = JSObject()
        val connected = info?.connected == true
        ret.put("connected", connected)
        if (connected && info != null) {
            ret.put("name", info.name)
            ret.put("email", info.email)
            ret.put("initials", info.initials)
        }
        return ret
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val ctx = context
        try {
            if (DropboxAuth.hasStoredTokens(ctx)) {
                ioExecutor.execute {
                    try {
                        val existing = DropboxAuth.silentReAuth(ctx)
                        if (existing?.connected == true) {
                            call.resolve(toAccountJSObject(existing))
                        } else {
                            launchPkceFlow(call)
                        }
                    } catch (_: Throwable) {
                        launchPkceFlow(call)
                    }
                }
                return
            }
            launchPkceFlow(call)
        } catch (t: Throwable) {
            call.reject("Failed to start Dropbox connection: ${t.message}")
        }
    }

    private fun launchPkceFlow(call: PluginCall) {
        val act = activity
        if (act == null) {
            call.reject("Activity unavailable to start Dropbox sign-in.")
            return
        }
        pendingConnectCall = call
        awaitingAuthResume = true
        act.runOnUiThread {
            try {
                DropboxAuth.startPkceAuth(act)
            } catch (e: Throwable) {
                awaitingAuthResume = false
                pendingConnectCall = null
                call.reject("Failed to launch Dropbox sign-in: ${e.message}")
            }
        }
    }

    override fun handleOnResume() {
        super.handleOnResume()
        if (!awaitingAuthResume) return
        awaitingAuthResume = false
        val call = pendingConnectCall ?: return
        pendingConnectCall = null

        val ctx = context
        ioExecutor.execute {
            try {
                val account = DropboxAuth.completePendingAuthFromResume(ctx)
                if (account?.connected == true) {
                    call.resolve(toAccountJSObject(account))
                } else {
                    call.reject("Dropbox authorization was cancelled.")
                }
            } catch (e: Throwable) {
                call.reject("Dropbox sign-in failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun silentReAuth(call: PluginCall) {
        val ctx = context
        ioExecutor.execute {
            try {
                val account = DropboxAuth.silentReAuth(ctx)
                call.resolve(toAccountJSObject(account))
            } catch (_: Throwable) {
                call.resolve(toAccountJSObject(null))
            }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        val ctx = context
        ioExecutor.execute {
            try {
                DropboxSyncProvider.clearAllLocalState(ctx)
                DropboxAuth.disconnect(ctx)
            } catch (_: Throwable) {
            }
            val ret = JSObject()
            ret.put("disconnected", true)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun backupToDropbox(call: PluginCall) {
        val payloadJson = call.getString("payloadJson", "") ?: ""
        if (payloadJson.isBlank()) {
            call.reject("Backup payload is empty.")
            return
        }
        val ctx = context
        ioExecutor.execute {
            try {
                val info = DropboxSyncProvider.backupToDropbox(ctx, payloadJson)
                val ret = JSObject()
                ret.put("success", true)
                ret.put("lastModified", info.lastModified)
                ret.put("fileSizeBytes", info.fileSizeBytes)
                call.resolve(ret)
            } catch (e: Throwable) {
                call.reject("Dropbox backup failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun restoreFromDropbox(call: PluginCall) {
        val ctx = context
        ioExecutor.execute {
            try {
                val res = DropboxSyncProvider.restoreFromDropbox(ctx)
                val ret = JSObject()
                ret.put("found", res.found)
                ret.put("content", res.content)
                ret.put("lastModified", res.lastModified)
                ret.put("fileSizeBytes", res.fileSizeBytes)
                call.resolve(ret)
            } catch (e: Throwable) {
                call.reject("Dropbox restore failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getLastSyncInfo(call: PluginCall) {
        val ctx = context
        ioExecutor.execute {
            try {
                val info = DropboxSyncProvider.getLastSyncInfo(ctx)
                val ret = JSObject()
                if (info == null) {
                    ret.put("exists", false)
                } else {
                    ret.put("exists", true)
                    ret.put("lastModified", info.lastModified)
                    ret.put("fileSizeBytes", info.fileSizeBytes)
                }
                call.resolve(ret)
            } catch (_: Throwable) {
                val cached = try {
                    DropboxSyncProvider.getCachedSyncInfo(ctx)
                } catch (_: Throwable) {
                    null
                }
                val ret = JSObject()
                if (cached != null) {
                    ret.put("exists", true)
                    ret.put("lastModified", cached.lastModified)
                    ret.put("fileSizeBytes", cached.fileSizeBytes)
                } else {
                    ret.put("exists", false)
                }
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun scheduleAutoSync(call: PluginCall) {
        val intervalMinutes = call.getInt("intervalMinutes", 0) ?: 0
        try {
            DropboxSyncProvider.autoSync(context, intervalMinutes)
        } catch (_: Throwable) {
        }
        val ret = JSObject()
        ret.put("scheduled", intervalMinutes > 0)
        ret.put("intervalMinutes", intervalMinutes)
        call.resolve(ret)
    }

    @PluginMethod
    fun cacheLocalPayloadForBackgroundSync(call: PluginCall) {
        val payloadJson = call.getString("payloadJson", "") ?: ""
        if (payloadJson.isNotBlank()) {
            ioExecutor.execute {
                try {
                    DropboxSyncProvider.cacheLocalPayloadForBackgroundSync(context, payloadJson)
                } catch (_: Throwable) {
                }
            }
        }
        val ret = JSObject()
        ret.put("cached", true)
        call.resolve(ret)
    }
}
