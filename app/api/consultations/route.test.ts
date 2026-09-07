/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

// Mocks `@/lib/prisma` (satisfies the whole import chain the route pulls in —
// lib/adminAuth -> lib/auth/session -> lib/auth/auth -> lib/prisma — no
// DATABASE_URL/DB connection needed), `@/services/consultation.service`, and
// `@/lib/whatsapp` so this test exercises the real rate-limit gating logic in
// the route without touching a DB or sending a real WhatsApp message.
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
  return new NextRequest('http://localhost/api/consultations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function loadRouteWith(loginAttemptStore: ReturnType<typeof makeLoginAttemptStore>) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: loginAttemptStore } }));
  mock.module('@/services/consultation.service', () => ({
    consultationService: {
      create: mock(async (data: unknown) => ({ id: 'consult-1', status: 'NEW', ...(data as object) })),
    },
  }));
  mock.module('@/lib/whatsapp', () => ({ sendWhatsAppMessage: mock(async () => ({ ok: true })) }));
  return import('./route');
}

const VALID_BODY = {
  name: 'Priya Sharma',
  phone: '9876543210',
  email: 'priya@example.com',
  city: 'Patna',
  eventType: 'wedding',
  weddingDate: '2027-01-01',
  days: 1,
  guestCount: 200,
  foodPreference: 'veg',
  services: ['venue'],
  venueType: 'banquet-hall',
  preferredTime: '10:00',
  message: '',
};

describe('POST /api/consultations — rate limiting', () => {
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
