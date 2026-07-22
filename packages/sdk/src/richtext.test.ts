import { describe, expect, it } from 'vitest';
import { renderInline, renderRichTextHtml } from './richtext.js';

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

  it('blocks javascript: URLs in links', () => {
    expect(renderInline('[click](javascript:alert(1))')).not.toContain('<a href="javascript:');
  });
});

describe('renderRichTextHtml', () => {
  it('renders every block type and resolves image keys via mediaUrl', () => {
    const html = renderRichTextHtml(
      [
        { type: 'paragraph', text: 'Hello **world**' },
        { type: 'heading', level: 2, text: 'Title' },
        { type: 'list', ordered: false, items: ['a', 'b'] },
        { type: 'quote', text: 'wise words' },
        { type: 'code', code: 'a < b' },
        { type: 'image', key: 'k.png', alt: 'alt' },
      ],
      { mediaUrl: (key) => `https://cdn.test/${key}` },
    );
    expect(html).toContain('<p>Hello <strong>world</strong></p>');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<blockquote>wise words</blockquote>');
    expect(html).toContain('<pre><code>a &lt; b</code></pre>');
    expect(html).toContain('<img src="https://cdn.test/k.png" alt="alt" />');
  });

  it('returns an empty string for empty/undefined content', () => {
    expect(renderRichTextHtml(undefined)).toBe('');
    expect(renderRichTextHtml([])).toBe('');
  });

  it('never emits an unescaped script tag', () => {
    const html = renderRichTextHtml([{ type: 'paragraph', text: '<script>alert(1)</script>' }]);
    expect(html).not.toContain('<script>');
  });
});
