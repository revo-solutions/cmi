import { expect, test } from '@jest/globals';

import { parseInline, parseMarkdown } from './markdown';

test('bold splits a line into its parts', () => {
  expect(parseInline('Ligue **192** na hora.')).toEqual([
    { text: 'Ligue ', bold: false },
    { text: '192', bold: true },
    { text: ' na hora.', bold: false },
  ]);
  expect(parseInline('**Tudo**')).toEqual([{ text: 'Tudo', bold: true }]);
});

test('blocks: headings, paragraphs joined across lines, and lists', () => {
  const blocks = parseMarkdown(`Primeira linha
segunda linha.

## Título

- um
continuação
- dois
1. primeiro
2. segundo`);

  expect(blocks).toEqual([
    { type: 'paragraph', text: [{ text: 'Primeira linha segunda linha.', bold: false }] },
    { type: 'heading', text: [{ text: 'Título', bold: false }] },
    { type: 'list', ordered: false, items: [[{ text: 'um continuação', bold: false }], [{ text: 'dois', bold: false }]] },
    { type: 'list', ordered: true, items: [[{ text: 'primeiro', bold: false }], [{ text: 'segundo', bold: false }]] },
  ]);
  // A line right after a list continues its last item; a blank line ends the list.
  expect(parseMarkdown('- a\n\nDepois.')[1]).toEqual({ type: 'paragraph', text: [{ text: 'Depois.', bold: false }] });
});
