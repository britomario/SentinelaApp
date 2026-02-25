package com.sentinelaapp;

import android.content.SharedPreferences;
import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Módulo de segurança para PIN de 4 dígitos.
 * O PIN é armazenado como HMAC-SHA256(pin, salt) para evitar ataques de força bruta.
 */
public class SecurityModule extends ReactContextBaseJavaModule {
    private static final String PREFS = "SentinelaPrefs";
    private static final String KEY_PIN_HASH = "security_pin_hash";
    private static final String KEY_PIN_SALT = "security_pin_salt";

    private final ReactApplicationContext reactContext;

    SecurityModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "SecurityModule";
    }

    @ReactMethod
    public void setSecurityPin(String pin, Promise promise) {
        try {
            if (pin == null || pin.length() != 4 || !pin.matches("\\d{4}")) {
                promise.reject("INVALID_PIN", "O PIN deve ter exatamente 4 dígitos");
                return;
            }
            SharedPreferences prefs = reactContext.getSharedPreferences(PREFS, 0);
            byte[] salt = new byte[32];
            new SecureRandom().nextBytes(salt);
            String saltB64 = Base64.encodeToString(salt, Base64.NO_WRAP);
            String hashB64 = hashPin(pin, salt);
            prefs.edit()
                .putString(KEY_PIN_HASH, hashB64)
                .putString(KEY_PIN_SALT, saltB64)
                .apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void validateSecurityPin(String pin, Promise promise) {
        try {
            if (pin == null || pin.isEmpty()) {
                promise.resolve(false);
                return;
            }
            promise.resolve(validatePinInternal(pin));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void hasSecurityPin(Promise promise) {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(PREFS, 0);
            promise.resolve(prefs.contains(KEY_PIN_HASH));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void changeSecurityPin(String oldPin, String newPin, Promise promise) {
        try {
            if (!validatePinInternal(oldPin)) {
                promise.reject("WRONG_PIN", "PIN atual incorreto");
                return;
            }
            if (newPin == null || newPin.length() != 4 || !newPin.matches("\\d{4}")) {
                promise.reject("INVALID_PIN", "O novo PIN deve ter exatamente 4 dígitos");
                return;
            }
            setSecurityPin(newPin, promise);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /** Validação síncrona para VpnModule - retorna true se PIN correto ou se nenhum PIN configurado */
    public static boolean validatePinForVpn(ReactApplicationContext ctx, String pin) {
        if (ctx == null) return false;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, 0);
        if (!prefs.contains(KEY_PIN_HASH)) return true; // Sem PIN configurado = permite (primeira vez)
        if (pin == null || pin.isEmpty()) return false;
        String storedHash = prefs.getString(KEY_PIN_HASH, null);
        String storedSalt = prefs.getString(KEY_PIN_SALT, null);
        if (storedHash == null || storedSalt == null) return false;
        try {
            byte[] salt = Base64.decode(storedSalt, Base64.NO_WRAP);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            byte[] hash = mac.doFinal(pin.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            String computed = Base64.encodeToString(hash, Base64.NO_WRAP);
            return computed.equals(storedHash);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean validatePinInternal(String pin) {
        SharedPreferences prefs = reactContext.getSharedPreferences(PREFS, 0);
        String storedHash = prefs.getString(KEY_PIN_HASH, null);
        String storedSalt = prefs.getString(KEY_PIN_SALT, null);
        if (storedHash == null || storedSalt == null) return false;
        String computed = hashPin(pin, Base64.decode(storedSalt, Base64.NO_WRAP));
        return computed != null && computed.equals(storedHash);
    }

    private String hashPin(String pin, byte[] salt) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(salt, "HmacSHA256"));
            byte[] hash = mac.doFinal(pin.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.encodeToString(hash, Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }
}
