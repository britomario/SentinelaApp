package com.sentinelaapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.HashSet;
import java.util.Set;

public class AppBlockModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    AppBlockModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "AppBlockModule";
    }

    @ReactMethod
    public void openNetworkSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isAccessibilityEnabled(Promise promise) {
        try {
            String service = reactContext.getPackageName() + "/" + SentinelaAccessibilityService.class.getName();
            int enabled = Settings.Secure.getInt(
                    reactContext.getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED,
                    0
            );
            if (enabled != 1) {
                promise.resolve(false);
                return;
            }
            String enabledServices = Settings.Secure.getString(
                    reactContext.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (enabledServices == null) enabledServices = "";
            promise.resolve(enabledServices.contains(service));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setBlockingEnabled(boolean enabled, Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyEnabled(), enabled).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isBlockingEnabled(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            promise.resolve(prefs.getBoolean(SentinelaAccessibilityService.getKeyEnabled(), false));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setBlockedApps(ReadableArray packages, Promise promise) {
        try {
            Set<String> set = new HashSet<>();
            if (packages != null) {
                for (int i = 0; i < packages.size(); i++) {
                    if (packages.getType(i) == com.facebook.react.bridge.ReadableType.String) {
                        String p = packages.getString(i);
                        if (!TextUtils.isEmpty(p)) set.add(p.trim());
                    }
                }
            }
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putStringSet(SentinelaAccessibilityService.getKeyBlocked(), set).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getBlockedApps(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            Set<String> set = prefs.getStringSet(SentinelaAccessibilityService.getKeyBlocked(), new HashSet<>());
            if (set == null) set = new HashSet<>();
            com.facebook.react.bridge.WritableArray arr = com.facebook.react.bridge.Arguments.createArray();
            for (String s : set) arr.pushString(s);
            promise.resolve(arr);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setAntiTamperingEnabled(boolean enabled, Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyAntiTampering(), enabled).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isAntiTamperingEnabled(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            promise.resolve(prefs.getBoolean(SentinelaAccessibilityService.getKeyAntiTampering(), true));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getInstalledApps(Promise promise) {
        try {
            PackageManager pm = reactContext.getPackageManager();
            WritableArray result = Arguments.createArray();
            for (ApplicationInfo appInfo : pm.getInstalledApplications(PackageManager.GET_META_DATA)) {
                if (pm.getLaunchIntentForPackage(appInfo.packageName) == null) continue;
                if (appInfo.packageName.equals(reactContext.getPackageName())) continue;
                CharSequence labelSeq = pm.getApplicationLabel(appInfo);
                String label = labelSeq != null ? labelSeq.toString() : appInfo.packageName;
                WritableMap item = Arguments.createMap();
                item.putString("packageName", appInfo.packageName);
                item.putString("label", label);
                result.pushMap(item);
            }
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
