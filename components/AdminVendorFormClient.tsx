'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Trash2, RefreshCw, Plus, Tag, HelpCircle, ExternalLink,
} from 'lucide-react';
import ImageUploadField from '@/components/admin/ImageUploadField';
import VideoUploadField from '@/components/admin/VideoUploadField';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;
interface PackageForm { name: string; price: string; description: string; features: string; isPopular: boolean; image: string; }
interface FaqForm { question: string; answer: string; }
const EMPTY_PACKAGE: PackageForm = { name: '', price: '', description: '', features: '', isPopular: false, image: '' };
const EMPTY_FAQ: FaqForm = { question: '', answer: '' };
const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];
const STATUSES: { value: string; label: string; hint: string }[] = [
  { value: 'DRAFT', label: 'Draft', hint: 'Not visible to the public — you’re still working on it.' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification', hint: 'Not yet publicly visible — awaiting your team’s review.' },
  { value: 'PUBLISHED', label: 'Published', hint: 'Live on the site — appears in search, city/category pages, and the sitemap.' },
];

interface Category { id: string; name: string; slug: string; }

const EMPTY_FORM = {
  name: '', ownerName: '', ownerPhone: '', ownerEmail: '',
  category: '', city: 'Patna', address: '',
  priceMin: '', priceMax: '', guestCapacity: '', venueType: '',
  description: '', features: '', isFeatured: false, status: 'DRAFT',
  virtualTourVideo: '',
};

export default function AdminVendorFormClient({ vendorId }: { vendorId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(vendorId);

  const [vendor, setVendor] = useState<AnyRecord | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>(['']);
  const [packages, setPackages] = useState<PackageForm[]>([{ ...EMPTY_PACKAGE }]);
  const [faqs, setFaqs] = useState<FaqForm[]>([]);

  const topRef = useRef<HTMLDivElement>(null);

  const populateForm = (v: AnyRecord) => {
    setForm({
      name: v.name || '', ownerName: v.ownerName || '', ownerPhone: v.ownerPhone || '', ownerEmail: v.ownerEmail || '',
      category: v.category || '', city: v.city || 'Patna', address: v.address || '',
      priceMin: String(v.priceMin ?? ''), priceMax: String(v.priceMax ?? ''),
      guestCapacity: v.guestCapacity != null ? String(v.guestCapacity) : '', venueType: v.venueType || '',
      description: v.description || '', features: (v.features || []).join(', '),
      isFeatured: v.isFeatured || false, status: v.status || 'DRAFT',
      virtualTourVideo: v.virtualTourVideo || '',
    });
    setImages(v.images?.length ? v.images : v.image ? [v.image] : ['']);
    setPackages(
      v.packages?.length
        ? v.packages.map((p: AnyRecord) => ({
            name: p.name || '', price: String(p.price || ''), description: p.description || '',
            features: (p.features || []).join(', '), isPopular: p.isPopular || false, image: p.image || '',
          }))
        : [{ ...EMPTY_PACKAGE }]
    );
    setFaqs(v.faqs?.length ? v.faqs.map((f: AnyRecord) => ({ question: f.question || '', answer: f.answer || '' })) : []);
  };

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => {
      if (d.success) {
        setCategories(d.data);
        setForm((f) => (f.category ? f : { ...f, category: d.data[0]?.slug || '' }));
      }
    });
  }, []);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    fetch(`/api/vendors/${vendorId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) { setNotFound(true); return; }
        setVendor(d.data);
        populateForm(d.data);
      })
      .finally(() => setLoading(false));
  }, [vendorId]);

  const addPackageRow = () => setPackages((p) => [...p, { ...EMPTY_PACKAGE }]);
  const removePackageRow = (i: number) => setPackages((p) => p.filter((_, idx) => idx !== i));
  const updatePackage = (i: number, key: keyof PackageForm, value: string | boolean) =>
    setPackages((p) => p.map((pkg, idx) => idx === i ? { ...pkg, [key]: value } : pkg));

  const addFaqRow = () => setFaqs((f) => [...f, { ...EMPTY_FAQ }]);
  const removeFaqRow = (i: number) => setFaqs((f) => f.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, key: keyof FaqForm, value: string) =>
    setFaqs((f) => f.map((row, idx) => idx === i ? { ...row, [key]: value } : row));

  const isFormValid = Boolean(
    form.name.trim() && form.description.trim() && form.category &&
    form.priceMin && form.priceMax && images[0]?.trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    try {
      const builtPackages = packages
        .filter((p) => p.name && p.price)
        .map((p) => ({
          name: p.name, price: Number(p.price), description: p.description,
          features: p.features.split(',').map((f) => f.trim()).filter(Boolean),
          isPopular: p.isPopular,
          ...(p.image ? { image: p.image } : {}),
        }));
      const builtFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
      const cleanImages = images.map((u) => u.trim()).filter(Boolean);

      const payload = {
        name: form.name.trim(),
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
        ownerEmail: form.ownerEmail.trim(),
        city: form.city,
        address: form.address.trim(),
        priceMin: Number(form.priceMin),
        priceMax: Number(form.priceMax),
        guestCapacity: form.guestCapacity ? Number(form.guestCapacity) : undefined,
        venueType: form.venueType.trim() || undefined,
        description: form.description.trim(),
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        isFeatured: form.isFeatured,
        status: form.status,
        virtualTourVideo: form.virtualTourVideo,
        image: cleanImages[0] || '',
        images: cleanImages,
        packages: builtPackages,
        faqs: builtFaqs,
        ...(isEdit ? { category: form.category } : { categoryId: form.category }),
      };

      const res = await fetch(isEdit ? `/api/vendors/${vendorId}` : '/api/vendors', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setSaveMsg('Vendor updated successfully!');
          setVendor(data.data);
          populateForm(data.data);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          router.push(`/admin/vendors/${data.data.id}`);
        }
      } else {
        setSaveMsg('Error: ' + (data.error || 'Save failed'));
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!vendorId || !confirm('Delete this vendor? This cannot be undone.')) return;
    await fetch(`/api/vendors/${vendorId}`, { method: 'DELETE' });
    router.push('/admin/vendors');
  };

  if (loading) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="pt-20 min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500 text-lg">Vendor not found.</p>
      <Link href="/admin/vendors" className="text-amber-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Vendors</Link>
    </div>
  );

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <div ref={topRef} className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin/vendors" className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Vendors
          </Link>
          {isEdit && (
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-all">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">
          {isEdit ? `Edit ${vendor?.name || 'Vendor'}` : 'Add Vendor'}
        </h1>
        <p className="text-gray-500 text-sm mb-6">Fill in the details below — SEO metadata, schema, and internal links are generated automatically.</p>

        {saveMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${saveMsg.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {saveMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* SECTION 1 — Basic Information */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">1. Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Vendor Name <span className="text-rose-500">*</span></label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder="e.g. Sharma Photography Studio" />
              </div>
              <div>
                <label className={labelCls}>Vendor Type / Category <span className="text-rose-500">*</span></label>
                <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>City <span className="text-rose-500">*</span></label>
                <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Area / Locality &amp; Full Address <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputCls} placeholder="e.g. Gola Road, Adarsh Vihar Colony, near T Point, Patna" />
              </div>
              <div>
                <label className={labelCls}>Contact Person</label>
                <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className={inputCls} placeholder="Ramesh Sharma" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                  className={inputCls} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp <span className="text-gray-400 font-normal">(if different)</span></label>
                <input type="tel" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                  className={inputCls} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                  className={inputCls} placeholder="ramesh@example.com" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Short Description <span className="text-rose-500">*</span></label>
                <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputCls} resize-none`} placeholder="A short, honest description of this vendor..." />
              </div>
            </div>
          </section>

          {/* SECTION 2 — Business Information */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">2. Business Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Starting Price (₹) <span className="text-rose-500">*</span></label>
                <input required type="number" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })}
                  className={inputCls} placeholder="50000" />
              </div>
              <div>
                <label className={labelCls}>Maximum Price (₹) <span className="text-rose-500">*</span></label>
                <input required type="number" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                  className={inputCls} placeholder="200000" />
              </div>
              <div>
                <label className={labelCls}>Guest Capacity <span className="text-gray-400 font-normal">(if applicable)</span></label>
                <input type="number" value={form.guestCapacity} onChange={(e) => setForm({ ...form, guestCapacity: e.target.value })}
                  className={inputCls} placeholder="500" />
              </div>
              <div>
                <label className={labelCls}>Venue Type <span className="text-gray-400 font-normal">(if applicable)</span></label>
                <input value={form.venueType} onChange={(e) => setForm({ ...form, venueType: e.target.value })}
                  className={inputCls} placeholder="Banquet Hall, Resort, Farmhouse..." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Rooms, Parking, Catering, Decoration, Amenities <span className="text-gray-400 font-normal">(comma-separated tags)</span></label>
                <input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })}
                  className={inputCls} placeholder="50 Rooms, Free Parking, In-house Catering, Decoration Included" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="featured" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="featured" className="text-sm text-gray-700">Mark as Featured</label>
              </div>
            </div>
          </section>

          {/* SECTION 3 — Media */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">3. Media</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Cover Image &amp; Gallery <span className="text-rose-500">*</span> <span className="text-gray-400 font-normal">(first = cover)</span></label>
                  <button type="button" onClick={() => setImages((imgs) => [...imgs, ''])}
                    className="flex items-center gap-1 text-xs text-amber-600 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50">
                    <Plus className="w-3 h-3" /> Add Slot
                  </button>
                </div>
                <div className="space-y-2">
                  {images.map((url, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <ImageUploadField value={url} onChange={(u) => setImages((imgs) => imgs.map((v, idx) => idx === i ? u : v))}
                          required={i === 0} placeholder={i === 0 ? 'Upload cover image (required)' : `Gallery image ${i + 1} (optional)`} />
                      </div>
                      {images.length > 1 && (
                        <button type="button" onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-600 mt-3 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Virtual Tour Video <span className="text-gray-400 font-normal">(optional)</span></label>
                <VideoUploadField value={form.virtualTourVideo} onChange={(u) => setForm({ ...form, virtualTourVideo: u })} />
              </div>
            </div>
          </section>

          {/* SECTION 4 — Packages */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5"><Tag className="w-4 h-4 text-amber-500" /> 4. Packages</h2>
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
                      <label className={labelCls}>Name</label>
                      <input value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)}
                        className={`${inputCls} bg-white`} placeholder="Basic, Premium, Deluxe" />
                    </div>
                    <div>
                      <label className={labelCls}>Price (₹)</label>
                      <input type="number" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)}
                        className={`${inputCls} bg-white`} placeholder="75000" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Description</label>
                      <input value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)}
                        className={`${inputCls} bg-white`} placeholder="What's included..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Features (comma-separated)</label>
                      <input value={pkg.features} onChange={(e) => updatePackage(i, 'features', e.target.value)}
                        className={`${inputCls} bg-white`} placeholder="5 Hours, 2 Photographers" />
                    </div>
                    <div>
                      <label className={labelCls}>Package Image <span className="text-gray-400 font-normal">(optional)</span></label>
                      <ImageUploadField value={pkg.image} onChange={(u) => updatePackage(i, 'image', u)} placeholder="Upload package image (optional)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`popular-${i}`} checked={pkg.isPopular} onChange={(e) => updatePackage(i, 'isPopular', e.target.checked)} className="w-4 h-4" />
                      <label htmlFor={`popular-${i}`} className="text-xs text-gray-600 font-medium">Mark as Popular</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5 — FAQs */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5"><HelpCircle className="w-4 h-4 text-amber-500" /> 5. FAQs</h2>
              <button type="button" onClick={addFaqRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                <Plus className="w-3.5 h-3.5" /> Add FAQ
              </button>
            </div>
            {faqs.length === 0 ? (
              <p className="text-sm text-gray-400">No FAQs yet — optional, but they show up in search results and answer common customer questions.</p>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">FAQ {i + 1}</span>
                      <button type="button" onClick={() => removeFaqRow(i)} className="text-rose-400 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input value={faq.question} onChange={(e) => updateFaq(i, 'question', e.target.value)}
                        className={`${inputCls} bg-white`} placeholder="Question, e.g. Do you provide parking?" />
                      <textarea rows={2} value={faq.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                        className={`${inputCls} bg-white resize-none`} placeholder="Answer" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 6 — Publishing */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">6. Publishing</h2>
            <div className="space-y-3">
              {STATUSES.map((s) => (
                <label key={s.value} className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-colors ${form.status === s.value ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
                  <input type="radio" name="status" value={s.value} checked={form.status === s.value}
                    onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                    <p className="text-xs text-gray-500">{s.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {isEdit && vendor?.slug && (
              <a href={`/vendors/${vendor.slug}${form.status !== 'PUBLISHED' ? '?preview=1' : ''}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-4">
                <ExternalLink className="w-3.5 h-3.5" /> Preview public profile
              </a>
            )}
          </section>

          {/* Submit */}
          <div className="flex items-center gap-3 pb-4">
            <button type="submit" disabled={!isFormValid || saving}
              className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Save Vendor'}
            </button>
            <Link href="/admin/vendors" className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
              Cancel
            </Link>
            {!isFormValid && <p className="text-xs text-rose-500">Fill all required <span className="font-bold">*</span> fields</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
