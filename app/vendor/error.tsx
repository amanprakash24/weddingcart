'use client';

import ErrorScreen from '@/components/ErrorScreen';
import { SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

// A Vendor OS screen that fails. The menu stays (this sits inside app/vendor/layout.tsx), so the person can go to another screen.
export default function VendorError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={unstable_retry}
      where="vendor-os"
      compact
      contact={{ href: shaadiWhatsAppLink(`Hi, a screen in Vivah OS is not opening for me.${error.digest ? ` Reference: ${error.digest}` : ''}`), label: `WhatsApp Shaadi Shopping on ${SHAADI_PHONE_DISPLAY}` }}
    />
  );
}
