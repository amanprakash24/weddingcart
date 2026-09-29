// The name of each wedding service a couple can ask for (the keys stored on a Consultation's `services`), as a
// customer reads it. One shared map — used for the team's WhatsApp alert on a new consultation, the quotation
// pre-fill and the couple's proposal page. Client-safe (no server imports).
export const SERVICE_LABELS: Record<string, string> = {
  venue: 'Venue', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
  catering: 'Catering', 'photo-video': 'Photography & Video',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transportation', legal: 'Legal & Documentation',
  hospitality: 'Hospitality', planning: 'Wedding Planning',
  'bridal-lehenga': 'Bridal Lehenga', 'bridal-jewellery': 'Bridal Jewellery',
  sherwani: 'Sherwani / Groom Wear', trousseau: 'Trousseau Packing',
  sfx: 'SFX Effects', security: 'Security Guards & Bouncers',
};

// The label for a service key. Text that is not a known key (a label already, or something staff typed) is returned
// as it is — never replaced with an invented name.
export function serviceLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value.trim();
  if (!text) return null;
  return SERVICE_LABELS[text] ?? text; // keys are lowercase slugs — "Makeup" typed by staff stays "Makeup"
}
