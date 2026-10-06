import { describe, it, expect, vi } from "vitest";

// storage.js is not pure, but `loadKey` swallowing a read failure and reporting it as
// "no data" is the exact line that caused the re-seed incident, so the stubbed store
// has to be able to throw. vi.hoisted keeps the shared handle usable from the factory,
// which runs before the module body.
const h = vi.hoisted(() => {
  const state = { get: async () => null };
  const instances = {};
  return {
    state,
    createInstance: ({ name }) => (instances[name] = instances[name] || {
      getItem: (key) => state.get(name, key),
      setItem: async () => {}
    })
  };
});

vi.mock("localforage", () => ({ default: { createInstance: h.createInstance } }));

// A fresh module per case: the legacy-migration promise is memoised per module instance.
async function freshStorage(get) {
  h.state.get = get;
  vi.resetModules();
  return await import("../../src/lib/storage.js");
}

describe("loadKey reports whether the read actually happened", () => {
  // AC-29
  it("returns ok:true with the stored value", async () => {
    const { loadKey } = await freshStorage(async (name, key) => (name === "ambitions" && key === "weeks" ? { "2026-09-21": { cells: { "0-0": "a1" } } } : null));
    await expect(loadKey("weeks")).resolves.toEqual({ ok: true, value: { "2026-09-21": { cells: { "0-0": "a1" } } } });
  });

  // AC-29 — an absent key is not a failure
  it("returns ok:true with a null value for a key that was never written", async () => {
    const { loadKey } = await freshStorage(async () => null);
    await expect(loadKey("tasks")).resolves.toEqual({ ok: true, value: null });
  });

  // AC-29 — the line that caused the incident
  it("returns ok:false when the read throws instead of pretending there is no data", async () => {
    // The legacy-migration pass logs the same failure; that noise is not the assertion.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadKey } = await freshStorage(async (name, key) => {
      if (name === "ambitions" && key === "tasks") throw new Error("IndexedDB read failed");
      return null;
    });
    await expect(loadKey("tasks")).resolves.toEqual({ ok: false, value: null });
    // other keys in the same session still read normally
    await expect(loadKey("questions")).resolves.toEqual({ ok: true, value: null });
    quiet.mockRestore();
  });

  it("reports an empty array as content-free but successfully read", async () => {
    const { loadKey } = await freshStorage(async () => []);
    await expect(loadKey("tasks")).resolves.toEqual({ ok: true, value: [] });
  });
});
