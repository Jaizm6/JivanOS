package com.jaiz.jivanos;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Lightweight Google Drive REST v3 AppDataFolder client using pure Android HttpURLConnection.
 * Stores and reads a single hidden file: appDataFolder/backup.json
 * Scope: https://www.googleapis.com/auth/drive.appdata ONLY.
 */
public class JivanDriveAppDataClient {

    public static final String DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    public static final String BACKUP_FILENAME = "backup.json";
    public static final String PREFS_NAME = "jivanos_drive_sync_prefs";
    public static final String KEY_LAST_MODIFIED = "last_modified";
    public static final String KEY_LAST_SIZE = "last_size_bytes";
    public static final String KEY_AUTO_INTERVAL = "auto_sync_interval_min";

    public static class SyncFileInfo {
        public final String id;
        public final String lastModified;
        public final long fileSizeBytes;

        public SyncFileInfo(String id, String lastModified, long fileSizeBytes) {
            this.id = id;
            this.lastModified = lastModified;
            this.fileSizeBytes = fileSizeBytes;
        }
    }

    public static class RestoreResult {
        public final boolean found;
        public final String content;
        public final String lastModified;
        public final long fileSizeBytes;

        public RestoreResult(boolean found, String content, String lastModified, long fileSizeBytes) {
            this.found = found;
            this.content = content;
            this.lastModified = lastModified;
            this.fileSizeBytes = fileSizeBytes;
        }
    }

    public static String acquireAccessToken(Context context, GoogleSignInAccount account) throws Exception {
        if (account == null || account.getAccount() == null) {
            throw new IllegalStateException("Google account not signed in.");
        }
        return GoogleAuthUtil.getToken(
                context,
                account.getAccount(),
                "oauth2:" + DRIVE_APPDATA_SCOPE
        );
    }

    public static void clearCachedToken(Context context, GoogleSignInAccount account) {
        if (account == null || account.getAccount() == null) return;
        try {
            String token = GoogleAuthUtil.getToken(
                    context,
                    account.getAccount(),
                    "oauth2:" + DRIVE_APPDATA_SCOPE
            );
            if (token != null && !token.isEmpty()) {
                GoogleAuthUtil.clearToken(context, token);
            }
        } catch (Exception ignored) {
        }
    }

    public static SyncFileInfo findBackupFile(String accessToken) throws Exception {
        String query = URLEncoder.encode(
                "name = '" + BACKUP_FILENAME + "' and trashed = false",
                "UTF-8"
        );
        String urlStr = "https://www.googleapis.com/drive/v3/files"
                + "?spaces=appDataFolder"
                + "&q=" + query
                + "&fields=" + URLEncoder.encode("files(id,name,modifiedTime,size)", "UTF-8")
                + "&orderBy=modifiedTime+desc"
                + "&pageSize=5";

        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);

        int code = conn.getResponseCode();
        String body = readResponseBody(conn, code >= 200 && code < 300);
        conn.disconnect();

        if (code < 200 || code >= 300) {
            throw new RuntimeException("Drive list failed (HTTP " + code + "): " + body);
        }

        JSONObject root = new JSONObject(body);
        JSONArray files = root.optJSONArray("files");
        if (files == null || files.length() == 0) {
            return null;
        }
        JSONObject first = files.getJSONObject(0);
        String id = first.optString("id", "");
        if (id.isEmpty()) return null;

