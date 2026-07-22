import { useState } from 'react';
import { renderRichTextHtml, type RichTextBlock, type RichTextValue } from '@ferrocms/core';
import { api } from '../lib/api.js';
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
  }
}

function asBlocks(value: unknown): RichTextValue {
  return Array.isArray(value) ? (value as RichTextValue) : [];
}

/**
 * Block-based rich text editor. Content is a structured JSON array — never
 * raw HTML — so it's rendered safely on the front-end via
 * `renderRichTextHtml` (core) / `@ferrocms/sdk`'s equivalent.
 */
export function BlockEditor({ value, onChange }: Props) {
  const blocks = asBlocks(value);
  const [preview, setPreview] = useState(false);

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

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
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
          No blocks yet — add one above. Text supports **bold**, *italic*, `code`, and [links](url).
        </div>
      ) : (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocks.map((block, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 8,
              }}
            >
              <div
                className="row"
                style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}
              >
                <span className="muted">{BLOCK_LABELS[block.type]}</span>
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
              <BlockFields block={block} onChange={(next) => update(i, next)} />
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
}: {
  block: RichTextBlock;
  onChange: (block: RichTextBlock) => void;
}) {
  switch (block.type) {
    case 'paragraph':
    case 'quote':
      return (
        <textarea
          rows={3}
          value={block.text}
          placeholder="Text… supports **bold**, *italic*, `code`, [link](url)"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
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
            style={{ flex: 1 }}
            value={block.text}
            placeholder="Heading text"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
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
  }
}
