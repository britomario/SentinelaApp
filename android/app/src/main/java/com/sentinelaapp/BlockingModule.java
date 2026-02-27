package com.sentinelaapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Módulo de bloqueio local de URLs ( substitui VPN/DNS ).
 * Gerencia blacklist, whitelist e keywords para o SentinelaAccessibilityService.
 */
public class BlockingModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BlockingModule";
    private final ReactApplicationContext reactContext;

    BlockingModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "BlockingModule";
    }

    @ReactMethod
    public void setUrlBlockingEnabled(boolean enabled, Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyUrlBlockingEnabled(), enabled).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isUrlBlockingEnabled(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            promise.resolve(prefs.getBoolean(SentinelaAccessibilityService.getKeyUrlBlockingEnabled(), false));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setBlacklist(ReadableArray domains, Promise promise) {
        try {
            Set<String> set = new HashSet<>();
            if (domains != null) {
                for (int i = 0; i < domains.size(); i++) {
                    if (domains.getType(i) == com.facebook.react.bridge.ReadableType.String) {
                        String d = domains.getString(i);
                        if (d != null && !d.trim().isEmpty()) {
                            set.add(d.trim().toLowerCase(Locale.ROOT));
                        }
                    }
                }
            }
            JSONArray arr = new JSONArray();
            for (String s : set) arr.put(s);
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putString(SentinelaAccessibilityService.getKeyBlockedDomains(), arr.toString()).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setWhitelist(ReadableArray domains, Promise promise) {
        try {
            Set<String> set = new HashSet<>();
            if (domains != null) {
                for (int i = 0; i < domains.size(); i++) {
                    if (domains.getType(i) == com.facebook.react.bridge.ReadableType.String) {
                        String d = domains.getString(i);
                        if (d != null && !d.trim().isEmpty()) {
                            set.add(d.trim().toLowerCase(Locale.ROOT));
                        }
                    }
                }
            }
            JSONArray arr = new JSONArray();
            for (String s : set) arr.put(s);
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putString(SentinelaAccessibilityService.getKeyWhitelistDomains(), arr.toString()).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setKeywords(ReadableArray keywords, Promise promise) {
        try {
            Set<String> set = new HashSet<>();
            if (keywords != null) {
                for (int i = 0; i < keywords.size(); i++) {
                    if (keywords.getType(i) == com.facebook.react.bridge.ReadableType.String) {
                        String k = keywords.getString(i);
                        if (k != null && !k.trim().isEmpty()) {
                            set.add(k.trim().toLowerCase(Locale.ROOT));
                        }
                    }
                }
            }
            JSONArray arr = new JSONArray();
            for (String s : set) arr.put(s);
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putString(SentinelaAccessibilityService.getKeyBlockedKeywords(), arr.toString()).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
