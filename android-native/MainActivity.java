package com.jaiz.jivanos;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {

    private static final String UPGRADE_PREFS_NAME = "jivanos_app_upgrade_prefs";
    private static final String KEY_LAST_VERSION_CODE = "last_version_code";
    private static final String KEY_LAST_VERSION_NAME = "last_version_name";
    private static final String KEY_LAST_UPDATE_TIME = "last_update_time";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JivanGoogleDrivePlugin.class);
        registerPlugin(JivanDropboxPlugin.class);

        // Clean stale WebView Service Worker & HTTP cache files BEFORE WebView loads if upgraded in-place
        boolean upgradedInPlace = purgeStaleWebViewCachesOnUpgrade();

        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            JivanLocalBackupBridge backupBridge = new JivanLocalBackupBridge(this);
            webView.addJavascriptInterface(backupBridge, "JivanAndroidBackup");
            webView.addJavascriptInterface(backupBridge, "JivanLocalBackup");

            if (upgradedInPlace) {
                try {
                    webView.clearCache(true);
                } catch (Throwable ignored) {
                }
            }
        }
    }

    /**
     * Detects when an APK is installed on top of an existing installation (in-place upgrade)
     * and removes stale WebView Service Worker and HTTP code caches while strictly preserving
     * WebView Local Storage and IndexedDB user data.
     */
    private boolean purgeStaleWebViewCachesOnUpgrade() {
        try {
            PackageInfo pkgInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long currentVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? pkgInfo.getLongVersionCode()
                    : pkgInfo.versionCode;
            String currentVersionName = pkgInfo.versionName != null ? pkgInfo.versionName : "";
            long lastUpdateTime = pkgInfo.lastUpdateTime;

            SharedPreferences prefs = getSharedPreferences(UPGRADE_PREFS_NAME, Context.MODE_PRIVATE);
            long savedVersionCode = prefs.getLong(KEY_LAST_VERSION_CODE, -1L);
            String savedVersionName = prefs.getString(KEY_LAST_VERSION_NAME, "");
            long savedUpdateTime = prefs.getLong(KEY_LAST_UPDATE_TIME, -1L);

            boolean isUpgrade = (savedVersionCode != currentVersionCode)
                    || (!currentVersionName.equals(savedVersionName))
                    || (savedUpdateTime != lastUpdateTime);

            if (isUpgrade) {
                File dataDir = getApplicationInfo().dataDir != null
                        ? new File(getApplicationInfo().dataDir)
                        : getFilesDir().getParentFile();

                if (dataDir != null) {
                    File appWebViewDir = new File(dataDir, "app_webview");
                    // Only delete Service Worker & HTTP/Code caches; NEVER touch Local Storage or IndexedDB
                    deleteDirectorySafely(new File(appWebViewDir, "Default/Service Worker"));
                    deleteDirectorySafely(new File(appWebViewDir, "Service Worker"));
                    deleteDirectorySafely(new File(appWebViewDir, "Default/Cache"));
                    deleteDirectorySafely(new File(appWebViewDir, "Default/Code Cache"));
                    deleteDirectorySafely(new File(appWebViewDir, "Default/GPUCache"));
                    deleteDirectorySafely(new File(appWebViewDir, "Cache"));
                    deleteDirectorySafely(new File(appWebViewDir, "Code Cache"));
                    deleteDirectorySafely(new File(appWebViewDir, "GPUCache"));
                }

                // Clear internal cacheDir HTTP cache files
                File cacheDir = getCacheDir();
                if (cacheDir != null) {
                    deleteDirectorySafely(new File(cacheDir, "WebView"));
                    deleteDirectorySafely(new File(cacheDir, "org.chromium.android_webview"));
                }

                prefs.edit()
                        .putLong(KEY_LAST_VERSION_CODE, currentVersionCode)
                        .putString(KEY_LAST_VERSION_NAME, currentVersionName)
                        .putLong(KEY_LAST_UPDATE_TIME, lastUpdateTime)
                        .apply();
                return true;
            }
        } catch (Throwable ignored) {
        }
        return false;
    }

    private void deleteDirectorySafely(File fileOrDir) {
        if (fileOrDir == null || !fileOrDir.exists()) return;
        try {
            if (fileOrDir.isDirectory()) {
                File[] children = fileOrDir.listFiles();
                if (children != null) {
                    for (File child : children) {
                        deleteDirectorySafely(child);
                    }
                }
            }
            fileOrDir.delete();
        } catch (Throwable ignored) {
        }
    }
}
