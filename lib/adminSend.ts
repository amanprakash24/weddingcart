// Sends one admin save / delete and says plainly whether it worked. The old /admin screen (components/AdminClient.tsx) used to
// fire these and move on: a refused or failed save closed the form and the work was lost with nothing on screen.
// Pure apart from fetch, so the wording is unit-tested.

export type SendResult = { ok: true; data: unknown } | { ok: false; message: string };

export const SEND_MESSAGES = {
  offline: 'Could not reach the server — check the internet connection and try again. Nothing was saved.',
  signedOut: 'Your sign-in has ended — please sign in again, then retry. Nothing was saved.',
  notAllowed: 'Your login is not allowed to do this. Nothing was saved.',
  failed: 'That did not save — please try again. If it keeps happening, tell the team.',
} as const;

// The words to show for a reply that was not a success. The server's own sentence wins when it sent one (handleApiError
// writes them for people); otherwise a plain one chosen by the status.
export function failureMessage(status: number, body: unknown): string {
  const b = body && typeof body === 'object' ? (body as { error?: unknown; message?: unknown }) : {};
  const own = typeof b.error === 'string' && b.error.trim() ? b.error : typeof b.message === 'string' && b.message.trim() ? b.message : '';
  // A bare "Unauthorized" / "Forbidden" from older routes is not a sentence a person can act on.
  if (status === 401) return own && !/^unauthori[sz]ed$/i.test(own) ? own : SEND_MESSAGES.signedOut;
  if (status === 403) return own && !/^forbidden$/i.test(own) ? own : SEND_MESSAGES.notAllowed;
  return own || SEND_MESSAGES.failed;
}

export async function adminSend(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, message: SEND_MESSAGES.offline };
  }
  const data: unknown = await res.json().catch(() => null);
  const flagged = data && typeof data === 'object' ? (data as { success?: unknown }).success : undefined;
  if (res.ok && flagged !== false) return { ok: true, data };
  return { ok: false, message: failureMessage(res.status, data) };
}
