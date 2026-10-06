/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// Every dependency is a fake passed to createPaymentSubmissionService — nothing is uploaded, no payment is recorded, no database is
// touched. Only '@/lib/prisma' is stubbed because importing the service loads the real modules.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createPaymentSubmissionService } = await import('./paymentSubmission.service');

type Sub = { id: string; quotationId: string; amount: number; method: string; utr: string; paidOn: Date | null; note: string | null; proofPublicId: string | null; proofFormat: string | null; status: 'PENDING' | 'VERIFIED' | 'REJECTED'; rejectReason: string | null; reviewedAt: Date | null; reviewedById: string | null; receiptId: string | null; createdAt: Date };
const NOW = new Date('2026-10-03T06:00:00Z');
const quotation = { id: 'q1', quotationNumber: 'QTN-202610-0001', leadId: null, enquiryId: null, consultationId: 'c1' };

let subs: Sub[];
let payments: { reference: string; quotationId: string }[];
let env: { SHAADI_UPI_ID?: string; SHAADI_UPI_NAME?: string };
let failCreate = false;

const matches = (s: Sub, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && 'in' in v ? (v.in as unknown[]).includes(s[k as keyof Sub]) : s[k as keyof Sub] === v));
const paymentSubmission = {
  findMany: mock(async ({ where }: { where: Record<string, unknown> }) => subs.filter((s) => matches(s, where))),
  findUnique: mock(async ({ where }: { where: { id: string } }) => subs.find((s) => s.id === where.id) ?? null),
  count: mock(async ({ where }: { where: Record<string, unknown> }) => subs.filter((s) => matches(s, where)).length),
  updateMany: mock(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Sub> }) => {
    const hit = subs.filter((s) => matches(s, where));
    hit.forEach((s) => Object.assign(s, data));
    return { count: hit.length };
  }),
  create: mock(async ({ data }: { data: Partial<Sub> }) => {
    if (failCreate) throw new Error('db down');
    const row = { id: `s${subs.length + 1}`, method: 'UPI', note: null, proofPublicId: null, proofFormat: null, status: 'PENDING', rejectReason: null, reviewedAt: null, reviewedById: null, receiptId: null, createdAt: NOW, paidOn: null, ...data } as Sub;
    subs.push(row);
    return row;
  }),
};
const payment = { findFirst: mock(async ({ where }: { where: { reference: { equals: string }; invoice: { quotationId: string } } }) => payments.find((p) => p.reference.toUpperCase() === where.reference.equals.toUpperCase() && p.quotationId === where.invoice.quotationId) ?? null) };
const tx = { paymentSubmission, payment, $queryRaw: mock(async () => []) };
const db = { paymentSubmission, payment, quotation: { findUnique: mock(async () => quotation) }, $transaction: mock(async (fn: (t: typeof tx) => unknown) => fn(tx)) };

const money = (outstanding = 200000) => ({ outstanding, weddingId: null, agreementTotal: 200000, received: 200000 - outstanding, payments: [] });
const loadMoney = mock(async () => money());
const recordPayment = mock(async (quotationId: string, input: { idempotencyKey: string }) => (void quotationId, { receiptId: `r-${input.idempotencyKey}`, duplicate: false, splits: [], confirmation: { attempted: false, confirmed: false, weddingId: null, error: null }, money: {} }));
const logActivity = mock(async () => ({}));
const upload = mock(async () => ({ publicId: 'payment-proofs/abc', format: 'jpg' }));
const removeProof = mock(async () => {});

const service = createPaymentSubmissionService({
  db: db as never,
  loadMoney: loadMoney as never,
  recordPayment: recordPayment as never,
  logActivity: logActivity as never,
  upload,
  removeProof,
  proofUrl: (p) => `https://signed.example/${p.publicId}.${p.format}?expires=1`,
  userNames: async () => new Map([['u1', 'Gaurav']]),
  env: () => env,
  now: () => NOW,
});

const proof = { bytes: Buffer.from('img'), type: 'image/jpeg', size: 3 };
const claim = { amount: 50000, utr: '4123 4567 8901', paidOn: '2026-10-02' };

beforeEach(() => {
  subs = [];
  payments = [];
  env = { SHAADI_UPI_ID: 'shaadishopping@okicici', SHAADI_UPI_NAME: 'Shaadi Shopping' };
  failCreate = false;
  loadMoney.mockImplementation(async () => money());
  for (const m of [paymentSubmission.create, paymentSubmission.updateMany, recordPayment, logActivity, upload, removeProof]) m.mockClear();
});

