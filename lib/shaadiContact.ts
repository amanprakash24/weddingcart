export const SHAADI_PHONE = '+917646028228';
export const SHAADI_PHONE_DISPLAY = '+91 76460 28228';

export function shaadiWhatsAppLink(message: string): string {
  return `https://wa.me/${SHAADI_PHONE}?text=${encodeURIComponent(message)}`;
}
