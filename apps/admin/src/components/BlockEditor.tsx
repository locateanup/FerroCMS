import { useEffect, useRef, useState } from 'react';
import { renderRichTextHtml, type RichTextBlock, type RichTextValue } from '@ferrocms/core';
import { api } from '../lib/api.js';
import { reorder, useDragReorder } from '../lib/dragReorder.js';
import { MediaInput } from './MediaInput.js';

interface Props {
  value: unknown;
  onChange: (value: RichTextValue) => void;
}

const BLOCK_LABELS: Record<RichTextBlock['type'], string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  list: 'List',
  quote: 'Quote',
  code: 'Code',
  image: 'Image',
  callout: 'Callout',
  adSlot: 'Ad slot',
};

function newBlock(type: RichTextBlock['type']): RichTextBlock {
  switch (type) {
    case 'paragraph':
      return { type: 'paragraph', text: '' };
    case 'heading':
      return { type: 'heading', level: 2, text: '' };
    case 'list':
      return { type: 'list', ordered: false, items: [''] };
    case 'quote':
      return { type: 'quote', text: '' };
    case 'code':
      return { type: 'code', code: '' };
    case 'image':
      return { type: 'image', key: '' };
    case 'callout':
      return { type: 'callout', tone: 'info', text: '' };
    case 'adSlot':
      return { type: 'adSlot' };
  }
}

function asBlocks(value: unknown): RichTextValue {
  return Array.isArray(value) ? (value as RichTextValue) : [];
}

// Wraps the current selection of a textarea/input in markdown syntax (or
// inserts a placeholder if nothing's selected), and restores focus + a
// sensible selection afterward. Works directly on the DOM element rather
// than through the controlled `value` prop, since the caret position isn't
// otherwise recoverable across a React re-render.
function wrapSelection(
  el: HTMLTextAreaElement | HTMLInputElement,
  before: string,
  after: string,
  onChange: (next: string) => void,
  placeholder = 'text',
) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const selected = el.value.slice(start, end) || placeholder;
  const next = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

