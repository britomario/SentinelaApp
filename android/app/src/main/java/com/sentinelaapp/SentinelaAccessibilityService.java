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
import java.util.List;
import java.util.Set;
import java.util.Locale;
import java.util.regex.Pattern;

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
    private static final String KEY_URL_BLOCKING_ENABLED = "url_blocking_enabled";
    private static final String KEY_BLOCKED_DOMAINS = "blocked_domains";
    private static final String KEY_WHITELIST_DOMAINS = "whitelist_domains";
    private static final String KEY_BLOCKED_KEYWORDS = "blocked_keywords";

    /** Navegadores nos quais verificamos URL */
    private static final Set<String> BROWSER_PACKAGES = new HashSet<>(Arrays.asList(
            "com.android.chrome",
            "org.mozilla.firefox",
            "org.mozilla.fennec_fdroid",
            "org.mozilla.fenix",
            "com.sec.android.app.sbrowser",
            "com.microsoft.emmx",
            "com.opera.browser",
            "com.opera.mini.native"
    ));

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

    /** Debounce para evitar excesso de checagens em TYPE_WINDOW_CONTENT_CHANGED. */
    private static final long URL_CHECK_DEBOUNCE_MS = 1500L;
    private volatile long lastUrlCheckScheduledAt;
    private volatile String lastUrlCheckPackage;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        int eventType = event.getEventType();
        CharSequence pkg = event.getPackageName();
        if (pkg == null || pkg.length() == 0) return;
        String packageName = pkg.toString();

        if (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            if (isUrlBlockingEnabled() && BROWSER_PACKAGES.contains(packageName)) {
                long now = System.currentTimeMillis();
                boolean samePkg = packageName.equals(lastUrlCheckPackage);
                if (!samePkg || (now - lastUrlCheckScheduledAt) > URL_CHECK_DEBOUNCE_MS) {
                    lastUrlCheckPackage = packageName;
                    lastUrlCheckScheduledAt = now;
                    prefs.edit().putString(KEY_LAST_FOREGROUND_PACKAGE, packageName).apply();
                    scheduleUrlChecks(packageName);
                }
            }
            return;
        }

        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
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

        // Bloqueio de URL em navegadores (proteção local)
        if (isUrlBlockingEnabled() && BROWSER_PACKAGES.contains(packageName)) {
            scheduleUrlChecks(packageName);
        }

        // ANTI-TAMPERING: monitora configurações quando usuário tenta desativar proteção ou desinstalar
        if (isAntiTamperingEnabled() && "com.android.settings".equals(packageName)) {
            handler.postDelayed(this::checkAndBlockDangerousSettings, 150);
        }
    }

    /** Agenda 5 checagens de URL (100ms, 500ms, 1s, 2s, 3s) para cobrir abertura e navegação. */
    private void scheduleUrlChecks(String packageName) {
        final long[] delays = {100, 500, 1000, 2000, 3000};
        for (long d : delays) {
            handler.postDelayed(() -> checkAndBlockUrlInBrowser(packageName), d);
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

    private boolean isUrlBlockingEnabled() {
        return prefs.getBoolean(KEY_URL_BLOCKING_ENABLED, false);
    }

    private Set<String> getBlockedDomains() {
        return loadStringSet(KEY_BLOCKED_DOMAINS);
    }

    private Set<String> getWhitelistDomains() {
        return loadStringSet(KEY_WHITELIST_DOMAINS);
    }

    private Set<String> getBlockedKeywords() {
        return loadStringSet(KEY_BLOCKED_KEYWORDS);
    }

    private Set<String> loadStringSet(String key) {
        Set<String> set = new HashSet<>();
        try {
            String raw = prefs.getString(key, "[]");
            JSONArray arr = new JSONArray(raw);
            boolean isKeywords = KEY_BLOCKED_KEYWORDS.equals(key);
            for (int i = 0; i < arr.length(); i++) {
                String s = arr.optString(i, "");
                if (s != null && !s.trim().isEmpty()) {
                    s = s.trim().toLowerCase(Locale.ROOT);
                    if (isKeywords) s = s.replaceAll("\\s+", "");
                    if (!s.isEmpty()) set.add(s);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "loadStringSet " + key + ": " + e.getMessage());
        }
        return set;
    }

    private static final Pattern DOMAIN_EXTRACT = Pattern.compile(
            "https?://([^/\\\\?#]+)", Pattern.CASE_INSENSITIVE);

    private void checkAndBlockUrlInBrowser(String packageName) {
        try {
            String foreground = prefs.getString(KEY_LAST_FOREGROUND_PACKAGE, "");
            if (!packageName.equals(foreground)) return;

            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return;

            String url = extractUrlFromRoot(root);
            root.recycle();

            if (url == null || url.isEmpty()) return;

            String domain = extractDomain(url);
            if (domain == null || domain.isEmpty()) return;

            if (shouldBlockUrl(url, domain)) {
                Log.i(TAG, "URL bloqueada: " + url);
                lastBlockAndBringAt = System.currentTimeMillis();
                performGlobalAction(GLOBAL_ACTION_HOME);
                bringSentinelaToFront();
            }
        } catch (Exception e) {
            Log.w(TAG, "checkAndBlockUrlInBrowser: " + e.getMessage());
        }
    }

    private String extractUrlFromRoot(AccessibilityNodeInfo root) {
        try {
            if (root == null) return null;
            String url = findUrlByViewId(root, "com.android.chrome:id/url_bar");
            if (url != null) return url;
            url = findUrlByViewId(root, "org.mozilla.firefox:id/mozac_browser_toolbar_url_view");
            if (url != null) return url;
            url = findUrlByViewId(root, "org.mozilla.fenix:id/mozac_browser_toolbar_url_view");
            if (url != null) return url;
            url = findUrlByViewId(root, "com.sec.android.app.sbrowser:id/location_bar_edit_text");
            if (url != null) return url;
            url = findUrlByViewId(root, "com.microsoft.emmx:id/url_bar");
            if (url != null) return url;
            url = findUrlByViewId(root, "com.opera.browser:id/url_field");
            if (url != null) return url;
            url = findUrlByViewId(root, "com.opera.mini.native:id/url_view");
            if (url != null) return url;
            url = findUrlFromText(root);
            if (url != null) return url;
            return extractUrlFromGatheredText(gatherAllText(root));
        } catch (Exception e) {
            return null;
        }
    }

    private String findUrlByViewId(AccessibilityNodeInfo root, String viewId) {
        try {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(viewId);
            if (nodes != null && !nodes.isEmpty()) {
                for (AccessibilityNodeInfo node : nodes) {
                    if (node != null && node.getText() != null) {
                        String text = node.getText().toString().trim();
                        if (text.startsWith("http://") || text.startsWith("https://")) {
                            node.recycle();
                            return text;
                        }
                    }
                }
                for (AccessibilityNodeInfo node : nodes) {
                    if (node != null) node.recycle();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String findUrlFromText(AccessibilityNodeInfo root) {
        try {
            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText("http");
            if (nodes != null && !nodes.isEmpty()) {
                for (AccessibilityNodeInfo node : nodes) {
                    if (node == null) continue;
                    CharSequence text = node.getText();
                    if (text != null) {
                        String s = text.toString().trim();
                        if (s.startsWith("http://") || s.startsWith("https://")) {
                            node.recycle();
                            return s;
                        }
                    }
                    node.recycle();
                }
            }
            return extractUrlFromGatheredText(gatherAllText(root));
        } catch (Exception e) {
            return null;
        }
    }

    private String extractUrlFromGatheredText(String text) {
        if (text == null || text.isEmpty()) return null;
        int idx = text.indexOf("https://");
        if (idx < 0) idx = text.indexOf("http://");
        if (idx < 0) return null;
        int schemeLen = (idx + 8 <= text.length() && text.startsWith("https://", idx)) ? 8 : 7;
        int end = idx + schemeLen;
        while (end < text.length()) {
            char c = text.charAt(end);
            if (c == ' ' || c == '\n' || c == '\r' || c == '"' || c == '\'' || c == ')' || c == '>') break;
            end++;
        }
        return text.substring(idx, end);
    }

    private String extractDomain(String url) {
        if (url == null) return null;
        try {
            java.util.regex.Matcher m = DOMAIN_EXTRACT.matcher(url);
            if (m.find()) {
                String host = m.group(1);
                if (host != null) {
                    int portIdx = host.indexOf(':');
                    if (portIdx >= 0) host = host.substring(0, portIdx);
                    return host.toLowerCase(Locale.ROOT);
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static final Set<String> DEFAULT_KEYWORDS = new HashSet<>(Arrays.asList(
            "bet", "porn", "xxx", "casino", "apostas", "onlyfans", "pornhub", "xvideos", "xnxx", "bet365", "betano"
    ));

    private boolean shouldBlockUrl(String url, String domain) {
        Set<String> whitelist = getWhitelistDomains();
        for (String wl : whitelist) {
            if (wl == null || wl.isEmpty()) continue;
            if (domain.equals(wl) || domain.endsWith("." + wl)) return false;
        }

        Set<String> blacklist = getBlockedDomains();
        for (String bl : blacklist) {
            if (bl == null || bl.isEmpty()) continue;
            if (domain.equals(bl) || domain.endsWith("." + bl) || bl.endsWith("." + domain)) return true;
        }

        String urlLower = url.toLowerCase(Locale.ROOT);
        Set<String> keywords = getBlockedKeywords();
        for (String kw : keywords) {
            if (kw != null && !kw.isEmpty() && urlLower.contains(kw)) return true;
        }
        for (String kw : DEFAULT_KEYWORDS) {
            if (urlLower.contains(kw)) return true;
        }
        return false;
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
    static String getKeyUrlBlockingEnabled() { return KEY_URL_BLOCKING_ENABLED; }
    static String getKeyBlockedDomains() { return KEY_BLOCKED_DOMAINS; }
    static String getKeyWhitelistDomains() { return KEY_WHITELIST_DOMAINS; }
    static String getKeyBlockedKeywords() { return KEY_BLOCKED_KEYWORDS; }
}
