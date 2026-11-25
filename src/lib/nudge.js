import { SLOTS } from "./seed";
import { notificationIdFor } from "./reminders";

// The unrecorded-time nudge is the one source that is not a recurring wall-clock
// occurrence: it depends on what is already painted. Everything here is a pure
// function of a supplied `now` and the stored `weeks`, so the whole decision is
// unit-testable without a clock, a DOM or a notification plugin.

export const NUDGE_GAP_OPTIONS = [60, 90, 120];
export const NUDGE_GAP_DEFAULT = 60;

const BLOCK_MS = 30 * 60 * 1000;
const NUDGE_BUFFER_MS = 60 * 1000;
const NON_EMPTY = (v) => (typeof v === "string" && v.length > 0 ? v : null);

export function normalizeUnrecorded(value) {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const gap = Number(v.gapMinutes);
  return {
    enabled: v.enabled === true,
    gapMinutes: NUDGE_GAP_OPTIONS.includes(gap) ? gap : NUDGE_GAP_DEFAULT,
    lastNudgedGapStart: NON_EMPTY(v.lastNudgedGapStart),
    lastNudgedAt: NON_EMPTY(v.lastNudgedAt)
  };
}

const GAP_TEXT = { 60: "hour", 90: "1.5 hours", 120: "2 hours" };

export function nudgeGapText(gapMinutes) {
  return GAP_TEXT[Number(gapMinutes)] || GAP_TEXT[NUDGE_GAP_DEFAULT];
}

// The latest block start at or before `now` that has a painted cell, scanning the
// stored weeks rather than a fixed number of days. Reading every stored week keeps
// the gap marker stable after a long silence: a block from last month is still the
// last thing recorded, so "one nudge per gap" survives closing the app.
function latestCellStart(now, weeks) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (isNaN(t)) return null;
  let latest = null;
  for (const [key, week] of Object.entries(weeks || {})) {
    const cells = (week && week.cells) || {};
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!parts) continue;
    const y = Number(parts[1]), m = Number(parts[2]), d = Number(parts[3]);
    for (const cellKey of Object.keys(cells)) {
      const match = /^(\d)-(\d{1,2})$/.exec(cellKey);
      if (!match) continue;
      const dayIdx = Number(match[1]), slot = Number(match[2]);
      if (dayIdx < 0 || dayIdx > 6 || slot < 0 || slot >= SLOTS) continue;
      const start = new Date(y, m - 1, d + dayIdx, Math.floor(slot / 2), slot % 2 ? 30 : 0, 0, 0);
      const ms = start.getTime();
      if (ms > t) continue;
      if (latest === null || ms > latest) latest = ms;
    }
  }
  return latest;
}

export function lastRecordedBlockEnd(now, weeks) {
  const start = latestCellStart(now, weeks);
  if (start === null) return null;
  const s = new Date(start);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes() + 30, 0, 0);
}

function planEntry(at, gapKey, gapMinutes) {
  return {
    id: notificationIdFor("unrecorded", at, gapKey),
    sourceId: "unrecorded",
    at,
    title: "Unrecorded time",
    body: `You haven't recorded anything for the past ${nudgeGapText(gapMinutes)}`
  };
}

// Returns null when there is nothing to schedule. `alreadyMarked` tells App not to
// persist the marker again; it is true only while a previously scheduled nudge is
// still in the future, which keeps that entry in the plan so reconciliation does
// not cancel it on the settings write that followed its first scheduling.
export function unrecordedNudge(now, weeks, unrecorded) {
  const value = normalizeUnrecorded(unrecorded);
  if (!value.enabled) return null;

  const n = now instanceof Date ? now : new Date(now);
  const nowMs = n.getTime();
  if (isNaN(nowMs)) return null;

  const lastEnd = lastRecordedBlockEnd(n, weeks);
  const gapKey = lastEnd ? lastEnd.toISOString() : "never";
  const dueAt = lastEnd ? lastEnd.getTime() + value.gapMinutes * 60 * 1000 : nowMs;

  if (value.lastNudgedGapStart === gapKey) {
    const scheduled = value.lastNudgedAt ? new Date(value.lastNudgedAt).getTime() : NaN;
    if (isNaN(scheduled) || nowMs >= scheduled) return null;
    const at = new Date(scheduled);
    return { gapKey, alreadyMarked: true, entry: planEntry(at, gapKey, value.gapMinutes) };
  }

  const at = new Date(Math.max(nowMs + NUDGE_BUFFER_MS, dueAt));
  return { gapKey, alreadyMarked: false, entry: planEntry(at, gapKey, value.gapMinutes) };
}
