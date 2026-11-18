import type { Article } from '../../content';

export type ArticleSection = { title: string; articles: Article[] };

const newestFirst = (a: Article, b: Article) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'pt-BR');

// The articles tagged with one of the person's conditions come first, under "Para você"; the rest by theme.
export function articleSections(articles: Article[], conditions: string[]): ArticleSection[] {
  const sorted = [...articles].sort(newestFirst);
  const forYou = sorted.filter((a) => a.conditions.some((c) => conditions.includes(c)));
  const others = sorted.filter((a) => !forYou.includes(a));
  const themes = [...new Set(others.map((a) => a.theme))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return [
    ...(forYou.length > 0 ? [{ title: 'Para você', articles: forYou }] : []),
    ...themes.map((theme) => ({ title: theme, articles: others.filter((a) => a.theme === theme) })),
  ];
}
