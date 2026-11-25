import { minutesOfClock } from "./time";
import { notificationIdFor } from "./reminders";

// Pure planning for to-do start alerts. Like reminders.js, nothing here reads the
// clock: `from` is supplied so a test can prove tomorrow's occurrence today. The
// impure half is the existing notify.js.
export const TODO_ALERT_SOURCE = "todo";
export const TODO_ALERT_TITLE = "To-do starts now";

// The next time this local clock time comes around, at or after `from`. Built from
// local date parts so the wall-clock hour survives a DST transition; a start exactly
// at `from` counts as passed, so an item never schedules an alert in the past.
export function nextStartAt(startTime, from) {
  const minutes = minutesOfClock(startTime);
  if (minutes == null) return null;
  const base = from instanceof Date ? new Date(from.getTime()) : new Date(from);
  if (isNaN(base.getTime())) return null;
  const at = new Date(
    base.getFullYear(), base.getMonth(), base.getDate(),
    Math.floor(minutes / 60), minutes % 60, 0, 0
  );
  if (at.getTime() <= base.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

// One upcoming entry per open timed item. Re-deriving rather than storing the schedule
// is what keeps it correct after a reboot: when the time passes and the item is still
// open, the next sync plans the following day. The id must encode the occurrence and
// the item's data version as well as its identity: reconciliation only cancels and
// re-schedules entries whose id is new, so a same-day time change (or a text edit)
// that kept the id would silently leave the old alarm in place. Two items at 09:00
// still neither collide nor cancel each other because the item id is in the source.
export function plannedTodoAlerts(items, from) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.doneAt || item.id == null || item.id === "") continue;
    const at = nextStartAt(item.startTime, from);
    if (!at) continue;
    const key = `${at.toISOString()}|${item.updatedAt || ""}`;
    out.push({
      id: notificationIdFor(`${TODO_ALERT_SOURCE}:${item.id}`, at, key),
      sourceId: TODO_ALERT_SOURCE,
      at,
      title: TODO_ALERT_TITLE,
      body: String(item.text == null ? "" : item.text).trim() || "Your to-do is due to start."
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
}
