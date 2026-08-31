'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, RefreshCw } from 'lucide-react';

// Extracted from AdminVendorDetailClient.tsx / AdminClient.tsx (previously
// duplicated near-identically in both) — Cloudinary upload via /api/upload.
export default function ImageUploadField({
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
          <Image src={value} alt="preview" width={120} height={80} className="rounded-lg object-cover border border-gray-200" style={{ height: 80, width: 120, objectFit: 'cover' }} unoptimized />
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
