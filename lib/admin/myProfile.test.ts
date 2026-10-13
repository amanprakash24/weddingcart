/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { checkProfile, initials, isOwnUpload } from './myProfile';

const CLOUD = 'democloud';
const OURS = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/shaadishopping/abc.jpg`;

describe('My profile — what may be saved', () => {
  test('name is tidied and required when sent; designation may be emptied', () => {
    expect(checkProfile({ name: '  Anisha   Kumari ', designation: ' Founder  & CEO ' }, CLOUD)).toEqual({ ok: true, value: { name: 'Anisha Kumari', designation: 'Founder & CEO' } });
    expect(checkProfile({ name: ' ' }, CLOUD)).toEqual({ ok: false, errors: { name: expect.any(String) } });
    expect(checkProfile({ name: 'x'.repeat(81) }, CLOUD)).toEqual({ ok: false, errors: { name: expect.any(String) } });
    expect(checkProfile({ designation: '   ' }, CLOUD)).toEqual({ ok: true, value: { designation: null } });
    expect(checkProfile({ designation: 'x'.repeat(61) }, CLOUD)).toEqual({ ok: false, errors: { designation: expect.any(String) } });
  });

  test('only what is sent is changed', () => {
    expect(checkProfile({}, CLOUD)).toEqual({ ok: true, value: {} });
    expect(checkProfile({ photoUrl: null }, CLOUD)).toEqual({ ok: true, value: { photoUrl: null } });
  });

  test('a photo is one of our own uploads — never a link to somewhere else', () => {
    expect(checkProfile({ photoUrl: OURS }, CLOUD)).toEqual({ ok: true, value: { photoUrl: OURS } });
    for (const bad of ['https://evil.example/x.jpg', `http://res.cloudinary.com/${CLOUD}/image/upload/x.jpg`, 'https://res.cloudinary.com/someone-else/image/upload/x.jpg', `https://res.cloudinary.com.evil.example/${CLOUD}/image/upload/x.jpg`, 'javascript:alert(1)', 42]) {
      expect(checkProfile({ photoUrl: bad }, CLOUD)).toEqual({ ok: false, errors: { photoUrl: expect.any(String) } });
    }
    expect(isOwnUpload(OURS, undefined)).toBe(false); // no cloud configured: nothing is ours
  });

  test('initials where there is no photo', () => {
    expect(initials('Anisha Kumari')).toBe('AK');
    expect(initials('  gaurav  ')).toBe('G');
    expect(initials('A B C')).toBe('AC');
    expect(initials(null)).toBe('?');
  });
});
