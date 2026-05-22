'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { Save, Send, ArrowLeft, RefreshCw, Upload, X, ChevronDown, ChevronUp } from 'lucide-react';

const TipTapEditor = dynamic(() => import('@/components/TipTapEditor'), { ssr: false });

const CATEGORIES = [
  'Wedding Tips', 'Venue Guides', 'Bridal Fashion', 'Real Weddings',
  'Budget Planning', 'Traditions & Culture', 'Destination Weddings',
  'Food & Catering', 'Décor & Flowers', 'Photography',
];

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function calculateReadTime(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

interface FormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  category: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  status: 'draft' | 'published';
}

const EMPTY: FormData = {
  title: '', slug: '', excerpt: '', content: '',
  coverImage: '', author: 'ShaadiShopping Team',
  category: 'Wedding Tips', tags: '',
  seoTitle: '', seoDescription: '', status: 'draft',
};

interface Props {
  blogId?: string; // if editing existing post
}

export default function AdminBlogEditorClient({ blogId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(blogId);

  // Load existing blog for edit
  useEffect(() => {
    if (!blogId) return;
    fetch(`/api/blogs/${blogId}`)
      .then(r => r.json())
      .then(data => {
        if (data.blog) {
          const b = data.blog;
          setForm({
            title: b.title ?? '',
            slug: b.slug ?? '',
            excerpt: b.excerpt ?? '',
            content: b.content ?? '',
            coverImage: b.coverImage ?? '',
            author: b.author ?? 'ShaadiShopping Team',
            category: b.category ?? 'Wedding Tips',
            tags: (b.tags ?? []).join(', '),
            seoTitle: b.seoTitle ?? '',
            seoDescription: b.seoDescription ?? '',
            status: b.status ?? 'draft',
          });
          setSlugManual(true);
        }
      });
  }, [blogId]);

  const set = (key: keyof FormData, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'title' && !slugManual) {
        next.slug = generateSlug(value);
      }
      return next;
    });
  };

  const handleCoverUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) set('coverImage', data.url);
    } finally {
      setUploading(false);
    }
  };

  const save = async (publishNow = false) => {
    setError('');
    setSuccess('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.slug.trim()) { setError('Slug is required'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        readTime: calculateReadTime(form.content),
        status: publishNow ? 'published' : form.status,
      };

      const url = isEdit ? `/api/blogs/${blogId}` : '/api/blogs';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
      } else {
        setSuccess(publishNow ? 'Published!' : 'Saved as draft');
        if (!isEdit) {
          router.replace(`/admin/blogs/${data.blog._id}`);
        } else {
          setForm(prev => ({ ...prev, status: publishNow ? 'published' : prev.status }));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link href="/admin/blogs" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Posts
        </Link>
        <div className="flex items-center gap-2">
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {success && <p className="text-emerald-600 text-sm">{success}</p>}
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-xl text-sm transition-all"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-all shadow-sm"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Title */}
        <div>
          <input
            type="text"
            placeholder="Blog post title..."
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="w-full text-2xl font-bold font-[Playfair_Display,serif] text-gray-900 bg-transparent border-0 border-b-2 border-gray-200 focus:border-amber-400 outline-none pb-2 placeholder-gray-300 transition-colors"
          />
        </div>

        {/* Slug */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 shrink-0">URL: /blog/</span>
          <input
            type="text"
            value={form.slug}
            onChange={e => { setSlugManual(true); set('slug', e.target.value); }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none text-sm"
            placeholder="post-url-slug"
          />
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image</label>
          {form.coverImage ? (
            <div className="relative inline-block">
              <Image
                src={form.coverImage}
                alt="cover"
                width={320}
                height={180}
                className="rounded-xl object-cover border border-gray-200"
                style={{ width: 320, height: 180, objectFit: 'cover' }}
                unoptimized
              />
              <button
                type="button"
                onClick={() => set('coverImage', '')}
                className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-6 py-4 text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload cover image'}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ''; }} />
        </div>

        {/* Row: category, author */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none bg-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Author</label>
            <input
              type="text"
              value={form.author}
              onChange={e => set('author', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tags <span className="font-normal text-gray-400">(comma-separated)</span></label>
          <input
            type="text"
            value={form.tags}
            onChange={e => set('tags', e.target.value)}
            placeholder="jaipur wedding, royal venue, venue guide"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none"
          />
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Excerpt <span className="font-normal text-gray-400">(shown on blog cards)</span></label>
          <textarea
            value={form.excerpt}
            onChange={e => set('excerpt', e.target.value)}
            rows={2}
            placeholder="A short summary of the post (1-2 sentences)..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none resize-none"
          />
        </div>

        {/* SEO section (collapsible) */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setSeoOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            SEO Settings
            {seoOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {seoOpen && (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SEO Title <span className="font-normal text-gray-400">(defaults to post title)</span></label>
                <input
                  type="text"
                  value={form.seoTitle}
                  onChange={e => set('seoTitle', e.target.value)}
                  placeholder={form.title || 'SEO title...'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Description <span className="font-normal text-gray-400">(defaults to excerpt)</span></label>
                <textarea
                  value={form.seoDescription}
                  onChange={e => set('seoDescription', e.target.value)}
                  rows={2}
                  placeholder={form.excerpt || 'Meta description for search engines...'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content editor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
          <TipTapEditor content={form.content} onChange={v => set('content', v)} />
        </div>

        {/* Bottom save */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-all shadow-sm"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.status === 'published' ? 'Update Post' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
