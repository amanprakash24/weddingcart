'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, Calendar, BookOpen } from 'lucide-react';

interface Blog {
  _id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  readTime: number;
  createdAt: string;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminBlogClient() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blogs?all=true&limit=100');
      const data = await res.json();
      setBlogs(data.blogs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);

  const toggleStatus = async (blog: Blog) => {
    const newStatus = blog.status === 'published' ? 'draft' : 'published';
    await fetch(`/api/blogs/${blog.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchBlogs();
  };

  const deleteBlog = async (blog: Blog) => {
    if (!confirm(`Delete "${blog.title}"? This cannot be undone.`)) return;
    setDeleting(blog._id);
    await fetch(`/api/blogs/${blog.slug}`, { method: 'DELETE' });
    setDeleting(null);
    fetchBlogs();
  };

  const published = blogs.filter(b => b.status === 'published').length;
  const drafts = blogs.filter(b => b.status === 'draft').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">Blog Posts</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {published} published · {drafts} draft{drafts !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBlogs}
              disabled={loading}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm hover:bg-white transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <Link
              href="/admin/blogs/new"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Post
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading posts...</p>
            </div>
          ) : blogs.length === 0 ? (
            <div className="p-16 text-center">
              <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No blog posts yet</p>
              <p className="text-gray-400 text-sm mb-6">Start writing to improve your SEO rankings.</p>
              <Link
                href="/admin/blogs/new"
                className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-amber-600 transition-colors"
              >
                <Plus className="w-4 h-4" /> Write your first post
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs.map(blog => (
                  <tr key={blog._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 line-clamp-1">{blog.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">/blog/{blog.slug}</p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {blog.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(blog.publishedAt || blog.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleStatus(blog)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          blog.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {blog.status === 'published' ? (
                          <><Eye className="w-3.5 h-3.5" /> Published</>
                        ) : (
                          <><EyeOff className="w-3.5 h-3.5" /> Draft</>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <a
                          href={`/blog/${blog.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <Link
                          href={`/admin/blogs/${blog._id}`}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => deleteBlog(blog)}
                          disabled={deleting === blog._id}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === blog._id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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
