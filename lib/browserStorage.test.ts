/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readStored, writeStored } from './browserStorage';

// The visitor's browser storage, safely (lib/browserStorage.ts). A browser that refuses storage must never break a page.
const g = globalThis as unknown as { window?: unknown };
afterEach(() => {
  delete g.window;
});

function memoryStorage(full = false): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size; },
  };
}

describe('browser storage that may be refused', () => {
  test('works normally when the browser allows it — local and session kept apart', () => {
    g.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };
    expect(writeStored('wc_cart', '[1]')).toBe(true);
    expect(readStored('wc_cart')).toBe('[1]');
    expect(readStored('wc_cart', 'session')).toBeNull();
    expect(writeStored('hidden', '1', 'session')).toBe(true);
    expect(readStored('hidden', 'session')).toBe('1');
  });

  test('a browser that refuses storage (even reading the property throws): nothing is thrown, nothing is kept', () => {
    const refuse = () => { throw new DOMException("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.", 'SecurityError'); };
    g.window = Object.defineProperties({}, { localStorage: { get: refuse }, sessionStorage: { get: refuse } });
    expect(() => readStored('wc_cart')).not.toThrow();
    expect(readStored('wc_cart')).toBeNull();
    expect(writeStored('wc_cart', '[1]')).toBe(false);
    expect(writeStored('hidden', '1', 'session')).toBe(false);
  });

  test('full storage: the write is skipped quietly', () => {
    g.window = { localStorage: memoryStorage(true), sessionStorage: memoryStorage() };
    expect(writeStored('wc_cart', 'x')).toBe(false);
  });

  test('on the server (no window): nothing, no error', () => {
    expect(readStored('wc_cart')).toBeNull();
    expect(writeStored('wc_cart', 'x')).toBe(false);
  });
});

describe('no page reads browser storage directly', () => {
  // The crash of 6 Nov 2026 came from one unguarded line. Every use goes through lib/browserStorage.ts.
  const root = join(import.meta.dir, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });
  test('only lib/browserStorage.ts touches localStorage / sessionStorage', () => {
    const offenders = ['app', 'components', 'context', 'lib', 'hooks', 'services']
      .flatMap((d) => { try { return files(join(root, d)); } catch { return []; } })
      .filter((p) => !p.split('\\').join('/').endsWith('lib/browserStorage.ts'))
      .filter((p) => /\b(localStorage|sessionStorage)\b/.test(readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '')))
      .map((p) => p.slice(root.length + 1).split('\\').join('/'));
    expect(offenders).toEqual([]);
  });
});
