package com.jaiz.jivanos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JivanGoogleDrivePlugin.class);
        registerPlugin(JivanDropboxPlugin.class);
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(
                    new JivanLocalBackupBridge(this),
                    "JivanAndroidBackup"
            );
        }
    }
}
