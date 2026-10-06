import localforage from "localforage";

// Current on-device store. The instance name is a permanent data key — it stays
// "ambitions" regardless of the product name, or every existing install loses its data.
const store = localforage.createInstance({ name: "ambitions", storeName: "kv" });

// V1/V2 stored data under the legacy instance name "my-time". Copy it into the
// new store once, on first load, so renaming the app never orphans anyone's data.
// The legacy instance is read-only here and is never deleted (safety net).
const legacy = localforage.createInstance({ name: "my-time", storeName: "kv" });
const KEYS = ["tasks", "categories", "questions", "weeks", "reflections", "settings"];

let migrateOnce;
function ensureMigrated() {
  if (!migrateOnce) {
    migrateOnce = (async () => {
      try {
        for (const k of KEYS) {
          const current = await store.getItem(k);
          if (current == null) {
            const old = await legacy.getItem(k);
            if (old != null) await store.setItem(k, old);
          }
        }
      } catch (e) { console.error("legacy migration failed", e); }
    })();
  }
  return migrateOnce;
}

// Returns { ok, value } rather than the bare value. Swallowing a read failure as "no
// data" is the root cause of the re-seed incident, and it opens a worse path: if the
// `weeks` read fails and the user paints one cell, setWeeksP writes a single-week object
// over the whole key and the entire history is gone. A key that is simply absent is
// { ok: true, value: null } — only a thrown read reports ok:false.
export async function loadKey(key) {
  try { await ensureMigrated(); return { ok: true, value: await store.getItem(key) }; }
  catch { return { ok: false, value: null }; }
}
export async function saveKey(key, val) { try { await store.setItem(key, val); } catch (e) { console.error("save failed", e); } }
