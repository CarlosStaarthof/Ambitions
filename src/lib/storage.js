import localforage from "localforage";

// Storage id stays "my-time" (the V1 name) on purpose: renaming it would orphan
// data already saved on users' devices. This id is internal/invisible to users;
// the app's display name is "Tiempo" everywhere a person can see it.
const store = localforage.createInstance({ name: "my-time", storeName: "kv" });

export async function loadKey(key) { try { return await store.getItem(key); } catch { return null; } }
export async function saveKey(key, val) { try { await store.setItem(key, val); } catch (e) { console.error("save failed", e); } }
