'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Trash2, Star, MapPin, CheckCircle, XCircle,
  Phone, Mail, User, RefreshCw, Upload, X, Plus, Tag,
} from 'lucide-react';

// ── Cloudinary uploader (same as AdminClient) ─────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
interface PackageForm { name: string; price: string; description: string; features: string; isPopular: boolean; image: string; }
const EMPTY_PACKAGE: PackageForm = { name: '', price: '', description: '', features: '', isPopular: false, image: '' };
const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminVendorDetailClient({ vendorId }: { vendorId: string }) {
  const [vendor, setVendor] = useState<AnyRecord | null>(null);
  const [categories, setCategories] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Edit form state
  const [vendorForm, setVendorForm] = useState({
    name: '', ownerName: '', ownerPhone: '', ownerEmail: '',
    category: 'venue', city: 'Patna', priceMin: '', priceMax: '',
    rating: '4.5', reviewCount: '', description: '', features: '', isFeatured: false,
  });
  const [vendorImages, setVendorImages] = useState<string[]>(['']);
  const [packages, setPackages] = useState<PackageForm[]>([{ ...EMPTY_PACKAGE }]);

  const formRef = useRef<HTMLDivElement>(null);

  const fetchVendor = async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        fetch(`/api/vendors/${vendorId}`),
        fetch('/api/categories'),
      ]);
      const [vData, cData] = await Promise.all([vRes.json(), cRes.json()]);
      if (!vData.success) { setNotFound(true); return; }
      setVendor(vData.data);
      if (cData.success) setCategories(cData.data);
      populateForm(vData.data);
    } finally { setLoading(false); }
  };

  const populateForm = (v: AnyRecord) => {
    setVendorForm({
      name: v.name || '',
      ownerName: v.ownerName || '',
      ownerPhone: v.ownerPhone || '',
      ownerEmail: v.ownerEmail || '',
      category: v.category || 'venue',
      city: v.city || 'Patna',
      priceMin: String(v.priceMin || ''),
      priceMax: String(v.priceMax || ''),
      rating: String(v.rating || '4.5'),
      reviewCount: String(v.reviewCount || ''),
      description: v.description || '',
      features: (v.features || []).join(', '),
      isFeatured: v.isFeatured || false,
    });
    const imgs = v.images?.length ? v.images : v.image ? [v.image] : [''];
    setVendorImages(imgs);
    setPackages(
      v.packages?.length
        ? v.packages.map((p: AnyRecord) => ({
            name: p.name || '', price: String(p.price || ''),
            description: p.description || '',
            features: (p.features || []).join(', '),
            isPopular: p.isPopular || false,
            image: p.image || '',
          }))
        : [{ ...EMPTY_PACKAGE }]
    );
  };

  useEffect(() => { fetchVendor(); }, [vendorId]);

  useEffect(() => {
    if (editMode && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editMode]);

  const addPackageRow = () => setPackages((p) => [...p, { ...EMPTY_PACKAGE }]);
  const removePackageRow = (i: number) => setPackages((p) => p.filter((_, idx) => idx !== i));
  const updatePackage = (i: number, key: keyof PackageForm, value: string | boolean) =>
    setPackages((p) => p.map((pkg, idx) => idx === i ? { ...pkg, [key]: value } : pkg));

  const isFormValid = Boolean(
    vendorForm.name.trim() && vendorForm.description.trim() &&
    vendorForm.priceMin && vendorForm.priceMax && vendorImages[0]?.trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    try {
      const builtPackages = packages
        .filter((p) => p.name && p.price)
        .map((p, i) => ({
          id: `pkg-${i + 1}`, name: p.name, price: Number(p.price),
          description: p.description,
          features: p.features.split(',').map((f) => f.trim()).filter(Boolean),
          isPopular: p.isPopular,
          ...(p.image ? { image: p.image } : {}),
        }));
      const cleanImages = vendorImages.map((u) => u.trim()).filter(Boolean);
      const payload = {
        ...vendorForm,
        ownerName: vendorForm.ownerName.trim(),
        ownerPhone: vendorForm.ownerPhone.trim(),
        ownerEmail: vendorForm.ownerEmail.trim(),
        image: cleanImages[0] || '',
        images: cleanImages,
        priceMin: Number(vendorForm.priceMin),
        priceMax: Number(vendorForm.priceMax),
        rating: Number(vendorForm.rating),
        reviewCount: Number(vendorForm.reviewCount),
        features: vendorForm.features.split(',').map((f) => f.trim()).filter(Boolean),
        packages: builtPackages,
      };
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Vendor updated successfully!');
        setVendor(data.data);
        populateForm(data.data);
        setEditMode(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSaveMsg('Error: ' + (data.error || 'Update failed'));
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this vendor? This cannot be undone.')) return;
    await fetch(`/api/vendors/${vendorId}`, { method: 'DELETE' });
    window.location.href = '/admin';
  };

  if (loading) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500 text-lg">Vendor not found.</p>
      <Link href="/admin" className="text-amber-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Admin</Link>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditMode((v) => !v); setSaveMsg(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${editMode ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
              <Edit className="w-4 h-4" /> {editMode ? 'Cancel Edit' : 'Edit Vendor'}
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

        {/* Vendor detail card */}
        {vendor && !editMode && (
          <div className="space-y-6">
            {/* Cover image + basic info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {vendor.image && (
                <div className="relative h-56 w-full">
                  <Image src={vendor.image} alt={vendor.name} fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">{vendor.name}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold capitalize">{vendor.category}</span>
                      <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5 text-rose-400" />{vendor.city}</span>
                      <span className="flex items-center gap-1 text-sm"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{vendor.rating} ({vendor.reviewCount} reviews)</span>
                      {vendor.isFeatured && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">★ Featured</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Price Range</p>
                    <p className="text-lg font-bold text-amber-600">₹{(vendor.priceMin || 0).toLocaleString('en-IN')} – ₹{(vendor.priceMax || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{vendor.description}</p>
                {vendor.features?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {vendor.features.map((f: string) => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Owner details (admin only) */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">🔒 Owner Details (Admin Only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-400 uppercase tracking-wide">Owner Name</p>
                    <p className="text-sm font-semibold text-gray-800">{vendor.ownerName || <span className="text-gray-400 font-normal italic">Not set</span>}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-400 uppercase tracking-wide">Contact</p>
                    {vendor.ownerPhone
                      ? <a href={`tel:${vendor.ownerPhone}`} className="text-sm font-semibold text-blue-600 hover:underline">{vendor.ownerPhone}</a>
                      : <p className="text-sm text-gray-400 italic">Not set</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-400 uppercase tracking-wide">Email</p>
                    {vendor.ownerEmail
                      ? <a href={`mailto:${vendor.ownerEmail}`} className="text-sm font-semibold text-blue-600 hover:underline">{vendor.ownerEmail}</a>
                      : <p className="text-sm text-gray-400 italic">Not set</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Image gallery */}
            {vendor.images?.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Image Gallery</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {vendor.images.map((img: string, i: number) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                      <Image src={img} alt={`${vendor.name} ${i + 1}`} fill className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Packages */}
            {vendor.packages?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Packages ({vendor.packages.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vendor.packages.map((pkg: AnyRecord) => (
                    <div key={pkg.id} className={`rounded-xl border p-4 ${pkg.isPopular ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-900 text-sm">{pkg.name}</p>
                        <div className="flex items-center gap-1.5">
                          {pkg.isPopular && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Popular</span>}
                          <p className="text-amber-600 font-bold text-sm">₹{(pkg.price || 0).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      {pkg.description && <p className="text-xs text-gray-500 mb-2">{pkg.description}</p>}
                      <ul className="space-y-1">
                        {(pkg.features || []).map((f: string) => (
                          <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {editMode && (
          <div ref={formRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Edit Vendor</h2>
              <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Business name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Business Name <span className="text-rose-500">*</span></label>
                  <input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Sharma Photography Studio" />
                </div>

                {/* Owner details */}
                <div className="sm:col-span-2">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">🔒 Owner Details <span className="font-normal normal-case text-blue-400">(admin only)</span></p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Owner Name</label>
                        <input value={vendorForm.ownerName} onChange={(e) => setVendorForm({ ...vendorForm, ownerName: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Ramesh Sharma" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Number</label>
                        <input type="tel" value={vendorForm.ownerPhone} onChange={(e) => setVendorForm({ ...vendorForm, ownerPhone: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="+91 98765 43210" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="email" value={vendorForm.ownerEmail} onChange={(e) => setVendorForm({ ...vendorForm, ownerEmail: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="ramesh@example.com" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category + City */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                  <select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                    {categories.length > 0
                      ? categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                      : ['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                  <select value={vendorForm.city} onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Pricing */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Min Price (₹) <span className="text-rose-500">*</span></label>
                  <input required type="number" value={vendorForm.priceMin} onChange={(e) => setVendorForm({ ...vendorForm, priceMin: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Max Price (₹) <span className="text-rose-500">*</span></label>
                  <input required type="number" value={vendorForm.priceMax} onChange={(e) => setVendorForm({ ...vendorForm, priceMax: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="200000" />
                </div>

                {/* Rating + Reviews */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Rating</label>
                  <input type="number" step="0.1" min="1" max="5" value={vendorForm.rating} onChange={(e) => setVendorForm({ ...vendorForm, rating: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Review Count</label>
                  <input type="number" value={vendorForm.reviewCount} onChange={(e) => setVendorForm({ ...vendorForm, reviewCount: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="100" />
                </div>

                {/* Image gallery */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-500">Image Gallery <span className="text-rose-500">*</span> <span className="text-gray-400 font-normal">(first = cover)</span></label>
                    <button type="button" onClick={() => setVendorImages((imgs) => [...imgs, ''])}
                      className="flex items-center gap-1 text-xs text-amber-600 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50">
                      <Plus className="w-3 h-3" /> Add Slot
                    </button>
                  </div>
                  <div className="space-y-2">
                    {vendorImages.map((url, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <ImageUploadField
                            value={url} onChange={(u) => setVendorImages((imgs) => imgs.map((v, idx) => idx === i ? u : v))}
                            required={i === 0} placeholder={i === 0 ? 'Upload cover image (required)' : `Gallery image ${i + 1} (optional)`} />
                        </div>
                        {vendorImages.length > 1 && (
                          <button type="button" onClick={() => setVendorImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                            className="text-rose-400 hover:text-rose-600 mt-3 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description <span className="text-rose-500">*</span></label>
                  <textarea required rows={3} value={vendorForm.description} onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Vendor description..." />
                </div>

                {/* Features */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Features <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                  <input value={vendorForm.features} onChange={(e) => setVendorForm({ ...vendorForm, features: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="AC Hall, Parking, Catering" />
                </div>

                {/* Featured */}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="featured-edit" checked={vendorForm.isFeatured} onChange={(e) => setVendorForm({ ...vendorForm, isFeatured: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="featured-edit" className="text-sm text-gray-700">Mark as Featured</label>
                </div>
              </div>

              {/* Packages */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><Tag className="w-4 h-4 text-amber-500" /> Packages</h4>
                  <button type="button" onClick={addPackageRow}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                    <Plus className="w-3.5 h-3.5" /> Add Package
                  </button>
                </div>
                <div className="space-y-3">
                  {packages.map((pkg, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Package {i + 1}</span>
                        {packages.length > 1 && (
                          <button type="button" onClick={() => removePackageRow(i)} className="text-rose-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
                          <input value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Basic, Premium, Deluxe" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Price (₹) *</label>
                          <input type="number" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="75000" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                          <input value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="What's included..." />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Features (comma-separated)</label>
                          <input value={pkg.features} onChange={(e) => updatePackage(i, 'features', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="5 Hours, 2 Photographers" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Package Image <span className="text-gray-400 font-normal">(optional)</span></label>
                          <ImageUploadField value={pkg.image} onChange={(u) => updatePackage(i, 'image', u)} placeholder="Upload package image (optional)" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id={`popular-edit-${i}`} checked={pkg.isPopular} onChange={(e) => updatePackage(i, 'isPopular', e.target.checked)} className="w-4 h-4" />
                          <label htmlFor={`popular-edit-${i}`} className="text-xs text-gray-600 font-medium">Mark as Popular</label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={!isFormValid || saving}
                  className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : 'Update Vendor'}
                </button>
                <button type="button" onClick={() => { setEditMode(false); populateForm(vendor!); }}
                  className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                  Cancel
                </button>
                {!isFormValid && <p className="text-xs text-rose-500">Fill all required <span className="font-bold">*</span> fields</p>}
              </div>
            </form>
          </div>
        )}

        {/* Empty state while editing shows form above */}
        {editMode && !vendor && null}
      </div>
    </div>
  );
}
