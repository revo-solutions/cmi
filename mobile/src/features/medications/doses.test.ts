import { expect, test } from '@jest/globals';

import { addDays, dosesOn, localInstant, nextDose, type Medication, type Period } from './doses';

const day = '2026-11-16';
const created = localInstant('2026-11-01', '00:00').toISOString();

function medication(id: string, times: string[], extra: Partial<Medication> = {}): Medication {
  return { id, name: id, dose: null, times, paused: false, sharedWithContact: false, deleted: false, updatedAt: created, ...extra };
}

function period(medicationId: string, startsAt: string, times: string[], paused = false): Period {
  return { id: `${medicationId}-${startsAt}`, medicationId, startsAt, times, paused };
}

const at = (time: string) => localInstant(day, time);
const states = (date: string, ...args: Parameters<typeof dosesOn> extends [string, ...infer Rest] ? Rest : never) =>
  dosesOn(date, ...args).map((d) => `${d.time} ${d.medication.id} ${d.state}`);

test('a dose is pending until an hour after its time, then unconfirmed, and taken once recorded', () => {
  const losartana = medication('losartana', ['08:00', '14:00', '20:00']);
  const periods = [period('losartana', created, losartana.times)];
  const records = [{ id: 'r', medicationId: 'losartana', scheduledDate: day, scheduledTime: '08:00', takenAt: at('08:05').toISOString() }];

  expect(states(day, [losartana], periods, records, at('14:59'))).toEqual([
    '08:00 losartana taken',
    '14:00 losartana pending',
    '20:00 losartana pending',
  ]);
  expect(states(day, [losartana], periods, records, at('15:00'))[1]).toBe('14:00 losartana unconfirmed');
});

test('a past day is read with the schedule it had', () => {
  const metformina = medication('metformina', ['18:00']);
  const periods = [period('metformina', created, ['08:00']), period('metformina', at('12:00').toISOString(), ['18:00'])];

  expect(states(day, [metformina], periods, [], at('23:00'))).toEqual(['08:00 metformina unconfirmed', '18:00 metformina unconfirmed']);
  expect(states(addDays(day, 1), [metformina], periods, [], at('23:00'))).toEqual(['18:00 metformina pending']);
});

test('a paused period shows its doses as paused, not as forgotten', () => {
  const sinvastatina = medication('sinvastatina', ['08:00', '20:00'], { paused: true });
  const periods = [period('sinvastatina', created, sinvastatina.times), period('sinvastatina', at('10:00').toISOString(), sinvastatina.times, true)];

  expect(states(day, [sinvastatina], periods, [], at('23:00'))).toEqual(['08:00 sinvastatina unconfirmed', '20:00 sinvastatina paused']);
});

test('a deleted medication keeps its doses before the deletion only', () => {
  const removed = medication('removed', ['08:00', '20:00'], { deleted: true, updatedAt: at('12:00').toISOString() });

  expect(states(day, [removed], [period('removed', created, removed.times)], [], at('23:00'))).toEqual(['08:00 removed unconfirmed']);
});

test('a dose taken before its time moved still shows as taken', () => {
  const moved = medication('moved', ['09:00']);
  const periods = [period('moved', created, ['08:00']), period('moved', at('08:30').toISOString(), ['09:00'])];
  const records = [{ id: 'r', medicationId: 'moved', scheduledDate: day, scheduledTime: '08:00', takenAt: at('08:01').toISOString() }];

  expect(states(day, [moved], periods, records, at('08:40'))).toEqual(['08:00 moved taken', '09:00 moved pending']);
});

test('the next dose is the earliest one still within its deadline', () => {
  const a = medication('a', ['08:00', '13:00']);
  const doses = dosesOn(day, [a], [period('a', created, a.times)], [], at('12:00'));

  expect(nextDose(doses)?.time).toBe('13:00');
  expect(nextDose(dosesOn(day, [a], [period('a', created, a.times)], [], at('14:30')))).toBeNull();
});
