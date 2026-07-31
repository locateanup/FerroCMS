import { describe, expect, it } from 'vitest';
import type { RichTextValue } from '@ferrocms/core';
import { blocksToTiptapDoc, tiptapDocToBlocks } from './richTextSerializer.js';

// The correctness that actually matters: round-tripping existing content
// through the new editor must never change what's stored. Each case here
// is checked as its own single-block document, rather than one giant
// document, so a failure points straight at the block type that broke.
const CASES: { name: string; blocks: RichTextValue }[] = [
  { name: 'plain paragraph', blocks: [{ type: 'paragraph', text: 'Just plain text.' }] },
  {
    name: 'paragraph with all inline marks',
    blocks: [
      {
        type: 'paragraph',
        text: 'A **bold** word, an *italic* word, `inline code`, and a [link](/go/partner).',
      },
    ],
  },
  { name: 'heading level 2', blocks: [{ type: 'heading', level: 2, text: 'Section title' }] },
  { name: 'heading level 4', blocks: [{ type: 'heading', level: 4, text: 'Minor heading' }] },
  { name: 'quote', blocks: [{ type: 'quote', text: 'A quoted **thought**.' }] },
  {
    name: 'unordered list',
    blocks: [{ type: 'list', ordered: false, items: ['First item', 'Second **bold** item'] }],
  },
  {
    name: 'ordered list',
    blocks: [{ type: 'list', ordered: true, items: ['Step one', 'Step two'] }],
  },
  {
    name: 'code block with language',
    blocks: [{ type: 'code', code: 'const x = 1;', language: 'ts' }],
  },
  { name: 'code block without language', blocks: [{ type: 'code', code: 'plain code' }] },
  {
    name: 'image with alt and caption',
    blocks: [{ type: 'image', key: 'media/photo.jpg', alt: 'A photo', caption: 'Caption text' }],
  },
  { name: 'image with only a key', blocks: [{ type: 'image', key: 'media/photo.jpg' }] },
  {
    name: 'callout with title',
    blocks: [{ type: 'callout', tone: 'tip', title: 'Heads up', text: 'Callout body.' }],
  },
  {
    name: 'callout without title',
    blocks: [{ type: 'callout', tone: 'warning', text: 'Callout body.' }],
  },
  { name: 'ad slot', blocks: [{ type: 'adSlot' }] },
];

describe('richTextSerializer round-trip', () => {
  for (const { name, blocks } of CASES) {
    it(`preserves ${name}`, () => {
      const doc = blocksToTiptapDoc(blocks);
      expect(tiptapDocToBlocks(doc)).toEqual(blocks);
    });
  }

  it('preserves a full multi-block document together', () => {
    const blocks: RichTextValue = CASES.flatMap((c) => c.blocks);
    const doc = blocksToTiptapDoc(blocks);
    expect(tiptapDocToBlocks(doc)).toEqual(blocks);
  });

  it('round-trips an empty document as an empty array', () => {
    const doc = blocksToTiptapDoc([]);
    expect(tiptapDocToBlocks(doc)).toEqual([]);
  });
});
