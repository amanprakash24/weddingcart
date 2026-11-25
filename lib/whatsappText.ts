// Text that goes into a pre-filled WhatsApp link (wa.me / api.whatsapp.com).
//
// WhatsApp's wa.me redirect replaces characters outside the Basic Multilingual Plane, which is every emoji, with U+FFFD, so the
// message arrives with "�" (checked 20 Nov 2026: "🙏" became %EF%BF%BD). ₹, —, ×, • and Hindi letters survive. Messages are
// written without emoji; this is the safety net, so nothing outside that range ever reaches the link.
export function whatsappSafeText(text: string): string {
  return text
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '') // emoji and other astral characters
    .replace(/[️‍]/g, '') // emoji presentation selector / joiner left behind
    .replace(/[ \t]+$/gm, '') // a trailing space where an emoji was removed
    .replace(/ {2,}/g, ' ');
}
