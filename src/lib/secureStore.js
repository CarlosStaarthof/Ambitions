import { registerPlugin, Capacitor } from "@capacitor/core";
import localforage from "localforage";

// Provider API keys do not belong in IndexedDB alongside ordinary app data. On
// device they go through SecureStorePlugin, which encrypts them with an AES key
// held in the Android Keystore (StrongBox where available), so the stored bytes
// are useless without the device's secure hardware.
const Native = registerPlugin("SecureStore");

// Browser fallback for `npm run dev`. NOT hardware-backed — there is no such thing
// in a desktop browser. Dev parity only; the native path is what ships.
const web = localforage.createInstance({ name: "ambitions", storeName: "secure" });

const isNative = () => Capacitor.isNativePlatform();

export async function secureGet(key) {
  try {
    if (isNative()) { const r = await Native.get({ key }); return (r && r.value) || ""; }
    return (await web.getItem(key)) || "";
  } catch { return ""; }
}

export async function secureSet(key, value) {
  const v = String(value || "");
  if (isNative()) { await Native.set({ key, value: v }); return; }
  if (v) await web.setItem(key, v); else await web.removeItem(key);
}

export async function secureRemove(key) {
  if (isNative()) { await Native.remove({ key }); return; }
  await web.removeItem(key);
}

export const aiKeyName = (provider) => `ai_key_${provider}`;
