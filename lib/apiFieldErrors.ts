// Turns the `issues` array that handleApiError() (lib/errors.ts) attaches to a
// 400 "Invalid request" response into one readable message per form field.
//
// The onboarding form used to show only `data.error` — the generic "Invalid
// request" — so nobody could tell which field was wrong. Pure so it can be
// unit-tested without a DOM.

export type FieldErrors = Record<string, string>;

interface RawIssue {
  path?: unknown;
  code?: unknown;
  message?: unknown;
}

// First issue per top-level field wins. `labels` maps a field name to the
// human label used in generic messages; unknown fields fall back to the name.
export function extractFieldErrors(payload: unknown, labels: Record<string, string> = {}): FieldErrors {
  const issues = (payload as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(issues)) return {};

  const errors: FieldErrors = {};
  for (const raw of issues as RawIssue[]) {
    const field = Array.isArray(raw?.path) && raw.path.length > 0 ? String(raw.path[0]) : null;
    if (!field || errors[field]) continue;

    const label = labels[field] ?? field;
    const message = typeof raw.message === 'string' ? raw.message : '';
    // "Too small" / "expected string, received undefined" are how a required
    // field reads to Zod; say it the way a person would.
    if (raw.code === 'too_small' || raw.code === 'invalid_type') {
      errors[field] = `${label} is required`;
    } else if (message) {
      errors[field] = message;
    } else {
      errors[field] = `${label} is not valid`;
    }
  }
  return errors;
}

// Pulls the failing field names out for a one-line summary above the form.
export function summarizeFieldErrors(errors: FieldErrors, labels: Record<string, string> = {}): string {
  const fields = Object.keys(errors);
  if (fields.length === 0) return '';
  return `Please fix: ${fields.map((f) => labels[f] ?? f).join(', ')}.`;
}
