import { expect, test } from '@jest/globals';

import { phones } from '../../content';
import { phoneCategories } from './phones';

test('categories keep the file order, emergency ones first', () => {
  const categories = phoneCategories([
    { category: 'Serviços', name: 'A', number: '1', emergency: false },
    { category: 'Emergência', name: 'B', number: '2', emergency: true },
    { category: 'Serviços', name: 'C', number: '3', emergency: false },
  ]);

  expect(categories.map((c) => [c.name, c.emergency, c.phones.map((p) => p.name)])).toEqual([
    ['Emergência', true, ['B']],
    ['Serviços', false, ['A', 'C']],
  ]);
});

test('the content opens with the emergency numbers', () => {
  expect(phoneCategories(phones)[0].phones.map((p) => p.number)).toEqual(['192', '193', '190', '199']);
});
