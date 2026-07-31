import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useState } from 'react';
import { renderRichTextHtml, type RichTextValue } from '@ferrocms/core';
import { api } from '../lib/api.js';
import { blocksToTiptapDoc, tiptapDocToBlocks } from '../lib/richTextSerializer.js';
import { CalloutNode, ImageNode, AdSlotNode } from './richTextNodes/index.js';
import { InsertMenu } from './richTextNodes/InsertMenu.js';

interface Props {
  value: unknown;
  onChange: (value: RichTextValue) => void;
}

function asBlocks(value: unknown): RichTextValue {
  return Array.isArray(value) ? (value as RichTextValue) : [];
}

/**
 * WYSIWYG rich-text editor built on Tiptap. Paragraphs, headings, lists,
 * quotes, code blocks, and bold/italic/code/link marks are typed and
 * formatted live — real document editing, not raw markdown in a textarea.
 * Callout/Image/Ad slot stay as distinct cards inside that flow (see
 * richTextNodes/) rather than becoming fully free-form content, since their
 * stored shape is a plain string field, not nested rich content.
 *
 * The `value`/`onChange` contract is unchanged from the old block-array
 * editor — richTextSerializer.ts is the only thing that knows Tiptap exists;
 * everything downstream (FieldInput, the server's zod validation,
 * `renderRichTextHtml`, moneyinsider's own render pipeline) keeps working
 * against the exact same `RichTextValue` shape as before.
 */
export function BlockEditor({ value, onChange }: Props) {
  const [preview, setPreview] = useState(false);
  const blocks = asBlocks(value);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          horizontalRule: false,
        }),
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({
          placeholder: 'Start writing, or use “+ Insert” for a heading, list, image…',
        }),
        CalloutNode,
        ImageNode,
        AdSlotNode,
      ],
      // Seeds the document once, at mount, from whatever `value` holds at
      // that moment. After that Tiptap's own document is the source of
      // truth going forward — onUpdate only ever reads *out* of it. This
      // component never re-seeds from a later `value` prop change, which
      // is what lets typing stay uninterrupted (no cursor jumps) even
      // though every keystroke round-trips through the parent's state via
      // onChange. Switching to a *different* entry works by remounting
      // this component entirely — see EntryEditorPage's `key={id}` on the
      // field-rendering wrapper — not by reacting to a prop change here.
      content: blocksToTiptapDoc(blocks),
      onUpdate: ({ editor: e }) => onChange(tiptapDocToBlocks(e.getJSON())),
    },
    [],
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          alignItems: 'center',
        }}
      >
        {editor && <InsertMenu editor={editor} />}
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
      ) : (
        editor && (
          <>
            <BubbleMenu editor={editor} options={{ placement: 'top' }}>
              <div className="rt-bubble-menu">
                <button
                  type="button"
                  className={editor.isActive('bold') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  className={editor.isActive('italic') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  title="Italic"
                  style={{ fontStyle: 'italic' }}
                >
                  I
                </button>
                <button
                  type="button"
                  className={editor.isActive('code') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  title="Code"
                  style={{ fontFamily: 'var(--font-mono, monospace)' }}
                >
                  {'</>'}
                </button>
                <button
                  type="button"
                  className={editor.isActive('link') ? 'active' : ''}
                  onClick={() => {
                    const prev = editor.getAttributes('link').href as string | undefined;
                    const url = prompt('Link URL (e.g. /go/partner or https://…)', prev ?? '');
                    if (url === null) return;
                    if (url === '') {
                      editor.chain().focus().unsetLink().run();
                    } else {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  title="Link"
                >
                  Link
                </button>
              </div>
            </BubbleMenu>
            <EditorContent editor={editor} className="rt-editor" />
          </>
        )
      )}
    </div>
  );
}
