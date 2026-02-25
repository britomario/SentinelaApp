package com.sentinelaapp;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Arrays;
import java.util.Set;

/**
 * Bloqueia apps quando o usuário tenta abri-los.
 * AUTOPROTEÇÃO: impede desativação da proteção de rede ou desinstalação do Sentinela.
 * Quando com.android.settings ganha foco, verifica se é tela de rede sensível ou
 * Informações do App do Sentinela → executa GLOBAL_ACTION_HOME.
 */
public class SentinelaAccessibilityService extends AccessibilityService {
    private static final String TAG = "SentinelaBlock";
    private static final String PREFS = "SentinelaPrefs";
    private static final String KEY_BLOCKED = "blocked_packages";
    private static final String KEY_ENABLED = "blocking_enabled";
    private static final String KEY_ANTI_TAMPERING = "anti_tampering_enabled";
    private static final String KEY_REST_MODE_ACTIVE = "rest_mode_active";
    private static final String KEY_FORCE_BLOCK_NOW = "force_block_now";
    private static final String KEY_LAST_FOREGROUND_PACKAGE = "last_foreground_package";

    /** Package do Sentinela — permite desligar o Modo Descanso mesmo com bloqueio ativo. */
    private static final String SENTINELA_PACKAGE = "com.sentinelaapp";
    private static final Set<String> ALARM_PACKAGES = new HashSet<>(Arrays.asList(
            "com.android.deskclock",
            "com.google.android.deskclock",
            "com.samsung.android.app.clock",
            "com.samsung.android.app.clockpackage",
            "com.miui.clock"
    ));

    /** System UI (status bar, nav) — evita loop quando usuário arrasta notificações. */
    private static final String SYSTEM_UI_PACKAGE = "com.android.systemui";

    private static final long BLOCK_DEBOUNCE_MS = 2500L;

