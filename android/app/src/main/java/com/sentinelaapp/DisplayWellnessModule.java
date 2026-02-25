package com.sentinelaapp;

import android.content.Intent;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.graphics.PixelFormat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Modo Descanso: brilho e filtro de luz azul.
 */
public class DisplayWellnessModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private WindowManager windowManager;
    private View blueLightOverlay;

    DisplayWellnessModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "DisplayWellnessModule";
    }

    @ReactMethod
    public void setBrightness(double value, Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.System.canWrite(getReactApplicationContext())) {
                    promise.reject("PERMISSION", "Conceda permissão de WRITE_SETTINGS");
                    return;
                }
            }
            int brightness = (int) Math.max(0, Math.min(255, value * 255));
            Settings.System.putInt(
                getReactApplicationContext().getContentResolver(),
                Settings.System.SCREEN_BRIGHTNESS,
                brightness
            );
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestWriteSettingsPermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
                intent.setData(Uri.parse("package:" + getReactApplicationContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getReactApplicationContext().startActivity(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void canWriteSettings(Promise promise) {
        try {
            promise.resolve(
                Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                Settings.System.canWrite(getReactApplicationContext())
            );
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void setBlueLightFilter(boolean enabled, Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.System.canWrite(getReactApplicationContext())) {
                    promise.reject("PERMISSION", "Conceda permissão de WRITE_SETTINGS");
                    return;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                Settings.System.putInt(
                    getReactApplicationContext().getContentResolver(),
                    "night_display_activated",
                    enabled ? 1 : 0
                );
            }
            setBlueLightOverlayInternal(enabled);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setBlueLightOverlay(boolean enabled, Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                promise.reject("PERMISSION", "Conceda permissão de sobreposição");
                return;
            }
            setBlueLightOverlayInternal(enabled);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void canDrawOverlay(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true);
                return;
            }
            promise.resolve(Settings.canDrawOverlays(reactContext));
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + reactContext.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private void setBlueLightOverlayInternal(boolean enabled) {
        if (enabled) {
            if (windowManager == null) {
                windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
            }
            if (windowManager == null || blueLightOverlay != null) return;

            int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    overlayType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.START;

            View overlay = new View(reactContext);
            overlay.setBackgroundColor(Color.argb(75, 255, 170, 60));
            windowManager.addView(overlay, params);
            blueLightOverlay = overlay;
        } else if (windowManager != null && blueLightOverlay != null) {
            try {
                windowManager.removeView(blueLightOverlay);
            } catch (Exception ignored) {}
            blueLightOverlay = null;
        }
    }
}
