import { normalizeClock, normalizeOptionalClock } from "./time";
import { nextStartAt } from "./todoTimes";
import { notificationIdFor } from "./reminders";

// Pure planning for the morning digest. Like todoTimes.js nothing here reads the clock:
// `from` is supplied so a test can prove tomorrow's occurrence today. The impure half is
// the existing notify.js.
export const DIGEST_DEFAULT_TIME = "08:00";
export const DIGEST_TITLE = "Morning digest";

// Only `enabled === true` enables. A valid clock is zero-padded, an out-of-range clock
// clamps, and anything that is not clock-shaped falls back to 08:00.
export function normalizeDigest(value) {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: v.enabled === true,
    time: normalizeClock(v.time, DIGEST_DEFAULT_TIME)
  };
}

// An item belongs in the digest only while it is open and has no start alert. An item
// with just an end time still qualifies: nothing is scheduled from its end time.
export function digestItems(items) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.doneAt || item.id == null || item.id === "") continue;
    if (normalizeOptionalClock(item.startTime)) continue;
    const text = String(item.text == null ? "" : item.text).trim();
    if (!text) continue;
    out.push({ id: item.id, text });
  }
  return out;
}

// At most one entry per day. The id encodes the occurrence and the exact listed content:
// reconciliation only re-schedules an entry whose id is absent from the pending set, so
// an unchanged list must keep its id while an edit, addition or removal must replace it.
export function plannedMorningDigest(items, digest, from) {
  const value = normalizeDigest(digest);
  if (!value.enabled) return [];
  const listed = digestItems(items);
  if (!listed.length) return [];

  const at = nextStartAt(value.time, from);
  if (!at) return [];

  const body = listed.map((it) => `• ${it.text}`).join("\n");
  const key = `${at.toISOString()}|${listed.map((it) => it.id).join(",")}|${body}`;
  return [{
    id: notificationIdFor("digest", at, key),
    sourceId: "digest",
    at,
    title: DIGEST_TITLE,
    body
  }];
}
