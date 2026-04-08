'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Briefcase, MessageSquare, Phone, Plus, Trash2, Edit, RefreshCw, CheckCircle, Star, ChevronRight, Database, ArrowLeft, Tag, BookOpen, Upload, X, Eye, Search, Sparkles, LogOut } from 'lucide-react';

// ── Cloudinary image uploader ─────────────────────────────────────────────────
function ImageUploadField({
  value,
  onChange,
  required = false,
  placeholder = 'Upload image',
}: {
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        onChange(data.url);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <Image src={value} alt="preview" width={120} height={80} className="rounded-lg object-cover border border-gray-200" style={{ height: 80, width: 120, objectFit: 'cover' }} unoptimized />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all disabled:opacity-50 w-full"
        >
          {uploading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-4 h-4" /> {placeholder}</>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        required={required && !value}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

type Tab = 'dashboard' | 'vendors' | 'categories' | 'special-services' | 'special-vendors' | 'enquiries' | 'consultations' | 'bookings';

interface Stats { vendors: number; categories: number; enquiries: number; consultations: number; newEnquiries: number; newConsultations: number; bookings: number; newBookings: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface PackageForm { name: string; price: string; description: string; features: string; isPopular: boolean; image: string; }

const EMPTY_PACKAGE: PackageForm = { name: '', price: '', description: '', features: '', isPopular: false, image: '' };

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
};

const EMPTY_VENDOR = { name: '', ownerName: '', ownerPhone: '', ownerEmail: '', category: 'venue', city: 'Patna', priceMin: '', priceMax: '', rating: '4.5', reviewCount: '', description: '', features: '', isFeatured: false };
const EMPTY_CATEGORY = { id: '', name: '', icon: '🏛️', description: '', image: '' };

export default function AdminClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [vendors, setVendors] = useState<AnyRecord[]>([]);
  const [categories, setCategories] = useState<AnyRecord[]>([]);
  const [enquiries, setEnquiries] = useState<AnyRecord[]>([]);
  const [consultations, setConsultations] = useState<AnyRecord[]>([]);
  const [bookings, setBookings] = useState<AnyRecord[]>([]);
  const [enquiryFilter, setEnquiryFilter] = useState<'all' | 'new' | 'contacted' | 'closed'>('all');
  const [consultationFilter, setConsultationFilter] = useState<'all' | 'new' | 'contacted' | 'closed'>('all');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin' | null>(null);

  // Vendor form
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AnyRecord | null>(null);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [vendorImages, setVendorImages] = useState<string[]>(['']);
  const [packages, setPackages] = useState<PackageForm[]>([{ ...EMPTY_PACKAGE }]);
  const vendorFormRef = useRef<HTMLDivElement>(null);
  const [vendorSearch, setVendorSearch] = useState('');

  // Scroll to form whenever it opens (add or edit)
  useEffect(() => {
    if (showAddVendor && vendorFormRef.current) {
      vendorFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showAddVendor, editingVendor]);

  // Category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AnyRecord | null>(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);

  // Special services form (same shape as category, but isSpecial=true)
  const [showAddSpecialCategory, setShowAddSpecialCategory] = useState(false);
  const [editingSpecialCategory, setEditingSpecialCategory] = useState<AnyRecord | null>(null);
  const [specialCategoryForm, setSpecialCategoryForm] = useState(EMPTY_CATEGORY);
  // Special vendor form (reuses vendor form, category limited to special service ids)
  const [showAddSpecialVendor, setShowAddSpecialVendor] = useState(false);
  const [editingSpecialVendor, setEditingSpecialVendor] = useState<AnyRecord | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, vRes, cRes, eRes, conRes, bRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/vendors?limit=100'),
        fetch('/api/categories'),
        fetch('/api/enquiries'),
        fetch('/api/consultations'),
        fetch('/api/bookings'),
      ]);
      const [s, v, c, e, con, b] = await Promise.all([sRes.json(), vRes.json(), cRes.json(), eRes.json(), conRes.json(), bRes.json()]);
      if (s.success) setStats(s.data);
      if (v.success) setVendors(v.data);
      if (c.success) setCategories(c.data);
      if (e.success) setEnquiries(e.data);
      if (con.success) setConsultations(con.data);
      if (b.success) setBookings(b.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => setRole(d.role));
  }, []);

  const handleSeed = async () => {
    setSeeding(true); setSeedMsg('');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      setSeedMsg(data.message || 'Seeded!');
      fetchAll();
    } finally { setSeeding(false); }
  };

  // ── Vendor handlers ────────────────────────────────────────────────────────
  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor?')) return;
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const isVendorFormValid = Boolean(
    vendorForm.name.trim() &&
    vendorForm.description.trim() &&
    vendorForm.priceMin &&
    vendorForm.priceMax &&
    vendorImages[0]?.trim()
  );

  const addPackageRow = () => setPackages((p) => [...p, { ...EMPTY_PACKAGE }]);
  const removePackageRow = (i: number) => setPackages((p) => p.filter((_, idx) => idx !== i));
  const updatePackage = (i: number, key: keyof PackageForm, value: string | boolean) =>
    setPackages((p) => p.map((pkg, idx) => idx === i ? { ...pkg, [key]: value } : pkg));

  const openAddVendor = () => {
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR);
    setVendorImages(['']);
    setPackages([{ ...EMPTY_PACKAGE }]);
    setShowAddVendor(true);
  };

  const openEditVendor = (v: AnyRecord) => {
    setEditingVendor(v);
    setVendorForm({
      name: v.name, ownerName: v.ownerName || '', ownerPhone: v.ownerPhone || '', ownerEmail: v.ownerEmail || '',
      category: v.category, city: v.city,
      priceMin: v.priceMin, priceMax: v.priceMax, rating: v.rating,
      reviewCount: v.reviewCount, description: v.description,
      features: (v.features || []).join(', '), isFeatured: v.isFeatured,
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
    setShowAddVendor(true);
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const builtPackages = packages
      .filter((p) => p.name && p.price)
      .map((p, i) => ({
        id: `pkg-${i + 1}`,
        name: p.name,
        price: Number(p.price),
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
      id: editingVendor ? editingVendor.id : `${vendorForm.category}-${Date.now()}`,
      image: cleanImages[0] || '',
      images: cleanImages,
      priceMin: Number(vendorForm.priceMin),
      priceMax: Number(vendorForm.priceMax),
      rating: Number(vendorForm.rating),
      reviewCount: Number(vendorForm.reviewCount),
      features: vendorForm.features.split(',').map((f) => f.trim()).filter(Boolean),
      packages: builtPackages,
    };

    if (editingVendor) {
      await fetch(`/api/vendors/${editingVendor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowAddVendor(false);
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR);
    setVendorImages(['']);
    setPackages([{ ...EMPTY_PACKAGE }]);
    fetchAll();
  };

  // ── Category handlers ──────────────────────────────────────────────────────
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm(EMPTY_CATEGORY);
    setShowAddCategory(true);
  };

  const openEditCategory = (c: AnyRecord) => {
    setEditingCategory(c);
    setCategoryForm({ id: c.id, name: c.name, icon: c.icon, description: c.description, image: c.image || '' });
    setShowAddCategory(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      await fetch(`/api/categories/${editingCategory.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) });
    } else {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...categoryForm, vendorCount: 0 }) });
    }
    setShowAddCategory(false);
    setEditingCategory(null);
    setCategoryForm(EMPTY_CATEGORY);
    fetchAll();
  };

  // ── Special service category handlers ─────────────────────────────────────
  const specialCategories = categories.filter((c) => c.isSpecial);
  const regularCategories = categories.filter((c) => !c.isSpecial);
  const regularVendors = vendors.filter((v) => !specialCategories.some((sc) => sc.id === v.category));
  const specialVendors = vendors.filter((v) => specialCategories.some((sc) => sc.id === v.category));

  const openAddSpecialCategory = () => {
    setEditingSpecialCategory(null);
    setSpecialCategoryForm(EMPTY_CATEGORY);
    setShowAddSpecialCategory(true);
  };

  const openEditSpecialCategory = (c: AnyRecord) => {
    setEditingSpecialCategory(c);
    setSpecialCategoryForm({ id: c.id, name: c.name, icon: c.icon, description: c.description, image: c.image || '' });
    setShowAddSpecialCategory(true);
  };

  const handleSpecialCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSpecialCategory) {
      await fetch(`/api/categories/${editingSpecialCategory.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...specialCategoryForm, isSpecial: true }) });
    } else {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...specialCategoryForm, isSpecial: true, vendorCount: 0 }) });
    }
    setShowAddSpecialCategory(false);
    setEditingSpecialCategory(null);
    setSpecialCategoryForm(EMPTY_CATEGORY);
    fetchAll();
  };

  const handleDeleteSpecialCategory = async (id: string) => {
    if (!confirm('Delete this special service category?')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const openAddSpecialVendor = () => {
    setEditingSpecialVendor(null);
    setEditingVendor(null);
    setVendorForm({ ...EMPTY_VENDOR, category: specialCategories[0]?.id || '' });
    setVendorImages(['']);
    setPackages([{ ...EMPTY_PACKAGE }]);
    setShowAddSpecialVendor(true);
  };

  const openEditSpecialVendor = (v: AnyRecord) => {
    setEditingSpecialVendor(v);
    setEditingVendor(v);
    setVendorForm({
      name: v.name, ownerName: v.ownerName || '', ownerPhone: v.ownerPhone || '', ownerEmail: v.ownerEmail || '',
      category: v.category, city: v.city,
      priceMin: v.priceMin, priceMax: v.priceMax, rating: v.rating,
      reviewCount: v.reviewCount, description: v.description,
      features: (v.features || []).join(', '), isFeatured: v.isFeatured,
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
    setShowAddSpecialVendor(true);
  };

  const handleSpecialVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      id: editingSpecialVendor ? editingSpecialVendor.id : `${vendorForm.category}-${Date.now()}`,
      image: cleanImages[0] || '',
      images: cleanImages,
      priceMin: Number(vendorForm.priceMin),
      priceMax: Number(vendorForm.priceMax),
      rating: Number(vendorForm.rating),
      reviewCount: Number(vendorForm.reviewCount),
      features: vendorForm.features.split(',').map((f) => f.trim()).filter(Boolean),
      packages: builtPackages,
    };
    if (editingSpecialVendor) {
      await fetch(`/api/vendors/${editingSpecialVendor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowAddSpecialVendor(false);
    setEditingSpecialVendor(null);
    setEditingVendor(null);
    setVendorForm(EMPTY_VENDOR);
    setVendorImages(['']);
    setPackages([{ ...EMPTY_PACKAGE }]);
    fetchAll();
  };

  const handleStatusChange = async (type: 'enquiries' | 'consultations', id: string, status: string) => {
    await fetch(`/api/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchAll();
  };

  const TABS = [
    { id: 'dashboard' as Tab, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'vendors' as Tab, icon: Briefcase, label: 'Vendors', badge: regularVendors.length },
    { id: 'categories' as Tab, icon: Tag, label: 'Categories', badge: regularCategories.length },
    { id: 'special-services' as Tab, icon: Sparkles, label: 'Special Services', badge: specialCategories.length },
    { id: 'special-vendors' as Tab, icon: Briefcase, label: 'Special Vendors', badge: specialVendors.length, badgeColor: 'bg-violet-500' },
    { id: 'enquiries' as Tab, icon: MessageSquare, label: 'Enquiries', badge: stats?.newEnquiries, badgeColor: 'bg-rose-500' },
    { id: 'consultations' as Tab, icon: Phone, label: 'Consultations', badge: stats?.newConsultations, badgeColor: 'bg-rose-500' },
    { id: 'bookings' as Tab, icon: BookOpen, label: 'Bookings', badge: stats?.newBookings, badgeColor: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-16 sm:w-56 bg-gray-950 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="hidden sm:flex items-center gap-2 text-white font-bold text-sm">
            <ArrowLeft className="w-4 h-4 text-gray-400" /> WeddingCart
          </Link>
          <div className="sm:hidden flex justify-center"><ArrowLeft className="w-5 h-5 text-gray-400" /></div>
        </div>
        <p className="hidden sm:block px-4 py-3 text-gray-500 text-[10px] uppercase tracking-widest font-semibold">Admin Panel</p>
        <nav className="flex-1 py-2">
          {TABS.map(({ id, icon: Icon, label, badge, badgeColor = 'bg-amber-500' }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                tab === id ? 'bg-amber-500/20 text-amber-400 border-r-2 border-amber-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:block text-sm font-medium">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`hidden sm:flex ml-auto ${badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] items-center justify-center`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          {role === 'super_admin' && (
            <>
              <button onClick={handleSeed} disabled={seeding}
                className="w-full flex items-center gap-2 justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium px-3 py-2.5 rounded-xl transition-all"
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:block">{seeding ? 'Seeding...' : 'Seed DB'}</span>
              </button>
              {seedMsg && <p className="text-emerald-400 text-[10px] mt-1 text-center hidden sm:block">{seedMsg}</p>}
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] capitalize">{tab}</h1>
              <p className="text-gray-500 text-sm mt-0.5">WeddingCart Admin Panel</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchAll} disabled={loading} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-white transition-all">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={async () => {
                  await fetch('/api/admin/logout', { method: 'POST' });
                  router.replace('/admin/login');
                }}
                className="flex items-center gap-2 text-rose-500 hover:text-rose-700 text-sm border border-rose-200 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total Vendors',  value: stats?.vendors || 0,       icon: Briefcase,    color: 'bg-blue-500',   tab: 'vendors' as Tab },
                  { label: 'Categories',     value: stats?.categories || 0,    icon: Tag,          color: 'bg-purple-500', tab: 'categories' as Tab },
                  { label: 'Enquiries',      value: stats?.enquiries || 0,     icon: MessageSquare,color: 'bg-amber-500',  tab: 'enquiries' as Tab,     sub: stats?.newEnquiries ? `${stats.newEnquiries} new` : undefined },
                  { label: 'Consultations',  value: stats?.consultations || 0, icon: Phone,        color: 'bg-rose-500',   tab: 'consultations' as Tab, sub: stats?.newConsultations ? `${stats.newConsultations} new` : undefined },
                  { label: 'Bookings',       value: stats?.bookings || 0,      icon: BookOpen,     color: 'bg-teal-500',   tab: 'bookings' as Tab,      sub: stats?.newBookings ? `${stats.newBookings} new` : undefined },
                ].map(({ label, value, icon: Icon, color, tab: targetTab, sub }) => (
                  <button
                    key={label}
                    onClick={() => setTab(targetTab)}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-left hover:shadow-md hover:border-amber-200 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-gray-600 text-sm font-medium">{label}</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {sub && <p className="text-xs text-amber-600 font-medium mt-1">{sub}</p>}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button onClick={() => { setTab('vendors'); openAddVendor(); }} className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all">
                    <Plus className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Add New Vendor</p>
                      <p className="text-xs opacity-70">Add a wedding vendor</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                  <button onClick={() => { setTab('categories'); openAddCategory(); }} className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-all">
                    <Tag className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Add Category</p>
                      <p className="text-xs opacity-70">Create a new category</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                  {role === 'super_admin' && (
                    <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all">
                      <Database className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">Seed Database</p>
                        <p className="text-xs opacity-70">Load sample data</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VENDORS */}
          {tab === 'vendors' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <p className="text-gray-500 text-sm">{regularVendors.length} vendors total</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Search vendors..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                  <button onClick={openAddVendor} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all whitespace-nowrap">
                    <Plus className="w-4 h-4" /> Add Vendor
                  </button>
                </div>
              </div>

              {showAddVendor && (
                <div ref={vendorFormRef} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 animate-fade-in">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
                  <form onSubmit={handleVendorSubmit} className="space-y-6">
                    {/* Basic info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Business Name *</label>
                        <input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Sharma Photography Studio" />
                      </div>

                      {/* Owner details — admin only */}
                      <div className="sm:col-span-2">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                            🔒 Owner Details <span className="font-normal normal-case text-blue-400">(admin only — not shown publicly)</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Owner Name *</label>
                              <input required value={vendorForm.ownerName} onChange={(e) => setVendorForm({ ...vendorForm, ownerName: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Ramesh Sharma" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Number *</label>
                              <input required type="tel" value={vendorForm.ownerPhone} onChange={(e) => setVendorForm({ ...vendorForm, ownerPhone: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="+91 98765 43210" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                              <input type="email" value={vendorForm.ownerEmail} onChange={(e) => setVendorForm({ ...vendorForm, ownerEmail: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="ramesh@example.com" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                        <select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                          {regularCategories.length > 0
                            ? regularCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                            : ['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video'].map((c) => <option key={c} value={c}>{c}</option>)
                          }
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                        <select value={vendorForm.city} onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                          {['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Rating</label>
                        <input type="number" step="0.1" min="1" max="5" value={vendorForm.rating} onChange={(e) => setVendorForm({ ...vendorForm, rating: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Min Price (₹) <span className="text-rose-500">*</span></label>
                        <input required type="number" value={vendorForm.priceMin} onChange={(e) => setVendorForm({ ...vendorForm, priceMin: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="50000" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Max Price (₹) <span className="text-rose-500">*</span></label>
                        <input required type="number" value={vendorForm.priceMax} onChange={(e) => setVendorForm({ ...vendorForm, priceMax: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="200000" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Review Count</label>
                        <input type="number" value={vendorForm.reviewCount} onChange={(e) => setVendorForm({ ...vendorForm, reviewCount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="100" />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-gray-500">Image Gallery <span className="text-rose-500">*</span> <span className="text-gray-400 font-normal">(first image = cover)</span></label>
                          <button type="button" onClick={() => setVendorImages((imgs) => [...imgs, ''])} className="flex items-center gap-1 text-xs text-amber-600 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50 transition-all">
                            <Plus className="w-3 h-3" /> Add Slot
                          </button>
                        </div>
                        <div className="space-y-2">
                          {vendorImages.map((url, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              <div className="flex-1">
                                <ImageUploadField
                                  value={url}
                                  onChange={(u) => setVendorImages((imgs) => imgs.map((v, idx) => idx === i ? u : v))}
                                  required={i === 0}
                                  placeholder={i === 0 ? 'Upload cover image (required)' : `Upload gallery image ${i + 1} (optional)`}
                                />
                              </div>
                              {vendorImages.length > 1 && (
                                <button type="button" onClick={() => setVendorImages((imgs) => imgs.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 transition-colors flex-shrink-0 mt-3">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Description <span className="text-rose-500">*</span></label>
                        <textarea required rows={3} value={vendorForm.description} onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Vendor description..." />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Features (comma-separated)</label>
                        <input value={vendorForm.features} onChange={(e) => setVendorForm({ ...vendorForm, features: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="AC Hall, Parking, Catering" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="featured" checked={vendorForm.isFeatured} onChange={(e) => setVendorForm({ ...vendorForm, isFeatured: e.target.checked })} className="w-4 h-4" />
                        <label htmlFor="featured" className="text-sm text-gray-700">Mark as Featured</label>
                      </div>
                    </div>

                    {/* Packages */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800 text-sm">Packages</h4>
                        <button type="button" onClick={addPackageRow} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all">
                          <Plus className="w-3.5 h-3.5" /> Add Package
                        </button>
                      </div>
                      <div className="space-y-3">
                        {packages.map((pkg, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Package {i + 1}</span>
                              {packages.length > 1 && (
                                <button type="button" onClick={() => removePackageRow(i)} className="text-rose-400 hover:text-rose-600 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Package Name *</label>
                                <input value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="e.g. Basic, Premium, Deluxe" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Price (₹) *</label>
                                <input type="number" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="75000" />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                                <input value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="What's included..." />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Features (comma-separated)</label>
                                <input value={pkg.features} onChange={(e) => updatePackage(i, 'features', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="5 Hours, 2 Photographers, Drone" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Package Image <span className="text-gray-400 font-normal">(optional)</span></label>
                                <ImageUploadField
                                  value={pkg.image}
                                  onChange={(u) => updatePackage(i, 'image', u)}
                                  placeholder="Upload package image (optional)"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" id={`popular-${i}`} checked={pkg.isPopular} onChange={(e) => updatePackage(i, 'isPopular', e.target.checked)} className="w-4 h-4" />
                                <label htmlFor={`popular-${i}`} className="text-xs text-gray-600 font-medium">Mark as Popular</label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      <button
                        type="submit"
                        disabled={!isVendorFormValid}
                        className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40 transition-opacity"
                      >
                        {editingVendor ? 'Update' : 'Add'} Vendor
                      </button>
                      <button type="button" onClick={() => { setShowAddVendor(false); setEditingVendor(null); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                        Cancel
                      </button>
                      {!isVendorFormValid && (
                        <p className="text-xs text-rose-500">Fill all required <span className="text-rose-500 font-bold">*</span> fields to continue</p>
                      )}
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Business', 'Owner / Contact', 'Category', 'City', 'Price Range', 'Rating', 'Pkgs', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {regularVendors
                        .filter((v) => {
                          const q = vendorSearch.toLowerCase();
                          return !q || v.name?.toLowerCase().includes(q) || v.category?.toLowerCase().includes(q) || v.city?.toLowerCase().includes(q) || v.ownerName?.toLowerCase().includes(q);
                        })
                        .map((v) => (
                        <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{v.name}</p>
                            {v.isFeatured && <span className="text-[10px] text-emerald-600 font-bold">★ Featured</span>}
                          </td>
                          <td className="px-4 py-3">
                            {v.ownerName ? (
                              <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-gray-800">{v.ownerName}</p>
                                {v.ownerPhone && (
                                  <a href={`tel:${v.ownerPhone}`} className="text-xs text-blue-600 hover:underline block">{v.ownerPhone}</a>
                                )}
                                {v.ownerEmail && (
                                  <a href={`mailto:${v.ownerEmail}`} className="text-xs text-gray-400 hover:underline block truncate max-w-[140px]">{v.ownerEmail}</a>
                                )}
                              </div>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3"><span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">{v.category}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.city}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">₹{(v.priceMin || 0).toLocaleString('en-IN')} – ₹{(v.priceMax || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {v.rating}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                              {(v.packages || []).length}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/vendors/${v.id}`} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </Link>
                              <button onClick={() => openEditVendor(v)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {regularVendors.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No vendors yet. Seed the database or add vendors manually.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          {tab === 'categories' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <p className="text-gray-500 text-sm">{regularCategories.length} categories total</p>
                <button onClick={openAddCategory} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>

              {showAddCategory && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 animate-fade-in">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
                  <form onSubmit={handleCategorySubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Category ID * <span className="text-gray-400 font-normal">(slug, e.g. &ldquo;venue&rdquo;)</span></label>
                      <input required value={categoryForm.id} onChange={(e) => setCategoryForm({ ...categoryForm, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })} disabled={!!editingCategory} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50 disabled:text-gray-400 font-mono" placeholder="photo-video" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Display Name *</label>
                      <input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Photography & Videography" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Icon (emoji) *</label>
                      <input required value={categoryForm.icon} onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="📸" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Cover Image <span className="text-rose-500">*</span></label>
                      <ImageUploadField
                        value={categoryForm.image}
                        onChange={(u) => setCategoryForm({ ...categoryForm, image: u })}
                        required
                        placeholder="Upload cover image (required)"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Description *</label>
                      <textarea required rows={2} value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Short description of this category..." />
                    </div>
                    <div className="sm:col-span-2 flex gap-3">
                      <button type="submit" className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90">
                        {editingCategory ? 'Update' : 'Add'} Category
                      </button>
                      <button type="button" onClick={() => { setShowAddCategory(false); setEditingCategory(null); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Icon', 'Name', 'ID', 'Description', 'Vendors', 'Image', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {regularCategories.map((c) => (
                        <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-2xl">{c.icon}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{c.name}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.id}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs line-clamp-1">{c.description}</td>
                          <td className="px-4 py-3 text-sm font-bold text-amber-600">{c.vendorCount}</td>
                          <td className="px-4 py-3">
                            {c.image ? (
                              <div className="relative w-12 h-8 rounded-lg overflow-hidden border border-gray-200">
                                <Image src={c.image} alt={c.name} fill className="object-cover" unoptimized />
                              </div>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/admin/categories/${c.id}`} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="View">
                                <Eye className="w-4 h-4" />
                              </Link>
                              <button onClick={() => openEditCategory(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteCategory(c.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {regularCategories.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No categories yet. Seed the database or add categories manually.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SPECIAL SERVICES — categories only */}
          {tab === 'special-services' && (
            <div>
              {/* ── Special Service Categories ── */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Special Service Categories</h2>
                    <p className="text-gray-400 text-xs mt-0.5">{specialCategories.length} special categories</p>
                  </div>
                  <button onClick={openAddSpecialCategory} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                    <Plus className="w-4 h-4" /> Add Special Category
                  </button>
                </div>

                {showAddSpecialCategory && (
                  <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 mb-5 animate-fade-in">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      {editingSpecialCategory ? 'Edit Special Service' : 'Add Special Service'}
                    </h3>
                    <form onSubmit={handleSpecialCategorySubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Category ID * <span className="text-gray-400 font-normal">(slug, e.g. &ldquo;trousseau&rdquo;)</span></label>
                        <input required value={specialCategoryForm.id} onChange={(e) => setSpecialCategoryForm({ ...specialCategoryForm, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })} disabled={!!editingSpecialCategory} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50 disabled:text-gray-400 font-mono" placeholder="bridal-lehenga" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Display Name *</label>
                        <input required value={specialCategoryForm.name} onChange={(e) => setSpecialCategoryForm({ ...specialCategoryForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Bridal Lehenga" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Icon (emoji) *</label>
                        <input required value={specialCategoryForm.icon} onChange={(e) => setSpecialCategoryForm({ ...specialCategoryForm, icon: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="👗" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Cover Image <span className="text-rose-500">*</span></label>
                        <ImageUploadField value={specialCategoryForm.image} onChange={(u) => setSpecialCategoryForm({ ...specialCategoryForm, image: u })} required placeholder="Upload cover image (required)" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Description *</label>
                        <textarea required rows={2} value={specialCategoryForm.description} onChange={(e) => setSpecialCategoryForm({ ...specialCategoryForm, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="What this special service offers..." />
                      </div>
                      <div className="sm:col-span-2 flex gap-3">
                        <button type="submit" className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90">
                          {editingSpecialCategory ? 'Update' : 'Add'} Special Service
                        </button>
                        <button type="button" onClick={() => { setShowAddSpecialCategory(false); setEditingSpecialCategory(null); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Icon', 'Name', 'ID', 'Description', 'Vendors', 'Image', 'Actions'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {specialCategories.map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-2xl">{c.icon}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{c.name}</td>
                            <td className="px-4 py-3"><span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">{c.id}</span></td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-xs line-clamp-1">{c.description}</td>
                            <td className="px-4 py-3 text-sm font-bold text-amber-600">{specialVendors.filter((v) => v.category === c.id).length}</td>
                            <td className="px-4 py-3">
                              {c.image ? (
                                <div className="relative w-12 h-8 rounded-lg overflow-hidden border border-gray-200">
                                  <Image src={c.image} alt={c.name} fill className="object-cover" unoptimized />
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Link href={`/admin/categories/${c.id}`} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="View">
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <button onClick={() => openEditSpecialCategory(c)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteSpecialCategory(c.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {specialCategories.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No special services yet. Add your first special service category above.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── hint ── */}
              <div className="mt-6 bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
                <p className="text-sm text-violet-700">To add or manage vendors for these special services, go to the <button onClick={() => setTab('special-vendors')} className="font-bold underline hover:text-violet-900">Special Vendors</button> tab.</p>
              </div>
            </div>
          )}

          {/* SPECIAL VENDORS — vendors in special services */}
          {tab === 'special-vendors' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Special Service Vendors</h2>
                  <p className="text-gray-400 text-xs mt-0.5">{specialVendors.length} vendors across {specialCategories.length} special services</p>
                </div>
                <button onClick={openAddSpecialVendor} disabled={specialCategories.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Add Vendor
                </button>
              </div>
              {specialCategories.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-700">Add at least one special service category first from the <button onClick={() => setTab('special-services')} className="font-bold underline hover:text-amber-900">Special Services</button> tab.</p>
                </div>
              )}
              <div>

                {showAddSpecialVendor && (
                  <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 mb-5 animate-fade-in">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg">{editingSpecialVendor ? 'Edit Vendor' : 'Add Special Service Vendor'}</h3>
                    <form onSubmit={handleSpecialVendorSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Business Name *</label>
                          <input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Rani Bridal Studio" />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">🔒 Owner Details <span className="font-normal normal-case text-blue-400">(admin only)</span></p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Owner Name</label>
                                <input value={vendorForm.ownerName} onChange={(e) => setVendorForm({ ...vendorForm, ownerName: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Sunita Devi" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Number</label>
                                <input type="tel" value={vendorForm.ownerPhone} onChange={(e) => setVendorForm({ ...vendorForm, ownerPhone: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="+91 98765 43210" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                                <input type="email" value={vendorForm.ownerEmail} onChange={(e) => setVendorForm({ ...vendorForm, ownerEmail: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="sunita@example.com" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Special Service Category *</label>
                          <select required value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                            {specialCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                          <select value={vendorForm.city} onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                            {['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'].map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Min Price (₹) *</label>
                          <input required type="number" value={vendorForm.priceMin} onChange={(e) => setVendorForm({ ...vendorForm, priceMin: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="5000" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Max Price (₹) *</label>
                          <input required type="number" value={vendorForm.priceMax} onChange={(e) => setVendorForm({ ...vendorForm, priceMax: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="50000" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Rating</label>
                          <input type="number" step="0.1" min="1" max="5" value={vendorForm.rating} onChange={(e) => setVendorForm({ ...vendorForm, rating: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Review Count</label>
                          <input type="number" value={vendorForm.reviewCount} onChange={(e) => setVendorForm({ ...vendorForm, reviewCount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="20" />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-gray-500">Image Gallery <span className="text-rose-500">*</span> <span className="text-gray-400 font-normal">(first = cover)</span></label>
                            <button type="button" onClick={() => setVendorImages((imgs) => [...imgs, ''])} className="flex items-center gap-1 text-xs text-amber-600 border border-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50">
                              <Plus className="w-3 h-3" /> Add Slot
                            </button>
                          </div>
                          <div className="space-y-2">
                            {vendorImages.map((url, i) => (
                              <div key={i} className="flex gap-2 items-start">
                                <div className="flex-1">
                                  <ImageUploadField value={url} onChange={(u) => setVendorImages((imgs) => imgs.map((v, idx) => idx === i ? u : v))} required={i === 0} placeholder={i === 0 ? 'Upload cover image (required)' : `Gallery image ${i + 1} (optional)`} />
                                </div>
                                {vendorImages.length > 1 && (
                                  <button type="button" onClick={() => setVendorImages((imgs) => imgs.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 mt-3 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Description *</label>
                          <textarea required rows={3} value={vendorForm.description} onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Vendor description..." />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Features <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                          <input value={vendorForm.features} onChange={(e) => setVendorForm({ ...vendorForm, features: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Home delivery, Trial session, Pan India" />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="special-vendor-featured" checked={vendorForm.isFeatured} onChange={(e) => setVendorForm({ ...vendorForm, isFeatured: e.target.checked })} className="w-4 h-4" />
                          <label htmlFor="special-vendor-featured" className="text-sm text-gray-700">Mark as Featured</label>
                        </div>
                      </div>
                      {/* Packages */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><Tag className="w-4 h-4 text-amber-500" /> Packages</h4>
                          <button type="button" onClick={addPackageRow} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50">
                            <Plus className="w-3.5 h-3.5" /> Add Package
                          </button>
                        </div>
                        <div className="space-y-3">
                          {packages.map((pkg, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Package {i + 1}</span>
                                {packages.length > 1 && <button type="button" onClick={() => removePackageRow(i)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
                                  <input value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Basic, Standard, Premium" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Price (₹) *</label>
                                  <input type="number" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="10000" />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                                  <input value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="What's included..." />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Features (comma-separated)</label>
                                  <input value={pkg.features} onChange={(e) => updatePackage(i, 'features', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="Home delivery, Customisation" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 mb-1">Package Image <span className="text-gray-400 font-normal">(optional)</span></label>
                                  <ImageUploadField value={pkg.image} onChange={(u) => updatePackage(i, 'image', u)} placeholder="Upload package image (optional)" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" id={`spl-popular-${i}`} checked={pkg.isPopular} onChange={(e) => updatePackage(i, 'isPopular', e.target.checked)} className="w-4 h-4" />
                                  <label htmlFor={`spl-popular-${i}`} className="text-xs text-gray-600 font-medium">Mark as Popular</label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <button type="submit" disabled={!isVendorFormValid} className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                          {editingSpecialVendor ? 'Update' : 'Add'} Vendor
                        </button>
                        <button type="button" onClick={() => { setShowAddSpecialVendor(false); setEditingSpecialVendor(null); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Business', 'Service', 'City', 'Price Range', 'Rating', 'Pkgs', 'Actions'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {specialVendors.map((v) => (
                          <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-gray-900">{v.name}</p>
                              {v.isFeatured && <span className="text-[10px] text-emerald-600 font-bold">★ Featured</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">
                                {specialCategories.find((sc) => sc.id === v.category)?.icon} {specialCategories.find((sc) => sc.id === v.category)?.name || v.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{v.city}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">₹{(v.priceMin || 0).toLocaleString('en-IN')} – ₹{(v.priceMax || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-sm">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {v.rating}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{(v.packages || []).length}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Link href={`/admin/vendors/${v.id}`} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="View">
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <button onClick={() => openEditSpecialVendor(v)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {specialVendors.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{specialCategories.length === 0 ? 'Add a special service category first, then add vendors.' : 'No vendors yet. Click "Add Vendor" to get started.'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ENQUIRIES */}
          {tab === 'enquiries' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter:</span>
                {(['all', 'new', 'contacted', 'closed'] as const).map((f) => {
                  const count = f === 'all' ? enquiries.length : enquiries.filter((e) => e.status === f).length;
                  return (
                    <button key={f} onClick={() => setEnquiryFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                        enquiryFilter === f ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300 bg-white'
                      }`}
                    >{f} ({count})</button>
                  );
                })}
              </div>
              {(enquiryFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === enquiryFilter)).length === 0 && (
                <div className="text-center py-12 text-gray-400"><p>No {enquiryFilter === 'all' ? '' : enquiryFilter} enquiries.</p></div>
              )}
              {(enquiryFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === enquiryFilter)).map((e) => {
                const vendorData = vendors.find((v) => v.id === e.vendorId);
                const categoryData = categories.find((c) => c.id === e.vendorCategory);
                const isSpecialVendor = categoryData?.isSpecial;
                return (
                  <div key={e._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[e.status as keyof typeof STATUS_COLORS]}`}>{e.status}</span>
                        {isSpecialVendor && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Special Service</span>}
                        <span className="text-xs text-gray-400">
                          {new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          <span className="font-semibold text-amber-600">{new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {['new', 'contacted', 'closed'].map((s) => (
                          <button key={s} onClick={() => handleStatusChange('enquiries', e._id, s)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                              e.status === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>

                    {/* Client & Vendor cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {/* Client */}
                      <div className="bg-blue-50 rounded-xl p-3.5">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Client</p>
                        <p className="font-semibold text-gray-900 text-sm">{e.name}</p>
                        <p className="text-gray-700 text-xs mt-1">📞 {e.phone}</p>
                        {e.city && <p className="text-gray-700 text-xs mt-0.5">📍 {e.city}</p>}
                        {e.email && <p className="text-gray-600 text-xs mt-0.5">✉️ {e.email}</p>}
                      </div>
                      {/* Vendor */}
                      <div className="bg-amber-50 rounded-xl p-3.5">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                          Vendor {isSpecialVendor && <span className="text-violet-600">(Special)</span>}
                        </p>
                        <p className="font-semibold text-gray-900 text-sm">{e.vendorName}</p>
                        <p className="text-gray-600 text-xs mt-0.5 capitalize">{e.vendorCategory.replace(/-/g, ' ')}</p>
                        {vendorData?.ownerPhone && <p className="text-gray-700 text-xs mt-1">📞 {vendorData.ownerPhone}</p>}
                        {vendorData?.ownerName && <p className="text-gray-600 text-xs mt-0.5">👤 {vendorData.ownerName}</p>}
                      </div>
                    </div>

                    {/* Event details */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      <span>📅 {e.eventDate}</span>
                      {e.guestCount && <span>👥 {e.guestCount} guests</span>}
                      <span className="capitalize">🎊 {e.eventType}</span>
                    </div>
                    {e.message && <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{e.message}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* BOOKINGS */}
          {tab === 'bookings' && (
            <div className="space-y-4">
              {bookings.length === 0 && <div className="text-center py-12 text-gray-400"><p>No bookings yet.</p></div>}
              {bookings.map((b) => (
                <div key={b._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-bold text-gray-900">{b.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-500'}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">📞 {b.phone}{b.city ? ` · 📍 ${b.city}` : ''}</p>
                    </div>
                    {/* Booking time — prominent */}
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Booked at</p>
                      <p className="text-xs font-semibold text-gray-700">
                        {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-sm font-bold text-amber-600">
                        {new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>

                  {/* Booked items with vendor details */}
                  <div className="space-y-3 mb-4">
                    {b.items?.map((item: AnyRecord, i: number) => {
                      const vendorData = vendors.find((v) => v.id === item.vendorId)
                        || vendors.find((v) => v.name === item.vendorName && v.category === item.vendorCategory)
                        || vendors.find((v) => v.name === item.vendorName);
                      return (
                        <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                          {/* Item header */}
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{item.vendorName}</span>
                              <span className="text-xs text-gray-400 capitalize ml-2">({item.vendorCategory?.replace(/-/g, ' ')})</span>
                            </div>
                            <span className="text-xs font-bold text-amber-600">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="px-3 py-1.5 text-xs text-gray-500">
                            Package: <span className="font-medium text-gray-700">{item.packageName}</span>
                            {item.quantity > 1 && <span className="ml-2 text-gray-400">× {item.quantity}</span>}
                          </div>
                          {/* Vendor contact — only if found */}
                          {vendorData && (
                            <div className="bg-amber-50 border-t border-amber-100 px-3 py-2 flex flex-wrap gap-3">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider w-full">Vendor Contact</p>
                              {vendorData.ownerName && (
                                <span className="text-xs text-gray-700 flex items-center gap-1">👤 {vendorData.ownerName}</span>
                              )}
                              {vendorData.ownerPhone && (
                                <a href={`tel:${vendorData.ownerPhone}`} className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1">
                                  📞 {vendorData.ownerPhone}
                                </a>
                              )}
                              {vendorData.ownerEmail && (
                                <a href={`mailto:${vendorData.ownerEmail}`} className="text-xs text-gray-600 hover:underline flex items-center gap-1">
                                  ✉️ {vendorData.ownerEmail}
                                </a>
                              )}
                              {vendorData.city && (
                                <span className="text-xs text-gray-500">📍 {vendorData.city}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total + status controls */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-gray-100">
                    <p className="text-amber-600 font-bold text-base">Total: ₹{b.total?.toLocaleString('en-IN')}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {['new', 'contacted', 'confirmed', 'closed'].map((s) => (
                        <button key={s} onClick={async () => { await fetch(`/api/bookings/${b._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) }); fetchAll(); }}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                            b.status === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CONSULTATIONS */}
          {tab === 'consultations' && (
            <div className="space-y-3">
              {/* Filter bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter:</span>
                {(['all', 'new', 'contacted', 'closed'] as const).map((f) => {
                  const count = f === 'all' ? consultations.length : consultations.filter((c) => c.status === f).length;
                  return (
                    <button key={f} onClick={() => setConsultationFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                        consultationFilter === f ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300 bg-white'
                      }`}
                    >{f} ({count})</button>
                  );
                })}
              </div>
              {(consultationFilter === 'all' ? consultations : consultations.filter((c) => c.status === consultationFilter)).length === 0 && (
                <div className="text-center py-12 text-gray-400"><p>No {consultationFilter === 'all' ? '' : consultationFilter} consultations.</p></div>
              )}
              {(consultationFilter === 'all' ? consultations : consultations.filter((c) => c.status === consultationFilter)).map((c) => (
                <div key={c._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{c.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status as keyof typeof STATUS_COLORS]}`}>{c.status}</span>
                        {c.createdAt && (
                          <span className="text-xs text-gray-400">
                            {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}
                            <span className="font-semibold text-amber-600">{new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{c.phone} · {c.email}{c.city ? ` · 📍 ${c.city}` : ''}</p>
                      <p className="text-gray-500 text-xs mt-0.5">Wedding: {c.weddingDate} · {c.guestCount} guests · {c.days} day(s)</p>
                      <p className="text-gray-500 text-xs">Preferred call time: <strong>{c.preferredTime}</strong></p>
                      {c.totalBudget > 0 && <p className="text-amber-600 text-xs font-semibold mt-1">Budget: ₹{c.totalBudget?.toLocaleString('en-IN')}</p>}
                      {c.services?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.services.map((s: string) => (
                            <span key={s} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {['new', 'contacted', 'closed'].map((s) => (
                        <button key={s} onClick={() => handleStatusChange('consultations', c._id, s)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                            c.status === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'
                          }`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
