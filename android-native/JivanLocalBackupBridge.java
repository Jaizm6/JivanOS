package com.jaiz.jivanos;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Pure-Android offline Local Backup, Rotating 3-Slot Auto-Snapshot,
 * and Native Share Sheet bridge for JivanOS.
 *
 * Uses Android SDK APIs only:
 * - MediaStore.Downloads (Android 10+ / API 29+)
 * - Environment.getExternalStoragePublicDirectory (Android 9 and older)
 * - Context.getFilesDir() for private rotating snapshots (snapshot-1..3.json)
 * - Intent.ACTION_SEND + FileProvider for Android Share Sheet
 *
 * Zero external libraries. Zero network / internet permission required.
 */
public class JivanLocalBackupBridge {

    private static final int MAX_SNAPSHOTS = 3;
    private static final String MIME_JSON = "application/json";

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public JivanLocalBackupBridge(Context context) {
        this.context = context;
    }

    /**
     * 1. EXPORT
     * Saves JSON backup to the public Downloads folder and launches Android's
     * built-in Share Sheet so the user can optionally share via WhatsApp, email, etc.
     */
    @JavascriptInterface
    public String exportBackup(String filename, String jsonContent) {
        JSONObject result = new JSONObject();
        try {
            String safeName = sanitizeBackupFilename(filename);
            byte[] payloadBytes = (jsonContent != null ? jsonContent : "{}")
                    .getBytes(StandardCharsets.UTF_8);

            Uri savedUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedUri = saveToDownloadsMediaStore(safeName, payloadBytes);
            } else {
                savedUri = saveToDownloadsLegacy(safeName, payloadBytes);
            }

            if (savedUri == null) {
                throw new IOException("Unable to write backup file to Downloads.");
            }

            // Open Android's native Share Sheet on the main thread
            launchShareSheet(savedUri, safeName);

            result.put("success", true);
            result.put("filename", safeName);
            result.put("uri", savedUri.toString());
            result.put("sizeBytes", payloadBytes.length);
            result.put("location", "Downloads");
            result.put("shared", true);
            return result.toString();
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("error", e.getMessage() != null ? e.getMessage() : "Export failed");
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }

