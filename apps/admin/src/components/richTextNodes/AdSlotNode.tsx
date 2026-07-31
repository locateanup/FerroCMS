import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

function AdSlotView({ deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`rt-node-card${selected ? ' rt-node-card-selected' : ''}`}
      data-drag-handle
      contentEditable={false}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Ad slot — reserves a fixed-height ad placement here. No fields; the front-end decides
          what renders.
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
    </NodeViewWrapper>
  );
}

export const AdSlotNode = Node.create({
  name: 'adSlotBlock',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-type="ad-slot-block"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'ad-slot-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AdSlotView);
  },
});
