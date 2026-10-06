import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { diffSchedule } from "./reminders";

// Thin wrapper over @capacitor/local-notifications, same shape as secureStore.js
// and io.js: on device it talks to the plugin, in a desktop browser every call is a
// safe no-op so `npm run dev` keeps working. Nothing here throws — a reminder that
// fails to schedule must never break the screen the user is on.

const CHANNEL_ID = "reminders";

export function notifySupported() { return Capacitor.isNativePlatform(); }

// Capacitor reports "prompt-with-rationale" as a fourth state; callers only care
// whether they may schedule, may ask, or must send the user to system settings.
const norm = (s) => (s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt");

export async function notifyPermission() {
  if (!notifySupported()) return "denied";
  try { const r = await LocalNotifications.checkPermissions(); return norm(r && r.display); }
  catch { return "denied"; }
}

// Only ever called from the moment of intent — switching a reminder on in Settings.
// Never at launch, and never twice unprompted.
export async function requestNotifyPermission() {
  if (!notifySupported()) return "denied";
  try { const r = await LocalNotifications.requestPermissions(); return norm(r && r.display); }
  catch { return "denied"; }
}

export async function pendingReminders() {
  if (!notifySupported()) return [];
  try {
    const r = await LocalNotifications.getPending();
    return ((r && r.notifications) || []).map((n) => ({
      id: Number(n.id),
      at: n.schedule && n.schedule.at ? new Date(n.schedule.at) : null
    }));
  } catch { return []; }
}

async function ensureChannel() {
  // importance 4 = HIGH, visibility 1 = public. One channel for every source, so the
  // user has a single switch in Android's own settings rather than a growing list.
  try { await LocalNotifications.createChannel({ id: CHANNEL_ID, name: "Reminders", importance: 4, visibility: 1 }); }
  catch { /* channels only exist on API 26+; older devices simply ignore this */ }
}

// Reconcile the derived plan against the OS. Android drops pending alarms on reboot,
// force-stop and clock changes, so the plan is re-derived and re-applied rather than
// remembered — a stored copy of "what is scheduled" would eventually be a lie.
export async function syncReminders(plan) {
  const none = { scheduled: 0, cancelled: 0 };
  if (!notifySupported()) return none;
  try {
    if ((await notifyPermission()) !== "granted") return none;
    await ensureChannel();
    const { toCancel, toSchedule } = diffSchedule(await pendingReminders(), plan || []);
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel.map((id) => ({ id })) });
    if (toSchedule.length) {
      await LocalNotifications.schedule({
        notifications: toSchedule.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          channelId: CHANNEL_ID,
          // allowWhileIdle stays false on purpose. Every reminder here is
          // day-granularity and tolerates drift, and an exact alarm would pull in
          // SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM plus a Play Store declaration.
          schedule: { at: p.at, allowWhileIdle: false }
        }))
      });
    }
    return { scheduled: toSchedule.length, cancelled: toCancel.length };
  } catch { return none; }
}
