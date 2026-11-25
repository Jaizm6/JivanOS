package com.jaiz.jivanos

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.dropbox.core.DbxRequestConfig
import com.dropbox.core.android.Auth
import com.dropbox.core.oauth.DbxCredential
import com.dropbox.core.v2.DbxClientV2

data class DropboxAccountInfo(
    val connected: Boolean,
    val name: String = "",
    val email: String = "",
    val initials: String = ""
)

/**
 * Phase 4 — Dropbox OAuth 2.0 PKCE Authentication Manager for JivanOS.
 *
 * Security model:
 * - Public App Key (PKCE flow, zero client secret embedded)
 * - App folder access type: strictly sandboxed by Dropbox to /Apps/JivanOS/
 * - Tokens (access token, refresh token, expiry) persisted ONLY in
 *   AndroidX EncryptedSharedPreferences (AES-256-GCM / AES-256-SIV)
 */
object DropboxAuth {

    const val APP_KEY: String = "7vi2yjqec4ezw1q"
    const val REDIRECT_URI: String = "db-7vi2yjqec4ezw1q://2/token"
    const val CLIENT_IDENTIFIER: String = "JivanOS/3.0"

    private const val ENCRYPTED_PREFS_NAME = "jivanos_dropbox_secure_tokens"
    private const val KEY_ACCESS_TOKEN = "dbx_access_token"
    private const val KEY_REFRESH_TOKEN = "dbx_refresh_token"
    private const val KEY_EXPIRES_AT = "dbx_expires_at"
    private const val KEY_DISPLAY_NAME = "dbx_display_name"
    private const val KEY_EMAIL = "dbx_email"

    private val PKCE_SCOPES: List<String> = listOf(
        "account_info.read",
        "files.content.read",
        "files.content.write",
        "files.metadata.read"
    )

    @Volatile
    private var cachedEncryptedPrefs: SharedPreferences? = null

    fun createRequestConfig(): DbxRequestConfig {
        return DbxRequestConfig.newBuilder(CLIENT_IDENTIFIER).build()
    }

