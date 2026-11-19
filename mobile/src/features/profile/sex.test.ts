import { expect, test } from '@jest/globals';

import { relationshipLabel } from '../contact/contact';
import { bySex, relationshipsFor } from './sex';

test('writes to the person in their gender', () => {
  expect(bySex('Female', 'sozinho', 'sozinha')).toBe('sozinha');
  expect(bySex('Male', 'sozinho', 'sozinha')).toBe('sozinho');
});

test('offers only the relationships that fit the person', () => {
  expect(relationshipsFor('Female', null)).toEqual(['Mother', 'Wife', 'Grandmother', 'Aunt', 'Friend', 'Other']);
  expect(relationshipsFor('Male', null)).toEqual(['Father', 'Husband', 'Grandfather', 'Uncle', 'Friend', 'Other']);
  expect(relationshipsFor('Male', 'Mother')).toContain('Mother');
  expect(relationshipsFor(null, null)).toHaveLength(10);
});

test('names a friend in the person gender', () => {
  expect(relationshipLabel('Friend', 'Female')).toBe('Amiga');
  expect(relationshipLabel('Friend', 'Male')).toBe('Amigo');
  expect(relationshipLabel('Mother', 'Female')).toBe('Mãe');
});
