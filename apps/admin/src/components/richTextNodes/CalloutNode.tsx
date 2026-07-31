import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { CALLOUT_TONES, type CalloutTone } from '@ferrocms/core';

// An "atom" block — its tone/title/text live in ProseMirror node *attrs*,
// edited via plain form controls in the NodeView below, not as directly
// editable ProseMirror content. That mirrors the stored shape exactly
// (CalloutBlock.text is a plain string, not nested rich content), so no
// translation is needed beyond what richTextSerializer.ts already does.
function CalloutView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const tone = (node.attrs.tone as CalloutTone) ?? 'info';
  const title = (node.attrs.title as string | null) ?? '';
  const text = (node.attrs.text as string) ?? '';

  return (
    <NodeViewWrapper
      className={`rt-node-card${selected ? ' rt-node-card-selected' : ''}`}
      data-drag-handle
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>
          Callout
        </span>
        <button
          type="button"
          className="btn btn-danger"
          style={{ padding: '1px 6px', fontSize: 11 }}
          onClick={deleteNode}
          contentEditable={false}
        >
          Remove
        </button>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 6 }} contentEditable={false}>
        <select
          style={{ width: 120 }}
          value={tone}
          onChange={(e) => updateAttributes({ tone: e.target.value })}
        >
          {CALLOUT_TONES.map((t) => (
            <option key={t} value={t}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input
          style={{ flex: 1 }}
          value={title}
          placeholder="Title (optional)"
          onChange={(e) => updateAttributes({ title: e.target.value || null })}
        />
      </div>
      <textarea
        rows={3}
        value={text}
        placeholder="Callout text… supports **bold**, *italic*, `code`, [link](url)"
        onChange={(e) => updateAttributes({ text: e.target.value })}
        contentEditable={false}
      />
    </NodeViewWrapper>
  );
}

export const CalloutNode = Node.create({
  name: 'calloutBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      tone: { default: 'info' },
      title: { default: null },
      text: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
