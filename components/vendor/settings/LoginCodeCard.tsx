'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { LOGIN_CODE_REMINDER_DAYS, type NewCodeErrors } from '@/lib/auth/vendorCode';

// "Login code" in Settings (6 Oct 2026): the vendor changes the 6-digit code they sign in with. They stay signed in here; the new
// code is what they use next time. A vendor with no code yet (an older login) is told how to get one.
type Status = { hasCode: boolean; setAt: string | null; reminder: boolean };

const big = 'flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-semibold disabled:opacity-50';
const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
const dateWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

export default function LoginCodeCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<NewCodeErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/login-code')
      .then((r) => r.json())
      .then((b) => live && b.success && setStatus(b.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch('/api/vendor-os/login-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setErrors({});
        setForm({ current: '', next: '', confirm: '' });
        setStatus({ hasCode: true, setAt: new Date().toISOString(), reminder: false });
        setDone(true);
      } else {
        setErrors(b.fieldErrors ?? {});
        setError(b.fieldErrors ? null : (b.error ?? 'Something went wrong. Your code was not changed — please try again.'));
      }
    } catch {
      setError('Could not reach Vivah OS. Your code was not changed — please check your connection.');
    }
    setBusy(false);
  }

  if (!status) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-playfair text-lg font-bold text-[var(--color-text-primary)]">Login code</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {status.hasCode
            ? `The 6-digit code you sign in with.${status.setAt ? ` Last changed ${dateWords(status.setAt)}.` : ''} We suggest changing it every ${LOGIN_CODE_REMINDER_DAYS} days.`
            : 'You do not have a login code yet. Please call Shaadi Shopping and we will give you one.'}
        </p>
      </div>

      {status.hasCode && (
        <>
          <Input label="Current code" type="password" inputMode="numeric" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: onlyDigits(e.target.value) })} error={errors.current} className="min-h-12 text-base tracking-[0.3em]" />
          <Input label="New code" type="password" inputMode="numeric" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: onlyDigits(e.target.value) })} error={errors.next} helperText="6 digits. Not 111111 or 123456." className="min-h-12 text-base tracking-[0.3em]" />
          <Input label="New code again" type="password" inputMode="numeric" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: onlyDigits(e.target.value) })} error={errors.confirm} className="min-h-12 text-base tracking-[0.3em]" />
          {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
          {done && <p role="status" className="text-sm text-[var(--color-success-text)]">Your login code is changed. Use the new code the next time you sign in.</p>}
          <button type="button" onClick={save} disabled={busy || form.current.length !== 6 || form.next.length !== 6 || form.confirm.length !== 6} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>
            {busy ? 'Changing…' : 'Change login code'}
          </button>
        </>
      )}
    </Card>
  );
}
