/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { checkDatabase } from './health';

describe('checkDatabase', () => {
  test('a ping that answers: ok', async () => {
    expect(await checkDatabase(async () => 1)).toMatchObject({ ok: true });
  });

  test('a ping that throws: not ok, and the error itself is not passed on', async () => {
    const out = await checkDatabase(async () => {
      throw new Error('password authentication failed for user "postgres"');
    });
    expect(out).toMatchObject({ ok: false, reason: 'error' });
    expect(JSON.stringify(out)).not.toContain('password');
  });

  test('a ping that hangs: not ok after the time limit, never waiting for ever', async () => {
    const started = Date.now();
    const out = await checkDatabase(() => new Promise(() => {}), 50);
    expect(out).toMatchObject({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test('a ping that answers after the limit is still a failure', async () => {
    expect(await checkDatabase(() => new Promise((r) => setTimeout(r, 200)), 20)).toMatchObject({ ok: false, reason: 'timeout' });
  });
});
