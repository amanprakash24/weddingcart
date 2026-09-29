/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The site's fonts are self-hosted (app/layout.tsx → next/font/local). A build that downloads fonts from Google fails
// whenever that download fails — this keeps it from coming back.
const APP = join(import.meta.dir, '..');
const layout = readFileSync(join(APP, 'layout.tsx'), 'utf8');
const referenced = [...layout.matchAll(/path:\s*'\.\/(fonts\/[^']+\.woff2)'/g)].map((m) => m[1]);

describe('self-hosted fonts', () => {
  test('the layout never loads fonts from Google at build time', () => {
    expect(layout).not.toMatch(/from ['"]next\/font\/google['"]/);
    expect(layout).toContain("from 'next/font/local'");
  });

  test('every font file the layout uses is in the repo and is a real woff2', () => {
    expect(referenced.sort()).toEqual([
      'fonts/CormorantGaramond-Italic-latin-variable.woff2',
      'fonts/CormorantGaramond-latin-variable.woff2',
      'fonts/DMSans-latin-variable.woff2',
      'fonts/PlayfairDisplay-latin-variable.woff2',
    ]);
    for (const file of referenced) {
      const bytes = readFileSync(join(APP, file));
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2');
    }
  });

  test('the same CSS variables as before, so nothing else on the site changes', () => {
    for (const v of ['--font-playfair', '--font-cormorant', '--font-dm-sans']) expect(layout).toContain(`variable: '${v}'`);
  });

  test('each font ships with its licence (SIL Open Font License)', () => {
    for (const name of ['PlayfairDisplay', 'CormorantGaramond', 'DMSans']) {
      const file = join(APP, 'fonts', `OFL-${name}.txt`);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });
});

// The Playfair font is registered under its own name (next/font), so the literal family name "Playfair Display" never
// matches — anything styled with it shows a fallback serif. Use the .font-playfair class or var(--font-playfair).
describe('Playfair is always referenced through its CSS variable', () => {
  const ROOT = join(APP, '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : walk(full);
      return /\.(tsx?|css)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
    });
  const sources = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)));

  test('no literal Playfair font names in classes, inline styles or CSS rules', () => {
    const offenders = sources.filter((file) => {
      const text = readFileSync(file, 'utf8');
      return /font-\[Playfair_Display/.test(text) || /['"]Playfair Display, serif['"]/.test(text) || /font-family:\s*'Playfair Display'/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  test('the .font-playfair helper uses the variable', () => {
    const css = readFileSync(join(APP, 'globals.css'), 'utf8');
    expect(css).toMatch(/\.font-playfair\s*\{\s*font-family:\s*var\(--font-playfair/);
  });
});
