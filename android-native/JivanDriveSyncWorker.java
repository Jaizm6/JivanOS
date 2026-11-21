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
