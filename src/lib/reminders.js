import { isoDate } from "./time";

// Pure schedule maths for local reminders. No Capacitor, no storage, no React —
// every function here is a function of a supplied `from` date, never of `new Date()`,
// which is the only reason a reminder that fires on the 27th of next month can be
// tested today. The impure half lives in notify.js.

export const REVIEW_WINDOW_DAYS = 4;   // last N calendar days of a month (domain rule)
export const REFLECTION_HOUR = 19;     // local hour reminders fire at
export const HORIZON = 6;              // future occurrences scheduled per source

// First day of the review window for the month containing `d`, at local midnight.
// Anchored to the END of the month, so it tracks month length without a table:
// Feb 25 in a common year, Feb 26 in a leap year, the 27th in a 30-day month.
export function reviewWindowStartOf(d) {
  const y = d.getFullYear(), m = d.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, daysInMonth - REVIEW_WINDOW_DAYS + 1, 0, 0, 0, 0);
}

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

// A month counts as done only when every current question has a real answer.
// Lookup is by question id, so the reserved `_ai` key (generated text, not an
// answer) can never be mistaken for one. With no questions on file nothing is
// "already answered" — otherwise the nudge would silently switch itself off.
function monthAnswered(ctx, y, m) {
  const questions = (ctx && ctx.questions) || [];
  if (!questions.length) return false;
  const answers = ((ctx && ctx.reflections) || {})[monthKey(y, m)] || {};
  return questions.every((q) => String(answers[q.id] == null ? "" : answers[q.id]).trim().length > 0);
}

// Occurrences for the monthly reflection nudge: the first evening of each month's
// review window, skipping months already answered in full. ctx: { reflections, questions }
export function reflectionOccurrences(from, count, ctx) {
  const out = [];
  const start = from instanceof Date ? from : new Date(from);
  let y = start.getFullYear(), m = start.getMonth();
  // A hard bound rather than `while (out.length < count)`: a future predicate that
  // rejects every month must not hang the app.
  const limit = Math.max(0, count) + 240;
  for (let i = 0; i < limit && out.length < count; i++, m++) {
    if (m > 11) { m -= 12; y += 1; }
    const w = reviewWindowStartOf(new Date(y, m, 1));
    // Built from local parts, so the wall-clock hour survives a DST transition.
    const at = new Date(w.getFullYear(), w.getMonth(), w.getDate(), REFLECTION_HOUR, 0, 0, 0);
    if (at.getTime() <= start.getTime()) continue;
    if (monthAnswered(ctx, y, m)) continue;
    out.push(at);
  }
  return out;
}

// The registry. Feature 6 adds a descriptor here and a default entry in
// DEFAULT_SETTINGS.reminders — the wrapper, the sync loop, the permission flow and
// the Settings list all iterate this array, so nothing else needs changing.
export const reflectionSource = {
  id: "reflection",
  title: "Monthly reflection",
  body: "The review window is open. Take a few minutes for this month's questions.",
  occurrences: reflectionOccurrences
};

export const REMINDER_SOURCES = [reflectionSource];

// Absent source or absent settings => false. Reminders are opt-in, always.
export function reminderEnabled(settings, sourceId) {
  const all = settings && settings.reminders;
  const one = all && all[sourceId];
  return !!(one && one.enabled);
}

// The full plan: `count` future occurrences per enabled source, merged and sorted.
// Disabled sources contribute nothing at all.
export function plannedReminders(sources, settings, from, count = HORIZON, ctx = {}) {
  const out = [];
  for (const src of sources || []) {
    if (!src || !src.id || typeof src.occurrences !== "function") continue;
    if (!reminderEnabled(settings, src.id)) continue;
    const dates = src.occurrences(from, count, ctx) || [];
    for (const at of dates.slice(0, count)) {
      out.push({ id: notificationIdFor(src.id, at), sourceId: src.id, at, title: src.title, body: src.body });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// FNV-1a. Android notification ids are signed 32-bit ints, so the hash is folded
// into 1…2147483647 — id 0 is avoided because the plugin treats it as unset.
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 2147483647) + 1;
}

// Stable id for (source, calendar day). Deriving it rather than storing it is what
// lets the plan be recomputed from scratch after a reboot and still line up with
// whatever the OS is already holding.
export function notificationIdFor(sourceId, at) {
  return hash32(`${sourceId}|${isoDate(at instanceof Date ? at : new Date(at))}`);
}

// Reconcile the derived plan against what the OS actually holds. Ids encode the
// day, so an entry that is still wanted is left alone rather than cancelled and
// re-scheduled — reconciliation must be a no-op when nothing has changed.
export function diffSchedule(pending, plan) {
  const wanted = new Set((plan || []).map((p) => p.id));
  const have = new Set((pending || []).map((p) => Number(p.id)));
  return {
    toCancel: [...have].filter((id) => !wanted.has(id)),
    toSchedule: (plan || []).filter((p) => !have.has(p.id))
  };
}
