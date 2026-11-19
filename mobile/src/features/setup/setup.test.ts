import { expect, jest, test } from '@jest/globals';

import type { Profile } from '../profile/store';
import { firstSetupStep, isHealthCardDue } from './setup';

jest.mock('../../lib/db', () => ({ setSetting: jest.fn(), useRows: jest.fn() }));
jest.mock('../profile/store', () => ({
  hasHealthAnswers: (p: Profile) => p.conditions.length > 0 || p.livesAlone !== null,
}));

const profile: Profile = {
  name: 'Maria', sex: 'Female', birthDate: null, conditions: [], otherCondition: null,
  livesAlone: null, fellLastYear: null, visionDifficulty: null, updatedAt: null,
};

test('a restored profile skips to the permissions', () => {
  expect(firstSetupStep(profile)).toBe('about');
  expect(firstSetupStep({ ...profile, updatedAt: '2026-11-01T10:00:00.000Z' })).toBe('permissions');
});

test('the health card returns three days after it was skipped, until answered', () => {
  expect(isHealthCardDue(profile, null, '2026-11-20')).toBe(false);
  expect(isHealthCardDue(profile, '2026-11-17', '2026-11-19')).toBe(false);
  expect(isHealthCardDue(profile, '2026-11-17', '2026-11-20')).toBe(true);
  expect(isHealthCardDue({ ...profile, livesAlone: true }, '2026-11-17', '2026-11-20')).toBe(false);
});
