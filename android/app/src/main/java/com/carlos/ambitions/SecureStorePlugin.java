package com.carlos.ambitions;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Hardware-backed storage for small secrets (the user's AI provider API keys).
 *
 * The AES-256 key lives in the Android Keystore and never leaves it — we hand the
 * Keystore plaintext and get ciphertext back. Only the ciphertext is written to
 * SharedPreferences, so an attacker with the app's data directory (root, forensic
 * dump) holds bytes they cannot decrypt without the device's secure hardware.
 *
 * StrongBox (a discrete secure element) is used when the device offers it, with a
 * transparent fallback to the TEE-backed Keystore otherwise.
 *
 * Deliberately dependency-free: this replaces androidx.security's
 * EncryptedSharedPreferences so there is no third-party crypto library to track.
 */
@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "ambitions_secure_store_v1";
    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final String PREFS = "ambitions_secure_store";
    private static final int IV_LEN = 12;      // GCM standard nonce length
    private static final int TAG_BITS = 128;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static KeyGenParameterSpec.Builder specBuilder() {
        return new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256);
    }

    private SecretKey secretKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry existing = ks.getEntry(ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                KeyGenerator sb = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
                sb.init(specBuilder().setIsStrongBoxBacked(true).build());
                return sb.generateKey();
            } catch (Exception ignored) {
                // No secure element on this device — fall through to the TEE-backed key.
            }
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        kg.init(specBuilder().build());
        return kg.generateKey();
    }

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("key");
        String value = call.getString("value");
        if (name == null) { call.reject("Missing key"); return; }
        try {
            if (value == null || value.isEmpty()) {
                prefs().edit().remove(name).apply();
                call.resolve();
                return;
            }
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey());
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(value.getBytes("UTF-8"));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            prefs().edit().putString(name, Base64.encodeToString(out, Base64.NO_WRAP)).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not store secret: " + e.getMessage());
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String name = call.getString("key");
        if (name == null) { call.reject("Missing key"); return; }
        JSObject ret = new JSObject();
        try {
            String stored = prefs().getString(name, null);
            if (stored == null) { ret.put("value", ""); call.resolve(ret); return; }
            byte[] raw = Base64.decode(stored, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(TAG_BITS, raw, 0, IV_LEN));
            byte[] pt = cipher.doFinal(raw, IV_LEN, raw.length - IV_LEN);
            ret.put("value", new String(pt, "UTF-8"));
            call.resolve(ret);
        } catch (Exception e) {
            // A key rotated out from under us (app data restored elsewhere, Keystore reset)
            // is unreadable by design — report empty rather than crashing the app.
            ret.put("value", "");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String name = call.getString("key");
        if (name == null) { call.reject("Missing key"); return; }
        prefs().edit().remove(name).apply();
        call.resolve();
    }
}