        String modified = first.optString("modifiedTime", "");
        long size = 0L;
        try {
            size = Long.parseLong(first.optString("size", "0"));
        } catch (Exception ignored) {
        }
        return new SyncFileInfo(id, modified, size);
    }

    public static SyncFileInfo uploadBackup(Context context, String accessToken, String jsonPayload) throws Exception {
        byte[] contentBytes = (jsonPayload != null ? jsonPayload : "{}")
                .getBytes(StandardCharsets.UTF_8);

        SyncFileInfo existing = findBackupFile(accessToken);
        HttpURLConnection conn;

        if (existing != null) {
            String urlStr = "https://www.googleapis.com/upload/drive/v3/files/"
                    + URLEncoder.encode(existing.id, "UTF-8")
                    + "?uploadType=media&fields=" + URLEncoder.encode("id,modifiedTime,size", "UTF-8");
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            // HttpURLConnection PATCH workaround via POST + X-HTTP-Method-Override for older Android runtimes
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            try (OutputStream os = conn.getOutputStream()) {
                os.write(contentBytes);
                os.flush();
            }
        } else {
            String boundary = "jivanos_appdata_boundary_" + System.currentTimeMillis();
            String metadataJson = "{\"name\":\"" + BACKUP_FILENAME
                    + "\",\"parents\":[\"appDataFolder\"],\"mimeType\":\"application/json\"}";

            ByteArrayOutputStream bodyStream = new ByteArrayOutputStream();
            bodyStream.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            bodyStream.write("Content-Type: application/json; charset=UTF-8\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            bodyStream.write(metadataJson.getBytes(StandardCharsets.UTF_8));
            bodyStream.write(("\r\n--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            bodyStream.write("Content-Type: application/json; charset=UTF-8\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            bodyStream.write(contentBytes);
            bodyStream.write(("\r\n--" + boundary + "--").getBytes(StandardCharsets.UTF_8));

            String urlStr = "https://www.googleapis.com/upload/drive/v3/files"
                    + "?uploadType=multipart&fields=" + URLEncoder.encode("id,modifiedTime,size", "UTF-8");
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(bodyStream.toByteArray());
                os.flush();
            }
        }

        int code = conn.getResponseCode();
        String resp = readResponseBody(conn, code >= 200 && code < 300);
        conn.disconnect();

        if (code < 200 || code >= 300) {
            throw new RuntimeException("Drive upload failed (HTTP " + code + "): " + resp);
        }

        JSONObject parsed = new JSONObject(resp);
        String id = parsed.optString("id", existing != null ? existing.id : "");
        String modified = parsed.optString("modifiedTime", "");
        long size = contentBytes.length;
        try {
            long parsedSize = Long.parseLong(parsed.optString("size", String.valueOf(contentBytes.length)));
            if (parsedSize > 0) size = parsedSize;
        } catch (Exception ignored) {
        }

        saveSyncMetadata(context, modified, size);
        return new SyncFileInfo(id, modified, size);
    }

    public static RestoreResult downloadBackup(Context context, String accessToken) throws Exception {
        SyncFileInfo existing = findBackupFile(accessToken);
        if (existing == null) {
            return new RestoreResult(false, "", "", 0L);
        }

        String urlStr = "https://www.googleapis.com/drive/v3/files/"
                + URLEncoder.encode(existing.id, "UTF-8")
                + "?alt=media";
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Authorization", "Bearer " + accessToken);

        int code = conn.getResponseCode();
        String content = readResponseBody(conn, code >= 200 && code < 300);
        conn.disconnect();

        if (code < 200 || code >= 300) {
            throw new RuntimeException("Drive download failed (HTTP " + code + ")");
        }

        long size = existing.fileSizeBytes > 0
                ? existing.fileSizeBytes
                : content.getBytes(StandardCharsets.UTF_8).length;
        saveSyncMetadata(context, existing.lastModified, size);
        return new RestoreResult(true, content, existing.lastModified, size);
    }

    public static void saveSyncMetadata(Context context, String lastModified, long sizeBytes) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_LAST_MODIFIED, lastModified != null ? lastModified : "")
                .putLong(KEY_LAST_SIZE, sizeBytes)
                .apply();
    }

    public static void clearSyncMetadata(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();
    }

    private static String readResponseBody(HttpURLConnection conn, boolean isSuccess) {
        InputStream stream = null;
        try {
            stream = isSuccess ? conn.getInputStream() : conn.getErrorStream();
            if (stream == null) return "";
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
