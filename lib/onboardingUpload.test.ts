/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  MAX_ONBOARDING_IMAGE_BYTES,
  ONBOARDING_UPLOAD_FOLDER,
  detectImageMime,
  validateOnboardingImage,
} from './onboardingUpload';

// Minimal real headers — enough for magic-byte detection.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const PDF = new TextEncoder().encode('%PDF-1.7 fake');

describe('detectImageMime — decides from the bytes, not the name', () => {
  test('recognises JPEG, PNG and WebP', () => {
    expect(detectImageMime(JPEG)).toBe('image/jpeg');
    expect(detectImageMime(PNG)).toBe('image/png');
    expect(detectImageMime(WEBP)).toBe('image/webp');
  });

  test.each([
    ['GIF', GIF],
    ['HTML', HTML],
    ['SVG (scriptable)', SVG],
    ['PDF', PDF],
    ['empty', new Uint8Array([])],
    ['a RIFF container that is not WebP (e.g. WAV)', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])],
    ['truncated PNG signature', new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  ])('rejects %s', (_name, bytes) => {
    expect(detectImageMime(bytes)).toBeNull();
  });
});

describe('validateOnboardingImage', () => {
  test.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
  ])('accepts a genuine %s', (type, bytes) => {
    expect(validateOnboardingImage(type, bytes)).toEqual({ ok: true, mime: type as 'image/jpeg' });
  });

  test('rejects an empty file with 400', () => {
    expect(validateOnboardingImage('image/jpeg', new Uint8Array([]))).toMatchObject({ ok: false, status: 400 });
  });

  test('rejects a file over the size cap with 413, at the boundary', () => {
    const atLimit = new Uint8Array(MAX_ONBOARDING_IMAGE_BYTES);
    atLimit.set(JPEG);
    expect(validateOnboardingImage('image/jpeg', atLimit).ok).toBe(true);

    const over = new Uint8Array(MAX_ONBOARDING_IMAGE_BYTES + 1);
    over.set(JPEG);
    expect(validateOnboardingImage('image/jpeg', over)).toMatchObject({ ok: false, status: 413 });
  });

  test.each([
    ['image/gif', GIF],
    ['image/svg+xml', SVG],
    ['text/html', HTML],
    ['application/pdf', PDF],
    ['', JPEG],
  ])('rejects a declared type of %p with 415', (type, bytes) => {
    expect(validateOnboardingImage(type, bytes)).toMatchObject({ ok: false, status: 415 });
  });

  test('rejects HTML/SVG/PDF bytes even when the client claims image/jpeg', () => {
    expect(validateOnboardingImage('image/jpeg', HTML)).toMatchObject({ ok: false, status: 415 });
    expect(validateOnboardingImage('image/jpeg', SVG)).toMatchObject({ ok: false, status: 415 });
    expect(validateOnboardingImage('image/png', PDF)).toMatchObject({ ok: false, status: 415 });
  });

  test('rejects a real PNG mislabelled as JPEG (declared type must match the bytes)', () => {
    expect(validateOnboardingImage('image/jpeg', PNG)).toMatchObject({ ok: false, status: 415 });
  });
});

describe('storage location', () => {
  test('is a fixed server constant, separate from vendors\' permanent media', () => {
    expect(ONBOARDING_UPLOAD_FOLDER).toBe('shaadishopping/vendor-onboarding');
    expect(ONBOARDING_UPLOAD_FOLDER).not.toContain('..');
  });
});
