import { describe, expect, it } from 'vitest';
import {
  renderInline,
  renderRichTextHtml,
  richTextValueSchema,
  type RichTextValue,
} from './richtext.js';

describe('richTextValueSchema', () => {
  it('accepts a valid mix of blocks', () => {
    const value: RichTextValue = [
      { type: 'paragraph', text: 'Hi' },
      { type: 'heading', level: 2, text: 'Title' },
      { type: 'list', ordered: false, items: ['a', 'b'] },
      { type: 'quote', text: 'Quoted' },
      { type: 'code', code: 'const x = 1;', language: 'ts' },
      { type: 'image', key: '2026/a.png', alt: 'A' },
    ];
    expect(richTextValueSchema.safeParse(value).success).toBe(true);
  });

  it('rejects an unknown block type', () => {
    expect(richTextValueSchema.safeParse([{ type: 'video', url: 'x' }]).success).toBe(false);
  });

  it('rejects an invalid heading level', () => {
    expect(richTextValueSchema.safeParse([{ type: 'heading', level: 1, text: 'x' }]).success).toBe(
      false,
    );
  });

  it('rejects raw HTML disguised as plain fields (still just a string)', () => {
    // Structurally valid — the point is *rendering* escapes it, not validation.
    const result = richTextValueSchema.safeParse([
      { type: 'paragraph', text: '<img src=x onerror=alert(1)>' },
    ]);
    expect(result.success).toBe(true);
  });
});

describe('renderInline', () => {
  it('escapes raw HTML', () => {
    expect(renderInline('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders bold, italic, code, and links', () => {
    expect(renderInline('**bold**')).toBe('<strong>bold</strong>');
    expect(renderInline('*italic*')).toBe('<em>italic</em>');
    expect(renderInline('_italic_')).toBe('<em>italic</em>');
    expect(renderInline('`code`')).toBe('<code>code</code>');
    expect(renderInline('[go](https://example.com)')).toBe(
      '<a href="https://example.com" rel="noopener noreferrer">go</a>',
    );
  });

  it('does not allow a javascript: URL through the link syntax', () => {
    const out = renderInline('[click](javascript:alert(1))');
    expect(out).not.toContain('<a href="javascript:');
  });

  it('allows relative URLs', () => {
    expect(renderInline('[home](/about)')).toBe(
      '<a href="/about" rel="noopener noreferrer">home</a>',
    );
  });
});

describe('renderRichTextHtml', () => {
  it('renders every block type and resolves image keys via mediaUrl', () => {
    const html = renderRichTextHtml(
      [
        { type: 'paragraph', text: 'Hello **world**' },
        { type: 'heading', level: 3, text: 'Sub' },
        { type: 'list', ordered: true, items: ['one', 'two'] },
        { type: 'quote', text: 'wise words' },
        { type: 'code', code: 'a < b', language: 'ts' },
        { type: 'image', key: 'k.png', alt: 'alt text', caption: 'a **caption**' },
      ],
      { mediaUrl: (key) => `https://cdn.test/${key}` },
    );

    expect(html).toContain('<p>Hello <strong>world</strong></p>');
    expect(html).toContain('<h3>Sub</h3>');
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
    expect(html).toContain('<blockquote>wise words</blockquote>');
    expect(html).toContain('<pre><code class="language-ts">a &lt; b</code></pre>');
    expect(html).toContain('<img src="https://cdn.test/k.png" alt="alt text" />');
    expect(html).toContain('<figcaption>a <strong>caption</strong></figcaption>');
  });

  it('returns an empty string for empty/undefined content', () => {
    expect(renderRichTextHtml(undefined)).toBe('');
    expect(renderRichTextHtml([])).toBe('');
  });

  it('never emits unescaped script tags even via image alt/caption', () => {
    const html = renderRichTextHtml([
      { type: 'image', key: 'x', alt: '<script>1</script>', caption: '<script>2</script>' },
    ]);
    expect(html).not.toContain('<script>');
  });
});
