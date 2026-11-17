import { expect, jest, test } from '@jest/globals';

import { migrations, pendingMigrations } from './db';

jest.mock('expo-sqlite', () => ({}));

test('a fresh install runs every migration and an up-to-date one none', () => {
  expect(pendingMigrations(0)).toEqual(migrations);
  expect(pendingMigrations(migrations.length)).toEqual([]);
});

test('the first schema has every table the plan names', () => {
  const tables = [...migrations[0].matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1]);
  expect(tables).toEqual(['medications', 'medication_periods', 'dose_records', 'contact', 'profile', 'outbox', 'settings']);
});
