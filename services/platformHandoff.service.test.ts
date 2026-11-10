/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { effectiveScope, runInScope, PLATFORM_SCOPE } from '@/lib/ownership/scope';

// Shaadi Shopping → a venue's Vivah OS (services/platformHandoff.service.ts). A fake database; nothing real is touched.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createPlatformHandoffService, eventKindOf, guestsOf } = await import('./platformHandoff.service');

const TODAY = '2026-11-11';
type Note = { summary: string; enquiryId?: string; consultationId?: string; leadId?: string; by?: string };

function setup(opts: { onVivahOs?: boolean; repeat?: boolean; intakeFails?: boolean } = {}) {
  const notes: Note[] = [];
  const intakeCalls: { e: Record<string, unknown>; how: Record<string, unknown>; scope: unknown }[] = [];
  const db = {
    enquiry: { findFirst: mock(async () => ({ name: 'Neha Sharma', phone: '+91 98765 43210', eventType: 'Wedding', eventDate: '2027-02-22', guestCount: '300-400', message: 'Need the lawn', vendorId: 'v-cozy' })) },
    consultation: { findFirst: mock(async () => ({ name: 'Rohit', phone: '9123456789', eventType: 'birthday', weddingDate: '2026-01-01', days: 9, guestCount: 120, totalBudget: 200000, message: 'Evening party', services: ['Venue', 'Catering'] })) },
    lead: { findFirst: mock(async () => ({ phone: '9988776655' })) },
    business: {
      findFirst: mock(async () => (opts.onVivahOs === false ? null : { id: 'b-cozy', name: 'Touch of Cozy' })),
      findMany: mock(async () => [{ vendorId: 'v-cozy', name: 'Touch of Cozy', vendor: { city: 'Patna', category: { name: 'Venues' } } }]),
    },
    vendor: { findUnique: mock(async () => ({ name: 'Touch of Cozy' })) },
    user: { findUnique: mock(async () => ({ name: 'Anisha' })) },
    activityLog: {
      create: mock(async (a: { data: { summary: string; enquiry?: { connect: { id: string } }; consultation?: { connect: { id: string } }; lead?: { connect: { id: string } }; performedBy?: { connect: { id: string } } } }) => {
        notes.push({ summary: a.data.summary, enquiryId: a.data.enquiry?.connect.id, consultationId: a.data.consultation?.connect.id, leadId: a.data.lead?.connect.id, by: a.data.performedBy?.connect.id });
        return {};
      }),
    },
  };
  const intake = mock(async (e: unknown, how: unknown) => {
    if (opts.intakeFails) throw new Error('venue database down');
    intakeCalls.push({ e: e as Record<string, unknown>, how: how as Record<string, unknown>, scope: effectiveScope() });
    return { id: 'venue-enq-1', repeat: !!opts.repeat };
  });
  const service = createPlatformHandoffService({ db: db as never, intake: intake as never, today: () => TODAY });
  const asPlatform = <T>(fn: () => Promise<T>) => runInScope(PLATFORM_SCOPE, fn);
  return { service, db, notes, intakeCalls, intake, asPlatform };
}

describe('reading Shaadi Shopping’s record in the venue’s words', () => {
  test('event names and guest counts as people type them', () => {
    expect(eventKindOf('Wedding')).toBe('wedding');
    expect(eventKindOf('Reception')).toBe('wedding');
    expect(eventKindOf('Birthday')).toBe('birthday');
    expect(eventKindOf('Corporate event')).toBe('corporate');
    expect(eventKindOf('Puja')).toBe('other');
    expect(eventKindOf(null)).toBe('wedding');
    expect(guestsOf('300-400')).toBe(300);
    expect(guestsOf('about 250')).toBe(250);
    expect(guestsOf(120)).toBe(120);
    expect(guestsOf('lots')).toBe(0);
  });
});

