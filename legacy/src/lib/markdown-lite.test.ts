import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline } from './markdown-lite';

describe('parseInline', () => {
  it('renders plain text as a single token', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('parses bold and italic with nested children', () => {
    const tokens = parseInline('**bold *and* italic** tail');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('bold');
    const bold = tokens[0] as { type: 'bold'; children: unknown[] };
    expect(bold.children).toHaveLength(3); // 'bold ' + italic + ' italic'
    expect(bold.children[1]).toEqual({ type: 'italic', children: [{ type: 'text', text: 'and' }] });
    expect(tokens[1]).toEqual({ type: 'text', text: ' tail' });
  });

  it('parses inline code verbatim', () => {
    expect(parseInline('use `John 3:16` here')).toEqual([
      { type: 'text', text: 'use ' },
      { type: 'code', text: 'John 3:16' },
      { type: 'text', text: ' here' },
    ]);
  });

  it('accepts http(s) and mailto links', () => {
    const tokens = parseInline('[t.me](https://t.me/ror) and [mail](mailto:a@b.co)');
    const links = tokens.filter((t) => t.type === 'link');
    expect(links).toHaveLength(2);
  });

  it('rejects javascript: and data: URLs, keeping the literal text', () => {
    const evil = '[x](javascript:alert(1))';
    const tokens = parseInline(evil);
    expect(tokens.some((t) => t.type === 'link')).toBe(false);
    expect(JSON.stringify(tokens)).toContain('javascript:alert(1)');
  });

  it('leaves unbalanced markers as text instead of throwing', () => {
    const tokens = parseInline('**oops *unbalanced `code');
    expect(tokens.every((t) => t.type === 'text')).toBe(true);
    expect(tokens.map((t) => (t as { text: string }).text).join('')).toBe('**oops *unbalanced `code');
  });
});

describe('parseBlocks', () => {
  it('splits blank-line paragraphs and maps heading/quote prefixes', () => {
    const blocks = parseBlocks(
      ['## Title here', '', 'A paragraph.', '', '> a quote', '', '### Sub'].join('\n')
    );
    expect(blocks.map((b) => b.type)).toEqual(['heading2', 'paragraph', 'quote', 'heading3']);
    expect(blocks[2].text).toBe('a quote');
  });

  it('unwraps multi-line quote blocks', () => {
    const [block] = parseBlocks('> line one\n> line two');
    expect(block.type).toBe('quote');
    expect(block.text).toBe('line one\nline two');
  });

  it('ignores blank input', () => {
    expect(parseBlocks('  \n \n')).toEqual([]);
  });
});
