/**
 * Render a FerroCMS `richText` field (a structured JSON block array — never
 * raw HTML) into safe HTML for your front-end. Dependency-free, and mirrors
 * the block contract used by the admin editor and `@ferrocms/core`.
 */

export type HeadingLevel = 2 | 3 | 4;

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}
export interface HeadingBlock {
  type: 'heading';
  level: HeadingLevel;
  text: string;
}
export interface QuoteBlock {
  type: 'quote';
  text: string;
}
export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}
export interface CodeBlock {
  type: 'code';
  code: string;
  language?: string;
}
export interface ImageBlock {
  type: 'image';
  key: string;
  alt?: string;
  caption?: string;
}

export type RichTextBlock =
  ParagraphBlock | HeadingBlock | QuoteBlock | ListBlock | CodeBlock | ImageBlock;

export type RichTextValue = RichTextBlock[];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse a small inline-formatting syntax — bold, italic, inline code, and
 * links — into safe HTML. The source is HTML-escaped first, so no raw markup
 * (including via the syntax itself) can ever pass through. Only http(s) and
 * relative URLs are allowed in links.
 */
export function renderInline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
    (_m, text: string, url: string) => `<a href="${url}" rel="noopener noreferrer">${text}</a>`,
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, t: string) => `<strong>${t}</strong>`);
  s = s.replace(/\*([^*]+)\*/g, (_m, t: string) => `<em>${t}</em>`);
  s = s.replace(/_([^_]+)_/g, (_m, t: string) => `<em>${t}</em>`);
  return s;
}

export interface RenderRichTextOptions {
  /** Resolve an image block's media key to a URL, e.g. `client.mediaUrl`. */
  mediaUrl?: (key: string) => string;
}

function renderBlock(block: RichTextBlock, opts: RenderRichTextOptions): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${renderInline(block.text)}</p>`;
    case 'heading':
      return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
    case 'quote':
      return `<blockquote>${renderInline(block.text)}</blockquote>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((i) => `<li>${renderInline(i)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'code': {
      const cls = block.language ? ` class="language-${escapeHtml(block.language)}"` : '';
      return `<pre><code${cls}>${escapeHtml(block.code)}</code></pre>`;
    }
    case 'image': {
      const src = escapeHtml(opts.mediaUrl ? opts.mediaUrl(block.key) : block.key);
      const alt = escapeHtml(block.alt ?? '');
      const img = `<img src="${src}" alt="${alt}" />`;
      return block.caption
        ? `<figure>${img}<figcaption>${renderInline(block.caption)}</figcaption></figure>`
        : img;
    }
  }
}

/** Render a rich-text value into a safe HTML string. */
export function renderRichTextHtml(
  blocks: RichTextValue | undefined | null,
  opts: RenderRichTextOptions = {},
): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks.map((b) => renderBlock(b, opts)).join('\n');
}