describe('a couple’s listing enquiry goes to the venue by itself', () => {
  test('into the venue’s own Enquiries — as THAT venue, marked Shaadi Shopping, linked to the record for commission — and noted here', async () => {
    const { service, intakeCalls, notes, asPlatform } = setup();
    await asPlatform(() => service.sendListingEnquiry('e-1'));
    expect(intakeCalls).toHaveLength(1);
    expect(intakeCalls[0].scope).toEqual({ kind: 'BUSINESS', businessId: 'b-cozy', role: 'STAFF' });
    expect(intakeCalls[0].e).toMatchObject({ name: 'Neha Sharma', phone: '9876543210', eventType: 'wedding', weddingDate: '2027-02-22', guestCount: 300, need: 'Need the lawn', channel: 'SHAADI_SHOPPING' });
    expect(intakeCalls[0].how).toEqual({ sourceDetail: null, actorId: null, platformRef: 'ENQUIRY:e-1' });
    expect(notes).toEqual([{ summary: 'Sent automatically to Touch of Cozy’s Vivah OS; commission applies when they book', enquiryId: 'e-1', consultationId: undefined, leadId: undefined, by: undefined }]);
  });

  test('a venue not on Vivah OS gets nothing — the team is told on the record to call them', async () => {
    const { service, intake, notes, asPlatform } = setup({ onVivahOs: false });
    await asPlatform(() => service.sendListingEnquiry('e-1'));
    expect(intake).not.toHaveBeenCalled();
    expect(notes.map((n) => n.summary)).toEqual(['Touch of Cozy is not on Vivah OS yet — not sent there; call them']);
  });

  test('if sending fails, the couple’s enquiry is untouched: nothing is thrown, and the team is told', async () => {
    const { service, notes, asPlatform } = setup({ intakeFails: true });
    await asPlatform(() => service.sendListingEnquiry('e-1'));
    expect(notes.map((n) => n.summary)).toEqual([expect.stringContaining('Could not send this enquiry to the venue')]);
  });
});

describe('the team sends any enquiry to a venue', () => {
  test('a /plan consultation: its details travel (a past date and an impossible day count are left out), and who sent it is noted', async () => {
    const { service, intakeCalls, notes, asPlatform } = setup();
    expect(await asPlatform(() => service.send({ sourceType: 'CONSULTATION', sourceId: 'c-1', vendorId: 'v-cozy', actorId: 'u-anisha' }))).toEqual({ status: 'SENT', venueName: 'Touch of Cozy' });
    expect(intakeCalls[0].e).toMatchObject({ name: 'Rohit', eventType: 'birthday', weddingDate: '', days: 7, guestCount: 120, budget: 200000, need: 'Looking for: Venue, Catering\nEvening party', channel: 'SHAADI_SHOPPING' });
    expect(intakeCalls[0].how).toMatchObject({ platformRef: 'CONSULTATION:c-1' });
    expect(notes).toEqual([expect.objectContaining({ summary: 'Sent to Touch of Cozy’s Vivah OS by Anisha; commission applies when they book', consultationId: 'c-1', by: 'u-anisha' })]);
  });

  test('a callback lead (only a mobile): sent with a plain name, ready for the venue to call', async () => {
    const { service, intakeCalls, asPlatform } = setup();
    await asPlatform(() => service.send({ sourceType: 'LEAD', sourceId: 'l-1', vendorId: 'v-cozy', actorId: 'u-anisha' }));
    expect(intakeCalls[0].e).toMatchObject({ name: 'Shaadi Shopping customer', phone: '9988776655', eventType: 'wedding' });
  });

  test('the venue already had this couple open: it is added there, and the note says so', async () => {
    const { service, notes, asPlatform } = setup({ repeat: true });
    expect(await asPlatform(() => service.send({ sourceType: 'ENQUIRY', sourceId: 'e-1', vendorId: 'v-cozy', actorId: 'u-anisha' }))).toEqual({ status: 'ADDED_TO_OPEN', venueName: 'Touch of Cozy' });
    expect(notes[0].summary).toContain('added to the enquiry they already had there');
  });

  test('to a venue not on Vivah OS: nothing is sent and the team is told on screen (no note on the record)', async () => {
    const { service, intake, notes, asPlatform } = setup({ onVivahOs: false });
    expect(await asPlatform(() => service.send({ sourceType: 'ENQUIRY', sourceId: 'e-1', vendorId: 'v-cozy', actorId: 'u-anisha' }))).toEqual({ status: 'NOT_ON_VIVAH_OS', venueName: 'Touch of Cozy' });
    expect(intake).not.toHaveBeenCalled();
    expect(notes).toEqual([]);
  });

  test('only venues on Vivah OS are offered', async () => {
    const { service, db, asPlatform } = setup();
    expect(await asPlatform(() => service.venues())).toEqual([{ vendorId: 'v-cozy', name: 'Touch of Cozy', city: 'Patna', category: 'Venues' }]);
    expect((db.business.findMany.mock.calls[0] as unknown as [{ where: unknown }])[0].where).toMatchObject({ kind: 'VENDOR', members: { some: { removedAt: null } } });
  });
});
