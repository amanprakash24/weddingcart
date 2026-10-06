/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { gstinCheckCharacter, isOwnUpload, isValidGstin, missingProfileSteps, normalizeGstin, PROFILE_LIMITS, validateProfile, videoLink } from './profile';

// Two GST numbers published as format examples; both carry a correct check character.
const GSTIN_A = '27AAPFU0939F1ZV';
const GSTIN_B = '29AAGCB7383J1Z4';

describe('GST number', () => {
  test('normalizeGstin: capitals, no spaces or dashes; empty stays empty', () => {
    expect(normalizeGstin(' 27aapfu0939f1zv ')).toBe(GSTIN_A);
    expect(normalizeGstin('27 AAPFU 0939 F 1ZV')).toBe(GSTIN_A);
    expect(normalizeGstin('27-AAPFU0939F-1ZV')).toBe(GSTIN_A);
    expect(normalizeGstin('')).toBe('');
    expect(normalizeGstin(null)).toBe('');
  });

  test('a real number passes; the check character is the 15th', () => {
    expect(isValidGstin(GSTIN_A)).toBe(true);
    expect(isValidGstin(GSTIN_B)).toBe(true);
    expect(gstinCheckCharacter(GSTIN_A.slice(0, 14))).toBe('V');
    expect(gstinCheckCharacter(GSTIN_B.slice(0, 14))).toBe('4');
  });

  test('one mistyped character is caught', () => {
    expect(isValidGstin('27AAPFU0939F1ZW')).toBe(false); // wrong check character
    expect(isValidGstin('27AAPFU0938F1ZV')).toBe(false); // one digit off in the PAN part
    expect(isValidGstin('28AAPFU0939F1ZV')).toBe(false); // wrong state for this check character
  });

  test('the wrong shape is refused: length, lower case, a missing Z, an impossible state code', () => {
    for (const bad of ['', '27AAPFU0939F1Z', '27AAPFU0939F1ZVX', '27aapfu0939f1zv', '27AAPFU0939F1YV', 'AAAPFU0939F1ZV1', '27AAPFU0939F0ZV']) expect(isValidGstin(bad)).toBe(false);
    const state99 = `99AAPFU0939F1Z`;
    expect(isValidGstin(state99 + gstinCheckCharacter(state99))).toBe(false);
    const state00 = `00AAPFU0939F1Z`;
    expect(isValidGstin(state00 + gstinCheckCharacter(state00))).toBe(false);
  });
});

describe('videoLink — a link that costs us no storage', () => {
  test('YouTube and Instagram over https', () => {
    for (const ok of ['https://www.youtube.com/watch?v=abc123', 'https://youtu.be/abc123', 'https://m.youtube.com/watch?v=abc123', 'https://www.instagram.com/reel/Cabc123/', '  https://youtube.com/shorts/abc  ']) expect(videoLink(ok)).toBe(new URL(ok.trim()).toString());
  });

  test('anything else is refused', () => {
    for (const bad of ['', 'youtube.com/watch?v=abc', 'http://www.youtube.com/watch?v=abc', 'https://vimeo.com/123', 'https://youtube.com.evil.example/watch', 'https://evil.example/?u=https://youtube.com/', 'javascript:alert(1)', null, 42]) expect(videoLink(bad)).toBeNull();
  });
});

describe('isOwnUpload — only media that came through our own upload routes is ever saved', () => {
  const cloud = 'democloud';
  const folder = 'shaadishopping/vendor-profile';
  const own = `https://res.cloudinary.com/${cloud}/image/upload/v1791200000/${folder}/abc123.jpg`;

  test('an address in our cloud, under our folder', () => {
    expect(isOwnUpload(own, cloud, folder)).toBe(true);
    expect(isOwnUpload(`https://res.cloudinary.com/${cloud}/video/upload/v1/${folder}/tour.mp4`, cloud, folder)).toBe(true);
  });

  test('another cloud, another folder, another site, a tampered address', () => {
    for (const bad of [
      `https://res.cloudinary.com/othercloud/image/upload/v1/${folder}/abc.jpg`,
      `https://res.cloudinary.com/${cloud}/image/upload/v1/shaadishopping/vendor-onboarding/abc.jpg`,
      `https://evil.example/res.cloudinary.com/${cloud}/image/upload/${folder}/abc.jpg`,
      `http://res.cloudinary.com/${cloud}/image/upload/v1/${folder}/abc.jpg`,
      `${own}?x=1`,
      `${own}#frag`,
      `https://res.cloudinary.com/${cloud}/image/upload/v1/${folder}/../../other/abc.jpg`,
      `https://res.cloudinary.com/${cloud}/image/upload/v1/${folder}/a b.jpg`,
      `https://res.cloudinary.com/${cloud}/image/upload/v1/x${folder}/abc.jpg`,
      '',
      null,
      undefined,
    ]) expect(isOwnUpload(bad, cloud, folder)).toBe(false);
  });

  test('with no cloud configured nothing is "ours"', () => {
    expect(isOwnUpload(own, '', folder)).toBe(false);
  });
});

describe('validateProfile — the typed fields', () => {
  test('name only is enough; GST number and video link are optional', () => {
    expect(validateProfile({ name: '  Swayamvar   Hall ' })).toEqual({ ok: true, value: { name: 'Swayamvar Hall', gstin: null, videoLink: null } });
  });

  test('a GST number is cleaned and kept; a video link is kept', () => {
    expect(validateProfile({ name: 'Swayamvar Hall', gstin: ' 27aapfu0939f1zv ', videoLink: 'https://youtu.be/abc123' })).toEqual({
      ok: true,
      value: { name: 'Swayamvar Hall', gstin: GSTIN_A, videoLink: 'https://youtu.be/abc123' },
    });
  });

  test('each box gets its own sentence', () => {
    expect(validateProfile({ name: 'S', gstin: '27AAPFU0939F1ZW', videoLink: 'https://vimeo.com/1' })).toEqual({
      ok: false,
      errors: { name: expect.any(String), gstin: expect.stringContaining('not a valid GST number'), videoLink: expect.stringContaining('YouTube or Instagram') },
    });
    expect(validateProfile({ name: 'x'.repeat(PROFILE_LIMITS.nameMax + 1) })).toEqual({ ok: false, errors: { name: expect.stringContaining(String(PROFILE_LIMITS.nameMax)) } });
    expect(validateProfile({})).toEqual({ ok: false, errors: { name: expect.any(String) } });
  });
});

describe('missingProfileSteps — what still has to be done, in order', () => {
  test('nothing yet', () => {
    expect(missingProfileSteps({ name: null, logoUrl: null, photoCount: 0 })).toEqual(['name', 'logo', 'photos']);
  });

  test('complete with a name, a logo and three photos — video and GST number are not needed', () => {
    expect(missingProfileSteps({ name: 'Swayamvar Hall', logoUrl: 'https://x/logo.png', photoCount: 3 })).toEqual([]);
  });

  test('two photos are not enough', () => {
    expect(missingProfileSteps({ name: 'Swayamvar Hall', logoUrl: 'https://x/logo.png', photoCount: 2 })).toEqual(['photos']);
  });
});