    /**
     * Android 10+ (API 29+): Write directly into Downloads via MediaStore.Downloads
     * without requiring legacy storage permissions.
     */
    private Uri saveToDownloadsMediaStore(String filename, byte[] bytes) throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return null;
        }
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
        values.put(MediaStore.Downloads.MIME_TYPE, MIME_JSON);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (itemUri == null) {
            throw new IOException("MediaStore could not create file in Downloads.");
        }

        try (OutputStream out = resolver.openOutputStream(itemUri)) {
            if (out == null) {
                throw new IOException("Could not open MediaStore output stream.");
            }
            out.write(bytes);
            out.flush();
        } catch (IOException writeErr) {
            try {
                resolver.delete(itemUri, null, null);
            } catch (Exception ignored) {
            }
            throw writeErr;
        }

        ContentValues doneValues = new ContentValues();
        doneValues.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(itemUri, doneValues, null, null);
        return itemUri;
    }

    /**
     * Android 9 and older (API < 29): Fallback to Environment.getExternalStoragePublicDirectory.
     * Falls back to app-private external Downloads folder if legacy write permission is denied.
     */
    @SuppressWarnings("deprecation")
    private Uri saveToDownloadsLegacy(String filename, byte[] bytes) throws IOException {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS
        );
        if (downloadsDir == null || (!downloadsDir.exists() && !downloadsDir.mkdirs())) {
            downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        }
        if (downloadsDir == null) {
            downloadsDir = context.getFilesDir();
        }
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }

        File outFile = new File(downloadsDir, filename);
        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            fos.write(bytes);
            fos.flush();
        }

        return FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                outFile
        );
    }

    /**
     * Opens Android's built-in Share Sheet so the user can send the backup
     * via WhatsApp, email, Bluetooth, Nearby Share, etc.
     */
    private void launchShareSheet(final Uri fileUri, final String filename) {
        mainHandler.post(() -> {
            try {
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(MIME_JSON);
                shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "JivanOS Backup - " + filename);
                shareIntent.putExtra(Intent.EXTRA_TEXT, "JivanOS offline backup file: " + filename);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Share JivanOS Backup");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                context.startActivity(chooser);
            } catch (Exception ignored) {
                // Export to Downloads already succeeded even if share sheet cannot launch
            }
        });
    }

    /**
     * 3. AUTO-SNAPSHOT (silent, rotating 3 slots inside context.getFilesDir())
     * Newest snapshot is always snapshot-1.json; older ones rotate to snapshot-2.json
     * and snapshot-3.json, and anything older is deleted automatically.
     */
    @JavascriptInterface
    public synchronized String saveAutoSnapshot(String jsonContent) {
        JSONObject result = new JSONObject();
        try {
            File dir = context.getFilesDir();
            byte[] payloadBytes = (jsonContent != null ? jsonContent : "{}")
                    .getBytes(StandardCharsets.UTF_8);

            // Delete oldest slot (snapshot-3.json)
            File oldest = new File(dir, "snapshot-" + MAX_SNAPSHOTS + ".json");
            if (oldest.exists()) {
                oldest.delete();
            }

            // Rotate snapshot-2 -> snapshot-3, snapshot-1 -> snapshot-2
            for (int i = MAX_SNAPSHOTS - 1; i >= 1; i--) {
                File src = new File(dir, "snapshot-" + i + ".json");
                File dst = new File(dir, "snapshot-" + (i + 1) + ".json");
                if (src.exists()) {
                    if (dst.exists()) {
                        dst.delete();
                    }
                    src.renameTo(dst);
                }
            }

            // Write new snapshot-1.json atomically via temporary file
            File tmpFile = new File(dir, "snapshot-1.json.tmp");
            File targetFile = new File(dir, "snapshot-1.json");
            try (FileOutputStream fos = new FileOutputStream(tmpFile)) {
                fos.write(payloadBytes);
                fos.flush();
            }
            if (targetFile.exists()) {
                targetFile.delete();
            }
            if (!tmpFile.renameTo(targetFile)) {
                // Direct fallback write if rename fails
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(payloadBytes);
                    fos.flush();
                }
                tmpFile.delete();
            }

            // Cleanup any stray snapshot-4+ files
            File[] allFiles = dir.listFiles();
            if (allFiles != null) {
                for (File f : allFiles) {
                    String name = f.getName();
                    if (name.startsWith("snapshot-") && name.endsWith(".json")) {
                        if (!name.equals("snapshot-1.json")
                                && !name.equals("snapshot-2.json")
                                && !name.equals("snapshot-3.json")) {
                            f.delete();
                        }
                    }
                }
            }

            result.put("success", true);
            result.put("snapshots", buildSnapshotsJsonArray());
            return result.toString();
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("error", e.getMessage() != null ? e.getMessage() : "Snapshot failed");
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }

    /**
     * 4. LIST SNAPSHOTS
     * Returns metadata for snapshot-1.json .. snapshot-3.json stored in getFilesDir().
     */
    @JavascriptInterface
    public synchronized String listSnapshots() {
        try {
            return buildSnapshotsJsonArray().toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    /**
     * 4. READ SNAPSHOT
     * Reads snapshot-1.json, snapshot-2.json, or snapshot-3.json from getFilesDir().
     */
    @JavascriptInterface
    public synchronized String readSnapshot(String filename) {
        if (!"snapshot-1.json".equals(filename)
                && !"snapshot-2.json".equals(filename)
                && !"snapshot-3.json".equals(filename)) {
            return "";
        }
        File file = new File(context.getFilesDir(), filename);
        if (!file.exists() || !file.isFile()) {
            return "";
        }
        try (FileInputStream fis = new FileInputStream(file);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) != -1) {
                baos.write(buffer, 0, len);
            }
            return baos.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return "";
        }
    }

    private JSONArray buildSnapshotsJsonArray() throws Exception {
        JSONArray arr = new JSONArray();
        File dir = context.getFilesDir();
        SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

        for (int slot = 1; slot <= MAX_SNAPSHOTS; slot++) {
            String name = "snapshot-" + slot + ".json";
            File file = new File(dir, name);
            if (file.exists() && file.isFile() && file.length() > 0) {
                JSONObject item = new JSONObject();
                item.put("slot", slot);
                item.put("filename", name);
                item.put("timestamp", isoFormat.format(new Date(file.lastModified())));
                item.put("sizeBytes", file.length());
                arr.put(item);
            }
        }
        return arr;
    }

    /**
     * 5. HISTORY BACKUP TO Documents/JivanOS/Backups (survives app uninstall)
     * Writes JivanOS-YYYY-MM-DD-HHmm.json into Documents/JivanOS/Backups and keeps the last 4 backups.
     */
    @JavascriptInterface
    public synchronized String saveBackupToDocumentsFolder(String filename, String jsonContent) {
        JSONObject result = new JSONObject();
        try {
            String safeName = sanitizeBackupFilename(filename);
            byte[] payloadBytes = (jsonContent != null ? jsonContent : "{}")
                    .getBytes(StandardCharsets.UTF_8);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();
                String relPath = Environment.DIRECTORY_DOCUMENTS + "/JivanOS/Backups";
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, MIME_JSON);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relPath);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri collection = MediaStore.Files.getContentUri("external");
                Uri itemUri = resolver.insert(collection, values);
                if (itemUri != null) {
                    try (OutputStream out = resolver.openOutputStream(itemUri)) {
                        if (out != null) {
                            out.write(payloadBytes);
                            out.flush();
                        }
                    }
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    resolver.update(itemUri, done, null, null);
                }
            } else {
                @SuppressWarnings("deprecation")
                File docsDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOCUMENTS
                );
                File targetDir = new File(docsDir, "JivanOS/Backups");
                if (!targetDir.exists()) {
                    targetDir.mkdirs();
                }
                File outFile = new File(targetDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(payloadBytes);
                    fos.flush();
                }
                // Keep last 4 backups
                File[] files = targetDir.listFiles();
                if (files != null && files.length > 4) {
                    java.util.Arrays.sort(files, (a, b) -> a.getName().compareTo(b.getName()));
                    for (int i = 0; i < files.length - 4; i++) {
                        files[i].delete();
                    }
                }
            }

            result.put("success", true);
            result.put("filename", safeName);
            result.put("location", "Documents/JivanOS/Backups");
            return result.toString();
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("error", e.getMessage() != null ? e.getMessage() : "Documents backup failed");
            } catch (Exception ignored) {
            }
            return result.toString();
        }
    }

    private String sanitizeBackupFilename(String raw) {
        String name = (raw == null || raw.trim().isEmpty())
                ? "JivanOS-backup.json"
                : raw.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!name.endsWith(".json")) {
            name = name + ".json";
        }
        return name;
    }
}
