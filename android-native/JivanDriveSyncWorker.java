package com.jaiz.jivanos;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;

/**
 * WorkManager periodic background worker for JivanOS Google Drive AppData auto-sync.
 * Silently uploads the latest cached JivanOS backup envelope to Drive appDataFolder/backup.json.
 */
public class JivanDriveSyncWorker extends Worker {

    public static final String UNIQUE_WORK_NAME = "jivanos_drive_auto_sync";
    public static final String CACHED_ENVELOPE_FILE = "drive-pending-backup.json";

    public JivanDriveSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        try {
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(ctx);
            Scope appDataScope = new Scope(JivanDriveAppDataClient.DRIVE_APPDATA_SCOPE);
            if (account == null || !GoogleSignIn.hasPermissions(account, appDataScope)) {
                return Result.success();
            }

            String payloadJson = readPendingPayload(ctx);
            if (payloadJson == null || payloadJson.trim().isEmpty()) {
                return Result.success();
            }

            String token = JivanDriveAppDataClient.acquireAccessToken(ctx, account);
            if (token == null || token.isEmpty()) {
                return Result.retry();
            }

            JivanDriveAppDataClient.uploadBackup(ctx, token, payloadJson);

            // Re-queue OneTimeWorkRequest for the next scheduled backup window (no exact alarms)
            android.content.SharedPreferences prefs = ctx.getSharedPreferences(
                    JivanDriveAppDataClient.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            int intervalMinutes = prefs.getInt(JivanDriveAppDataClient.KEY_AUTO_INTERVAL, 0);
            boolean wifiOnly = prefs.getBoolean("backup_wifi_only", true);
            boolean onlyCharging = prefs.getBoolean("backup_only_charging", false);
            if (intervalMinutes > 0) {
                androidx.work.Constraints constraints = new androidx.work.Constraints.Builder()
                        .setRequiredNetworkType(
                                wifiOnly
                                        ? androidx.work.NetworkType.UNMETERED
                                        : androidx.work.NetworkType.CONNECTED
                        )
                        .setRequiresCharging(onlyCharging)
                        .build();
                androidx.work.OneTimeWorkRequest nextWork =
                        new androidx.work.OneTimeWorkRequest.Builder(JivanDriveSyncWorker.class)
                                .setInitialDelay(Math.max(15L, intervalMinutes), java.util.concurrent.TimeUnit.MINUTES)
                                .setConstraints(constraints)
                                .build();
                androidx.work.WorkManager.getInstance(ctx).enqueueUniqueWork(
                        UNIQUE_WORK_NAME,
                        androidx.work.ExistingWorkPolicy.REPLACE,
                        nextWork
                );
            }
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private String readPendingPayload(Context ctx) {
        File cached = new File(ctx.getFilesDir(), CACHED_ENVELOPE_FILE);
        if (!cached.exists() || !cached.isFile() || cached.length() == 0) {
            return null;
        }
        try (FileInputStream fis = new FileInputStream(cached);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return baos.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return null;
        }
    }
}
