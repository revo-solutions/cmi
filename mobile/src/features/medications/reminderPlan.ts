import type { Medication } from './doses';

// What the scheduled notifications should be, worked out without the device so it can be tested. A daily reminder's
// identifier names its medication and time; a snoozed one also names the day of the dose it belongs to.

// iOS keeps at most 64 pending notifications and a daily reminder takes one; the rest is room for snoozes, the
// birthday and the end of the trial (docs/plano-app.md, phase 2).
export const maxDailyReminders = 48;

export const snoozeMinutes = 10;

export type Reminder = { identifier: string; medicationId: string; time: string; title: string; body: string };

export type ReminderKey = { medicationId: string; time: string; date: string | null };

export function dailyIdentifier(medicationId: string, time: string) {
  return `dose.${medicationId}.${time.replace(':', '')}`;
}

export function snoozeIdentifier(medicationId: string, date: string, time: string) {
  return `snooze.${medicationId}.${date}.${time.replace(':', '')}`;
}

export function parseIdentifier(identifier: string): ReminderKey | null {
  const daily = /^dose\.([0-9a-f-]+)\.(\d{2})(\d{2})$/i.exec(identifier);
  if (daily) {
    return { medicationId: daily[1], time: `${daily[2]}:${daily[3]}`, date: null };
  }

  const snooze = /^snooze\.([0-9a-f-]+)\.(\d{4}-\d{2}-\d{2})\.(\d{2})(\d{2})$/i.exec(identifier);
  return snooze ? { medicationId: snooze[1], time: `${snooze[3]}:${snooze[4]}`, date: snooze[2] } : null;
}

export function reminderText(medication: Medication, time: string) {
  return {
    title: `Hora do remédio · ${time}`,
    body: medication.dose ? `${medication.name}, ${medication.dose}` : medication.name,
  };
}

export function dailyReminders(medications: Medication[]): Reminder[] {
  return medications
    .filter((m) => !m.deleted && !m.paused)
    .flatMap((m) => m.times.map((time) => ({ identifier: dailyIdentifier(m.id, time), medicationId: m.id, time, ...reminderText(m, time) })));
}

export function countDailyReminders(medications: Medication[]) {
  return dailyReminders(medications).length;
}

// Cancel what is scheduled and no longer wanted, or whose text changed; schedule what is missing. Snoozes are left
// alone: they end by themselves.
export function planReminders(wanted: Reminder[], scheduled: { identifier: string; title: string; body: string }[]) {
  const daily = scheduled.filter((s) => s.identifier.startsWith('dose.'));
  const current = new Map(daily.map((s) => [s.identifier, s]));
  const wantedIds = new Set(wanted.map((w) => w.identifier));
  const changed = (w: Reminder) => {
    const s = current.get(w.identifier);
    return !s || s.title !== w.title || s.body !== w.body;
  };

  return {
    cancel: daily.filter((s) => !wantedIds.has(s.identifier) || changed(wanted.find((w) => w.identifier === s.identifier)!)).map((s) => s.identifier),
    schedule: wanted.filter(changed),
  };
}
