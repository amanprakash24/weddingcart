'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useRef } from 'react';
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Image as ImageIcon, Minus, Undo, Redo,
} from 'lucide-react';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function TipTapEditor({ content, onChange }: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExt,
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing your blog post here...' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const handleImageUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success && data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch {
      alert('Image upload failed');
    }
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const btn = (active: boolean) =>
    `p-1.5 rounded hover:bg-gray-200 transition-colors ${active ? 'bg-amber-100 text-amber-700' : 'text-gray-600'}`;

  const sep = <div className="w-px h-5 bg-gray-300 mx-1" />;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-400/50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}>
          <Undo className="w-4 h-4" />
        </button>
        <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}>
          <Redo className="w-4 h-4" />
        </button>
        {sep}
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}>
          <Italic className="w-4 h-4" />
        </button>
        {sep}
        <button type="button" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive('heading', { level: 2 }))}>
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive('heading', { level: 3 }))}>
          <Heading3 className="w-4 h-4" />
        </button>
        {sep}
        <button type="button" title="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" title="Ordered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}>
          <Quote className="w-4 h-4" />
        </button>
        {sep}
        <button type="button" title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>
          <Minus className="w-4 h-4" />
        </button>
        <button type="button" title="Link" onClick={setLink} className={btn(editor.isActive('link'))}>
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" title="Insert Image" onClick={() => fileInputRef.current?.click()} className={btn(false)}>
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageUpload(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose-editor min-h-[360px] px-5 py-4 text-gray-800 text-sm leading-relaxed focus:outline-none"
      />
    </div>
  );
}
