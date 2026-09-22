/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { MAX_ONBOARDING_IMAGE_BYTES } from '@/lib/onboardingUpload';

// Same isolation technique as app/api/vendor-applications/route.test.ts:
// `@/lib/prisma` is mocked with an in-memory LoginAttempt store (satisfies
// lib/auth/rateLimit.ts, no DB), and `cloudinary` is mocked so no network call
// is ever made — these tests must never upload anything for real.
function makeLoginAttemptStore() {
  const rows: { identifier: string; success: boolean; createdAt: Date }[] = [];
  return {
    rows,
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

const CDN_URL = 'https://res.cloudinary.com/demo/image/upload/v1/shaadishopping/vendor-onboarding/abc123.jpg';

type UploadResult = { secure_url?: string } | null;

function makeCloudinary(result: UploadResult | Error = { secure_url: CDN_URL }) {
  const upload_stream = mock((_options: Record<string, unknown>, cb: (err: unknown, res: UploadResult) => void) => ({
    end: () => (result instanceof Error ? cb(result, null) : cb(null, result)),
  }));
  return { upload_stream, module: { v2: { config: () => undefined, uploader: { upload_stream } } } };
}

async function loadRouteWith(store = makeLoginAttemptStore(), cloudinary = makeCloudinary()) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: store } }));
  mock.module('cloudinary', () => cloudinary.module);
  const route = await import('./route');
  return { POST: route.POST, store, upload_stream: cloudinary.upload_stream };
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const jpegBytes = (size = 2048) => {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_HEADER);
  return bytes;
};

function uploadRequest(
  file: File | string | null,
  { ip = '1.2.3.4', headers = {} as Record<string, string> } = {}
) {
  const form = new FormData();
  if (file !== null) form.set('file', file);
  return new NextRequest('http://localhost/api/vendor-applications/upload', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, ...headers },
    body: form,
  });
}

const jpegFile = (name = 'venue.jpg', size?: number) => new File([jpegBytes(size)], name, { type: 'image/jpeg' });

describe('POST /api/vendor-applications/upload — public, no login required', () => {
  test('a valid JPEG from an anonymous visitor uploads and returns only the https URL', async () => {
    const { POST, upload_stream } = await loadRouteWith();

    const res = await POST(uploadRequest(jpegFile()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, url: CDN_URL });
    expect(upload_stream).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/vendor-applications/upload — safe storage', () => {
  test('always stores in the fixed onboarding folder with a random name, ignoring the client file name', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const evil = '../../admin/../etc/passwd<script>.jpg';

    const res = await POST(uploadRequest(jpegFile(evil)));

    expect(res.status).toBe(200);
    const options = upload_stream.mock.calls[0][0];
    expect(options.folder).toBe('shaadishopping/vendor-onboarding');
    expect(options.resource_type).toBe('image');
    expect(options.use_filename).toBe(false);
    expect(options.unique_filename).toBe(true);
    expect(options.overwrite).toBe(false);
    expect(options.allowed_formats).toEqual(['jpg', 'png', 'webp']);
    expect(options.tags).toEqual(['vendor-onboarding', 'unverified']);
    // No caller-controlled path/name reaches Cloudinary.
    expect(options).not.toHaveProperty('public_id');
    expect(JSON.stringify(options)).not.toContain('passwd');
    expect(JSON.stringify(options)).not.toContain('..');
  });
});

describe('POST /api/vendor-applications/upload — strict file validation', () => {
  test('rejects a request with no file (400) without calling Cloudinary', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const res = await POST(uploadRequest(null));
    expect(res.status).toBe(400);
    expect(upload_stream).not.toHaveBeenCalled();
  });

  test('rejects a plain-text "file" field (400)', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const res = await POST(uploadRequest('just a string'));
    expect(res.status).toBe(400);
    expect(upload_stream).not.toHaveBeenCalled();
  });

  test('rejects HTML disguised as a JPEG (415) — bytes decide, not the declared type or extension', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const html = new File(['<html><script>alert(1)</script></html>'], 'photo.jpg', { type: 'image/jpeg' });
    const res = await POST(uploadRequest(html));
    expect(res.status).toBe(415);
    expect(upload_stream).not.toHaveBeenCalled();
  });

  test('rejects a scriptable SVG (415)', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'a.svg', { type: 'image/svg+xml' });
    const res = await POST(uploadRequest(svg));
    expect(res.status).toBe(415);
    expect(upload_stream).not.toHaveBeenCalled();
  });

  test('rejects GIF, which the public path no longer accepts (415)', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0])], 'a.gif', { type: 'image/gif' });
    const res = await POST(uploadRequest(gif));
    expect(res.status).toBe(415);
    expect(upload_stream).not.toHaveBeenCalled();
  });

  test('rejects a file over the size cap (413) without calling Cloudinary', async () => {
    const { POST, upload_stream } = await loadRouteWith();
    const res = await POST(uploadRequest(jpegFile('big.jpg', MAX_ONBOARDING_IMAGE_BYTES + 1)));
    expect(res.status).toBe(413);
    expect((await res.json()).success).toBe(false);
    expect(upload_stream).not.toHaveBeenCalled();
  });
});

