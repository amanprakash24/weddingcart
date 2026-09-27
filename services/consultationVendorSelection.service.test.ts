/// <reference types="bun-types" />
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NotFoundError, ValidationError } from '@/lib/errors';

type Selection = {
  id: string;
  consultationId: string;
  serviceKey: string;
  categoryId: string | null;
  vendorId: string;
  vendor: { id: string; name: string; category: { id: string; name: string; slug: string } };
  category: { id: string; name: string; slug: string } | null;
};

const consultation = { id: 'consultation-1', services: ['photography', 'decoration'] };
const vendors = new Map([
  ['vendor-a', { id: 'vendor-a', categoryId: 'category-photo', status: 'PUBLISHED', name: 'Photo A' }],
  ['vendor-b', { id: 'vendor-b', categoryId: 'category-decor', status: 'PUBLISHED', name: 'Decor B' }],
  ['vendor-c', { id: 'vendor-c', categoryId: 'category-photo', status: 'PUBLISHED', name: 'Photo C' }],
  ['vendor-draft', { id: 'vendor-draft', categoryId: 'category-photo', status: 'DRAFT', name: 'Draft Photo' }],
]);
const categories = new Map([
  ['category-photo', { id: 'category-photo', name: 'Photography', slug: 'photography' }],
  ['category-decor', { id: 'category-decor', name: 'Decoration', slug: 'decoration' }],
]);
const selections = new Map<string, Selection>();

const findConsultation = mock(async (id: string) => (id === consultation.id ? consultation : null));
const findCategory = mock(async (id: string) => categories.get(id) ?? null);
const findVendor = mock(async ({ where }: { where: { id: string } }) => vendors.get(where.id) ?? null);
const findMany = mock(async (consultationId: string) => [...selections.values()].filter((row) => row.consultationId === consultationId));
const upsert = mock(async (data: { consultation: { connect: { id: string } }; serviceKey: string; category?: { connect: { id: string } }; vendor: { connect: { id: string } } }) => {
  const key = `${data.consultation.connect.id}:${data.serviceKey}`;
  const vendor = vendors.get(data.vendor.connect.id)!;
  const category = data.category ? categories.get(data.category.connect.id)! : null;
  const row: Selection = {
    id: selections.get(key)?.id ?? `selection-${selections.size + 1}`,
    consultationId: data.consultation.connect.id,
    serviceKey: data.serviceKey,
    categoryId: category?.id ?? null,
    vendorId: vendor.id,
    vendor: { id: vendor.id, name: vendor.name, category: categories.get(vendor.categoryId)! },
    category,
  };
  selections.set(key, row);
  return row;
});
const remove = mock(async ({ consultationId_serviceKey }: { consultationId_serviceKey: { consultationId: string; serviceKey: string } }) => {
  const key = `${consultationId_serviceKey.consultationId}:${consultationId_serviceKey.serviceKey}`;
  const row = selections.get(key);
  if (!row) throw new NotFoundError('Consultation vendor selection', key);
  selections.delete(key);
  return row;
});

mock.module('@/lib/prisma', () => ({ prisma: { vendor: { findUnique: findVendor } } }));
mock.module('@/repositories/consultation.repository', () => ({ consultationRepository: { findById: findConsultation } }));
mock.module('@/repositories/category.repository', () => ({ categoryRepository: { findById: findCategory } }));
mock.module('@/repositories/consultationVendorSelection.repository', () => ({
  consultationVendorSelectionRepository: { findMany, upsert, delete: remove },
}));

const { consultationVendorSelectionService } = await import('./consultationVendorSelection.service');

beforeEach(() => {
  selections.clear();
  findConsultation.mockClear();
  findCategory.mockClear();
  findVendor.mockClear();
  findMany.mockClear();
  upsert.mockClear();
  remove.mockClear();
});

describe('consultationVendorSelectionService', () => {
  test('lists no selections for a new consultation', async () => {
    expect(await consultationVendorSelectionService.list(consultation.id)).toEqual([]);
  });

  test('selects photography and returns the selected vendor/category', async () => {
    const selected = await consultationVendorSelectionService.select({
      consultationId: consultation.id,
      serviceKey: ' Photography ',
      categoryId: 'category-photo',
      vendorId: 'vendor-a',
    });
    expect(selected).toMatchObject({ serviceKey: 'photography', vendorId: 'vendor-a', categoryId: 'category-photo' });
  });

  test('persists independently selected vendors and returns them on refresh', async () => {
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'category-photo', vendorId: 'vendor-a' });
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'decoration', categoryId: 'category-decor', vendorId: 'vendor-b' });
    expect(await consultationVendorSelectionService.list(consultation.id)).toHaveLength(2);
  });

  test('changes photography without creating a duplicate selection', async () => {
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'category-photo', vendorId: 'vendor-a' });
    const changed = await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'category-photo', vendorId: 'vendor-c' });
    expect(changed).toMatchObject({ id: 'selection-1', vendorId: 'vendor-c' });
    expect((await consultationVendorSelectionService.list(consultation.id)).filter((row) => row.serviceKey === 'photography')).toHaveLength(1);
  });

  test('removes only photography and keeps decoration', async () => {
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'category-photo', vendorId: 'vendor-a' });
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'decoration', categoryId: 'category-decor', vendorId: 'vendor-b' });
    await consultationVendorSelectionService.remove(consultation.id, 'PHOTOGRAPHY');
    expect(await consultationVendorSelectionService.list(consultation.id)).toMatchObject([{ serviceKey: 'decoration', vendorId: 'vendor-b' }]);
  });

  test('rejects a service not required by the consultation', async () => {
    await expect(consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'makeup', vendorId: 'vendor-a' })).rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects an invalid consultation', async () => {
    await expect(consultationVendorSelectionService.list('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('rejects an invalid vendor, unpublished vendor, and invalid category', async () => {
    await expect(consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', vendorId: 'missing' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', vendorId: 'vendor-draft' })).rejects.toBeInstanceOf(ValidationError);
    await expect(consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'missing', vendorId: 'vendor-a' })).rejects.toBeInstanceOf(NotFoundError);
  });

  test('rejects a category that does not match the vendor', async () => {
    await expect(consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', categoryId: 'category-decor', vendorId: 'vendor-a' })).rejects.toBeInstanceOf(ValidationError);
  });

  test('does not create downstream enquiry, quotation, or booking records', async () => {
    await consultationVendorSelectionService.select({ consultationId: consultation.id, serviceKey: 'photography', vendorId: 'vendor-a' });
    expect(selections.size).toBe(1);
    expect([...selections.values()][0]).not.toHaveProperty('enquiry');
    expect([...selections.values()][0]).not.toHaveProperty('quotation');
    expect([...selections.values()][0]).not.toHaveProperty('booking');
  });
});
