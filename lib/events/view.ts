// Who sees what of an event (security fix, 21 Nov 2026), applied by GET /api/events/[id]. Until now that public,
// unauthenticated route returned every order and ticket of a published event — buyers' names, phones and emails, amounts,
// payment references, ticket codes and QR codes. Now:
//   • the public: the event and its pass types only (what the public event page shows anyway);
//   • the internal team (check-in, order handling): orders and tickets, but order amounts withheld (null);
//   • the founder: everything, including amounts (the admin screen adds them up as revenue).
// Pure, so it is tested directly.
export function eventView<E extends { orders: { amount: number }[]; tickets: unknown[] }>(
  event: E,
  { isAdmin, isFounder }: { isAdmin: boolean; isFounder: boolean }
) {
  if (!isAdmin) {
    const { orders: _orders, tickets: _tickets, ...publicEvent } = event;
    return publicEvent;
  }
  if (isFounder) return event;
  return { ...event, orders: event.orders.map((order) => ({ ...order, amount: null })) };
}