describe('POST /api/vendor-applications/upload — rate limiting', () => {
  test('allows 20 uploads per IP per window, then rejects with 429', async () => {
    const { POST, upload_stream } = await loadRouteWith();

    for (let i = 0; i < 20; i++) {
      expect((await POST(uploadRequest(jpegFile()))).status).toBe(200);
    }
    const blocked = await POST(uploadRequest(jpegFile()));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).success).toBe(false);
    expect(upload_stream).toHaveBeenCalledTimes(20);
  });

  test('one IP exhausting its budget does not block another IP', async () => {
    const { POST } = await loadRouteWith();
    for (let i = 0; i < 20; i++) await POST(uploadRequest(jpegFile(), { ip: '1.2.3.4' }));
    expect((await POST(uploadRequest(jpegFile(), { ip: '1.2.3.4' }))).status).toBe(429);
    expect((await POST(uploadRequest(jpegFile(), { ip: '9.9.9.9' }))).status).toBe(200);
  });

  test('counts invalid requests too, so malformed spam cannot dodge the limiter', async () => {
    const { POST, store } = await loadRouteWith();
    for (let i = 0; i < 20; i++) await POST(uploadRequest(null));
    expect(store.rows.filter((r) => r.identifier === 'onboarding-upload:1.2.3.4')).toHaveLength(20);
    expect((await POST(uploadRequest(jpegFile()))).status).toBe(429);
  });

  test('uses its own namespace, separate from the application-submit throttle', async () => {
    const { POST, store } = await loadRouteWith();
    await POST(uploadRequest(jpegFile()));
    expect(store.rows.map((r) => r.identifier)).toEqual(['onboarding-upload:1.2.3.4']);
  });
});

describe('POST /api/vendor-applications/upload — same-origin only', () => {
  test('refuses a cross-site POST (403) without touching the rate limiter or Cloudinary', async () => {
    const { POST, upload_stream, store } = await loadRouteWith();
    const res = await POST(
      uploadRequest(jpegFile(), { headers: { origin: 'https://evil.example', host: 'www.shaadishopping.com' } })
    );
    expect(res.status).toBe(403);
    expect(upload_stream).not.toHaveBeenCalled();
    expect(store.rows).toHaveLength(0);
  });

  test('allows the site\'s own origin', async () => {
    const { POST } = await loadRouteWith();
    const res = await POST(
      uploadRequest(jpegFile(), { headers: { origin: 'https://www.shaadishopping.com', host: 'www.shaadishopping.com' } })
    );
    expect(res.status).toBe(200);
  });

  test('treats an unparseable Origin as cross-site (403)', async () => {
    const { POST } = await loadRouteWith();
    const res = await POST(uploadRequest(jpegFile(), { headers: { origin: 'not a url', host: 'www.shaadishopping.com' } }));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/vendor-applications/upload — failure handling', () => {
  test('a Cloudinary error returns a generic 500 and never leaks the underlying message', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore(), makeCloudinary(new Error('api_secret=SUPERSECRET invalid')));
    const res = await POST(uploadRequest(jpegFile()));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain('Upload failed');
    expect(text).not.toContain('SUPERSECRET');
  });

  test('a response without an https URL is treated as a failure (500)', async () => {
    const { POST } = await loadRouteWith(makeLoginAttemptStore(), makeCloudinary({ secure_url: 'http://insecure.example/x.jpg' }));
    expect((await POST(uploadRequest(jpegFile()))).status).toBe(500);
    const { POST: POST2 } = await loadRouteWith(makeLoginAttemptStore(), makeCloudinary({}));
    expect((await POST2(uploadRequest(jpegFile()))).status).toBe(500);
  });
});
