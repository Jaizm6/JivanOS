package com.jaiz.jivanos;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.activity.result.ActivityResult;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Native Capacitor plugin for JivanOS Phase 2 Google Drive Sync.
 *
 * - Uses Google Sign-In SDK (com.google.android.gms:play-services-auth)
 * - Scope: Drive.APPDATA (https://www.googleapis.com/auth/drive.appdata) ONLY
 * - Silent re-auth on app launch
 * - AppDataFolder backup.json read/write/metadata
 * - WorkManager periodic background autoSync(intervalMinutes)
 */
@CapacitorPlugin(name = "JivanGoogleDrive")
public class JivanGoogleDrivePlugin extends Plugin {

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private GoogleSignInClient signInClient;

    private GoogleSignInClient getSignInClient() {
        if (signInClient == null) {
            Scope appDataScope = new Scope(JivanDriveAppDataClient.DRIVE_APPDATA_SCOPE);
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .requestScopes(appDataScope)
                    .build();
            signInClient = GoogleSignIn.getClient(getContext(), gso);
        }
        return signInClient;
    }

    private boolean hasAppDataPermission(GoogleSignInAccount account) {
        if (account == null) return false;
        return GoogleSignIn.hasPermissions(
                account,
                new Scope(JivanDriveAppDataClient.DRIVE_APPDATA_SCOPE)
        );
    }

    private JSObject buildAccountPayload(GoogleSignInAccount account, boolean connected) {
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        if (connected && account != null) {
            String name = account.getDisplayName() != null && !account.getDisplayName().trim().isEmpty()
                    ? account.getDisplayName().trim()
                    : (account.getEmail() != null ? account.getEmail().split("@")[0] : "Google User");
            String email = account.getEmail() != null ? account.getEmail() : "";
            ret.put("name", name);
            ret.put("email", email);
            ret.put("initials", computeInitials(name, email));
        }
        return ret;
    }

    private String computeInitials(String name, String email) {
        String source = (name != null && !name.trim().isEmpty()) ? name.trim() : (email != null ? email.trim() : "J");
        String[] parts = source.split("\\s+");
        if (parts.length >= 2 && !parts[0].isEmpty() && !parts[1].isEmpty()) {
            return ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return source.substring(0, Math.min(2, source.length())).toUpperCase();
    }

    private static final String KEY_EXPLICIT_CONNECTED = "gdrive_explicit_connected";

    private boolean isExplicitlyConnected(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(
                    JivanDriveAppDataClient.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            return prefs.getBoolean(KEY_EXPLICIT_CONNECTED, false);
        } catch (Throwable t) {
            return false;
        }
    }

    private void setExplicitlyConnected(Context ctx, boolean connected) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(
                    JivanDriveAppDataClient.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            prefs.edit().putBoolean(KEY_EXPLICIT_CONNECTED, connected).apply();
        } catch (Throwable ignored) {
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        try {
            Context ctx = getContext();
            if (isExplicitlyConnected(ctx)) {
                GoogleSignInAccount existing = GoogleSignIn.getLastSignedInAccount(ctx);
                if (existing != null && hasAppDataPermission(existing)) {
                    call.resolve(buildAccountPayload(existing, true));
                    return;
                }
            }
            // Clear any stale Play Services cache left over from a prior uninstall so user chooses explicitly
            getSignInClient().signOut().addOnCompleteListener(task -> {
                try {
                    Intent signInIntent = getSignInClient().getSignInIntent();
                    startActivityForResult(call, signInIntent, "handleSignInResult");
                } catch (Throwable t) {
                    call.reject("Google sign-in unavailable: " + t.getMessage());
                }
            });
        } catch (Throwable t) {
            call.reject("Google sign-in unavailable: " + t.getMessage());
        }
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || (result.getResultCode() != Activity.RESULT_OK && result.getData() == null)) {
            call.reject("Google sign-in was cancelled.");
            return;
        }
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || !hasAppDataPermission(account)) {
                call.reject("Google Drive AppData permission was not granted.");
                return;
            }
            setExplicitlyConnected(getContext(), true);
            call.resolve(buildAccountPayload(account, true));
        } catch (ApiException e) {
            call.reject("Google sign-in failed (code " + e.getStatusCode() + "): " + e.getMessage());
        } catch (Throwable e) {
            call.reject("Google sign-in failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void silentReAuth(PluginCall call) {
        try {
            if (!isExplicitlyConnected(getContext())) {
                call.resolve(buildAccountPayload(null, false));
                return;
            }
            GoogleSignInAccount existing = GoogleSignIn.getLastSignedInAccount(getContext());
            if (existing != null && hasAppDataPermission(existing)) {
                call.resolve(buildAccountPayload(existing, true));
                return;
            }
            getSignInClient().silentSignIn()
                    .addOnSuccessListener(account -> {
                        try {
                            if (account != null && hasAppDataPermission(account)) {
                                call.resolve(buildAccountPayload(account, true));
                            } else {
                                call.resolve(buildAccountPayload(null, false));
                            }
                        } catch (Throwable t) {
                            call.resolve(buildAccountPayload(null, false));
                        }
                    })
                    .addOnFailureListener(err -> call.resolve(buildAccountPayload(null, false)));
        } catch (Throwable t) {
            call.resolve(buildAccountPayload(null, false));
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Context ctx = getContext();
        setExplicitlyConnected(ctx, false);
        GoogleSignInAccount existing = null;
        try {
            existing = GoogleSignIn.getLastSignedInAccount(ctx);
        } catch (Throwable ignored) {
        }

        // Cancel WorkManager periodic sync immediately
        try {
            WorkManager.getInstance(ctx).cancelUniqueWork(JivanDriveSyncWorker.UNIQUE_WORK_NAME);
        } catch (Throwable ignored) {
        }

        // Remove cached background payload and metadata
        try {
            File pending = new File(ctx.getFilesDir(), JivanDriveSyncWorker.CACHED_ENVELOPE_FILE);
            if (pending.exists()) pending.delete();
        } catch (Throwable ignored) {
        }
        try {
            JivanDriveAppDataClient.clearSyncMetadata(ctx);
        } catch (Throwable ignored) {
        }

        final GoogleSignInAccount accountToClear = existing;
        ioExecutor.execute(() -> {
            try {
                JivanDriveAppDataClient.clearCachedToken(ctx, accountToClear);
                getSignInClient().revokeAccess().addOnCompleteListener(revokeTask ->
                        getSignInClient().signOut().addOnCompleteListener(signOutTask -> {
                            JSObject ret = new JSObject();
                            ret.put("disconnected", true);
                            call.resolve(ret);
                        })
                );
            } catch (Throwable t) {
                JSObject ret = new JSObject();
                ret.put("disconnected", true);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void backupToDrive(PluginCall call) {
        String payloadJson = call.getString("payloadJson", "");
        if (payloadJson == null || payloadJson.trim().isEmpty()) {
            call.reject("Backup payload is empty.");
            return;
        }
        Context ctx = getContext();
        GoogleSignInAccount account;
        try {
            account = GoogleSignIn.getLastSignedInAccount(ctx);
        } catch (Throwable t) {
            account = null;
        }
        if (account == null || !hasAppDataPermission(account)) {
            call.reject("Google Drive is not connected.");
            return;
        }

        final GoogleSignInAccount validAccount = account;
        ioExecutor.execute(() -> {
            try {
                writePendingPayload(ctx, payloadJson);
                String token = JivanDriveAppDataClient.acquireAccessToken(ctx, validAccount);
                JivanDriveAppDataClient.SyncFileInfo info =
                        JivanDriveAppDataClient.uploadBackup(ctx, token, payloadJson);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("lastModified", info.lastModified);
                ret.put("fileSizeBytes", info.fileSizeBytes);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Drive backup failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void restoreFromDrive(PluginCall call) {
        Context ctx = getContext();
        GoogleSignInAccount account;
        try {
            account = GoogleSignIn.getLastSignedInAccount(ctx);
        } catch (Throwable t) {
            account = null;
        }
        if (account == null || !hasAppDataPermission(account)) {
            call.reject("Google Drive is not connected.");
            return;
        }

        final GoogleSignInAccount validAccount = account;
        ioExecutor.execute(() -> {
            try {
                String token = JivanDriveAppDataClient.acquireAccessToken(ctx, validAccount);
                JivanDriveAppDataClient.RestoreResult result =
                        JivanDriveAppDataClient.downloadBackup(ctx, token);

                JSObject ret = new JSObject();
                ret.put("found", result.found);
                ret.put("content", result.content);
                ret.put("lastModified", result.lastModified);
                ret.put("fileSizeBytes", result.fileSizeBytes);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Drive restore failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getLastSyncInfo(PluginCall call) {
        Context ctx = getContext();
        GoogleSignInAccount account;
        try {
            account = GoogleSignIn.getLastSignedInAccount(ctx);
        } catch (Throwable t) {
            account = null;
        }
        if (account == null || !hasAppDataPermission(account)) {
            JSObject ret = new JSObject();
            ret.put("exists", false);
            call.resolve(ret);
            return;
        }

        final GoogleSignInAccount validAccount = account;
        ioExecutor.execute(() -> {
            try {
                String token = JivanDriveAppDataClient.acquireAccessToken(ctx, validAccount);
                JivanDriveAppDataClient.SyncFileInfo info = JivanDriveAppDataClient.findBackupFile(token);
                JSObject ret = new JSObject();
                if (info == null) {
                    ret.put("exists", false);
                } else {
                    JivanDriveAppDataClient.saveSyncMetadata(ctx, info.lastModified, info.fileSizeBytes);
                    ret.put("exists", true);
                    ret.put("lastModified", info.lastModified);
                    ret.put("fileSizeBytes", info.fileSizeBytes);
                }
                call.resolve(ret);
            } catch (Throwable e) {
                // Fall back to locally cached metadata if temporarily offline
                SharedPreferences prefs = ctx.getSharedPreferences(
                        JivanDriveAppDataClient.PREFS_NAME,
                        Context.MODE_PRIVATE
                );
                String cachedModified = prefs.getString(JivanDriveAppDataClient.KEY_LAST_MODIFIED, "");
                long cachedSize = prefs.getLong(JivanDriveAppDataClient.KEY_LAST_SIZE, 0L);
                JSObject ret = new JSObject();
                if (cachedModified != null && !cachedModified.isEmpty()) {
                    ret.put("exists", true);
                    ret.put("lastModified", cachedModified);
                    ret.put("fileSizeBytes", cachedSize);
                } else {
                    ret.put("exists", false);
                }
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void scheduleAutoSync(PluginCall call) {
        int intervalMinutes = call.getInt("intervalMinutes", 0);
        boolean wifiOnly = call.getBoolean("wifiOnly", true);
        boolean onlyWhileCharging = call.getBoolean("onlyWhileCharging", false);
        Context ctx = getContext();

        try {
            SharedPreferences prefs = ctx.getSharedPreferences(
                    JivanDriveAppDataClient.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            prefs.edit()
                    .putInt(JivanDriveAppDataClient.KEY_AUTO_INTERVAL, intervalMinutes)
                    .putBoolean("backup_wifi_only", wifiOnly)
                    .putBoolean("backup_only_charging", onlyWhileCharging)
                    .apply();

            WorkManager wm = WorkManager.getInstance(ctx);
            if (intervalMinutes <= 0) {
                wm.cancelUniqueWork(JivanDriveSyncWorker.UNIQUE_WORK_NAME);
            } else {
                long delayMinutes = Math.max(15L, intervalMinutes);
                Constraints constraints = new Constraints.Builder()
                        .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED)
                        .setRequiresCharging(onlyWhileCharging)
                        .build();

                androidx.work.OneTimeWorkRequest workRequest = new androidx.work.OneTimeWorkRequest.Builder(
                        JivanDriveSyncWorker.class
                )
                        .setInitialDelay(delayMinutes, TimeUnit.MINUTES)
                        .setConstraints(constraints)
                        .build();

                wm.enqueueUniqueWork(
                        JivanDriveSyncWorker.UNIQUE_WORK_NAME,
                        androidx.work.ExistingWorkPolicy.REPLACE,
                        workRequest
                );
            }
        } catch (Throwable ignored) {
        }

        JSObject ret = new JSObject();
        ret.put("scheduled", intervalMinutes > 0);
        ret.put("intervalMinutes", intervalMinutes);
        call.resolve(ret);
    }

    @PluginMethod
    public void cacheLocalPayloadForBackgroundSync(PluginCall call) {
        String payloadJson = call.getString("payloadJson", "");
        if (payloadJson != null && !payloadJson.trim().isEmpty()) {
            ioExecutor.execute(() -> writePendingPayload(getContext(), payloadJson));
        }
        JSObject ret = new JSObject();
        ret.put("cached", true);
        call.resolve(ret);
    }

    private void writePendingPayload(Context ctx, String payloadJson) {
        try {
            File tmp = new File(ctx.getFilesDir(), JivanDriveSyncWorker.CACHED_ENVELOPE_FILE + ".tmp");
            File target = new File(ctx.getFilesDir(), JivanDriveSyncWorker.CACHED_ENVELOPE_FILE);
            try (FileOutputStream fos = new FileOutputStream(tmp)) {
                fos.write(payloadJson.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }
            if (target.exists()) target.delete();
            tmp.renameTo(target);
        } catch (Exception ignored) {
        }
    }
}
