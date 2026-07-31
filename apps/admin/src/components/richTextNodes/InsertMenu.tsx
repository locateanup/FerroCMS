import { useState } from 'react';
import type { Editor } from '@tiptap/react';

interface MenuItem {
  label: string;
  run: (editor: Editor) => void;
}

// "Toggle" commands act on the current (usually empty) block — converting
// it to the chosen type, the same as typing "/heading" in Notion or "## "
// in a markdown editor turns the current line into a heading rather than
// inserting a separate block below it. The three custom node types have no
// text content to convert, so they're inserted at the cursor instead.
const ITEMS: MenuItem[] = [
  { label: 'Heading 2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet list', run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Quote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code block', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  {
    label: 'Image',
    run: (e) => e.chain().focus().insertContent({ type: 'imageBlock', attrs: { key: '' } }).run(),
  },
  {
    label: 'Callout',
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({ type: 'calloutBlock', attrs: { tone: 'info', text: '' } })
        .run(),
  },
  {
    label: 'Ad slot',
    run: (e) => e.chain().focus().insertContent({ type: 'adSlotBlock' }).run(),
  },
];

export function InsertMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn"
        title="Insert a block"
        style={{ padding: '3px 9px', fontSize: 12 }}
        onClick={() => setOpen((v) => !v)}
      >
        + Insert
      </button>
      {open && (
        <>
          {/* Click-outside catcher — a plain full-screen div behind the
              popover, simpler and more robust than wiring per-item blur
              handlers. */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              zIndex: 11,
              padding: 4,
              minWidth: 160,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                className="btn"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontSize: 13,
                  border: 'none',
                }}
                onClick={() => {
                  item.run(editor);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
