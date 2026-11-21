package com.jaiz.jivanos

import android.content.Context
import androidx.work.WorkManager
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * Shared Cross-Platform SyncProvider Contract — Android (Kotlin)
 *
 * Mirrors `/src/sync/SyncProvider.ts` method-for-method so Android, Web, Desktop,
 * and future iOS implementations share the exact same sync contract and backup.json schema.
 */
data class SyncInfo(
    val lastModified: String,
    val fileSizeBytes: Long
)

data class SyncRestoreResult(
    val found: Boolean,
    val content: String,
    val lastModified: String,
    val fileSizeBytes: Long
)

interface SyncProvider {
    val providerId: String

    suspend fun backup(data: String): SyncInfo
    suspend fun restore(): SyncRestoreResult
    fun isConnected(): Boolean
    suspend fun disconnect()
    suspend fun getLastSyncInfo(): SyncInfo?
}

/**
 * Runs blocking native SDK I/O off the main thread using Kotlin stdlib coroutines
 * (no extra kotlinx-coroutines Gradle dependencies required).
 */
private object SyncIoDispatcher {
    private val executor = Executors.newCachedThreadPool()

    suspend fun <T> runIo(block: () -> T): T = suspendCoroutine { cont ->
        executor.execute {
            try {
                cont.resume(block())
            } catch (t: Throwable) {
                cont.resumeWithException(t)
            }
        }
    }
}

/**
 * Native Android Dropbox implementation of SyncProvider.
 * Uses Dropbox Android SDK + EncryptedSharedPreferences via DropboxAuth & DropboxSyncProvider.
 */
class AndroidDropboxSyncProvider(private val context: Context) : SyncProvider {
    override val providerId: String = "dropbox"

    override suspend fun backup(data: String): SyncInfo = SyncIoDispatcher.runIo {
        val result = DropboxSyncProvider.backupToDropbox(context, data)
        SyncInfo(lastModified = result.lastModified, fileSizeBytes = result.fileSizeBytes)
    }

    override suspend fun restore(): SyncRestoreResult = SyncIoDispatcher.runIo {
        val result = DropboxSyncProvider.restoreFromDropbox(context)
        SyncRestoreResult(
            found = result.found,
            content = result.content,
            lastModified = result.lastModified,
            fileSizeBytes = result.fileSizeBytes
        )
    }

    override fun isConnected(): Boolean = DropboxAuth.hasStoredTokens(context)

    override suspend fun disconnect() = SyncIoDispatcher.runIo {
        DropboxSyncProvider.clearAllLocalState(context)
        DropboxAuth.disconnect(context)
    }

    override suspend fun getLastSyncInfo(): SyncInfo? = SyncIoDispatcher.runIo {
        val info = DropboxSyncProvider.getLastSyncInfo(context) ?: return@runIo null
        SyncInfo(lastModified = info.lastModified, fileSizeBytes = info.fileSizeBytes)
    }
}

/**
 * Native Android Google Drive (appDataFolder) implementation of SyncProvider.
 * Delegates to Google Sign-In SDK + JivanDriveAppDataClient.
 */
class AndroidGoogleDriveSyncProvider(private val context: Context) : SyncProvider {
    override val providerId: String = "gdrive"

    override suspend fun backup(data: String): SyncInfo = SyncIoDispatcher.runIo {
        val account = GoogleSignIn.getLastSignedInAccount(context)
            ?: throw IllegalStateException("Google Drive is not connected.")
        val token = JivanDriveAppDataClient.acquireAccessToken(context, account)
        val result = JivanDriveAppDataClient.uploadBackup(context, token, data)
        SyncInfo(lastModified = result.lastModified, fileSizeBytes = result.fileSizeBytes)
    }

    override suspend fun restore(): SyncRestoreResult = SyncIoDispatcher.runIo {
        val account = GoogleSignIn.getLastSignedInAccount(context)
            ?: throw IllegalStateException("Google Drive is not connected.")
        val token = JivanDriveAppDataClient.acquireAccessToken(context, account)
        val result = JivanDriveAppDataClient.downloadBackup(context, token)
        SyncRestoreResult(
            found = result.found,
            content = result.content ?: "",
            lastModified = result.lastModified ?: "",
            fileSizeBytes = result.fileSizeBytes
        )
    }

    override fun isConnected(): Boolean {
        val account = GoogleSignIn.getLastSignedInAccount(context) ?: return false
        return GoogleSignIn.hasPermissions(account, Scope(JivanDriveAppDataClient.DRIVE_APPDATA_SCOPE))
    }

    override suspend fun disconnect() = SyncIoDispatcher.runIo {
        val account = GoogleSignIn.getLastSignedInAccount(context)
        WorkManager.getInstance(context.applicationContext)
            .cancelUniqueWork(JivanDriveSyncWorker.UNIQUE_WORK_NAME)
        if (account != null) {
            JivanDriveAppDataClient.clearCachedToken(context, account)
        }
        JivanDriveAppDataClient.clearSyncMetadata(context)
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(JivanDriveAppDataClient.DRIVE_APPDATA_SCOPE))
            .build()
        val client = GoogleSignIn.getClient(context, gso)
        Tasks.await(client.signOut())
    }

    override suspend fun getLastSyncInfo(): SyncInfo? = SyncIoDispatcher.runIo {
        val account = GoogleSignIn.getLastSignedInAccount(context) ?: return@runIo null
        val token = JivanDriveAppDataClient.acquireAccessToken(context, account)
        val info = JivanDriveAppDataClient.findBackupFile(token) ?: return@runIo null
        SyncInfo(lastModified = info.lastModified, fileSizeBytes = info.fileSizeBytes)
    }
}
