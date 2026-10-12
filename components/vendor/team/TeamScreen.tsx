'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import StatusPill from '@/components/ui/StatusPill';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/lib/auth/permissions';
import { whatsappTo } from '@/lib/venue/enquiry';
import { loginMessage, ROLE_HELP, TEAM_LIMITS, type AddResult, type TeamErrors, type TeamMemberView, type TeamView } from '@/lib/venue/team';

// "Team" in Vendor OS (lib/venue/team.ts): the people who work in the business. The owner adds someone by name and mobile number,
// gives a role (Manager or Employee), a job title, and says whether they may see money. A new person's 6-digit code is shown here
// ONCE, with a ready WhatsApp message the owner sends from their own phone. Loaded and saved through /api/vendor-os/team.

type Form = { name: string; mobile: string; role: MemberRole; jobTitle: string; seesMoney: boolean };
const BLANK: Form = { name: '', mobile: '', role: 'MANAGER', jobTitle: '', seesMoney: false };

function RolePicker({ roles, value, onChange }: { roles: readonly MemberRole[]; value: MemberRole; onChange: (r: MemberRole) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-[var(--color-text-primary)]">Role</legend>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((r) => (
          <label key={r} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold ${value === r ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-[var(--color-border-default)] text-[var(--color-text-primary)]'}`}>
            <input type="radio" name="role" value={r} checked={value === r} onChange={() => onChange(r)} className="sr-only" />
            {MEMBER_ROLE_LABELS[r]}
          </label>
        ))}
      </div>
      {ROLE_HELP[value] && <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{ROLE_HELP[value]}</p>}
    </fieldset>
  );
}

