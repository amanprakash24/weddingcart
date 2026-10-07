/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ADMIN_ROLES, Role, withoutInternalRoles } from './roles';

// The WhatsApp one-time-code sign-in uses this: it must never open the Command Center, whoever's number it is.
describe('withoutInternalRoles', () => {
  test('a founder who is also a vendor owner and a customer keeps only the portal roles', () => {
    expect(withoutInternalRoles([Role.SUPER_ADMIN, Role.VENDOR, Role.CUSTOMER])).toEqual([Role.VENDOR, Role.CUSTOMER]);
  });

  test('every internal role is dropped — none is left to open /admin', () => {
    expect(withoutInternalRoles([...ADMIN_ROLES])).toEqual([]);
  });

  test('a couple or a vendor is unchanged', () => {
    expect(withoutInternalRoles([Role.CUSTOMER])).toEqual([Role.CUSTOMER]);
    expect(withoutInternalRoles([Role.VENDOR])).toEqual([Role.VENDOR]);
  });
});
