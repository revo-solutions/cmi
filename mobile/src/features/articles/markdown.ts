// The Markdown subset the articles use (AGENTS.md, "Mobile"): headings, paragraphs, lists and bold.

export type Inline = { text: string; bold: boolean };

export type Block =
  | { type: 'heading'; text: Inline[] }
  | { type: 'paragraph'; text: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] };

export function parseInline(text: string): Inline[] {
  return text.split(/\*\*(.+?)\*\*/).map((part, index) => ({ text: part, bold: index % 2 === 1 })).filter((p) => p.text);
}

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: parseInline(paragraph.join(' ')) });
    }
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    }
    paragraph = [];
    list = null;
  };

  for (const line of markdown.split(/\r?\n/).map((l) => l.trim())) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const item = line.match(/^(?:([-*])|\d+\.)\s+(.*)$/);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: 'heading', text: parseInline(heading[1]) });
    } else if (item) {
      const ordered = !item[1];
      if (paragraph.length > 0 || (list && list.ordered !== ordered)) {
        flush();
      }
      list ??= { ordered, items: [] };
      list.items.push(item[2]);
    } else if (list) {
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