function MoneySwitch({ checked, onChange, disabled, error }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean; error?: string }) {
  return (
    <div>
      <label className={`flex min-h-11 items-center gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
        <span className="text-sm text-[var(--color-text-primary)]">Can see money — payments received, amounts due and totals</span>
      </label>
      {error && <p className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </div>
  );
}

function Added({ result, businessName, onDone }: { result: AddResult; businessName: string; onDone: () => void }) {
  const m = result.member;
  const name = m.name ?? 'They';
  return (
    <Card className="space-y-3 border-2 border-[var(--color-success-text)]">
      <p className="text-base font-semibold text-[var(--color-text-primary)]">{name} is in your team</p>
      {result.kind === 'NEW_LOGIN' && (
        <>
          <p className="text-sm text-[var(--color-text-secondary)]">Their login code — shown only now. Send it to them, then close this.</p>
          <p className="text-center text-3xl font-bold tracking-[0.3em] tabular-nums text-[var(--color-text-primary)]" aria-label={`Login code ${result.code.split('').join(' ')}`}>
            {result.code}
          </p>
          <a
            href={whatsappTo(m.mobile ?? '', loginMessage({ businessName, personName: name, mobile: m.mobile ?? '', code: result.code, site: window.location.origin }))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-lg bg-[#25D366] text-sm font-semibold text-white"
          >
            Send it on WhatsApp
          </a>
        </>
      )}
      {result.kind === 'EXISTING_LOGIN' && <p className="text-sm text-[var(--color-text-secondary)]">This number already signs in to Vivah OS. They use their own code and will see {businessName} when they sign in.</p>}
      {result.kind === 'NEEDS_CODE' && (
        <p className="text-sm text-[var(--color-text-secondary)]">This number already has a Shaadi Shopping account, but no login code. Ask Shaadi Shopping to give them one — then they will see {businessName} when they sign in.</p>
      )}
      <Button className="min-h-11 w-full" variant="outline" onClick={onDone}>
        {result.kind === 'NEW_LOGIN' ? 'I have sent the code — close' : 'Close'}
      </Button>
    </Card>
  );
}

function MemberCard({ m, team, onChanged, onRemoved }: { m: TeamMemberView; team: TeamView; onChanged: (m: TeamMemberView) => void; onRemoved: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [form, setForm] = useState({ role: m.role, jobTitle: m.jobTitle ?? '', seesMoney: m.seesMoney });
  const [errors, setErrors] = useState<TeamErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: 'PATCH' | 'DELETE') => {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/vendor-os/team/${m.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'PATCH' ? JSON.stringify(form) : undefined });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setErrors(body.fieldErrors ?? {});
        setError(body.fieldErrors ? null : (body.error ?? 'That did not go through — please try again'));
        return;
      }
      if (method === 'DELETE') onRemoved(m.id);
      else {
        onChanged(body.data);
        setEditing(false);
      }
    } catch {
      setError('No connection — please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="border-b border-[var(--color-border-subtle)] py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {m.name ?? 'No name yet'}
            {m.isYou && <span className="font-normal text-[var(--color-text-muted)]"> (you)</span>}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{[m.jobTitle, m.mobile].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <StatusPill status={m.role === 'OWNER' ? 'confirmed' : 'neutral'}>{MEMBER_ROLE_LABELS[m.role]}</StatusPill>
          {m.seesMoney && m.role !== 'OWNER' && <StatusPill status="info">Sees money</StatusPill>}
        </div>
      </div>

      {m.canChange && !editing && !confirmRemove && (
        <div className="mt-2 flex gap-4 text-sm font-semibold">
          <button type="button" className="min-h-11 underline underline-offset-2" onClick={() => setEditing(true)}>
            Change
          </button>
          <button type="button" className="min-h-11 text-[var(--color-danger-text)] underline underline-offset-2" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        </div>
      )}

      {confirmRemove && (
        <div className="mt-2 space-y-2 rounded-lg bg-[var(--color-danger-bg)] p-3">
          <p className="text-sm text-[var(--color-text-primary)]">Remove {m.name ?? 'this person'}? They will not be able to open {team.businessName} any more. What they did stays, with their name.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-11" variant="danger" disabled={busy} onClick={() => call('DELETE')}>
              {busy ? 'Removing…' : 'Remove'}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-3">
          <RolePicker roles={team.roles} value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Input label="Job title (optional)" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} error={errors.jobTitle} maxLength={TEAM_LIMITS.jobTitleMax} className="min-h-12 text-base" />
          <MoneySwitch checked={form.seesMoney} disabled={!team.canGiveMoney} onChange={(seesMoney) => setForm({ ...form, seesMoney })} error={errors.seesMoney} />
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-11" disabled={busy} onClick={() => call('PATCH')}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger-text)]">{error}</p>}
    </li>
  );
}

export default function TeamScreen() {
  const [team, setTeam] = useState<TeamView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>(BLANK);
  const [errors, setErrors] = useState<TeamErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<AddResult | null>(null);

  const load = useCallback(() => {
    fetch('/api/vendor-os/team')
      .then((r) => r.json())
      .then((b) => (b.success ? setTeam(b.data) : setLoadError(b.error ?? 'Your team could not be loaded')))
      .catch(() => setLoadError('Your team could not be loaded — please check your connection'));
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await fetch('/api/vendor-os/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setErrors(body.fieldErrors ?? {});
        setError(body.fieldErrors ? null : (body.error ?? 'That did not go through — please try again'));
        return;
      }
      setAdded(body.data);
      setAdding(false);
      setForm(BLANK);
      setTeam((t) => (t ? { ...t, members: [...t.members, body.data.member] } : t));
    } catch {
      setError('No connection — please try again');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Card><p className="text-sm text-[var(--color-text-secondary)]">{loadError}</p></Card>;
  if (!team) return <CardSkeleton lines={5} />;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Team</h1>
        <p className="text-sm text-[var(--color-text-muted)]">The people who work in {team.businessName}. Each signs in with their own mobile number and their own code.</p>
      </header>

      {added && <Added result={added} businessName={team.businessName} onDone={() => setAdded(null)} />}

      <Card className="!py-1">
        <ul>
          {team.members.map((m) => (
            <MemberCard
              key={m.id}
              m={m}
              team={team}
              onChanged={(next) => setTeam((t) => (t ? { ...t, members: t.members.map((x) => (x.id === next.id ? next : x)) } : t))}
              onRemoved={(id) => setTeam((t) => (t ? { ...t, members: t.members.filter((x) => x.id !== id) } : t))}
            />
          ))}
        </ul>
      </Card>

      {!adding && !added && (
        <Button className="min-h-12 w-full" onClick={() => setAdding(true)}>
          Add a person
        </Button>
      )}

      {adding && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Add a person</h2>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={TEAM_LIMITS.nameMax} autoComplete="off" className="min-h-12 text-base" />
          <Input label="Mobile number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} error={errors.mobile} inputMode="tel" placeholder="98765 43210" helperText="They sign in with this number." className="min-h-12 text-base" />
          <RolePicker roles={team.roles} value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Input label="Job title (optional)" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} error={errors.jobTitle} maxLength={TEAM_LIMITS.jobTitleMax} placeholder="e.g. Event coordinator" className="min-h-12 text-base" />
          <MoneySwitch checked={form.seesMoney} disabled={!team.canGiveMoney} onChange={(seesMoney) => setForm({ ...form, seesMoney })} error={errors.seesMoney} />
          {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-11" disabled={busy} onClick={add}>
              {busy ? 'Adding…' : 'Add'}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => (setAdding(false), setErrors({}), setError(null))}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
