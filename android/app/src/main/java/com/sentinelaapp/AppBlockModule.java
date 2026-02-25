package com.sentinelaapp;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.media.projection.MediaProjectionManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import java.io.ByteArrayOutputStream;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.provider.Settings;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONObject;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.HashSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    public void copyToClipboard(String text, Promise promise) {
        try {
            ClipboardManager clipboard = (ClipboardManager) reactContext.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null && text != null) {
                clipboard.setPrimaryClip(ClipData.newPlainText("Sentinela", text));
                promise.resolve(true);
            } else {
                promise.reject("ERROR", "Clipboard unavailable");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setRestModeActive(boolean active, Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyRestModeActive(), active).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setForceBlockNow(boolean enabled, Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            prefs.edit().putBoolean(SentinelaAccessibilityService.getKeyForceBlockNow(), enabled).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getInstalledApps(Promise promise) {
        try {
            PackageManager pm = reactContext.getPackageManager();
            WritableArray result = Arguments.createArray();
            int iconSizePx = (int) (48 * reactContext.getResources().getDisplayMetrics().density);

            Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> launchables = pm.queryIntentActivities(launcherIntent, 0);
            Set<String> seenPackages = new HashSet<>();

            List<ResolveInfo> sortedLaunchables = new ArrayList<>(launchables);
            Collections.sort(
                sortedLaunchables,
                (a, b) -> {
                    CharSequence la = a.loadLabel(pm);
                    CharSequence lb = b.loadLabel(pm);
                    String sa = la != null ? la.toString() : "";
                    String sb = lb != null ? lb.toString() : "";
                    return sa.compareToIgnoreCase(sb);
                }
            );

            for (ResolveInfo info : sortedLaunchables) {
                if (info == null || info.activityInfo == null) continue;
                ApplicationInfo appInfo = info.activityInfo.applicationInfo;
                if (appInfo == null) continue;
                String pkg = appInfo.packageName;
                if (TextUtils.isEmpty(pkg)) continue;
                if (pkg.equals(reactContext.getPackageName())) continue;
                if (seenPackages.contains(pkg)) continue;
                seenPackages.add(pkg);

                CharSequence labelSeq = info.loadLabel(pm);
                String label = labelSeq != null ? labelSeq.toString() : pkg;
                Drawable icon = info.loadIcon(pm);
                String iconBase64 = drawableToBase64(icon, iconSizePx);

                WritableMap item = Arguments.createMap();
                item.putString("packageName", pkg);
                item.putString("label", label);
                if (iconBase64 != null) item.putString("iconUri", "data:image/png;base64," + iconBase64);
                result.pushMap(item);
            }
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private static String drawableToBase64(Drawable drawable, int sizePx) {
        try {
            Bitmap bitmap;
            if (drawable instanceof BitmapDrawable) {
                bitmap = ((BitmapDrawable) drawable).getBitmap();
            } else {
                bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, sizePx, sizePx);
                drawable.draw(canvas);
            }
            if (bitmap != null) {
                Bitmap scaled = Bitmap.createScaledBitmap(bitmap, sizePx, sizePx, true);
                if (scaled != bitmap) bitmap.recycle();
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                scaled.compress(Bitmap.CompressFormat.PNG, 85, stream);
                byte[] bytes = stream.toByteArray();
                scaled.recycle();
                return Base64.encodeToString(bytes, Base64.NO_WRAP);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static final String KEY_TEMP_UNLOCKS = "temp_app_unlocks";

    @ReactMethod
    public void addTemporaryUnlock(String packageName, double expiresAtMs, Promise promise) {
        try {
            if (TextUtils.isEmpty(packageName)) {
                promise.resolve(true);
                return;
            }
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            String raw = prefs.getString(KEY_TEMP_UNLOCKS, "[]");
            JSONArray arr = new JSONArray(raw);
            long now = System.currentTimeMillis();
            JSONArray kept = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (o.optLong("exp", 0) > now) kept.put(o);
            }
            JSONObject entry = new JSONObject();
            entry.put("pkg", packageName);
            entry.put("exp", (long) expiresAtMs);
            kept.put(entry);
            prefs.edit().putString(KEY_TEMP_UNLOCKS, kept.toString()).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    static String getKeyTempUnlocks() {
        return KEY_TEMP_UNLOCKS;
    }

    @ReactMethod
    public void addThirtyMinutes(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(
                    SentinelaAccessibilityService.getPrefsName(), 0);
            String packageName = prefs.getString(
                    SentinelaAccessibilityService.getKeyLastForegroundPackage(),
                    null
            );

            if (TextUtils.isEmpty(packageName) || packageName.equals(reactContext.getPackageName())) {
                promise.resolve(false);
                return;
            }

            long now = System.currentTimeMillis();
            long expiresAtMs = now + (30L * 60L * 1000L);
            String raw = prefs.getString(KEY_TEMP_UNLOCKS, "[]");
            JSONArray arr = new JSONArray(raw);
            JSONArray kept = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (o.optLong("exp", 0) > now) kept.put(o);
            }
            JSONObject entry = new JSONObject();
            entry.put("pkg", packageName);
            entry.put("exp", expiresAtMs);
            kept.put(entry);
            prefs.edit().putString(KEY_TEMP_UNLOCKS, kept.toString()).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestLiveScreenPermission(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("ERROR", "Atividade atual indisponível");
                return;
            }
            MediaProjectionManager manager =
                    (MediaProjectionManager) reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (manager == null) {
                promise.reject("ERROR", "MediaProjection indisponível");
                return;
            }
            Intent intent = manager.createScreenCaptureIntent();
            activity.startActivityForResult(intent, 41991);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getUsageSummary(Promise promise) {
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) reactContext.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) {
                promise.reject("ERROR", "UsageStatsManager indisponível");
                return;
            }

            long now = System.currentTimeMillis();
            long start = now - (7L * 24L * 60L * 60L * 1000L);
            List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now);
            if (stats == null || stats.isEmpty()) {
                promise.reject("PERMISSION", "Sem dados de uso (permita acesso a uso do app)");
                return;
            }

            Map<String, Long> totalPerPkg = new HashMap<>();
            Map<String, Long> totalPerDay = new HashMap<>();

            Calendar cal = Calendar.getInstance();
            for (UsageStats s : stats) {
                if (s == null || s.getTotalTimeInForeground() <= 0) continue;
                String pkg = s.getPackageName();
                if (TextUtils.isEmpty(pkg) || pkg.equals(reactContext.getPackageName())) continue;
                long fg = s.getTotalTimeInForeground();
                totalPerPkg.put(pkg, totalPerPkg.getOrDefault(pkg, 0L) + fg);

                cal.setTimeInMillis(s.getLastTimeUsed() > 0 ? s.getLastTimeUsed() : now);
                String dayKey = String.format(
                        Locale.US,
                        "%04d-%02d-%02d",
                        cal.get(Calendar.YEAR),
                        cal.get(Calendar.MONTH) + 1,
                        cal.get(Calendar.DAY_OF_MONTH)
                );
                totalPerDay.put(dayKey, totalPerDay.getOrDefault(dayKey, 0L) + fg);
            }

            WritableMap out = Arguments.createMap();
            WritableArray weekly = Arguments.createArray();
            String[] labels = new String[] {"Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"};
            for (int i = 6; i >= 0; i--) {
                Calendar c = Calendar.getInstance();
                c.setTimeInMillis(now - (long) i * 24L * 60L * 60L * 1000L);
                String key = String.format(
                        Locale.US,
                        "%04d-%02d-%02d",
                        c.get(Calendar.YEAR),
                        c.get(Calendar.MONTH) + 1,
                        c.get(Calendar.DAY_OF_MONTH)
                );
                long ms = totalPerDay.getOrDefault(key, 0L);
                WritableMap d = Arguments.createMap();
                d.putString("day", labels[c.get(Calendar.DAY_OF_WEEK) - 1]);
                d.putDouble("minutes", ms / 60000.0);
                weekly.pushMap(d);
            }

            List<Map.Entry<String, Long>> top = new ArrayList<>(totalPerPkg.entrySet());
            top.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
            WritableArray topApps = Arguments.createArray();
            int iconSizePx = (int) (40 * reactContext.getResources().getDisplayMetrics().density);
            PackageManager pm = reactContext.getPackageManager();
            int limit = Math.min(top.size(), 50);
            for (int i = 0; i < limit; i++) {
                Map.Entry<String, Long> entry = top.get(i);
                String pkg = entry.getKey();
                long ms = entry.getValue();
                String label = pkg;
                String iconUri = null;
                try {
                    ApplicationInfo appInfo = pm.getApplicationInfo(pkg, 0);
                    CharSequence l = pm.getApplicationLabel(appInfo);
                    if (l != null) label = l.toString();
                    Drawable icon = pm.getApplicationIcon(appInfo);
                    String base64 = drawableToBase64(icon, iconSizePx);
                    if (base64 != null) iconUri = "data:image/png;base64," + base64;
                } catch (Exception ignored) {}

                WritableMap app = Arguments.createMap();
                app.putString("packageName", pkg);
                app.putString("label", label);
                app.putDouble("minutes", ms / 60000.0);
                if (iconUri != null) app.putString("iconUri", iconUri);
                topApps.pushMap(app);
            }

            out.putArray("weekly", weekly);
            out.putArray("topApps", topApps);
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
