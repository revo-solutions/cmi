import { expect, test } from '@jest/globals';

import { birthdayReminder, nextBirthday } from './birthday';

test('the next birthday is this year until its morning has passed', () => {
  expect(nextBirthday('1950-06-10', new Date(2026, 5, 10, 8))).toEqual(new Date(2026, 5, 10, 9));
  expect(nextBirthday('1950-06-10', new Date(2026, 5, 10, 10))).toEqual(new Date(2027, 5, 10, 9));
  expect(nextBirthday('1950-01-05', new Date(2026, 11, 31))).toEqual(new Date(2027, 0, 5, 9));
});

test('29 February falls on the 28th outside leap years', () => {
  expect(nextBirthday('1952-02-29', new Date(2026, 0, 1))).toEqual(new Date(2026, 1, 28, 9));
  expect(nextBirthday('1952-02-29', new Date(2027, 2, 1))).toEqual(new Date(2028, 1, 29, 9));
});

test('greets by first name', () => {
  const reminder = birthdayReminder('Maria da Silva', '1950-06-10', new Date(2026, 0, 1));
  expect(reminder).toMatchObject({ date: '2026-06-10', title: 'Feliz aniversário, Maria!' });
  expect(birthdayReminder(null, '1950-06-10', new Date(2026, 0, 1)).title).toBe('Feliz aniversário!');
});
