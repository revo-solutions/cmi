import { expect, test } from '@jest/globals';

import { greeting } from './greeting';

const at = (hour: number, minute = 0) => new Date(2026, 10, 18, hour, minute);

test('greets by the period of the day', () => {
  expect(greeting(at(4, 59), 'Maria')).toBe('Boa noite, Maria');
  expect(greeting(at(5), 'Maria')).toBe('Bom dia, Maria');
  expect(greeting(at(11, 59), 'Maria')).toBe('Bom dia, Maria');
  expect(greeting(at(12), 'Maria')).toBe('Boa tarde, Maria');
  expect(greeting(at(18), 'Maria')).toBe('Boa noite, Maria');
});

test('greets without a name when the profile has none', () => {
  expect(greeting(at(9), null)).toBe('Bom dia');
  expect(greeting(at(9), '  ')).toBe('Bom dia');
});
