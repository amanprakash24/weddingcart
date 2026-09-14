/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { NotFoundError } from '@/lib/errors';

// Mocks `@/lib/prisma` (satisfies lib/auth/rateLimit.ts's — and, transitively,
// lib/adminAuth.ts's GET-only — import chain; no DATABASE_URL/DB connection
// needed) and `@/services/vendorApplication.service` (isolates the route's
// own rate-limit/validation logic from the real service, which has its own
// coverage), same technique as app/api/consultations/route.test.ts and
// app/api/events/[id]/orders/route.test.ts.
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

function postRequest(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/vendor-applications', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function loadRouteWith(
  loginAttemptStore: ReturnType<typeof makeLoginAttemptStore>,
  create = mock(async (input: unknown) => ({
    ...(input as object),
    id: 'app-1',
    status: 'NEW',
    category: { name: 'Photography' },
  }))
) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: loginAttemptStore } }));
  mock.module('@/services/vendorApplication.service', () => ({ vendorApplicationService: { create } }));
  const route = await import('./route');
  return { POST: route.POST, create };
}

// Matches the exact shape components/VendorOnboardingClient.tsx submits:
// businessName/ownerName/ownerPhone/ownerEmail/category/city/priceMin/
// priceMax/experience/description/instagram/website (spread from `form`)
// plus portfolioImages always, foodMenuImages only for venue category.
// Notably no coverImage — the live form never sends it.
const VALID_BODY = {
  businessName: 'Royal Wedding Photography',
  ownerName: 'Aman Singh',
  ownerPhone: '9876543210',
  ownerEmail: 'aman@example.com',
  category: 'cat-1',
  city: 'Patna',
  priceMin: 25000,
  priceMax: 100000,
  experience: '3–5 years',
  description: 'We do great photography.',
  instagram: '@royalwedding',
  website: 'https://royalwedding.example.com',
  portfolioImages: [
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
    'https://cdn.example.com/3.jpg',
  ],
};

describe('POST /api/vendor-applications — rate limiting', () => {
  test('allows requests under the threshold, then rejects with 429 once exceeded', async () => {
    const store = makeLoginAttemptStore();
    const { POST } = await loadRouteWith(store);

    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest(VALID_BODY));
      expect(res.status).toBe(201);
    }
    const blocked = await POST(postRequest(VALID_BODY));
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

describe('POST /api/vendor-applications — request validation', () => {
  test('a valid application succeeds and reaches vendorApplicationService.create with the parsed fields', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.businessName).toBe('Royal Wedding Photography');
    expect(input.ownerName).toBe('Aman Singh');
    expect(input.ownerPhone).toBe('9876543210');
    expect(input.ownerEmail).toBe('aman@example.com');
    expect(input.category).toBe('cat-1');
    expect(input.city).toBe('Patna');
    expect(input.priceMin).toBe(25000);
    expect(input.priceMax).toBe(100000);
    expect(input.portfolioImages).toEqual(VALID_BODY.portfolioImages);
  });

  test('a missing businessName is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { businessName: _omit, ...rest } = VALID_BODY;
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(rest));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a missing ownerName is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { ownerName: _omit, ...rest } = VALID_BODY;
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(rest));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a malformed ownerPhone (not 10 digits) is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, ownerPhone: '12345' }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('an invalid ownerEmail is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, ownerEmail: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a blank ownerEmail ("") is accepted, matching the tolerant optional-email convention', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, ownerEmail: '' }));

    expect(res.status).toBe(201);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.ownerEmail).toBe('');
  });

  test('an omitted ownerEmail defaults to an empty string, not undefined, matching the required-string service contract', async () => {
    const store = makeLoginAttemptStore();
    const { ownerEmail: _omit, ...rest } = VALID_BODY;
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(rest));

    expect(res.status).toBe(201);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.ownerEmail).toBe('');
  });

  test('a portfolioImages array over the cap is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(
      postRequest({ ...VALID_BODY, portfolioImages: Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.jpg`) })
    );

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a non-URL portfolioImages entry is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, portfolioImages: ['not-a-url'] }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a foodMenuImages array over the cap is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(
      postRequest({ ...VALID_BODY, foodMenuImages: Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/menu-${i}.jpg`) })
    );

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a negative priceMin is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, priceMin: -1 }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('a non-integer priceMax is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, priceMax: 100000.5 }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test('missing priceMin/priceMax are accepted (optional, matching the schema default of 0)', async () => {
    const store = makeLoginAttemptStore();
    const { priceMin: _p1, priceMax: _p2, ...rest } = VALID_BODY;
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(rest));

    expect(res.status).toBe(201);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.priceMin).toBeUndefined();
    expect(input.priceMax).toBeUndefined();
  });

  test('coverImage is validated only when present in the payload — omitted is accepted', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest(VALID_BODY));

    expect(res.status).toBe(201);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.coverImage).toBeUndefined();
  });

  test('a valid coverImage, when present, is accepted', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, coverImage: 'https://cdn.example.com/cover.jpg' }));

    expect(res.status).toBe(201);
    const [input] = create.mock.calls[0] as [Record<string, unknown>];
    expect(input.coverImage).toBe('https://cdn.example.com/cover.jpg');
  });

  test('an invalid coverImage, when present, is rejected before the service is invoked', async () => {
    const store = makeLoginAttemptStore();
    const { POST, create } = await loadRouteWith(store);

    const res = await POST(postRequest({ ...VALID_BODY, coverImage: 'not-a-url' }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('POST /api/vendor-applications — existing category-existence behavior still surfaces correctly', () => {
  test("a nonexistent category's NotFoundError from vendorApplicationService.create is mapped to a 404", async () => {
    const store = makeLoginAttemptStore();
    const create = mock(async () => {
      throw new NotFoundError('Category', 'cat-1');
    });
    const { POST } = await loadRouteWith(store, create);

    const res = await POST(postRequest(VALID_BODY));

    expect(res.status).toBe(404);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