    private fun createEncryptedPrefsInstance(appCtx: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(appCtx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            appCtx,
            ENCRYPTED_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun clearCorruptedEncryptedPrefs(appCtx: Context) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                appCtx.deleteSharedPreferences(ENCRYPTED_PREFS_NAME)
            } else {
                appCtx.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .commit()
            }
        } catch (_: Throwable) {
        }
    }

    private fun getSecurePrefs(context: Context): SharedPreferences {
        cachedEncryptedPrefs?.let { return it }
        synchronized(this) {
            cachedEncryptedPrefs?.let { return it }
            val appCtx = context.applicationContext
            val prefs: SharedPreferences = try {
                createEncryptedPrefsInstance(appCtx)
            } catch (_: Throwable) {
                // In-place APK upgrade or Android Auto-Backup restore can invalidate Keystore master key
                clearCorruptedEncryptedPrefs(appCtx)
                try {
                    createEncryptedPrefsInstance(appCtx)
                } catch (_: Throwable) {
                    appCtx.getSharedPreferences("${ENCRYPTED_PREFS_NAME}_fallback", Context.MODE_PRIVATE)
                }
            }
            cachedEncryptedPrefs = prefs
            return prefs
        }
    }

    /**
     * Starts Dropbox OAuth 2.0 PKCE authorization flow (no client secret required).
     * Dropbox redirects back to db-7vi2yjqec4ezw1q://2/token handled by AuthActivity.
     */
    fun startPkceAuth(context: Context) {
        Auth.startOAuth2PKCE(
            context,
            APP_KEY,
            createRequestConfig(),
            PKCE_SCOPES
        )
    }

    /**
     * Completes an in-flight PKCE OAuth flow after MainActivity resumes from AuthActivity.
     * Saves access token + refresh token into EncryptedSharedPreferences and fetches profile.
     * Must be called off the main UI thread (performs network account lookup).
     */
    fun completePendingAuthFromResume(context: Context): DropboxAccountInfo? {
        return try {
            val credential = Auth.getDbxCredential() ?: return null
            saveCredential(context, credential)
            fetchAndCacheAccountProfile(context, credential)
        } catch (_: Throwable) {
            null
        }
    }

    /**
     * Silent re-authentication on app launch if tokens already exist in EncryptedSharedPreferences.
     * Automatically refreshes the short-lived access token using the stored refresh token if needed.
     */
    fun silentReAuth(context: Context): DropboxAccountInfo? {
        return try {
            val credential = loadStoredCredential(context) ?: return null
            val prefs = getSecurePrefs(context)
            try {
                val client = createAuthenticatedClient(context, credential)
                val account = client.users().currentAccount
                val name = account.name?.displayName?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: account.email?.substringBefore("@")
                    ?: "Dropbox User"
                val email = account.email ?: ""
                // Persist refreshed access token if SDK refreshed it
                saveCredential(context, credential)
                prefs.edit()
                    .putString(KEY_DISPLAY_NAME, name)
                    .putString(KEY_EMAIL, email)
                    .apply()
                DropboxAccountInfo(
                    connected = true,
                    name = name,
                    email = email,
                    initials = computeInitials(name, email)
                )
            } catch (_: Throwable) {
                // If temporarily offline, return cached display info if valid refresh token is stored
                val cachedName = prefs.getString(KEY_DISPLAY_NAME, "") ?: ""
                val cachedEmail = prefs.getString(KEY_EMAIL, "") ?: ""
                if (cachedName.isNotEmpty() || cachedEmail.isNotEmpty()) {
                    val resolvedName = cachedName.ifEmpty { cachedEmail.substringBefore("@") }
                    DropboxAccountInfo(
                        connected = true,
                        name = resolvedName,
                        email = cachedEmail,
                        initials = computeInitials(resolvedName, cachedEmail)
                    )
                } else {
                    null
                }
            }
        } catch (_: Throwable) {
            null
        }
    }

    fun hasStoredTokens(context: Context): Boolean {
        return try {
            val prefs = getSecurePrefs(context)
            val access = prefs.getString(KEY_ACCESS_TOKEN, null)
            val refresh = prefs.getString(KEY_REFRESH_TOKEN, null)
            !access.isNullOrBlank() || !refresh.isNullOrBlank()
        } catch (_: Throwable) {
            false
        }
    }

    fun loadStoredCredential(context: Context): DbxCredential? {
        return try {
            val prefs = getSecurePrefs(context)
            val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null)?.trim()
            val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)?.trim()
            val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)

            if (accessToken.isNullOrEmpty() && refreshToken.isNullOrEmpty()) {
                return null
            }

            val resolvedExpiresAt: Long? = if (expiresAt > 0L) expiresAt else null
            DbxCredential(
                accessToken ?: "",
                resolvedExpiresAt,
                refreshToken,
                APP_KEY
            )
        } catch (_: Throwable) {
            null
        }
    }

    fun saveCredential(context: Context, credential: DbxCredential) {
        try {
            val prefs = getSecurePrefs(context)
            prefs.edit()
                .putString(KEY_ACCESS_TOKEN, credential.accessToken ?: "")
                .putString(KEY_REFRESH_TOKEN, credential.refreshToken ?: "")
                .putLong(KEY_EXPIRES_AT, credential.expiresAt ?: 0L)
                .apply()
        } catch (_: Throwable) {
        }
    }

    /**
     * Builds an authenticated DbxClientV2 backed by the PKCE DbxCredential.
     * Proactively refreshes the access token via refresh token if expired or expiring soon.
     */
    @Throws(Exception::class)
    fun createAuthenticatedClient(
        context: Context,
        existingCredential: DbxCredential? = null
    ): DbxClientV2 {
        val credential = existingCredential ?: loadStoredCredential(context)
            ?: throw IllegalStateException("Dropbox is not connected.")
        val requestConfig = createRequestConfig()
        if (credential.refreshToken != null && (credential.accessToken.isNullOrEmpty() || credential.aboutToExpire())) {
            credential.refresh(requestConfig)
            saveCredential(context, credential)
        }
        return DbxClientV2(requestConfig, credential)
    }

    private fun fetchAndCacheAccountProfile(
        context: Context,
        credential: DbxCredential
    ): DropboxAccountInfo {
        val client = createAuthenticatedClient(context, credential)
        val account = client.users().currentAccount
        val name = account.name?.displayName?.trim().takeUnless { it.isNullOrEmpty() }
            ?: account.email?.substringBefore("@")
            ?: "Dropbox User"
        val email = account.email ?: ""

        try {
            getSecurePrefs(context).edit()
                .putString(KEY_DISPLAY_NAME, name)
                .putString(KEY_EMAIL, email)
                .apply()
        } catch (_: Throwable) {
        }

        return DropboxAccountInfo(
            connected = true,
            name = name,
            email = email,
            initials = computeInitials(name, email)
        )
    }

    /**
     * Revokes the active Dropbox token (best-effort) and wipes all stored tokens
     * and account metadata from EncryptedSharedPreferences.
     */
    fun disconnect(context: Context) {
        try {
            val credential = loadStoredCredential(context)
            if (credential != null) {
                val client = DbxClientV2(createRequestConfig(), credential)
                client.auth().tokenRevoke()
            }
        } catch (_: Throwable) {
            // Proceed to clear all local encrypted tokens regardless of network state
        } finally {
            try {
                getSecurePrefs(context).edit().clear().apply()
            } catch (_: Throwable) {
            }
        }
    }

    fun computeInitials(name: String?, email: String?): String {
        val source = name?.trim()?.takeIf { it.isNotEmpty() }
            ?: email?.trim()?.takeIf { it.isNotEmpty() }
            ?: "D"
        val parts = source.split(Regex("\\s+")).filter { it.isNotEmpty() }
        return if (parts.size >= 2) {
            "${parts[0].first()}${parts[1].first()}".uppercase()
        } else {
            source.take(2).uppercase()
        }
    }
}
