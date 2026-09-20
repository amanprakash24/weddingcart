import { Suspense, type ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';

// One navigation shell for every /admin page. Access control stays in proxy.ts; the shell skips itself on /admin/login.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
