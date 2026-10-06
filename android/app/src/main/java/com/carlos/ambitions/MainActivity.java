package com.carlos.ambitions;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate() — that is where the bridge is built.
        registerPlugin(SecureStorePlugin.class);
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);
        // Draw edge-to-edge behind the status and navigation bars. Without this
        // the WebView is laid out inside the system insets and the app looks
        // letterboxed. The web layer restores the padding via safe-area insets.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
