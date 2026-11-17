import { expect, test } from '@jest/globals';

import { daysInMonth, formatTime, isValidDate, parseTime, stepDate, stepHour, stepMinute, toIsoDate } from './dateFields';

const years = { min: 1900, max: 2026, start: 1956 };

test('hours wrap around midnight', () => {
  expect(stepHour({ hour: 23, minute: 30 }, 1)).toEqual({ hour: 0, minute: 30 });
  expect(stepHour({ hour: 0, minute: 30 }, -1)).toEqual({ hour: 23, minute: 30 });
});

test('minutes move to the next multiple of five and wrap without changing the hour', () => {
  expect(stepMinute({ hour: 8, minute: 7 }, 1)).toEqual({ hour: 8, minute: 10 });
  expect(stepMinute({ hour: 8, minute: 7 }, -1)).toEqual({ hour: 8, minute: 5 });
  expect(stepMinute({ hour: 8, minute: 55 }, 1)).toEqual({ hour: 8, minute: 0 });
  expect(stepMinute({ hour: 8, minute: 0 }, -1)).toEqual({ hour: 8, minute: 55 });
});

test('times read and write as HH:mm', () => {
  expect(formatTime({ hour: 8, minute: 5 })).toBe('08:05');
  expect(parseTime('20:30')).toEqual({ hour: 20, minute: 30 });
  expect(parseTime('24:00')).toBeNull();
  expect(parseTime('8:00')).toBeNull();
});

test('months know their length, leap years included', () => {
  expect(daysInMonth(2, 2024)).toBe(29);
  expect(daysInMonth(2, 2025)).toBe(28);
  expect(daysInMonth(4, 2025)).toBe(30);
  expect(daysInMonth(12, 2025)).toBe(31);
});

test('the day wraps within its month and never passes its end', () => {
  expect(stepDate({ day: 31, month: 1, year: 1950 }, 'day', 1, years)).toEqual({ day: 1, month: 1, year: 1950 });
  expect(stepDate({ day: 1, month: 3, year: 1950 }, 'day', -1, years)).toEqual({ day: 31, month: 3, year: 1950 });
  expect(stepDate({ day: 31, month: 1, year: 1950 }, 'month', 1, years)).toEqual({ day: 28, month: 2, year: 1950 });
  expect(stepDate({ day: 29, month: 2, year: 1952 }, 'year', 1, years)).toEqual({ day: 28, month: 2, year: 1953 });
});

test('the year stays within its bounds', () => {
  expect(stepDate({ day: 1, month: 1, year: 2026 }, 'year', 1, years).year).toBe(2026);
  expect(stepDate({ day: 1, month: 1, year: 1900 }, 'year', -1, years).year).toBe(1900);
});

test('an empty part starts on the first step, and an unknown year allows 29 February', () => {
  const empty = { day: null, month: null, year: null };
  expect(stepDate(empty, 'day', -1, years)).toEqual({ day: 1, month: null, year: null });
  expect(stepDate(empty, 'year', 1, years)).toEqual({ day: null, month: null, year: 1956 });
  expect(stepDate({ day: 28, month: 2, year: null }, 'day', 1, years)).toEqual({ day: 29, month: 2, year: null });
});

test('a date is valid only if its day exists', () => {
  expect(isValidDate({ day: 9, month: 3, year: null })).toBe(false);
  expect(isValidDate({ day: 29, month: 2, year: 1952 })).toBe(true);
  expect(isValidDate({ day: 29, month: 2, year: 1953 })).toBe(false);
  expect(toIsoDate({ day: 9, month: 3, year: 1950 })).toBe('1950-03-09');
});
