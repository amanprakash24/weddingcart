// The vendor login code (6 Oct 2026) — pure rules, shared by the server and the forms.
// Shaadi Shopping accepts a registration and issues a 6-digit code; the vendor signs in with the registered mobile number + that
// code, and may change it. Only a hash is stored (services/vendorLoginCode.service.ts). No Node imports here: the vendor's screens
// use these rules too. The random source is passed in by the server (crypto.randomInt).

export const LOGIN_CODE_LENGTH = 6;
// After this long the dashboard reminds the vendor to change the code. A reminder only — the vendor is never locked out for it.
export const LOGIN_CODE_REMINDER_DAYS = 30;

const WELL_FORMED = /^\d{6}$/;

export const isWellFormedCode = (code: unknown): code is string => typeof code === 'string' && WELL_FORMED.test(code);

// The mobile number as it is stored on the login: 10 digits, starting 6–9. Accepts what people type ("+91 98765 43210", "098765…").
export function normalizeMobile(input: unknown): string | null {
  const digits = (typeof input === 'string' ? input : '').replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

// Codes anyone would try first: one digit repeated, or a straight run up or down (123456, 654321, 012345 …).
export function isGuessableCode(code: string): boolean {
  if (/^(\d)\1{5}$/.test(code)) return true;
  const steps = [...code].slice(1).map((d, i) => Number(d) - Number(code[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

// A code Shaadi Shopping issues: uniformly random, never one of the guessable ones.
export function generateLoginCode(random: (max: number) => number): string {
  for (;;) {
    const code = String(random(1_000_000)).padStart(LOGIN_CODE_LENGTH, '0');
    if (!isGuessableCode(code)) return code;
  }
}

export type NewCodeErrors = Partial<Record<'current' | 'next' | 'confirm', string>>;

// The vendor changing their own code: the sentence for each box that is wrong, or null when all three are fine.
export function validateCodeChange(input: { current?: unknown; next?: unknown; confirm?: unknown }): NewCodeErrors | null {
  const errors: NewCodeErrors = {};
  if (!isWellFormedCode(input.current)) errors.current = 'Enter your current 6-digit code';
  if (!isWellFormedCode(input.next)) errors.next = 'Choose a code of exactly 6 digits';
  else if (isGuessableCode(input.next)) errors.next = 'That code is too easy to guess — please choose another';
  else if (input.next === input.current) errors.next = 'Choose a code different from your current one';
  if (!errors.next && input.confirm !== input.next) errors.confirm = 'The two new codes do not match';
  return Object.keys(errors).length ? errors : null;
}

// Is it time to remind the vendor? Never for a login that has no code.
export function codeNeedsReminder(setAt: Date | null | undefined, now: Date): boolean {
  return !!setAt && now.getTime() - setAt.getTime() >= LOGIN_CODE_REMINDER_DAYS * 86_400_000;
}
