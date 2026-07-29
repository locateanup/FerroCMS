/**
 * Block-based rich text for `richText` fields — a small, structured JSON
 * format (not raw HTML), so content authored in the admin can never inject
 * arbitrary markup. Inline formatting (bold/italic/code/links) is parsed from
 * plain text and rendered through an HTML-escaping renderer, closing the XSS
 * gap that free-form HTML input would otherwise open.
 */

import { z } from 'zod';

export const HEADING_LEVELS = [2, 3, 4] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

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
  /** Media object key (resolve to a URL via mediaUrl(key) when rendering). */
  key: string;
  alt?: string;
  caption?: string;
}
export const CALLOUT_TONES = ['info', 'tip', 'warning'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];
export interface CalloutBlock {
  type: 'callout';
  tone: CalloutTone;
  title?: string;
  text: string;
}
/** A reserved-height ad placement marker — no content, just a position. */
export interface AdSlotBlock {
  type: 'adSlot';
}

export type RichTextBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | CalloutBlock
  | AdSlotBlock;

export type RichTextValue = RichTextBlock[];

const richTextBlockSchema: z.ZodType<RichTextBlock> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string(),
  }),
  z.object({ type: z.literal('quote'), text: z.string() }),
  z.object({ type: z.literal('list'), ordered: z.boolean(), items: z.array(z.string()) }),
  z.object({ type: z.literal('code'), code: z.string(), language: z.string().optional() }),
  z.object({
    type: z.literal('image'),
    key: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal('callout'),
    tone: z.enum(CALLOUT_TONES),
    title: z.string().optional(),
    text: z.string(),
  }),
  z.object({ type: z.literal('adSlot') }),
]);

/** Zod schema for a full rich-text value (an array of blocks). */
export const richTextValueSchema = z.array(richTextBlockSchema);

export function emptyRichText(): RichTextValue {
  return [];
}

// --- Safe rendering -------------------------------------------------------

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
  /** Resolve an image block's media key to a URL. Defaults to returning the key as-is. */
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
    case 'callout': {
      const title = block.title
        ? `<strong class="callout-title">${renderInline(block.title)}</strong>`
        : '';
      return `<div class="callout callout-${block.tone}">${title}<p>${renderInline(block.text)}</p></div>`;
    }
    case 'adSlot':
      return `<div class="ad-slot" data-ad-slot="true"></div>`;
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
