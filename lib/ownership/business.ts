import { prisma } from '@/lib/prisma';
import { COMMERCIAL_RULES, type CommercialRules } from '@/lib/commercial/rules';
import { PLATFORM_BUSINESS_ID } from './owned';
import { effectiveScope } from './scope';

// The business the current work runs as — for what differs per business (docs/wedding-os/15-record-ownership.md §4.6):
//   • document numbers: Shaadi Shopping keeps QTN- / INV- / WED-; a venue's carry its short code (SWA-QTN-202610-0001) — D6
//   • the confirmation rule its customers book under — the platform's 25% / 7 days unless the venue set its own (approved 4 Oct)
//   • its brand and number on the couple's proposal link — D8
// Business is not an owned table, so these reads need no scope of their own.

export interface BusinessInfo {
  id: string;
  kind: 'PLATFORM' | 'VENDOR';
  name: string;
  numberPrefix: string | null;
  confirmationPercent: number | null;
  holdWindowDays: number | null;
  contactPhone: string | null;
  // Where its own customers pay (D7). Null = not set; nothing is shown.
  upiId: string | null;
  upiName: string | null;
}

const RESERVED = new Set(['QTN', 'INV', 'WED', 'RCPT', 'SS']);

// A 3-letter code from the name ("Swayamvar Hall" → "SWA"), made unique with a digit when taken ("SWA2"). Pure.
export function prefixFromName(name: string, taken: (code: string) => boolean): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  const base = (letters + 'VEN').slice(0, 3);
  for (let n = 1; n < 1000; n++) {
    const code = n === 1 ? base : `${base}${n}`;
    if (!RESERVED.has(code) && !taken(code)) return code;
  }
  throw new Error('No free number prefix');
}

export function rulesOf(b: Pick<BusinessInfo, 'confirmationPercent' | 'holdWindowDays'>): CommercialRules {
  return {
    confirmationPercent: b.confirmationPercent ?? COMMERCIAL_RULES.confirmationPercent,
    holdWindowDays: b.holdWindowDays ?? COMMERCIAL_RULES.holdWindowDays,
    rounding: COMMERCIAL_RULES.rounding,
  };
}

// "QTN" for the platform; "SWA-QTN" for a venue — then lib/numbering.ts adds the month / year and the sequence. Pure.
export function documentPrefix(b: Pick<BusinessInfo, 'kind' | 'numberPrefix'>, kind: 'QTN' | 'INV' | 'WED'): string {
  if (b.kind === 'PLATFORM') return kind;
  if (!b.numberPrefix) throw new Error('This business has no number prefix yet');
  return `${b.numberPrefix}-${kind}`;
}

const select = { id: true, kind: true, name: true, numberPrefix: true, confirmationPercent: true, holdWindowDays: true, contactPhone: true, upiId: true, upiName: true } as const;

// Shaadi Shopping's numbering (QTN- / INV- / WED-) and rule (lib/commercial/rules.ts) live in code, so the platform needs no
// database read — none on every number it makes.
export const PLATFORM_INFO: BusinessInfo = { id: PLATFORM_BUSINESS_ID, kind: 'PLATFORM', name: 'Shaadi Shopping', numberPrefix: null, confirmationPercent: null, holdWindowDays: null, contactPhone: null, upiId: null, upiName: null };

export async function businessById(id: string): Promise<BusinessInfo> {
  if (id === PLATFORM_BUSINESS_ID) return PLATFORM_INFO;
  const b = await prisma.business.findUnique({ where: { id }, select });
  if (!b) throw new Error(`Business ${id} not found`);
  return b.kind === 'VENDOR' && !b.numberPrefix ? ensurePrefix(b) : b;
}

// The business of the current scope (a SYSTEM scope has none — that work must name one itself).
export async function currentBusiness(): Promise<BusinessInfo> {
  const scope = effectiveScope();
  return businessById(scope.kind === 'BUSINESS' ? scope.businessId : PLATFORM_BUSINESS_ID);
}

async function ensurePrefix(b: BusinessInfo): Promise<BusinessInfo> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = new Set((await prisma.business.findMany({ where: { numberPrefix: { not: null } }, select: { numberPrefix: true } })).map((x) => x.numberPrefix as string));
    const code = prefixFromName(b.name, (c) => existing.has(c));
    try {
      const updated = await prisma.business.updateMany({ where: { id: b.id, numberPrefix: null }, data: { numberPrefix: code } });
      const fresh = await prisma.business.findUniqueOrThrow({ where: { id: b.id }, select });
      if (updated.count === 1 || fresh.numberPrefix) return fresh;
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err; // two businesses took the same code at once — try the next one
    }
  }
  throw new Error('Could not give this business a number prefix');
}

// Who the couple sees on their proposal link (D8): Shaadi Shopping for its quotations; the venue — its name and its own number —
// for a venue's, with "Powered by Vivah OS". phone null = no number to show (the page then shows no call / WhatsApp links).
export interface ProposalBrand {
  name: string;
  phone: string | null; // 10 digits
  isPlatform: boolean;
}

export async function proposalBrandFor(businessId: string): Promise<ProposalBrand> {
  if (businessId === PLATFORM_BUSINESS_ID) return { name: 'Shaadi Shopping', phone: null, isPlatform: true }; // the page uses SHAADI_PHONE
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, contactPhone: true, vendor: { select: { ownerPhone: true } } } });
  const raw = (b?.contactPhone || b?.vendor?.ownerPhone || '').replace(/\D/g, '').slice(-10);
  return { name: b?.name ?? 'Vivah OS', phone: /^[6-9]\d{9}$/.test(raw) ? raw : null, isPlatform: false };
}
