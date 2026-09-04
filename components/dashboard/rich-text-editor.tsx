'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#0B1F33', '#2563EB', '#DC2626', '#16A34A', '#7C3AED'];

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50',
        active ? 'bg-tenant-accent text-white' : 'text-tenant-ink hover:bg-white',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Minimal rich text editor for signatures and the custom email compose box:
 * bold/italic/underline/color/links/bullet+numbered lists only — the
 * toolbar's scope IS the schema's scope. StarterKit is configured down to
 * just that set, so the editor cannot emit headings, blockquotes, code
 * blocks, or anything else outside it — this is what actually keeps the
 * generated HTML safe to mail out raw, not just the toolbar UI.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          'min-h-[100px] rounded-b-md border border-t-0 border-input bg-white px-3 py-2 text-sm focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  function setLink() {
    const url = window.prompt('Link URL');
    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-tenant-gray px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('link')} disabled={disabled} onClick={setLink} title="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-tenant-ink/10" />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-tenant-ink/10" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            disabled={disabled}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className="h-5 w-5 flex-none rounded-full border border-tenant-ink/10"
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          title="Reset color"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetColor().run()}
          className="text-xs text-muted-foreground hover:text-tenant-ink"
        >
          Reset
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
