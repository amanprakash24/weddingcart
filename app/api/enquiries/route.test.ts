/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Mirrors app/api/consultations/route.test.ts's exact pattern — mocks
// `@/lib/prisma`'s loginAttempt model (letting the real
// isRequestRateLimited/recordRequest run against it) and
// `@/services/enquiry.service`, so this exercises the route's own
// rate-limit and validation logic without touching a DB.
function makeLoginAttemptStore() {
  const rows: { identifier: string; success: boolean; createdAt: Date }[] = [];
  return {
    count: mock(async (args: { where: { identifier: string; createdAt: { gt: Date } } }) => {
      const { identifier, createdAt } = args.where;
      return rows.filter((r) => r.identifier === identifier && r.createdAt.getTime() > createdAt.gt.getTime()).length;
    }),
    create: mock(async (args: { data: { identifier: string; success: boolean } }) => {
      const row = { ...args.data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
  };
}

function postRequest(body: unknown, ip: string) {
  return new NextRequest('http://localhost/api/enquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function loadRouteWith(loginAttemptStore: ReturnType<typeof makeLoginAttemptStore>) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: loginAttemptStore } }));
  mock.module('@/services/enquiry.service', () => ({
    enquiryService: {
      create: mock(async (data: unknown) => ({ id: 'enquiry-1', status: 'NEW', ...(data as object) })),
    },
  }));
  return import('./route');
}

const VALID_BODY = {
  vendorId: 'some-vendor',
  vendorName: 'Some Vendor',
  vendorCategory: 'Venues',
  name: 'Priya Sharma',
  phone: '9876543210',
  city: 'Patna',
  eventDate: '2027-02-14',
  eventType: 'wedding',
};

describe('POST /api/enquiries — rate limiting (production-integrity fix)', () => {
  test('allows requests under the threshold, then rejects with 429 once exceeded', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest(VALID_BODY, '1.2.3.4'));
      expect(res.status).toBe(201);
    }
    const blocked = await POST(postRequest(VALID_BODY, '1.2.3.4'));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.success).toBe(false);
  });

  test('does not let one IP exhaust the limit for another IP', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      await POST(postRequest(VALID_BODY, '1.2.3.4'));
    }
    expect((await POST(postRequest(VALID_BODY, '1.2.3.4'))).status).toBe(429);
    expect((await POST(postRequest(VALID_BODY, '9.9.9.9'))).status).toBe(201);
  });
});

describe('POST /api/enquiries — validation (production-integrity fix)', () => {
  test('a well-formed body creates the enquiry', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    const res = await POST(postRequest(VALID_BODY, '5.5.5.5'));
    expect(res.status).toBe(201);
  });

  test('the malformed free-text eventDate ("20 October 20202") is rejected with 400, not silently persisted', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, eventDate: '20 October 20202' }, '6.6.6.6'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('a missing required field is rejected with 400', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    const { name, ...withoutName } = VALID_BODY;
    void name;
    const res = await POST(postRequest(withoutName, '7.7.7.7'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/enquiries — Consultation -> Enquiry bridge', () => {
  test('a consultationId in the body reaches enquiryService.create() and comes back on the created enquiry', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, consultationId: 'consultation-1' }, '8.8.8.8'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.consultationId).toBe('consultation-1');
  });

  test('omitting consultationId still creates the enquiry normally — unaffected existing /vendors/[id] path', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    const res = await POST(postRequest(VALID_BODY, '8.8.8.9'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.consultationId).toBeUndefined();
  });
});
