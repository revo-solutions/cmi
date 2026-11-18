import { expect, test } from '@jest/globals';

import { articles, type Article } from '../../content';
import { healthConditions } from '../profile/health';
import { articleSections } from './articles';
import { parseMarkdown } from './markdown';

function article(slug: string, theme: string, conditions: string[], date = '2026-01-01'): Article {
  return { slug, title: slug, theme, conditions, date, body: '' };
}

test('articles for the profile come first, the rest by theme, newest first', () => {
  const list = [
    article('pes', 'Saúde', ['diabetes']),
    article('golpes', 'Segurança', []),
    article('pressao', 'Saúde', ['hipertensao'], '2026-02-01'),
    article('agua', 'Bem-estar', []),
    article('sal', 'Saúde', ['hipertensao']),
  ];

  expect(articleSections(list, ['hipertensao']).map((s) => [s.title, s.articles.map((a) => a.slug)])).toEqual([
    ['Para você', ['pressao', 'sal']],
    ['Bem-estar', ['agua']],
    ['Saúde', ['pes']],
    ['Segurança', ['golpes']],
  ]);
  expect(articleSections(list, [])[0].title).toBe('Bem-estar');
});

test('the content tags articles only with known health conditions', () => {
  const codes = healthConditions.map((c) => c.code);
  for (const { slug, conditions } of articles) {
    expect([slug, conditions.filter((c) => !codes.includes(c))]).toEqual([slug, []]);
  }
});

test('the content parses into headings, paragraphs and lists', () => {
  for (const { body } of articles) {
    expect(parseMarkdown(body).length).toBeGreaterThan(0);
  }
});
