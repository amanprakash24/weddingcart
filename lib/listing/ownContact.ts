// The listing's own website, social pages, phone or email. Couples contact Shaadi Shopping, never the vendor or venue
// directly (contact rule), so a feature or package line like this is never shown on a public listing page.
const OWN_CONTACT = /^(website|web|site|instagram|insta|facebook|fb|youtube|whatsapp|phone|mobile|contact|email|e-mail)\b\s*[:\-]|https?:\/\/|www\.|@[a-z0-9_.]{3,}|\b\d{10}\b|[\w.+-]+@[\w-]+\.[\w.]+/i;

export function isOwnContactLine(line: string): boolean {
  return OWN_CONTACT.test(line.trim());
}
