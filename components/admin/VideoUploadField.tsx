'use client';

import { useState, useRef } from 'react';
import { Video, X, RefreshCw } from 'lucide-react';

// Extracted from AdminVendorDetailClient.tsx — direct-to-Cloudinary signed
// upload (Vercel's 4.5MB request body cap makes proxying video through our
// own API unreliable).
export default function VideoUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(''); setUploading(true);
    try {
      const sigRes = await fetch('/api/upload/video-signature', { method: 'POST' });
      const sig = await sigRes.json();
      if (!sig.success) { setError('Could not start upload'); return; }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sig.apiKey);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`, {
        method: 'POST', body: fd,
      });
      const data = await res.json();
      if (data.secure_url) onChange(data.secure_url);
      else setError(data.error?.message || 'Upload failed');
    } catch { setError('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <video src={value} className="rounded-lg border border-gray-200" style={{ height: 90, width: 160, objectFit: 'cover' }} muted />
          <button type="button" onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-50 w-full">
          {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading video...</> : <><Video className="w-4 h-4" /> Upload virtual tour video</>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
