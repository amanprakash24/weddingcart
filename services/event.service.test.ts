/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { Prisma } from '@/generated/prisma/client';
import { NotFoundError, InvalidTransitionError, DuplicateError } from '@/lib/errors';

// Mocks `@/lib/prisma` and `@/lib/razorpay` wholesale (no DATABASE_URL/DB
// connection or real Razorpay call needed, same technique used elsewhere in
// this repo). Confirms event.service.ts's create/update/createOrder/checkIn
// throw the correct *typed* errors (NotFoundError/InvalidTransitionError/
// DuplicateError) for each condition — this is what app/api/events/**'s
// handleApiError() maps to the correct HTTP status, and what keeps an
// unrelated/unexpected error (e.g. a raw Prisma internal) from being
// mistaken for one of these safe, anticipated cases.
function fakeP2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`slug`)', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: { target: ['slug'] },
  });
}

function fakeP2025() {
  return new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
    code: 'P2025',
    clientVersion: '7.10.0',
    meta: { cause: 'Record to update not found.' },
  });
}

async function loadEventServiceWith(prismaMock: Record<string, unknown>, razorpayMock?: Record<string, unknown>) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  mock.module('@/lib/razorpay', () => ({ createPaymentLink: mock(async () => ({ ok: false, error: 'card declined' })), ...razorpayMock }));
  const { eventService } = await import('./event.service');
  return eventService;
}

describe('eventService — typed errors for handleApiError to map correctly', () => {
  test('create() wraps a duplicate-slug Prisma error into DuplicateError', async () => {
    const eventService = await loadEventServiceWith({
      event: { create: mock(async () => { throw fakeP2002(); }) },
    });
    await expect(
      eventService.create({ slug: 'dup', name: 'E', date: '2027-01-01', venueName: 'V', passTypes: [] })
    ).rejects.toThrow(DuplicateError);
  });

  test('update() wraps a not-found Prisma error into NotFoundError', async () => {
    const eventService = await loadEventServiceWith({
      event: { update: mock(async () => { throw fakeP2025(); }) },
    });
    await expect(eventService.update('missing-id', { name: 'New name' })).rejects.toThrow(NotFoundError);
  });

  test('createOrder() throws NotFoundError for a nonexistent or unpublished event', async () => {
    const eventService = await loadEventServiceWith({
      event: { findUnique: mock(async () => null) },
    });
    await expect(
      eventService.createOrder('missing-event', { customerName: 'A', customerPhone: '1', passTypeId: 'p1' })
    ).rejects.toThrow(NotFoundError);
  });

  test('createOrder() throws NotFoundError for a pass type that does not match', async () => {
    const eventService = await loadEventServiceWith({
      event: {
        findUnique: mock(async () => ({ id: 'e1', status: 'PUBLISHED', name: 'Sangeet', passTypes: [] })),
      },
    });
    await expect(
      eventService.createOrder('e1', { customerName: 'A', customerPhone: '1', passTypeId: 'no-such-pass' })
    ).rejects.toThrow(NotFoundError);
  });

  test('createOrder() throws InvalidTransitionError with the sales-limit message when sold out', async () => {
    const eventService = await loadEventServiceWith({
      event: {
        findUnique: mock(async () => ({
          id: 'e1',
          status: 'PUBLISHED',
          name: 'Sangeet',
          passTypes: [{ id: 'p1', status: 'ACTIVE', price: 500, salesLimit: 10 }],
        })),
      },
      eventTicket: { count: mock(async () => 10) },
    });
    await expect(
      eventService.createOrder('e1', { customerName: 'A', customerPhone: '1', passTypeId: 'p1', quantity: 1 })
    ).rejects.toThrow(new InvalidTransitionError('Sales limit reached for this pass type'));
  });

  test("createOrder() throws InvalidTransitionError with the payment gateway's own error message on payment-link failure", async () => {
    const eventService = await loadEventServiceWith(
      {
        event: {
          findUnique: mock(async () => ({
            id: 'e1',
            status: 'PUBLISHED',
            name: 'Sangeet',
            passTypes: [{ id: 'p1', status: 'ACTIVE', price: 500, salesLimit: null }],
          })),
        },
        eventTicket: { count: mock(async () => 0) },
        eventOrder: {
          create: mock(async () => ({ id: 'order-1' })),
          update: mock(async () => ({ id: 'order-1' })),
        },
      },
      { createPaymentLink: mock(async () => ({ ok: false, error: 'card declined' })) }
    );
    await expect(
      eventService.createOrder('e1', { customerName: 'A', customerPhone: '1', passTypeId: 'p1', quantity: 1 })
    ).rejects.toThrow(new InvalidTransitionError('card declined'));
  });

  test('checkIn() throws NotFoundError for a nonexistent ticket', async () => {
    const eventService = await loadEventServiceWith({
      $transaction: mock(async (fn: (tx: unknown) => unknown) =>
        fn({ eventTicket: { findFirst: mock(async () => null) } })
      ),
    });
    await expect(eventService.checkIn('e1', 'missing-ticket')).rejects.toThrow(NotFoundError);
  });

  test('checkIn() throws InvalidTransitionError for an already-checked-in ticket', async () => {
    const eventService = await loadEventServiceWith({
      $transaction: mock(async (fn: (tx: unknown) => unknown) =>
        fn({
          eventTicket: {
            findFirst: mock(async () => ({
              id: 't1',
              checkInStatus: 'CHECKED_IN',
              order: { status: 'CONFIRMED' },
            })),
          },
        })
      ),
    });
    await expect(eventService.checkIn('e1', 't1')).rejects.toThrow(
      new InvalidTransitionError('Ticket has already been used')
    );
  });
});
