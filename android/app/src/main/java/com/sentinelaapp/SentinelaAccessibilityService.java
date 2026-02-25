package com.sentinelaapp;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.HashSet;
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

    private SharedPreferences prefs;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;

        CharSequence pkg = event.getPackageName();
        if (pkg == null || pkg.length() == 0) return;
        String packageName = pkg.toString();

        // Bloqueio de apps (lista bloqueados)
        if (isBlockingEnabled() && !packageName.equals(getPackageName()) && isBlocked(packageName)) {
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

    private boolean isAntiTamperingEnabled() {
        return prefs.getBoolean(KEY_ANTI_TAMPERING, true);
    }

    private boolean isBlocked(String packageName) {
        Set<String> blocked = prefs.getStringSet(KEY_BLOCKED, new HashSet<>());
        return blocked != null && blocked.contains(packageName);
    }

    static String getPrefsName() { return PREFS; }
    static String getKeyBlocked() { return KEY_BLOCKED; }
    static String getKeyEnabled() { return KEY_ENABLED; }
    static String getKeyAntiTampering() { return KEY_ANTI_TAMPERING; }
}
