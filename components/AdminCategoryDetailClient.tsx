'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, RefreshCw, Upload, X, Tag } from 'lucide-react';

// ── Cloudinary uploader ───────────────────────────────────────────────────────
function ImageUploadField({
  value, onChange, required = false, placeholder = 'Upload image',
}: { value: string; onChange: (url: string) => void; required?: boolean; placeholder?: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(''); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) onChange(data.url);
      else setError(data.error || 'Upload failed');
    } catch { setError('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <Image src={value} alt="preview" width={160} height={100} className="rounded-xl object-cover border border-gray-200" style={{ height: 100, width: 160, objectFit: 'cover' }} unoptimized />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-50 w-full">
          {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> {placeholder}</>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        required={required && !value}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default function AdminCategoryDetailClient({ categoryId }: { categoryId: string }) {
  const [category, setCategory] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ name: '', icon: '🏛️', description: '', image: '', isSpecial: false });

  const fetchCategory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}`);
      const data = await res.json();
      if (!data.success) { setNotFound(true); return; }
      setCategory(data.data);
      populateForm(data.data);
    } finally { setLoading(false); }
  };

  const populateForm = (c: AnyRecord) => {
    setForm({ name: c.name || '', icon: c.icon || '🏛️', description: c.description || '', image: c.image || '', isSpecial: c.isSpecial || false });
  };

  useEffect(() => { fetchCategory(); }, [categoryId]);

  useEffect(() => {
    if (editMode && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editMode]);

  const isFormValid = Boolean(form.name.trim() && form.icon.trim() && form.description.trim() && form.image.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Category updated successfully!');
        setCategory(data.data);
        populateForm(data.data);
        setEditMode(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSaveMsg('Error: ' + (data.error || 'Update failed'));
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
    window.location.href = '/admin';
  };

  if (loading) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500 text-lg">Category not found.</p>
      <Link href="/admin" className="text-amber-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Admin</Link>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditMode((v) => !v); setSaveMsg(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${editMode ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
              <Edit className="w-4 h-4" /> {editMode ? 'Cancel Edit' : 'Edit Category'}
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-all">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>

        {saveMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${saveMsg.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {saveMsg}
          </div>
        )}

        {/* View mode */}
        {category && !editMode && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {category.image && (
              <div className="relative h-52 w-full">
                <Image src={category.image} alt={category.name} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-4 left-5 flex items-center gap-3">
                  <span className="text-4xl">{category.icon}</span>
                  <h1 className="text-2xl font-bold text-white font-[Playfair_Display,serif]">{category.name}</h1>
                </div>
              </div>
            )}
            <div className="p-6 space-y-4">
              {!category.image && (
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">{category.icon}</span>
                  <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">{category.name}</h1>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-mono">{category.id}</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
                  <Tag className="w-3 h-3 inline mr-1" />{category.vendorCount} vendors
                </span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{category.description}</p>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editMode && (
          <div ref={formRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Edit Category</h2>
              <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Category ID <span className="text-gray-400 font-normal">(slug — cannot change)</span></label>
                  <input disabled value={categoryId} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Display Name <span className="text-rose-500">*</span></label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Photography & Videography" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Icon (emoji) <span className="text-rose-500">*</span></label>
                  <input required value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="📸" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Cover Image <span className="text-rose-500">*</span></label>
                  <ImageUploadField value={form.image} onChange={(u) => setForm({ ...form, image: u })} required placeholder="Upload cover image (required)" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description <span className="text-rose-500">*</span></label>
                  <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Short description of this category..." />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={!isFormValid || saving}
                  className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : 'Update Category'}
                </button>
                <button type="button" onClick={() => { setEditMode(false); populateForm(category!); }}
                  className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                  Cancel
                </button>
                {!isFormValid && <p className="text-xs text-rose-500">Fill all required <span className="font-bold">*</span> fields</p>}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
