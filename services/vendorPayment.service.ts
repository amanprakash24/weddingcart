import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { commissionRateRepository } from '@/repositories/commissionRate.repository';
import {
  assignmentMoney,
  checkPayment,
  checkVoidReason,
  methodLabel,
  moneyTotals,
  vendorTotals,
  type AssignmentMoney,
  type MoneyTotals,
  type PaymentInput,
  type VendorTotals,
} from '@/lib/vendor/vendorMoney';

// Payments Shaadi Shopping makes to its vendors, and the vendor-wise money both dashboards show (25 Nov 2026). The arithmetic is in
// lib/vendor/vendorMoney.ts; this file only loads the real records into it and writes new payment entries. It never changes an
// agreed price, a payout or an existing payment — a wrong entry is voided (kept, with who and why), never edited or deleted.

const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const assignmentInclude = {
  vendor: { select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } },
  weddingEvent: { select: { id: true, type: true, label: true, date: true, wedding: { select: { id: true, weddingNumber: true, status: true, customer: { select: { name: true } }, couple: { select: { brideName: true, groomName: true } } } } } },
  payouts: { select: { id: true, status: true, grossAmount: true, commissionRate: true, commissionAmount: true, netAmount: true, paidAt: true } },
  vendorPayments: { orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.VendorBookingInclude;

type Loaded = Awaited<ReturnType<typeof loadAssignments>>[number];

async function loadAssignments(where: { weddingEvent?: { weddingId: string }; vendorId?: string }) {
  return prisma.vendorBooking.findMany({ where, include: assignmentInclude, orderBy: [{ weddingEvent: { date: 'asc' } }, { createdAt: 'asc' }] });
}

// The current commission % per vendor category. A category with no rate set up (and no global rate) is null — shown as "not set
// up", never guessed and never ₹0.
async function ratesFor(categoryIds: string[]): Promise<Map<string, number | null>> {
  const entries = await Promise.all(
    [...new Set(categoryIds)].map(async (id): Promise<[string, number | null]> => {
      try {
        return [id, (await commissionRateRepository.findCurrentRate(id)).rate];
      } catch {
        return [id, null];
      }
    })
  );
  return new Map(entries);
}

export interface PaymentEntryView {
  id: string;
  amount: number;
  paidOn: string; // YYYY-MM-DD
  method: string;
  methodLabel: string;
  reference: string | null;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
  legacyPayout?: true; // an older payout marked paid (before payments were recorded one by one)
}

export interface WorkView {
  id: string;
  weddingId: string;
  weddingNumber: string;
  coupleName: string | null;
  functionName: string;
  functionDate: string;
  vendorId: string;
  vendorName: string;
  category: string;
  agreedPrice: number;
  bookingStatus: string;
  venueStatus: string;
  money: AssignmentMoney;
  payments: PaymentEntryView[];
  canRecord: boolean; // owed, and something is left to pay
  legacyPayoutPending: boolean; // an older payout calculated but not yet marked paid
}

export interface VendorGroup {
  vendorId: string;
  vendorName: string;
  category: string;
  totals: MoneyTotals;
  works: WorkView[];
}

function workView(a: Loaded, rates: Map<string, number | null>): WorkView {
  const payout = a.payouts[0] ?? null;
  const money = assignmentMoney({
    id: a.id,
    status: a.status,
    venueStatus: a.venueStatus,
    agreedPrice: a.agreedPrice,
    currentRate: rates.get(a.vendor.categoryId) ?? null,
    payout: payout ? { status: payout.status, commissionRate: payout.commissionRate, commissionAmount: payout.commissionAmount, netAmount: payout.netAmount } : null,
    payments: a.vendorPayments.map((p) => ({ amount: p.amount, voided: p.voidedAt !== null })),
  });
  const payments: PaymentEntryView[] = a.vendorPayments.map((p) => ({
    id: p.id,
    amount: p.amount,
    paidOn: ymd(p.paidOn),
    method: p.method,
    methodLabel: methodLabel(p.method),
    reference: p.reference,
    note: p.note,
    voided: p.voidedAt !== null,
    voidReason: p.voidReason,
  }));
  if (payout?.status === 'PAID') {
    payments.unshift({ id: payout.id, amount: payout.netAmount, paidOn: payout.paidAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(payout.paidAt) : '', method: 'PAYOUT', methodLabel: 'Payout (earlier)', reference: null, note: null, voided: false, voidReason: null, legacyPayout: true });
  }
  const ev = a.weddingEvent;
  return {
    id: a.id,
    weddingId: ev.wedding.id,
    weddingNumber: ev.wedding.weddingNumber,
    coupleName: ev.wedding.customer?.name || [ev.wedding.couple?.brideName, ev.wedding.couple?.groomName].filter(Boolean).join(' & ') || null,
    functionName: ev.label || ev.type.charAt(0) + ev.type.slice(1).toLowerCase().replace(/_/g, ' '),
    functionDate: ev.date.toISOString(),
    vendorId: a.vendor.id,
    vendorName: a.vendor.name,
    category: a.vendor.category?.name ?? '',
    agreedPrice: a.agreedPrice,
    bookingStatus: a.status,
    venueStatus: a.venueStatus,
    money,
    payments,
    canRecord: money.owed && money.remaining !== null && money.remaining > 0,
    legacyPayoutPending: payout?.status === 'PENDING',
  };
}

function groupByVendor(works: WorkView[], loaded: Loaded[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  for (const w of works) {
    const g = groups.get(w.vendorId) ?? { vendorId: w.vendorId, vendorName: w.vendorName, category: w.category, totals: moneyTotals([]), works: [] };
    g.works.push(w);
    groups.set(w.vendorId, g);
  }
  for (const g of groups.values()) {
    g.totals = moneyTotals(g.works.map((w) => w.money), loaded.filter((a) => a.vendorId === g.vendorId).map((a) => ({ id: a.id, status: a.status, agreedPrice: a.agreedPrice })));
  }
  return [...groups.values()].sort((a, b) => b.totals.workValue - a.totals.workValue || a.vendorName.localeCompare(b.vendorName));
}

// What a vendor sees of one work: an explicit allow-list, so a field added to WorkView later never reaches a vendor by accident.
export interface VendorWorkView {
  id: string;
  weddingNumber: string;
  coupleName: string | null;
  functionName: string;
  functionDate: string;
  workStatus: AssignmentMoney['workStatus'];
  owed: boolean;
  payable: number | null;
  paid: number;
  remaining: number | null;
  payments: { id: string; amount: number; paidOn: string; methodLabel: string; reference: string | null }[];
}

function vendorWorkView(w: WorkView): VendorWorkView {
  return {
    id: w.id,
    weddingNumber: w.weddingNumber,
    coupleName: w.coupleName,
    functionName: w.functionName,
    functionDate: w.functionDate,
    workStatus: w.money.workStatus,
    owed: w.money.owed,
    payable: w.money.payable,
    paid: w.money.paid,
    remaining: w.money.owed ? w.money.remaining : w.money.paid > 0 ? -w.money.paid : 0,
    payments: w.payments.filter((p) => !p.voided).map((p) => ({ id: p.id, amount: p.amount, paidOn: p.paidOn, methodLabel: p.methodLabel, reference: p.reference })),
  };
}

// A commission the viewer may not see: removed, with net kept (the same rule as payouts — lib/auth/moneyAccess.ts).
function hideCommission(m: AssignmentMoney): AssignmentMoney {
  return { ...m, commission: null, commissionRate: null };
}

export const vendorPaymentService = {
  // Admin: one wedding, vendor by vendor. Callers check money access first (full access only — vendor money).
  async forWedding(weddingId: string, opts: { seesCommission: boolean }): Promise<{ vendors: VendorGroup[]; totals: MoneyTotals }> {
    const loaded = await loadAssignments({ weddingEvent: { weddingId } });
    const rates = await ratesFor(loaded.map((a) => a.vendor.categoryId));
    let works = loaded.map((a) => workView(a, rates));
    const totals = moneyTotals(works.map((w) => w.money), loaded.map((a) => ({ id: a.id, status: a.status, agreedPrice: a.agreedPrice })));
    if (!opts.seesCommission) works = works.map((w) => ({ ...w, money: hideCommission(w.money) }));
    const vendors = groupByVendor(works, loaded).map((g) => (opts.seesCommission ? g : { ...g, totals: { ...g.totals, commission: null } }));
    return { vendors, totals: opts.seesCommission ? totals : { ...totals, commission: null } };
  },

  // The vendor's own view: every Shaadi Shopping work of theirs, across weddings. Only for people who may see the vendor's money.
  // Built for the vendor's eyes (money design rule 1, 25 Nov 2026): their payable amount, what they received and what is left —
  // never the couple's price, our commission or margin, staff notes or voided entries. Nothing else leaves the server.
  async forVendor(vendorId: string): Promise<{ totals: VendorTotals; works: VendorWorkView[] }> {
    const loaded = await loadAssignments({ vendorId });
    const rates = await ratesFor(loaded.map((a) => a.vendor.categoryId));
    const works = loaded.map((a) => workView(a, rates));
    return { totals: vendorTotals(works.map((w) => w.money)), works: works.map(vendorWorkView) };
  },

  // Founder dashboard, all weddings: what is still owed to vendors for confirmed work, on how many works, what has gone out as
  // payments recorded one by one, and the commission on works now fully paid that way (a payout's own commission is counted
  // from the payout).
  async companyTotals(): Promise<{ outstanding: number; worksLeft: number; unknownWorks: number; ledgerPaid: number; settledLedgerCommission: number }> {
    const loaded = await prisma.vendorBooking.findMany({
      where: { OR: [{ status: { in: ['CONFIRMED', 'COMPLETED'] } }, { vendorPayments: { some: { voidedAt: null } } }] },
      include: { vendor: { select: { categoryId: true } }, payouts: true, vendorPayments: { select: { amount: true, voidedAt: true } } },
    });
    const rates = await ratesFor(loaded.map((a) => a.vendor.categoryId));
    let outstanding = 0, worksLeft = 0, unknownWorks = 0, ledgerPaid = 0, settledLedgerCommission = 0;
    for (const a of loaded) {
      const payout = a.payouts[0] ?? null;
      const m = assignmentMoney({
        id: a.id,
        status: a.status,
        venueStatus: a.venueStatus,
        agreedPrice: a.agreedPrice,
        currentRate: rates.get(a.vendor.categoryId) ?? null,
        payout: payout ? { status: payout.status, commissionRate: payout.commissionRate, commissionAmount: payout.commissionAmount, netAmount: payout.netAmount } : null,
        payments: a.vendorPayments.map((p) => ({ amount: p.amount, voided: p.voidedAt !== null })),
      });
      const ledger = a.vendorPayments.filter((p) => p.voidedAt === null).reduce((s, p) => s + p.amount, 0);
      ledgerPaid += ledger;
      if (!m.owed) continue;
      if (m.remaining === null) unknownWorks += 1;
      else if (m.remaining > 0) {
        outstanding += m.remaining;
        worksLeft += 1;
      } else if (ledger > 0 && !payout && m.commission !== null) settledLedgerCommission += m.commission;
    }
    return { outstanding, worksLeft, unknownWorks, ledgerPaid, settledLedgerCommission };
  },

  // Record one payment to the vendor for one work. The work is locked first, so two people recording at the same moment can never
  // together pay more than is owed.
  async record(weddingId: string, vendorBookingId: string, input: PaymentInput, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM vendor_bookings WHERE id = ${vendorBookingId} FOR UPDATE`;
      const a = await tx.vendorBooking.findFirst({
        where: { id: vendorBookingId, weddingEvent: { weddingId } },
        include: { vendor: { select: { id: true, name: true, categoryId: true } }, payouts: true, vendorPayments: { select: { amount: true, voidedAt: true } } },
      });
      if (!a) throw new NotFoundError('VendorBooking', vendorBookingId);
      if (a.status !== 'CONFIRMED' && a.status !== 'COMPLETED') throw new ConflictError('Payments are recorded only for work the vendor has confirmed');
      const payout = a.payouts[0] ?? null;
      if (payout?.status === 'PENDING') throw new ConflictError('This work has an earlier payout waiting to be marked paid — mark that paid first, or record payments only');
      const rates = await ratesFor([a.vendor.categoryId]);
      const money = assignmentMoney({
        id: a.id,
        status: a.status,
        venueStatus: a.venueStatus,
        agreedPrice: a.agreedPrice,
        currentRate: rates.get(a.vendor.categoryId) ?? null,
        payout: payout ? { status: payout.status, commissionRate: payout.commissionRate, commissionAmount: payout.commissionAmount, netAmount: payout.netAmount } : null,
        payments: a.vendorPayments.map((p) => ({ amount: p.amount, voided: p.voidedAt !== null })),
      });
      const c = checkPayment(input, money.remaining, indiaToday());
      if (!c.ok) throw new ValidationError(c.error);
      const created = await tx.vendorPayment.create({ data: { ...c.value, vendorBooking: { connect: { id: a.id } }, vendor: { connect: { id: a.vendorId } }, recordedById: actorId } });
      await tx.activityLog.create({
        data: {
          type: ActivityType.STATUS_CHANGED,
          summary: `Paid ${a.vendor.name} ${inr(c.value.amount)} by ${methodLabel(c.value.method)}${c.value.reference ? ` (ref ${c.value.reference})` : ''} on ${ymd(c.value.paidOn)} — ${inr((money.remaining ?? 0) - c.value.amount)} left to pay on this work`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: a.id } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
      });
      return created;
    });
  },

  // A wrong entry is voided, never deleted or changed: it stays in the history, struck through, with who and why.
  async voidPayment(weddingId: string, paymentId: string, reason: unknown, actorId: string | null) {
    const r = checkVoidReason(reason);
    if (!r.ok) throw new ValidationError(r.error);
    return prisma.$transaction(async (tx) => {
      const p = await tx.vendorPayment.findFirst({ where: { id: paymentId, vendorBooking: { weddingEvent: { weddingId } } }, include: { vendor: { select: { name: true } } } });
      if (!p) throw new NotFoundError('VendorPayment', paymentId);
      if (p.voidedAt) throw new ConflictError('This payment entry was already voided');
      const updated = await tx.vendorPayment.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidedById: actorId, voidReason: r.value } });
      await tx.activityLog.create({
        data: {
          type: ActivityType.STATUS_CHANGED,
          summary: `Payment entry voided: ${inr(p.amount)} to ${p.vendor.name} on ${ymd(p.paidOn)} — ${r.value}`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: p.vendorBookingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
      });
      return updated;
    });
  },
};
