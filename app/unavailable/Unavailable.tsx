'use client';

import ErrorScreen from '@/components/ErrorScreen';
import { SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

const UNAVAILABLE = new Error('sign-in check could not be made');

export default function Unavailable() {
  return (
    <ErrorScreen
      error={UNAVAILABLE}
      retry={() => window.location.reload()}
      where="gate"
      title="We cannot open this just now"
      contact={{ href: shaadiWhatsAppLink('Hi, Vivah OS is not opening for me.'), label: `WhatsApp Shaadi Shopping on ${SHAADI_PHONE_DISPLAY}` }}
    />
  );
}
