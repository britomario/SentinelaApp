package com.sentinelaapp;

import android.app.Activity;
import android.content.Intent;
import android.provider.Settings;
import android.net.VpnService;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import java.util.HashSet;
import java.util.Set;

public class VpnModule extends ReactContextBaseJavaModule {

    private static final int VPN_REQUEST_CODE = 0;
    private Promise mVpnPromise;

    VpnModule(ReactApplicationContext context) {
        super(context);
        context.addActivityEventListener(new VpnActivityEventListener(this));
    }

    @Override
    public String getName() {
        return "VpnModule";
    }

    /**
     * Inicia a VPN. Exige PIN se configurado.
     * @param pin PIN de 4 dígitos ou "" quando nenhum PIN foi definido
     */
    @ReactMethod
    public void startVpn(String pin, Promise promise) {
        if (!SecurityModule.validatePinForVpn(getReactApplicationContext(), pin != null ? pin : "")) {
            promise.reject("PIN_REQUIRED", "PIN incorreto ou necessário para alterar VPN");
            return;
        }
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NULL", "Activity atual é nula");
            return;
        }
        Intent intent = VpnService.prepare(currentActivity);
        if (intent != null) {
            mVpnPromise = promise;
            currentActivity.startActivityForResult(intent, VPN_REQUEST_CODE);
        } else {
            startVpnService();
            promise.resolve(true);
        }
    }

    /**
     * Para a VPN. Exige PIN se configurado.
     */
    @ReactMethod
    public void stopVpn(String pin, Promise promise) {
        if (!SecurityModule.validatePinForVpn(getReactApplicationContext(), pin != null ? pin : "")) {
            promise.reject("PIN_REQUIRED", "PIN incorreto ou necessário para alterar VPN");
            return;
        }
        Intent intent = new Intent(getReactApplicationContext(), SentinelaVpnService.class);
        intent.setAction("STOP");
        getReactApplicationContext().startService(intent);
        promise.resolve(true);
    }

    /**
     * Atualiza a blacklist em tempo real.
     * @param domains Array de strings (ex: ["bet365.com", "betano.com"])
     */
    @ReactMethod
    public void updateBlacklist(ReadableArray domains) {
        Set<String> set = new HashSet<>();
        if (domains != null) {
            for (int i = 0; i < domains.size(); i++) {
                if (domains.getType(i) == com.facebook.react.bridge.ReadableType.String) {
                    String d = domains.getString(i);
                    if (d != null && !d.trim().isEmpty()) {
                        set.add(d.trim().toLowerCase());
                    }
                }
            }
        }
        SentinelaVpnService.updateBlacklist(set);
    }

    @ReactMethod
    public void addToBlacklist(String domain) {
        SentinelaVpnService.addToBlacklist(domain);
    }

    @ReactMethod
    public void removeFromBlacklist(String domain) {
        SentinelaVpnService.removeFromBlacklist(domain);
    }

    @ReactMethod
    public void setUpstreamDns(String upstreamDnsIp, Promise promise) {
        try {
            SentinelaVpnService.setUpstreamDns(upstreamDnsIp);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DNS_CONFIG_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setNextDnsDotHost(String dotHost, Promise promise) {
        try {
            SentinelaVpnService.setNextDnsDotHost(dotHost);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("NEXTDNS_PROFILE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getUpstreamDns(Promise promise) {
        promise.resolve(SentinelaVpnService.getUpstreamDns());
    }

    @ReactMethod
    public void isVpnActive(Promise promise) {
        promise.resolve(SentinelaVpnService.isVpnActive());
    }

    @ReactMethod
    public void openPrivateDnsSettings(Promise promise) {
        try {
            Intent intent = new Intent("android.settings.PRIVATE_DNS_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DNS_SETTINGS_ERROR", e.getMessage());
        }
    }

    void onVpnPermissionResult(int resultCode) {
        if (resultCode == Activity.RESULT_OK) {
            startVpnService();
            if (mVpnPromise != null) {
                mVpnPromise.resolve(true);
                mVpnPromise = null;
            }
        } else if (mVpnPromise != null) {
            mVpnPromise.reject("VPN_DENIED", "Permissão negada");
            mVpnPromise = null;
        }
    }

    private void startVpnService() {
        Intent intent = new Intent(getReactApplicationContext(), SentinelaVpnService.class);
        getReactApplicationContext().startService(intent);
    }

    private static class VpnActivityEventListener implements com.facebook.react.bridge.ActivityEventListener {
        private final VpnModule module;

        VpnActivityEventListener(VpnModule module) {
            this.module = module;
        }

        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == VPN_REQUEST_CODE) {
                module.onVpnPermissionResult(resultCode);
            }
        }

        @Override
        public void onNewIntent(Intent intent) {
        }
    }
}
