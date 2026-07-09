package com.squashdb.tracker;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppIconPlugin.class);
        registerPlugin(BackupFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
