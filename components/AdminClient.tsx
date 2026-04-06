'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Briefcase, MessageSquare, Phone, Plus, Trash2, Edit, RefreshCw, CheckCircle, XCircle, Star, ChevronRight, Database, ArrowLeft } from 'lucide-react';

type Tab = 'dashboard' | 'vendors' | 'categories' | 'enquiries' | 'consultations';

interface Stats { vendors: number; categories: number; enquiries: number; consultations: number; newEnquiries: number; newConsultations: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  closed: 'bg-gray-100 text-gray-500',
};

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [vendors, setVendors] = useState<AnyRecord[]>([]);
  const [categories, setCategories] = useState<AnyRecord[]>([]);
  const [enquiries, setEnquiries] = useState<AnyRecord[]>([]);
  const [consultations, setConsultations] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [editingVendor, setEditingVendor] = useState<AnyRecord | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', category: 'venue', city: 'Delhi', priceMin: '', priceMax: '', rating: '4.5', reviewCount: '', image: '', description: '', features: '', isFeatured: false });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, vRes, cRes, eRes, conRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/vendors?limit=100'),
        fetch('/api/categories'),
        fetch('/api/enquiries'),
        fetch('/api/consultations'),
      ]);
      const [s, v, c, e, con] = await Promise.all([sRes.json(), vRes.json(), cRes.json(), eRes.json(), conRes.json()]);
      if (s.success) setStats(s.data);
      if (v.success) setVendors(v.data);
      if (c.success) setCategories(c.data);
      if (e.success) setEnquiries(e.data);
      if (con.success) setConsultations(con.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      setSeedMsg(data.message || 'Seeded!');
      fetchAll();
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor?')) return;
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const handleStatusChange = async (type: 'enquiries' | 'consultations', id: string, status: string) => {
    await fetch(`/api/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchAll();
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...vendorForm,
      id: editingVendor ? editingVendor.id : `${vendorForm.category}-${Date.now()}`,
      priceMin: Number(vendorForm.priceMin),
      priceMax: Number(vendorForm.priceMax),
      rating: Number(vendorForm.rating),
      reviewCount: Number(vendorForm.reviewCount),
      features: vendorForm.features.split(',').map((f) => f.trim()).filter(Boolean),
      packages: [],
    };
    if (editingVendor) {
      await fetch(`/api/vendors/${editingVendor.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowAddVendor(false);
    setEditingVendor(null);
    setVendorForm({ name: '', category: 'venue', city: 'Delhi', priceMin: '', priceMax: '', rating: '4.5', reviewCount: '', image: '', description: '', features: '', isFeatured: false });
    fetchAll();
  };

  const TABS = [
    { id: 'dashboard' as Tab, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'vendors' as Tab, icon: Briefcase, label: 'Vendors', badge: stats?.vendors },
    { id: 'categories' as Tab, icon: Users, label: 'Categories', badge: stats?.categories },
    { id: 'enquiries' as Tab, icon: MessageSquare, label: 'Enquiries', badge: stats?.newEnquiries, badgeColor: 'bg-rose-500' },
    { id: 'consultations' as Tab, icon: Phone, label: 'Consultations', badge: stats?.newConsultations, badgeColor: 'bg-rose-500' },
  ];

  return (
    <div className="pt-16 min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-16 sm:w-56 bg-gray-950 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="hidden sm:flex items-center gap-2 text-white font-bold text-sm">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
            WeddingCart
          </Link>
          <div className="sm:hidden flex justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        <p className="hidden sm:block px-4 py-3 text-gray-500 text-[10px] uppercase tracking-widest font-semibold">Admin Panel</p>
        <nav className="flex-1 py-2">
          {TABS.map(({ id, icon: Icon, label, badge, badgeColor = 'bg-amber-500' }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
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

        {/* Seed button */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full flex items-center gap-2 justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium px-3 py-2.5 rounded-xl transition-all"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:block">{seeding ? 'Seeding...' : 'Seed DB'}</span>
          </button>
          {seedMsg && <p className="text-emerald-400 text-[10px] mt-1 text-center hidden sm:block">{seedMsg}</p>}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] capitalize">{tab}</h1>
              <p className="text-gray-500 text-sm mt-0.5">WeddingCart Admin Panel</p>
            </div>
            <button onClick={fetchAll} disabled={loading} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-white transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total Vendors', value: stats?.vendors || 0, icon: Briefcase, color: 'bg-blue-500' },
                  { label: 'Categories', value: stats?.categories || 0, icon: Users, color: 'bg-purple-500' },
                  { label: 'Enquiries', value: stats?.enquiries || 0, icon: MessageSquare, color: 'bg-amber-500', sub: `${stats?.newEnquiries || 0} new` },
                  { label: 'Consultations', value: stats?.consultations || 0, icon: Phone, color: 'bg-rose-500', sub: `${stats?.newConsultations || 0} new` },
                  { label: 'New Enquiries', value: stats?.newEnquiries || 0, icon: Star, color: 'bg-emerald-500' },
                  { label: 'Pending Calls', value: stats?.newConsultations || 0, icon: CheckCircle, color: 'bg-indigo-500' },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                  <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-gray-600 text-sm font-medium">{label}</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {sub && <p className="text-xs text-amber-600 font-medium mt-1">{sub}</p>}
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => { setTab('vendors'); setShowAddVendor(true); }} className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all">
                    <Plus className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Add New Vendor</p>
                      <p className="text-xs opacity-70">Add a new wedding vendor</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                  <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all">
                    <Database className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Seed Database</p>
                      <p className="text-xs opacity-70">Load sample data</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VENDORS */}
          {tab === 'vendors' && (
            <div>
              <div className="flex justify-between items-center mb-5">
                <p className="text-gray-500 text-sm">{vendors.length} vendors total</p>
                <button onClick={() => setShowAddVendor(true)} className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                  <Plus className="w-4 h-4" /> Add Vendor
                </button>
              </div>

              {showAddVendor && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 animate-fade-in">
                  <h3 className="font-bold text-gray-900 mb-4">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
                  <form onSubmit={handleVendorSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
                      <input required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Vendor Name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                      <select value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                        {['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                      <select value={vendorForm.city} onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                        {['Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa', 'Pune'].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Min Price (₹)</label>
                      <input type="number" value={vendorForm.priceMin} onChange={(e) => setVendorForm({ ...vendorForm, priceMin: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="50000" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Max Price (₹)</label>
                      <input type="number" value={vendorForm.priceMax} onChange={(e) => setVendorForm({ ...vendorForm, priceMax: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="200000" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Rating</label>
                      <input type="number" step="0.1" min="1" max="5" value={vendorForm.rating} onChange={(e) => setVendorForm({ ...vendorForm, rating: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Review Count</label>
                      <input type="number" value={vendorForm.reviewCount} onChange={(e) => setVendorForm({ ...vendorForm, reviewCount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="100" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Image URL</label>
                      <input value={vendorForm.image} onChange={(e) => setVendorForm({ ...vendorForm, image: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="https://..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                      <textarea rows={3} value={vendorForm.description} onChange={(e) => setVendorForm({ ...vendorForm, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Vendor description..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Features (comma-separated)</label>
                      <input value={vendorForm.features} onChange={(e) => setVendorForm({ ...vendorForm, features: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" placeholder="AC Hall, Parking, Catering" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="featured" checked={vendorForm.isFeatured} onChange={(e) => setVendorForm({ ...vendorForm, isFeatured: e.target.checked })} className="w-4 h-4" />
                      <label htmlFor="featured" className="text-sm text-gray-700">Mark as Featured</label>
                    </div>
                    <div className="sm:col-span-2 flex gap-3">
                      <button type="submit" className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90">
                        {editingVendor ? 'Update' : 'Add'} Vendor
                      </button>
                      <button type="button" onClick={() => { setShowAddVendor(false); setEditingVendor(null); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200">
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
                        {['Name', 'Category', 'City', 'Price Range', 'Rating', 'Featured', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {vendors.map((v) => (
                        <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.name}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">{v.category}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.city}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">₹{(v.priceMin || 0).toLocaleString('en-IN')} – ₹{(v.priceMax || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {v.rating}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {v.isFeatured
                              ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                              : <XCircle className="w-5 h-5 text-gray-300" />
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setEditingVendor(v); setVendorForm({ name: v.name, category: v.category, city: v.city, priceMin: v.priceMin, priceMax: v.priceMax, rating: v.rating, reviewCount: v.reviewCount, image: v.image, description: v.description, features: (v.features || []).join(', '), isFeatured: v.isFeatured }); setShowAddVendor(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {vendors.length === 0 && (
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'ID', 'Description', 'Vendor Count'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {categories.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{c.name}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.id}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs line-clamp-1">{c.description}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600">{c.vendorCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categories.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">No categories. Seed the database first.</p>
                </div>
              )}
            </div>
          )}

          {/* ENQUIRIES */}
          {tab === 'enquiries' && (
            <div className="space-y-3">
              {enquiries.length === 0 && <div className="text-center py-12 text-gray-400"><p>No enquiries yet.</p></div>}
              {enquiries.map((e) => (
                <div key={e._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{e.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status as keyof typeof STATUS_COLORS]}`}>
                          {e.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">{e.vendorName} ({e.vendorCategory}) · {e.phone} · {e.eventDate}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{e.guestCount} guests · {e.eventType}</p>
                      {e.message && <p className="text-gray-600 text-xs mt-1.5 bg-gray-50 rounded-lg px-3 py-2">{e.message}</p>}
                    </div>
                    <div className="flex gap-2">
                      {['new', 'contacted', 'closed'].map((s) => (
                        <button key={s} onClick={() => handleStatusChange('enquiries', e._id, s)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${
                            e.status === s ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'
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
              {consultations.length === 0 && <div className="text-center py-12 text-gray-400"><p>No consultations yet.</p></div>}
              {consultations.map((c) => (
                <div key={c._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{c.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status as keyof typeof STATUS_COLORS]}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">{c.phone} · {c.email}</p>
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
