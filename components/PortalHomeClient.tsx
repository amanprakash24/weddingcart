'use client';

import { useSession, signOut } from 'next-auth/react';
import { LogOut, Sparkles } from 'lucide-react';

// Milestone 4 stub landing page — proves the auth flow (login, session,
// role-gated middleware, logout) works end-to-end for this portal. Not the
// real dashboard: the Vendor OS / Customer Portal features (docs/wedding-os/
// 04-vendor-os.md, 05-customer-portal.md) are separate, later milestones.
export default function PortalHomeClient({ portalName }: { portalName: string }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#FFFAF5] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-5 py-2.5 rounded-full text-sm font-bold mb-6 shadow-lg">
          <Sparkles className="w-4 h-4" />
          ShaadiShopping
        </div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-2">
          {portalName} Portal
        </h1>
        <p className="text-gray-500 text-sm mb-1">
          Signed in{session?.user?.name ? ` as ${session.user.name}` : ''}
        </p>
        <p className="text-gray-400 text-xs mb-6">Roles: {session?.user?.roles?.join(', ') ?? '—'}</p>
        <button
          onClick={() => signOut({ callbackUrl: `/${portalName.toLowerCase()}/login` })}
          className="w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-700 text-sm border border-rose-200 px-4 py-3 rounded-xl hover:bg-rose-50 transition-all font-semibold"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );
}
