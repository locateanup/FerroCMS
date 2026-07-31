/**
 * Bridges the new Tiptap-based editor to FerroCMS's stored rich-text format.
 * This is the one place that has to get it right: everything else (the
 * server's zod validation, `renderRichTextHtml`, moneyinsider's own render
 * pipeline) depends on `RichTextValue` never changing shape, so Tiptap's
 * document model is translated to and from it here rather than replacing it.
 *
 * Inline marks only go one level deep (no bold-inside-italic-inside-link) —
 * that mirrors `packages/core/src/richtext.ts`'s `renderInline`, which is
 * itself a single, non-recursive regex pass. A user who deliberately
 * combines two marks (e.g. bold + italic on the same selection) will see a
 * best-effort nested rendering here, but the site's own renderer won't
 * recurse into it — a pre-existing limitation of the markdown-ish inline
 * syntax, not something introduced by this editor.
 */

import type { JSONContent } from '@tiptap/react';
import type { RichTextBlock, RichTextValue } from '@ferrocms/core';

// --- text -> Tiptap inline nodes ------------------------------------------

const INLINE_RE =
  /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;

function textToInline(text: string): JSONContent[] {
  if (!text) return [];
  const nodes: JSONContent[] = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push({ type: 'text', text: text.slice(last, m.index) });
    const [, code, linkText, linkHref, bold, italic, italicAlt] = m;
    if (code !== undefined) nodes.push({ type: 'text', text: code, marks: [{ type: 'code' }] });
    else if (linkText !== undefined && linkHref !== undefined)
      nodes.push({
        type: 'text',
        text: linkText,
        marks: [{ type: 'link', attrs: { href: linkHref } }],
      });
    else if (bold !== undefined) nodes.push({ type: 'text', text: bold, marks: [{ type: 'bold' }] });
    else if (italic !== undefined || italicAlt !== undefined)
      nodes.push({ type: 'text', text: (italic ?? italicAlt)!, marks: [{ type: 'italic' }] });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes;
}

// --- Tiptap inline nodes -> text -------------------------------------------

function wrapByMark(text: string, markType: string, attrs?: Record<string, unknown>): string {
  switch (markType) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'code':
      return `\`${text}\``;
    case 'link':
      return `[${text}](${(attrs?.href as string) ?? ''})`;
    default:
      return text;
  }
}

function inlineToText(content: JSONContent[] | undefined): string {
  if (!content) return '';
  return content
    .map((node) => {
      if (node.type !== 'text') return '';
      let text = node.text ?? '';
      // Applied innermost-first so e.g. bold+italic nests as **_text_** —
      // matches how a human would type combined markdown by hand.
      for (const mark of node.marks ?? []) {
        text = wrapByMark(text, mark.type, mark.attrs);
      }
      return text;
    })
    .join('');
}

// --- RichTextBlock[] -> Tiptap doc ------------------------------------------

export function blocksToTiptapDoc(blocks: RichTextValue): JSONContent {
  const content: JSONContent[] = blocks.map((block): JSONContent => {
    switch (block.type) {
      case 'paragraph':
        return { type: 'paragraph', content: textToInline(block.text) };
      case 'heading':
        return {
          type: 'heading',
          attrs: { level: block.level },
          content: textToInline(block.text),
        };
      case 'quote':
        return {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: textToInline(block.text) }],
        };
      case 'list':
        return {
          type: block.ordered ? 'orderedList' : 'bulletList',
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: textToInline(item) }],
          })),
        };
      case 'code':
        return {
          type: 'codeBlock',
          attrs: { language: block.language ?? null },
          content: block.code ? [{ type: 'text', text: block.code }] : [],
        };
      case 'image':
        return { type: 'imageBlock', attrs: { key: block.key, alt: block.alt, caption: block.caption } };
      case 'callout':
        return {
          type: 'calloutBlock',
          attrs: { tone: block.tone, title: block.title ?? null, text: block.text },
        };
      case 'adSlot':
        return { type: 'adSlotBlock' };
    }
  });
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

// --- Tiptap doc -> RichTextBlock[] ------------------------------------------

export function tiptapDocToBlocks(doc: JSONContent): RichTextValue {
  const nodes = doc.content ?? [];
  const blocks: RichTextBlock[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const text = inlineToText(node.content);
        // Tiptap always keeps at least one empty paragraph so there's
        // somewhere for the cursor to land in an otherwise-empty document —
        // that placeholder (and any other blank paragraph) is dropped
        // rather than persisted, so an empty editor saves as `[]`, not
        // `[{type:'paragraph', text:''}]`.
        if (text) blocks.push({ type: 'paragraph', text });
        break;
      }
      case 'heading':
        blocks.push({
          type: 'heading',
          level: (node.attrs?.level ?? 2) as 2 | 3 | 4,
          text: inlineToText(node.content),
        });
        break;
      case 'blockquote':
        blocks.push({
          type: 'quote',
          text: inlineToText(node.content?.[0]?.content),
        });
        break;
      case 'bulletList':
      case 'orderedList':
        blocks.push({
          type: 'list',
          ordered: node.type === 'orderedList',
          // Only the first paragraph of each item is kept — the schema's
          // `items: string[]` has no room for a nested sub-list; a user who
          // nests one loses it on save, same as if they'd never had the
          // option in a plain textarea.
          items: (node.content ?? []).map((item) => inlineToText(item.content?.[0]?.content)),
        });
        break;
      case 'codeBlock':
        blocks.push({
          type: 'code',
          code: (node.content ?? []).map((t) => t.text ?? '').join(''),
          language: (node.attrs?.language as string | undefined) ?? undefined,
        });
        break;
      case 'imageBlock':
        blocks.push({
          type: 'image',
          key: (node.attrs?.key as string) ?? '',
          alt: (node.attrs?.alt as string | undefined) ?? undefined,
          caption: (node.attrs?.caption as string | undefined) ?? undefined,
        });
        break;
      case 'calloutBlock':
        blocks.push({
          type: 'callout',
          tone: (node.attrs?.tone as 'info' | 'tip' | 'warning') ?? 'info',
          title: (node.attrs?.title as string | undefined) ?? undefined,
          text: (node.attrs?.text as string) ?? '',
        });
        break;
      case 'adSlotBlock':
        blocks.push({ type: 'adSlot' });
        break;
    }
  }

  return blocks;
}
