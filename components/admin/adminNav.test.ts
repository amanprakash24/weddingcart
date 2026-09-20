import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MORE, OLD_SCREENS, PHONE_BAR, PRIMARY, SETUP, UPCOMING_SECTION, type ActiveContext } from './adminNav';

// The admin navigation is the product structure: Today / Leads & Quotes / Weddings / Vendors / Invoices, everything else
// under More. These tests pin that structure and guard against dead links.

const root = join(import.meta.dir, '..', '..');
const activePrimary = (ctx: ActiveContext) => PRIMARY.filter((item) => item.isActive(ctx)).map((item) => item.key);
const ctx = (pathname: string, tab: string | null = null, section: string | null = null): ActiveContext => ({ pathname, tab, section });

describe('primary navigation', () => {
  test('is exactly Today, Leads & Quotes, Weddings, Vendors, Invoices — in that order', () => {
    expect(PRIMARY.map((item) => item.label)).toEqual(['Today', 'Leads & Quotes', 'Weddings', 'Vendors', 'Invoices']);
  });

  test('the old workflow screens are not primary navigation', () => {
    const primaryLabels = PRIMARY.map((item) => item.label);
    for (const old of ['Enquiries', 'Consultations', 'Leads', 'Bookings', 'Categories', 'Special services', 'Blog']) {
      expect(primaryLabels).not.toContain(old);
    }
    expect(OLD_SCREENS.map((item) => item.label)).toEqual(['Bookings', 'Enquiries', 'Consultations', 'Leads']);
  });

  test('the phone bar is the four daily screens (Invoices goes under More)', () => {
    expect(PHONE_BAR.map((item) => item.key)).toEqual(['today', 'leads', 'weddings', 'vendors']);
  });

  test.each([
    ['Today', ctx('/admin/dashboard'), ['today']],
    ['Weddings (the Upcoming weddings list on Today)', ctx('/admin/dashboard', null, UPCOMING_SECTION), ['weddings']],
    ['a wedding\'s Control Room', ctx('/admin/weddings/abc'), ['weddings']],
    ['the lead list', ctx('/admin/crm'), ['leads']],
    ['a lead workspace (where the quote lives)', ctx('/admin/crm/leads/CONSULTATION/abc'), ['leads']],
    ['the vendor list', ctx('/admin/vendors'), ['vendors']],
    ['editing a vendor', ctx('/admin/vendors/abc'), ['vendors']],
    ['Invoices', ctx('/admin', 'invoices'), ['invoices']],
    ['a screen under More highlights no primary item', ctx('/admin', 'outside-vendors'), []],
    ['Public events highlights no primary item', ctx('/admin/events'), []],
  ])('%s highlights exactly the right item', (_name, context, expected) => {
    expect(activePrimary(context)).toEqual(expected);
  });

  test('each More / old-screen entry lights up on its own screen only', () => {
    for (const item of [...MORE, SETUP, ...OLD_SCREENS]) {
      const tab = item.href.includes('?tab=') ? item.href.split('?tab=')[1] : null;
      const pathname = tab ? '/admin' : item.href;
      expect(item.isActive(ctx(pathname, tab))).toBe(true);
      expect(activePrimary(ctx(pathname, tab))).toEqual([]);
    }
  });
});

describe('no dead links', () => {
  const all = [...PRIMARY, ...MORE, SETUP, ...OLD_SCREENS];

  test('nothing points at /admin/weddings, which has no list page (V1 uses the Upcoming weddings list on Today)', () => {
    expect(all.map((item) => item.href.split(/[?#]/)[0])).not.toContain('/admin/weddings');
  });

  test('every path link has a page', () => {
    for (const item of all) {
      const path = item.href.split(/[?#]/)[0];
      const page = join(root, 'app', ...path.split('/').filter(Boolean), 'page.tsx');
      expect({ href: item.href, exists: existsSync(page) }).toEqual({ href: item.href, exists: true });
    }
  });

  test('every ?tab= link is a screen AdminClient really has', () => {
    const source = readFileSync(join(root, 'components', 'AdminClient.tsx'), 'utf8');
    const ids = [...(source.match(/const TAB_IDS = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    for (const item of all.filter((i) => i.href.includes('?tab='))) {
      expect(ids).toContain(item.href.split('?tab=')[1]);
    }
  });

  test('the Today page has the section the Weddings link scrolls to', () => {
    const source = readFileSync(join(root, 'components', 'crm', 'dashboard', 'CommandCenter.tsx'), 'utf8');
    expect(source).toContain(`id="${UPCOMING_SECTION}"`);
  });
});
