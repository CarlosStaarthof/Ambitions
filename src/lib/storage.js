import localforage from "localforage";

const store = localforage.createInstance({ name: "my-time", storeName: "kv" });

export async function loadKey(key) { try { return await store.getItem(key); } catch { return null; } }
export async function saveKey(key, val) { try { await store.setItem(key, val); } catch (e) { console.error("save failed", e); } }
