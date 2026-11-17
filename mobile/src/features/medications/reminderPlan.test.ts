import { expect, test } from '@jest/globals';

import type { Medication } from './doses';
import { dailyIdentifier, dailyReminders, parseIdentifier, planReminders, snoozeIdentifier } from './reminderPlan';

const id = '0b5f8a8e-3c1d-4a8e-9b7a-2f0c8d1e4a11';

function medication(extra: Partial<Medication> = {}): Medication {
  return { id, name: 'Losartana', dose: '50 mg', times: ['08:00', '20:00'], paused: false, sharedWithContact: false, deleted: false, updatedAt: '', ...extra };
}

test('identifiers carry the medication, the time and, for a snooze, the day', () => {
  expect(parseIdentifier(dailyIdentifier(id, '08:30'))).toEqual({ medicationId: id, time: '08:30', date: null });
  expect(parseIdentifier(snoozeIdentifier(id, '2026-11-16', '20:00'))).toEqual({ medicationId: id, time: '20:00', date: '2026-11-16' });
  expect(parseIdentifier('reminder-test:0')).toBeNull();
});

test('a paused or deleted medication has no daily reminders', () => {
  expect(dailyReminders([medication()]).map((r) => r.title)).toEqual(['Hora do remédio · 08:00', 'Hora do remédio · 20:00']);
  expect(dailyReminders([medication({ paused: true }), medication({ deleted: true })])).toEqual([]);
});

test('reconciling cancels what is gone or changed, schedules what is missing and leaves snoozes alone', () => {
  const wanted = dailyReminders([medication({ times: ['08:00', '12:00'], dose: '100 mg' })]);
  const scheduled = [
    { identifier: dailyIdentifier(id, '08:00'), title: 'Hora do remédio · 08:00', body: 'Losartana, 50 mg' },
    { identifier: dailyIdentifier(id, '20:00'), title: 'Hora do remédio · 20:00', body: 'Losartana, 50 mg' },
    { identifier: snoozeIdentifier(id, '2026-11-16', '08:00'), title: 'Hora do remédio · 08:00', body: 'Losartana, 50 mg' },
  ];

  const plan = planReminders(wanted, scheduled);

  expect(plan.cancel).toEqual([dailyIdentifier(id, '08:00'), dailyIdentifier(id, '20:00')]);
  expect(plan.schedule.map((r) => r.time)).toEqual(['08:00', '12:00']);
  expect(planReminders(wanted, wanted)).toEqual({ cancel: [], schedule: [] });
});