describe('submit — "I have paid"', () => {
  test('records a claim and a timeline entry — never a payment', async () => {
    await expect(service.submit(quotation, claim, proof)).resolves.toEqual({ submitted: true });
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ quotationId: 'q1', amount: 50000, utr: '412345678901', status: 'PENDING', proofPublicId: 'payment-proofs/abc', proofFormat: 'jpg' });
    expect(recordPayment).not.toHaveBeenCalled();
    expect((logActivity.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]).toMatchObject({ type: 'PAYMENT_SUBMITTED', consultation: { connect: { id: 'c1' } } });
  });

  test('no UPI configured → refused, nothing stored', async () => {
    env = {};
    await expect(service.submit(quotation, claim, proof)).rejects.toBeInstanceOf(ConflictError);
    expect(upload).not.toHaveBeenCalled();
    expect(subs).toHaveLength(0);
  });

  test('a bad claim is refused before any upload', async () => {
    await expect(service.submit(quotation, { ...claim, utr: '' }, proof)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.submit(quotation, { ...claim, amount: 250000 }, proof)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.submit(quotation, claim, { ...proof, type: 'text/html' })).rejects.toBeInstanceOf(ValidationError);
    expect(upload).not.toHaveBeenCalled();
  });

  test('the same UTR is never claimed twice — whether claimed or already recorded by staff', async () => {
    await service.submit(quotation, claim, null);
    await expect(service.submit(quotation, claim, proof)).rejects.toThrow('already been sent');
    subs = [];
    payments = [{ reference: '412345678901', quotationId: 'q1' }];
    await expect(service.submit(quotation, claim, proof)).rejects.toThrow('already been sent');
    expect(upload).not.toHaveBeenCalled();
  });

  test('a refused UTR can be sent again', async () => {
    await service.submit(quotation, claim, null);
    subs[0].status = 'REJECTED';
    await expect(service.submit(quotation, claim, null)).resolves.toEqual({ submitted: true });
  });

  test('at most 3 open claims', async () => {
    for (const utr of ['111111', '222222', '333333']) await service.submit(quotation, { ...claim, amount: 1000, utr }, null);
    await expect(service.submit(quotation, { ...claim, amount: 1000, utr: '444444' }, null)).rejects.toThrow('still checking');
  });

  test('if saving fails after the upload, the file is removed', async () => {
    failCreate = true;
    await expect(service.submit(quotation, claim, proof)).rejects.toThrow('db down');
    expect(removeProof).toHaveBeenCalledWith('payment-proofs/abc');
  });
});

describe('verify', () => {
  beforeEach(async () => {
    await service.submit(quotation, claim, proof);
  });

  test('records the payment through Money v1: UPI, the UTR as reference, the date the couple paid, a fixed idempotency key', async () => {
    const out = await service.verify('q1', 's1', {}, 'u1');
    expect(recordPayment).toHaveBeenCalledWith('q1', { amount: 50000, method: 'UPI', reference: '412345678901', paidAt: new Date('2026-10-02T12:00:00+05:30'), idempotencyKey: 'sub-s1' }, 'u1');
    expect(subs[0]).toMatchObject({ status: 'VERIFIED', receiptId: 'r-sub-s1', reviewedById: 'u1' });
    expect(out.alreadyVerified).toBe(false);
  });

  test('staff may correct the amount and date to what actually arrived', async () => {
    const at = new Date('2026-10-02T09:00:00Z');
    await service.verify('q1', 's1', { amount: 49000, paidAt: at }, 'u1');
    expect((recordPayment.mock.calls.at(-1) as unknown as [string, { amount: number; paidAt: Date }])[1]).toMatchObject({ amount: 49000, paidAt: at });
  });

  test('pressing verify again is safe — same key, no second row', async () => {
    await service.verify('q1', 's1', {}, 'u1');
    const again = await service.verify('q1', 's1', {}, 'u2');
    expect(again.alreadyVerified).toBe(true);
    expect((recordPayment.mock.calls.at(-1) as unknown as [string, { idempotencyKey: string }])[1].idempotencyKey).toBe('sub-s1');
    expect(subs[0].reviewedById).toBe('u1');
  });

  test('a refused claim cannot be verified; another quotation’s claim is not found', async () => {
    await expect(service.verify('q2', 's1', {}, 'u1')).rejects.toBeInstanceOf(NotFoundError);
    subs[0].status = 'REJECTED';
    await expect(service.verify('q1', 's1', {}, 'u1')).rejects.toBeInstanceOf(ConflictError);
    expect(recordPayment).not.toHaveBeenCalled();
  });

  test('if recording fails (e.g. staff already typed in that UTR), the claim stays open', async () => {
    recordPayment.mockImplementationOnce(async () => { throw new ValidationError('The reference was already recorded'); });
    await expect(service.verify('q1', 's1', {}, 'u1')).rejects.toBeInstanceOf(ValidationError);
    expect(subs[0].status).toBe('PENDING');
  });
});

describe('reject', () => {
  beforeEach(async () => {
    await service.submit(quotation, claim, null);
  });

  test('needs a reason; marks it not matched and logs it', async () => {
    await expect(service.reject('q1', 's1', ' ', 'u1')).rejects.toBeInstanceOf(ValidationError);
    await service.reject('q1', 's1', 'Not in the bank statement', 'u1');
    expect(subs[0]).toMatchObject({ status: 'REJECTED', rejectReason: 'Not in the bank statement', reviewedById: 'u1' });
    expect((logActivity.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]).toMatchObject({ type: 'PAYMENT_SUBMISSION_REJECTED', detail: 'Not in the bank statement' });
  });

  test('a verified claim cannot be rejected', async () => {
    await service.verify('q1', 's1', {}, 'u1');
    await expect(service.reject('q1', 's1', 'oops', 'u1')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('listForQuotation', () => {
  test('signed proof links and reviewer names for staff', async () => {
    await service.submit(quotation, claim, proof);
    await service.verify('q1', 's1', {}, 'u1');
    const [s] = await service.listForQuotation('q1');
    expect(s).toMatchObject({ utr: '412345678901', status: 'VERIFIED', reviewedByName: 'Gaurav', proofUrl: 'https://signed.example/payment-proofs/abc.jpg?expires=1', proofIsPdf: false });
  });
});
