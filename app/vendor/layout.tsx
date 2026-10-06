import type { ReactNode } from 'react';
import VendorShell from '@/components/vendor/VendorShell';

// One shell for every /vendor page, same relationship app/admin/layout.tsx has with AdminShell. Access
// control stays entirely in proxy.ts — this file only adds chrome, never a second auth check.
export default function VendorLayout({ children }: { children: ReactNode }) {
  return <VendorShell>{children}</VendorShell>;
}
