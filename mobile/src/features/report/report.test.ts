import { expect, test } from '@jest/globals';

import { localInstant, type DoseRecord, type Medication, type Period } from '../medications/doses';
import { buildReport, formatDelay, median, percent } from './report';
import { medicationListHtml, regularityHtml, reportFootnote, scheduledDays } from './reportHtml';

const at = (date: string, time: string) => localInstant(date, time).toISOString();

const medication: Medication = {
  id: 'med', name: 'Losartana <50>', dose: '50 mg', times: ['08:00', '20:00'],
  paused: false, sharedWithContact: true, deleted: false, updatedAt: at('2026-11-10', '07:00'),
};

// Created on the 10th at 08:00 and 20:00, paused on the 12th, resumed on the 13th at 20:00 alone.
const periods: Period[] = [
  { id: 'p1', medicationId: 'med', startsAt: at('2026-11-10', '07:00'), times: ['08:00', '20:00'], paused: false },
  { id: 'p2', medicationId: 'med', startsAt: at('2026-11-12', '00:00'), times: ['08:00', '20:00'], paused: true },
  { id: 'p3', medicationId: 'med', startsAt: at('2026-11-13', '00:00'), times: ['20:00'], paused: false },
];

const taken = (date: string, time: string, takenAt: string): DoseRecord =>
  ({ id: `${date} ${time}`, medicationId: 'med', scheduledDate: date, scheduledTime: time, takenAt: at(date, takenAt) });

const records = [
  taken('2026-11-10', '08:00', '08:10'),
  taken('2026-11-10', '20:00', '20:30'),
  taken('2026-11-11', '08:00', '07:50'),
  taken('2026-11-13', '20:00', '21:00'),
];

test('counts the doses past their deadline, leaving out paused days and the ones still on time', () => {
  // The 14th at 20:30: today's 20:00 dose is still within its hour.
  const report = buildReport(5, [medication], periods, records, localInstant('2026-11-14', '20:30'));
  expect(report.from).toBe('2026-11-10');
  const [entry] = report.medications;
  expect(entry).toMatchObject({ expected: 4 + 1, taken: 4, unconfirmed: 1, times: ['08:00', '20:00'] });
  expect(entry.typicalDelay).toBe(20);
  expect(entry.days.map(({ states }) => states)).toEqual([
    { '08:00': 'taken', '20:00': 'taken' },
    { '08:00': 'taken', '20:00': 'unconfirmed' },
    { '08:00': 'paused', '20:00': 'paused' },
    { '20:00': 'taken' },
    { '20:00': 'pending' },
  ]);
  expect(percent(report.taken, report.expected)).toBe(80);
});

test('a medication removed before the period is left out, and one removed during it stays', () => {
  const removed = { ...medication, deleted: true, updatedAt: at('2026-11-11', '12:00') };
  const before = records.filter((record) => record.scheduledDate < '2026-11-12');
  expect(buildReport(2, [removed], periods, before, localInstant('2026-11-14', '23:00')).medications).toEqual([]);
  expect(buildReport(5, [removed], periods, before, localInstant('2026-11-14', '23:00')).medications[0].expected).toBe(3);
});

test('the typical delay is the median and reads as people say it', () => {
  expect(median([5, 1, 3])).toBe(3);
  expect(median([1, 2])).toBe(1.5);
  expect(median([])).toBeNull();
  expect(formatDelay(null)).toBe('—');
  expect(formatDelay(-5)).toBe('no horário ou antes');
  expect(formatDelay(15)).toBe('15 min depois');
  expect(formatDelay(80)).toBe('1 h 20 min depois');
  expect(formatDelay(120)).toBe('2 h depois');
});

test('the documents escape names and carry the required footnote', () => {
  const report = buildReport(5, [medication], periods, records, localInstant('2026-11-14', '23:00'));
  const html = regularityHtml(report, [medication], 'Maria & José');
  expect(html).toContain('Losartana &#60;50&#62;');
  expect(html).toContain('Maria &#38; José');
  expect(html).toContain('4 de 6');
  expect(html).toContain(reportFootnote);
  expect(html).not.toMatch(/monitoramento|controle do tratamento/i);
  expect(medicationListHtml([medication], null, '2026-11-14')).toContain('08:00, 20:00');
});

test('the grid starts at the first scheduled day, so a new medication has no empty rows', () => {
  const report = buildReport(30, [medication], periods, records, localInstant('2026-11-14', '23:00'));
  const days = scheduledDays(report.medications[0].days);
  expect(days[0].date).toBe('2026-11-10');
  expect(days.at(-1)?.date).toBe('2026-11-14');
  expect(regularityHtml(report, [medication], null)).not.toContain('<footer');
});
