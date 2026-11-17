import { expect, test } from '@jest/globals';

import { conditionLabels, toggleCondition } from './health';

test('"nenhuma" excludes every other condition', () => {
  expect(toggleCondition(['diabetes', 'rins'], 'nenhuma')).toEqual(['nenhuma']);
  expect(toggleCondition(['nenhuma'], 'diabetes')).toEqual(['diabetes']);
  expect(toggleCondition(['diabetes'], 'diabetes')).toEqual([]);
});

test('labels show the free text of "outra"', () => {
  expect(conditionLabels(['hipertensao', 'outra'], 'Glaucoma')).toEqual(['Pressão alta', 'Glaucoma']);
  expect(conditionLabels(['outra'], null)).toEqual(['Outra']);
});
