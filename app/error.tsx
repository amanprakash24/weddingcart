'use client';

import ErrorScreen from '@/components/ErrorScreen';
import { SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

// Any screen that fails and has no error screen of its own (Vendor OS and the couple's link have theirs).
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <ErrorScreen
      error={error}
      retry={unstable_retry}
      where="site"
      contact={{ href: shaadiWhatsAppLink(`Hi, a page on Shaadi Shopping is not opening for me.${error.digest ? ` Reference: ${error.digest}` : ''}`), label: `WhatsApp Shaadi Shopping on ${SHAADI_PHONE_DISPLAY}` }}
    />
  );
}
