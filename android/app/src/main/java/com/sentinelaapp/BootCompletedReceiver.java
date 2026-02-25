package com.sentinelaapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "SentinelaBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }

        Log.i(TAG, "BOOT_COMPLETED recebido: restaurando protecao infantil");

        SharedPreferences prefs = context.getSharedPreferences(
                SentinelaAccessibilityService.getPrefsName(),
                Context.MODE_PRIVATE
        );
        if (!prefs.getBoolean(SentinelaAccessibilityService.getKeyAntiTampering(), true)) {
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyAntiTampering(), true).apply();
        }
        if (!prefs.getBoolean(SentinelaAccessibilityService.getKeyEnabled(), false)) {
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyEnabled(), true).apply();
        }
    }
}
