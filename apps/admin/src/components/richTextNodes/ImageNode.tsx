import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { MediaInput } from '../MediaInput.js';

function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const key = (node.attrs.key as string) ?? '';
  const alt = (node.attrs.alt as string | null) ?? '';
  const caption = (node.attrs.caption as string | null) ?? '';

  return (
    <NodeViewWrapper
      className={`rt-node-card${selected ? ' rt-node-card-selected' : ''}`}
      data-drag-handle
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }} contentEditable={false}>
        <span className="muted" style={{ fontSize: 11 }}>
          Image
        </span>
        <button
          type="button"
          className="btn btn-danger"
          style={{ padding: '1px 6px', fontSize: 11 }}
          onClick={deleteNode}
        >
          Remove
        </button>
      </div>
      <div contentEditable={false}>
        <MediaInput value={key} onChange={(v) => updateAttributes({ key: (v as string) ?? '' })} />
        <input
          style={{ marginTop: 6 }}
          value={alt}
          placeholder="Alt text"
          onChange={(e) => updateAttributes({ alt: e.target.value || null })}
        />
        <input
          style={{ marginTop: 6 }}
          value={caption}
          placeholder="Caption (optional)"
          onChange={(e) => updateAttributes({ caption: e.target.value || null })}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const ImageNode = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      key: { default: '' },
      alt: { default: null },
      caption: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
