import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const PREF_KEY = 'cg-reminders';

export async function remindersEnabled() {
  try {
    const v = await SecureStore.getItemAsync(PREF_KEY);
    return v === null ? null : v !== '0';
  } catch {
    return null;
  }
}

export async function setRemindersEnabled(v) {
  try {
    await SecureStore.setItemAsync(PREF_KEY, v ? '1' : '0');
  } catch { /* ignore */ }
  if (v) {
    await ensurePermission();
  } else {
    try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
  }
}

export async function ensurePermission() {
  if (!Device.isDevice) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted || cur.ios?.status === 3) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

function permissionAlreadyGranted() {
  return Notifications.getPermissionsAsync().then((cur) => !!(cur.granted || cur.ios?.status === 3)).catch(() => false);
}

// Schedules daily repeating reminders from the live care plan.
// Call after tasks load; replaces previous day's schedule (idempotent).
export async function rescheduleFromPlan(exercises, medicines) {
  try {
    const pref = await remindersEnabled();
    if (pref === false) return { scheduled: 0, reason: 'disabled' };
    if (pref === null && !(await permissionAlreadyGranted())) {
      return { scheduled: 0, reason: 'not-enabled' };
    }
    if (!(await ensurePermission())) return { scheduled: 0, reason: 'no-permission' };
    await Notifications.cancelAllScheduledNotificationsAsync();
    let n = 0;
    const at = (h, m) => {
      const d = new Date();
      d.setHours(h, m || 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    };
    const queue = [];
    for (const a of medicines || []) {
      const times = (a.scheduleTimes || []).length ? a.scheduleTimes : ['08:00'];
      for (const t of times) {
        const [h, m] = String(t).split(':').map((v) => parseInt(v, 10));
        if ([h, m].some((v) => Number.isNaN(v))) continue;
        queue.push({
          title: 'Medicine time',
          body: `${a.medicine?.name || 'Medicine'} ${a.dosage || ''} — mark taken in PARKO Care.`.trim(),
          date: at(h, m),
        });
      }
    }
    if ((exercises || []).length) {
      queue.push({ title: 'Exercise session', body: `Today's physiotherapy exercises are waiting in PARKO Care.`, date: at(9, 30) });
    }
    queue.push({ title: 'Daily check-in', body: 'How is the patient feeling today? Complete the check-in.', date: at(20, 0) });
    for (const q of queue.slice(0, 20)) {
      await Notifications.scheduleNotificationAsync({ content: { title: q.title, body: q.body }, trigger: { type: 'date', date: q.date } });
      // repeat daily: schedule next 6 occurrences too (7-day horizon, refreshed on each app open)
      for (let d = 1; d < 7; d++) {
        const next = new Date(q.date.getTime() + d * 864e5);
        await Notifications.scheduleNotificationAsync({ content: { title: q.title, body: q.body }, trigger: { type: 'date', date: next } });
      }
      n++;
    }
    return { scheduled: n };
  } catch (e) {
    return { scheduled: 0, reason: String(e?.message || e) };
  }
}