function TextToolbar({
  getEl,
  onChange,
}: {
  getEl: () => HTMLTextAreaElement | HTMLInputElement | null;
  onChange: (next: string) => void;
}) {
  function run(before: string, after: string, placeholder?: string) {
    const el = getEl();
    if (el) wrapSelection(el, before, after, onChange, placeholder);
  }
  return (
    <div className="row" style={{ gap: 2, marginBottom: 4 }}>
      <button
        type="button"
        className="btn"
        title="Bold"
        style={{ padding: '1px 8px', fontSize: 12, fontWeight: 700 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('**', '**', 'bold text')}
      >
        B
      </button>
      <button
        type="button"
        className="btn"
        title="Italic"
        style={{ padding: '1px 8px', fontSize: 12, fontStyle: 'italic' }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run('*', '*', 'italic text')}
      >
        I
      </button>
      <button
        type="button"
        className="btn"
        title="Link"
        style={{ padding: '1px 8px', fontSize: 12 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const el = getEl();
          if (!el) return;
          const url = prompt('Link URL (e.g. /go/partner or https://…)');
          if (!url) return;
          wrapSelection(el, '[', `](${url})`, onChange, 'link text');
        }}
      >
        Link
      </button>
    </div>
  );
}

/**
 * Block-based rich text editor. Content is a structured JSON array — never
 * raw HTML — so it's rendered safely on the front-end via
 * `renderRichTextHtml` (core) / `@ferrocms/sdk`'s equivalent.
 */
export function BlockEditor({ value, onChange }: Props) {
  const blocks = asBlocks(value);
  const [preview, setPreview] = useState(false);
  const { dragIndex, handleProps, dropZoneProps } = useDragReorder((from, to) =>
    onChange(reorder(blocks, from, to)),
  );

  // Index of a block that should receive focus once it's in the DOM — set
  // right after inserting a new block via Enter, cleared once focused.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const controlRefs = useRef<Record<number, HTMLTextAreaElement | HTMLInputElement | null>>({});

  useEffect(() => {
    if (focusIndex === null) return;
    const el = controlRefs.current[focusIndex];
    el?.focus();
    setFocusIndex(null);
  }, [focusIndex, blocks.length]);

  function update(i: number, next: RichTextBlock) {
    const copy = blocks.slice();
    copy[i] = next;
    onChange(copy);
  }

  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = blocks.slice();
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    onChange(copy);
  }

  function add(type: RichTextBlock['type']) {
    onChange([...blocks, newBlock(type)]);
  }

  // Pressing Enter (not Shift+Enter) in a paragraph or heading inserts a new
  // paragraph right after it and focuses that — the "just keep typing"
  // behavior a plain textarea/block-picker doesn't otherwise have.
  function insertParagraphAfter(i: number) {
    const copy = blocks.slice();
    copy.splice(i + 1, 0, newBlock('paragraph'));
    onChange(copy);
    setFocusIndex(i + 1);
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {(Object.keys(BLOCK_LABELS) as RichTextBlock['type'][]).map((type) => (
          <button
            key={type}
            type="button"
            className="btn"
            style={{ padding: '3px 9px', fontSize: 12 }}
            onClick={() => add(type)}
          >
            + {BLOCK_LABELS[type]}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn"
            style={{ padding: '3px 9px', fontSize: 12 }}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {preview ? (
        <div
          style={{ padding: '12px 14px', fontSize: 14, lineHeight: 1.6 }}
          // Safe: renderRichTextHtml escapes all text and only emits a small,
          // fixed set of tags from our own structured block data.
          dangerouslySetInnerHTML={{
            __html:
              renderRichTextHtml(blocks, { mediaUrl: api.mediaUrl }) ||
              '<p class="muted">Nothing to preview yet.</p>',
          }}
        />
      ) : blocks.length === 0 ? (
        <div style={{ padding: '16px', fontSize: 12 }} className="muted">
          No blocks yet — add one above. Text supports **bold**, *italic*, `code`, and [links](url)
          — or use the B / I / Link buttons once a text block exists.
        </div>
      ) : (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocks.map((block, i) => (
            <div
              key={i}
              {...dropZoneProps(i)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 8,
                opacity: dragIndex === i ? 0.5 : 1,
              }}
            >
              <div
                className="row"
                style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}
              >
                <span className="row" style={{ gap: 6 }}>
                  <span
                    {...handleProps(i)}
                    className="muted"
                    title="Drag to reorder"
                    style={{ cursor: 'grab' }}
                  >
                    ⠿
                  </span>
                  <span className="muted">{BLOCK_LABELS[block.type]}</span>
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    disabled={i === blocks.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    onClick={() => remove(i)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <BlockFields
                block={block}
                onChange={(next) => update(i, next)}
                onEnterNext={() => insertParagraphAfter(i)}
                registerRef={(el) => {
                  controlRefs.current[i] = el;
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  onEnterNext,
  registerRef,
}: {
  block: RichTextBlock;
  onChange: (block: RichTextBlock) => void;
  /** Enter (without Shift) in a paragraph/heading calls this instead of
   * inserting a newline/doing nothing. */
  onEnterNext: () => void;
  /** Attaches the block's primary text control so BlockEditor can focus it
   * (used right after inserting a new block via Enter). */
  registerRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  function handleEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnterNext();
    }
  }

  switch (block.type) {
    case 'paragraph':
      return (
        <div>
          <TextToolbar getEl={() => textRef.current} onChange={(text) => onChange({ ...block, text })} />
          <textarea
            ref={(el) => {
              textRef.current = el;
              registerRef(el);
            }}
            rows={3}
            value={block.text}
            placeholder="Text… Enter starts a new paragraph, Shift+Enter for a line break."
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            onKeyDown={handleEnter}
          />
        </div>
      );
    case 'quote':
      return (
        <div>
          <TextToolbar getEl={() => textRef.current} onChange={(text) => onChange({ ...block, text })} />
          <textarea
            ref={textRef}
            rows={3}
            value={block.text}
            placeholder="Text… supports **bold**, *italic*, `code`, [link](url)"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case 'heading':
      return (
        <div className="row" style={{ gap: 8 }}>
          <select
            style={{ width: 90 }}
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </select>
          <input
            ref={registerRef}
            style={{ flex: 1 }}
            value={block.text}
            placeholder="Heading text — Enter adds a paragraph below"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            onKeyDown={handleEnter}
          />
        </div>
      );
    case 'list':
      return (
        <div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={block.ordered}
              onChange={(e) => onChange({ ...block, ordered: e.target.checked })}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              Numbered
            </span>
          </label>
          <textarea
            rows={4}
            value={block.items.join('\n')}
            placeholder={'One item per line'}
            onChange={(e) => onChange({ ...block, items: e.target.value.split('\n') })}
          />
        </div>
      );
    case 'code':
      return (
        <div>
          <input
            style={{ marginBottom: 6 }}
            value={block.language ?? ''}
            placeholder="Language (optional, e.g. ts)"
            onChange={(e) => onChange({ ...block, language: e.target.value || undefined })}
          />
          <textarea
            rows={4}
            value={block.code}
            placeholder="Code…"
            style={{ fontFamily: 'var(--font-mono, monospace)' }}
            onChange={(e) => onChange({ ...block, code: e.target.value })}
          />
        </div>
      );
    case 'image':
      return (
        <div>
          <MediaInput
            value={block.key}
            onChange={(key) => onChange({ ...block, key: (key as string) ?? '' })}
          />
          <input
            style={{ marginTop: 6 }}
            value={block.alt ?? ''}
            placeholder="Alt text"
            onChange={(e) => onChange({ ...block, alt: e.target.value || undefined })}
          />
          <input
            style={{ marginTop: 6 }}
            value={block.caption ?? ''}
            placeholder="Caption (optional)"
            onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
          />
        </div>
      );
    case 'callout':
      return (
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <select
              style={{ width: 120 }}
              value={block.tone}
              onChange={(e) => onChange({ ...block, tone: e.target.value as typeof block.tone })}
            >
              <option value="info">Info</option>
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
            </select>
            <input
              style={{ flex: 1 }}
              value={block.title ?? ''}
              placeholder="Title (optional)"
              onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
            />
          </div>
          <TextToolbar getEl={() => textRef.current} onChange={(text) => onChange({ ...block, text })} />
          <textarea
            ref={textRef}
            rows={3}
            value={block.text}
            placeholder="Callout text… supports **bold**, *italic*, `code`, [link](url)"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case 'adSlot':
      return (
        <div className="muted" style={{ fontSize: 12 }}>
          Reserves a fixed-height ad placement at this position in the article. No fields — the
          front-end decides what renders here.
        </div>
      );
  }
}