    private SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());

    /** Último momento em que executamos bloqueio + bringSentinela (debounce). */
    private volatile long lastBlockAndBringAt;

    /** Launcher padrão cacheado — permite usuário ver home e tocar no Sentinela para abrir. */
    private volatile String cachedLauncherPackage;

    /** IME (teclado) padrão cacheado — evita fechar o app quando o usuário digita o PIN. */
    private volatile String cachedImePackage;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    /** Resolve o pacote do launcher padrão (home screen). */
    private String getDefaultLauncherPackage() {
        if (cachedLauncherPackage != null) return cachedLauncherPackage;
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo info = getPackageManager().resolveActivity(intent, 0);
            if (info != null && info.activityInfo != null) {
                cachedLauncherPackage = info.activityInfo.packageName;
                Log.i(TAG, "Launcher padrão: " + cachedLauncherPackage);
            }
        } catch (Exception e) {
            Log.w(TAG, "getDefaultLauncherPackage: " + e.getMessage());
        }
        return cachedLauncherPackage;
    }

    /** Resolve o pacote do teclado (IME) padrão. */
    private String getDefaultImePackage() {
        if (cachedImePackage != null) return cachedImePackage;
        try {
            String def = Settings.Secure.getString(getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
            if (def != null && def.contains("/")) {
                cachedImePackage = def.split("/")[0];
                Log.i(TAG, "IME padrão: " + cachedImePackage);
            }
        } catch (Exception e) {
            Log.w(TAG, "getDefaultImePackage: " + e.getMessage());
        }
        return cachedImePackage;
    }

    /** Retorna true se o pacote pode ser aberto no Modo Descanso. */
    private boolean isAllowedInRestMode(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        if (SENTINELA_PACKAGE.equals(packageName)) return true;
        if (packageName.equals(getPackageName())) return true;
        if (ALARM_PACKAGES.contains(packageName)) return true;
        if (SYSTEM_UI_PACKAGE.equals(packageName)) return true;
        String launcher = getDefaultLauncherPackage();
        if (launcher != null && launcher.equals(packageName)) return true;
        String ime = getDefaultImePackage();
        if (ime != null && ime.equals(packageName)) return true;
        return false;
    }

    /** Debounce: evita bloqueios em cascata em curto intervalo. */
    private boolean isWithinBlockDebounce() {
        return (System.currentTimeMillis() - lastBlockAndBringAt) < BLOCK_DEBOUNCE_MS;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;

        CharSequence pkg = event.getPackageName();
        if (pkg == null || pkg.length() == 0) return;
        String packageName = pkg.toString();
        prefs.edit().putString(KEY_LAST_FOREGROUND_PACKAGE, packageName).apply();

        // Sentinela ganhou foco: desliga kill switch e evita loop.
        if (SENTINELA_PACKAGE.equals(packageName) || packageName.equals(getPackageName())) {
            if (isForceBlockNowEnabled()) {
                prefs.edit().putBoolean(KEY_FORCE_BLOCK_NOW, false).apply();
                Log.i(TAG, "Kill switch desativado ao abrir Sentinela");
            }
            return;
        }

        // Debounce global: evita loops de abrir/fechar em cascata.
        if (isWithinBlockDebounce()) return;

        // Kill switch imediato do responsável.
        if (isForceBlockNowEnabled()) {
            lastBlockAndBringAt = System.currentTimeMillis();
            performGlobalAction(GLOBAL_ACTION_HOME);
            bringSentinelaToFront();
            return;
        }

        // Modo Descanso: bloqueia todos os apps exceto allowlist.
        if (isRestModeActive() && !isAllowedInRestMode(packageName)) {
            lastBlockAndBringAt = System.currentTimeMillis();
            Log.i(TAG, "Modo Descanso: bloqueando app " + packageName);
            performGlobalAction(GLOBAL_ACTION_HOME);
            return;
        }

        // Bloqueio de apps (lista bloqueados), exceto unlocks temporários ativos.
        if (isBlockingEnabled() && isBlocked(packageName)) {
            if (hasActiveTemporaryUnlock(packageName)) {
                return;
            }
            lastBlockAndBringAt = System.currentTimeMillis();
            Log.i(TAG, "Bloqueando app: " + packageName);
            performGlobalAction(GLOBAL_ACTION_HOME);
            return;
        }

        // ANTI-TAMPERING: monitora configurações quando usuário tenta desativar proteção ou desinstalar
        if (isAntiTamperingEnabled() && "com.android.settings".equals(packageName)) {
            handler.postDelayed(this::checkAndBlockDangerousSettings, 150);
        }
    }

    /**
     * Verifica se a tela atual é de rede sensível ou informações do app Sentinela.
     * Se for, executa GLOBAL_ACTION_HOME para impedir a ação.
     */
    private void checkAndBlockDangerousSettings() {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;

            String text = gatherAllText(root).toLowerCase();
            root.recycle();

            // Bloqueia apenas quando for tela sensível de rede ou App Info do Sentinela
            if (text.contains("sentinela") || text.contains("vpn")) {
                Log.i(TAG, "Anti-tampering: bloqueando acesso sensível em Settings");
                performGlobalAction(GLOBAL_ACTION_HOME);
            }
        } catch (Exception e) {
            Log.w(TAG, "checkAndBlockDangerousSettings: " + e.getMessage());
        }
    }

    private String gatherAllText(AccessibilityNodeInfo node) {
        StringBuilder sb = new StringBuilder();
        gatherTextRecursive(node, sb);
        return sb.toString();
    }

    private void gatherTextRecursive(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        try {
            CharSequence text = node.getText();
            if (text != null && text.length() > 0) sb.append(text).append(" ");
            CharSequence desc = node.getContentDescription();
            if (desc != null && desc.length() > 0) sb.append(desc).append(" ");
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    gatherTextRecursive(child, sb);
                    child.recycle();
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        Log.i(TAG, "AccessibilityService conectado - Anti-tampering disponível");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        Log.i(TAG, "AccessibilityService desconectado");
        return true; // true = redemand binding para resiliência
    }

    private boolean isBlockingEnabled() {
        return prefs.getBoolean(KEY_ENABLED, false);
    }

    private boolean isRestModeActive() {
        return prefs.getBoolean(KEY_REST_MODE_ACTIVE, false);
    }

    private boolean isAntiTamperingEnabled() {
        return prefs.getBoolean(KEY_ANTI_TAMPERING, true);
    }

    private boolean isForceBlockNowEnabled() {
        return prefs.getBoolean(KEY_FORCE_BLOCK_NOW, false);
    }

    private void bringSentinelaToFront() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch == null) {
                launch = new Intent(Intent.ACTION_VIEW, Uri.parse("sentinela://pair"));
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(launch);
        } catch (Exception e) {
            Log.w(TAG, "bringSentinelaToFront: " + e.getMessage());
        }
    }

    private boolean isBlocked(String packageName) {
        Set<String> blocked = prefs.getStringSet(KEY_BLOCKED, new HashSet<>());
        return blocked != null && blocked.contains(packageName);
    }

    private boolean hasActiveTemporaryUnlock(String packageName) {
        try {
            String raw = prefs.getString(AppBlockModule.getKeyTempUnlocks(), "[]");
            JSONArray arr = new JSONArray(raw);
            long now = System.currentTimeMillis();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                if (packageName.equals(o.optString("pkg", "")) && o.optLong("exp", 0) > now) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    static String getPrefsName() { return PREFS; }
    static String getKeyBlocked() { return KEY_BLOCKED; }
    static String getKeyEnabled() { return KEY_ENABLED; }
    static String getKeyAntiTampering() { return KEY_ANTI_TAMPERING; }
    static String getKeyRestModeActive() { return KEY_REST_MODE_ACTIVE; }
    static String getKeyForceBlockNow() { return KEY_FORCE_BLOCK_NOW; }
    static String getKeyLastForegroundPackage() { return KEY_LAST_FOREGROUND_PACKAGE; }
}
