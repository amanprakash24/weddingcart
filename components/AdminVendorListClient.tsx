'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, Eye, RefreshCw, Store, Search, Star } from 'lucide-react';

interface Category { id: string; name: string; slug: string; }
interface VendorRow {
  id: string; name: string; slug: string; city: string; category: string;
  status: 'DRAFT' | 'PENDING_VERIFICATION' | 'PUBLISHED';
  priceMin: number; priceMax: number; isFeatured: boolean;
}

const STATUS_LABEL: Record<VendorRow['status'], string> = {
  DRAFT: 'Draft', PENDING_VERIFICATION: 'Pending Verification', PUBLISHED: 'Published',
};
const STATUS_STYLE: Record<VendorRow['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
};

export default function AdminVendorListClient() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Unfiltered — dashboard stats always reflect the whole vendor table, not
  // whatever the search/filter fields currently hold.
  const [allVendors, setAllVendors] = useState<VendorRow[]>([]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/vendors?status=all&limit=1000');
    const data = await res.json();
    if (data.success) setAllVendors(data.data);
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter || 'all', limit: '500' });
      if (search) params.set('search', search);
      if (cityFilter) params.set('city', cityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/vendors?${params}`);
      const data = await res.json();
      if (data.success) setVendors(data.data);
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => { if (d.success) setCategories(d.data); });
    fetchStats();
  }, [fetchStats]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const refresh = () => { fetchVendors(); fetchStats(); };

  const deleteVendor = async (vendor: VendorRow) => {
    if (!confirm(`Delete "${vendor.name}"? This cannot be undone.`)) return;
    setDeleting(vendor.id);
    await fetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
    setDeleting(null);
    refresh();
  };

  const cities = [...new Set(allVendors.map((v) => v.city))].sort();

  const total = allVendors.length;
  const published = allVendors.filter((v) => v.status === 'PUBLISHED').length;
  const draft = allVendors.filter((v) => v.status === 'DRAFT').length;
  const pending = allVendors.filter((v) => v.status === 'PENDING_VERIFICATION').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">Vendors</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage your vendor listings</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm hover:bg-white transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <Link href="/admin/vendors/new"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Add Vendor
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-emerald-500 uppercase tracking-wide">Published</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{published}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Draft</p>
            <p className="text-2xl font-bold text-gray-600 mt-0.5">{draft}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-amber-500 uppercase tracking-wide">Pending Verification</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{pending}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white" />
          </div>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">All Cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading vendors...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="p-16 text-center">
              <Store className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No vendors match these filters</p>
              <Link href="/admin/vendors/new"
                className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-600 transition-colors">
                <Plus className="w-4 h-4" /> Add your first vendor
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">City</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 line-clamp-1 flex items-center gap-1.5">
                        {vendor.name}
                        {vendor.isFeatured && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">/vendors/{vendor.slug}</p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell text-gray-600">{vendor.city}</td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium capitalize">{vendor.category}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-gray-500">
                      ₹{(vendor.priceMin || 0).toLocaleString('en-IN')}–{(vendor.priceMax || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[vendor.status]}`}>
                        {STATUS_LABEL[vendor.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <a href={`/vendors/${vendor.slug}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Preview">
                          <Eye className="w-4 h-4" />
                        </a>
                        <Link href={`/admin/vendors/${vendor.id}`}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => deleteVendor(vendor)} disabled={deleting === vendor.id}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50" title="Delete">
                          {deleting === vendor.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/admin" className="hover:text-amber-600 transition-colors">← Back to Admin Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
