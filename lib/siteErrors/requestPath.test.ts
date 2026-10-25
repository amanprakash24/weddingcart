/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { currentRequestPath, withRequestPath } from './requestPath';
import { platformScoped } from '@/lib/ownership/entry';

describe('request path for site errors', () => {
  test('a request handled through the route wrapper knows its path (only the path)', async () => {
    const handler = platformScoped(async (_req: Request) => {
      await Promise.resolve();
      return currentRequestPath();
    });
    expect(await handler(new Request('https://www.shaadishopping.com/api/leads?phone=9876543210'))).toBe('/api/leads');
  });
  test('no request (a server page with props, or none): nothing', () => {
    expect(withRequestPath({ params: {} }, () => currentRequestPath())).toBeNull();
    expect(withRequestPath(undefined, () => currentRequestPath())).toBeNull();
    expect(currentRequestPath()).toBeNull();
  });
});
