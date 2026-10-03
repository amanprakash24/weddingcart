'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PARTNER_STATUSES,
  PARTNER_STATUS_LABEL,
  PAYOUT_STATUSES,
  PAYOUT_STATUS_LABEL,
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  REFERRAL_TYPES,
  REFERRAL_TYPE_LABEL,
  type PartnerStatus,
  type PayoutStatus,
  type ReferralStatus,
  type ReferralType,
} from '@/lib/growthPartner/labels';
import { referralCrmView, referralTarget } from '@/lib/growthPartner/crmLink';
import { STAGE_LABELS, type PipelineStage } from '@/components/crm/types';

// Staff view of the Growth Partner Program (docs/wedding-os/14-growth-partner.md): who is the partner, what did they
// refer, did it convert, what payout is due. A referral is sent once to the CRM (couple) or vendor prospects (venue / vendor) and
// then shows its real stage there; the status and payout are still set by hand.

interface Partner {
  id: string;
  code: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  city: string;
  category: string;
  referralTypes: string[];
  networkNote: string | null;
  status: PartnerStatus;
  staffNotes: string | null;
  createdAt: string;
  _count: { referrals: number };
}
interface Referral {
  id: string;
  type: ReferralType;
  name: string;
  phone: string;
  city: string;
  requirement: string | null;
  notes: string | null;
  status: ReferralStatus;
  payoutStatus: PayoutStatus;
  payoutAmount: number | null;
  staffNotes: string | null;
  createdAt: string;
  partner: { id: string; code: string; name: string; phone: string };
  assignedTo: { id: string; name: string | null } | null;
  consultation: { id: string; pipelineStage: string; wedding: { weddingNumber: string } | null } | null;
  vendorProspect: { id: string; status: string } | null;
}

const stageLabel = (s: string) => STAGE_LABELS[s as PipelineStage] ?? s;

// Where the referral is worked (MASTER-GAP-ANALYSIS §2.4.3): a link to it with its real stage, or the button that sends it there.
function CrmLink({ r, onSaved }: { r: Referral; onSaved: () => void }) {
  const view = referralCrmView(r, stageLabel);
  const target = referralTarget(r.type);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (view) {
    return (
      <a href={view.href} className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
        {view.label} →
      </a>
    );
  }
  if (!target || r.status === 'REJECTED') return null;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/growth-partner-referrals/${r.id}/crm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target === 'CONSULTATION' ? { weddingDate: date, guestCount: guests } : {}) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not add it — please try again');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (target === 'VENDOR_PROSPECT') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={go} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40">
          {busy ? 'Adding…' : 'Add to vendor prospects'}
        </button>
        {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }
  return open ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input type="date" aria-label="Wedding date (optional)" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
      <input inputMode="numeric" aria-label="Guests (optional)" placeholder="Guests" value={guests} onChange={(e) => setGuests(e.target.value)} className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
      <button type="button" disabled={busy} onClick={go} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Adding…' : 'Add to CRM'}</button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-xs text-gray-500">Cancel</button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50">
      Add to CRM
    </button>
  );
}
interface Stats {
  partners: number;
  activePartners: number;
  newReferrals: number;
  converted: number;
  completed: number;
  payoutsDue: number;
  totalPaid: number;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const sel = 'rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm';

async function send(url: string, method: 'PATCH', body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) throw new Error(payload.issues?.[0]?.message ?? payload.error ?? 'Could not save');
  return payload.data;
}

function ReferralRow({ r, reps, onSaved }: { r: Referral; reps: { id: string; name: string | null }[]; onSaved: () => void }) {
  const [status, setStatus] = useState<ReferralStatus>(r.status);
  const [assignedToId, setAssignedToId] = useState(r.assignedTo?.id ?? '');
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>(r.payoutStatus);
  const [payoutAmount, setPayoutAmount] = useState(r.payoutAmount != null ? String(r.payoutAmount) : '');
  const [staffNotes, setStaffNotes] = useState(r.staffNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    status !== r.status || assignedToId !== (r.assignedTo?.id ?? '') || payoutStatus !== r.payoutStatus || payoutAmount !== (r.payoutAmount != null ? String(r.payoutAmount) : '') || staffNotes !== (r.staffNotes ?? '');

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await send(`/api/admin/growth-partner-referrals/${r.id}`, 'PATCH', { status, assignedToId: assignedToId || null, payoutStatus, payoutAmount: payoutAmount === '' ? null : payoutAmount, staffNotes });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="grid gap-2 py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {r.name} <span className="font-normal text-gray-500">· {REFERRAL_TYPE_LABEL[r.type]} · {r.city}</span>
          </p>
          <p className="text-gray-600">
            <a href={`tel:${r.phone}`} className="underline underline-offset-2">{r.phone}</a> · referred by <b>{r.partner.name}</b> ({r.partner.code}) · {day(r.createdAt)}
          </p>
          {(r.requirement || r.notes) && <p className="mt-1 text-gray-600">{[r.requirement, r.notes].filter(Boolean).join(' — ')}</p>}
        </div>
        <CrmLink r={r} onSaved={onSaved} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as ReferralStatus)} aria-label="Referral status">
          {REFERRAL_STATUSES.map((s) => (
            <option key={s} value={s}>{REFERRAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className={sel} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} aria-label="Assigned to">
          <option value="">Unassigned</option>
          {reps.map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? 'Team member'}</option>
          ))}
        </select>
        <select className={sel} value={payoutStatus} onChange={(e) => setPayoutStatus(e.target.value as PayoutStatus)} aria-label="Payout status">
          {PAYOUT_STATUSES.map((s) => (
            <option key={s} value={s}>Payout: {PAYOUT_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input className={`${sel} w-28`} inputMode="numeric" placeholder="Payout ₹" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} aria-label="Payout amount" />
        <input className={`${sel} min-w-[12rem] flex-1`} placeholder="Staff notes" value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} aria-label="Staff notes" />
        <button type="button" disabled={!dirty || busy} onClick={save} className="rounded-lg bg-amber-500 px-3 py-1.5 font-medium text-white disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function GrowthPartnersAdminClient() {
  const [tab, setTab] = useState<'partners' | 'referrals'>('referrals');
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [reps, setReps] = useState<{ id: string; name: string | null }[]>([]);
  const [partnerStatus, setPartnerStatus] = useState('');
  const [city, setCity] = useState('');
  const [refStatus, setRefStatus] = useState('');
  const [refType, setRefType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const pq = new URLSearchParams({ ...(partnerStatus ? { status: partnerStatus } : {}), ...(city.trim() ? { city: city.trim() } : {}) });
    const rq = new URLSearchParams({ ...(refStatus ? { status: refStatus } : {}), ...(refType ? { type: refType } : {}) });
    Promise.all([fetch(`/api/admin/growth-partners?${pq}`).then((r) => r.json()), fetch(`/api/admin/growth-partner-referrals?${rq}`).then((r) => r.json())])
      .then(([p, r]) => {
        if (!p.success || !r.success) throw new Error(p.error ?? r.error ?? 'Failed to load');
        setPartners(p.data.partners);
        setStats(p.data.stats);
        setReferrals(r.data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [partnerStatus, city, refStatus, refType]);

  // Deferred like the other admin panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    fetch('/api/crm/sales-reps')
      .then((r) => r.json())
      .then((b) => b.success && setReps(b.data))
      .catch(() => undefined);
  }, []);

  const updatePartnerStatus = async (id: string, status: PartnerStatus) => {
    try {
      await send(`/api/admin/growth-partners/${id}`, 'PATCH', { status });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cards: [string, string | number][] = stats
    ? [
        ['Partners', stats.partners],
        ['Active (approved)', stats.activePartners],
        ['New referrals', stats.newReferrals],
        ['Converted', stats.converted],
        ['Completed', stats.completed],
        ['Payouts due', rupees(stats.payoutsDue)],
        ['Total paid', rupees(stats.totalPaid)],
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Growth Partners</h1>
        <p className="text-sm text-gray-500">Who is the partner · what did they refer · did it convert · what payout is due. Public page: /growth-partner</p>
      </header>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-xs text-gray-500">{k}</p>
            <p className="text-lg font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {(['referrals', 'partners'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            {t === 'referrals' ? `Referrals (${referrals?.length ?? '…'})` : `Partners (${partners?.length ?? '…'})`}
          </button>
        ))}
      </div>

      {tab === 'referrals' && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <select className={sel} value={refStatus} onChange={(e) => setRefStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {REFERRAL_STATUSES.map((s) => (
                <option key={s} value={s}>{REFERRAL_STATUS_LABEL[s]}</option>
              ))}
            </select>
            <select className={sel} value={refType} onChange={(e) => setRefType(e.target.value)} aria-label="Filter by type">
              <option value="">All types</option>
              {REFERRAL_TYPES.map((t) => (
                <option key={t} value={t}>{REFERRAL_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          {referrals?.length === 0 && <p className="mt-4 text-sm text-gray-500">No referrals yet.</p>}
          <ul className="divide-y divide-gray-100">
            {(referrals ?? []).map((r) => (
              <ReferralRow key={`${r.id}:${r.status}:${r.payoutStatus}:${r.payoutAmount}:${r.assignedTo?.id}`} r={r} reps={reps} onSaved={load} />
            ))}
          </ul>
        </section>
      )}

      {tab === 'partners' && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <select className={sel} value={partnerStatus} onChange={(e) => setPartnerStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {PARTNER_STATUSES.map((s) => (
                <option key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</option>
              ))}
            </select>
            <input className={sel} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city" />
          </div>
          {partners?.length === 0 && <p className="mt-4 text-sm text-gray-500">No partners yet.</p>}
          <ul className="divide-y divide-gray-100">
            {(partners ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {p.name} <span className="font-normal text-gray-500">· {p.code} · {p.city}</span>
                  </p>
                  <p className="text-gray-600">
                    <a href={`tel:${p.phone}`} className="underline underline-offset-2">{p.phone}</a>
                    {p.whatsapp ? ` · WhatsApp ${p.whatsapp}` : ''}
                    {p.email ? ` · ${p.email}` : ''} · {p.category} · refers: {p.referralTypes.join(', ')} · {p._count.referrals} referral(s) · joined {day(p.createdAt)}
                  </p>
                  {p.networkNote && <p className="mt-1 text-gray-600">“{p.networkNote}”</p>}
                </div>
                <select className={sel} value={p.status} onChange={(e) => updatePartnerStatus(p.id, e.target.value as PartnerStatus)} aria-label={`Status for ${p.name}`}>
                  {PARTNER_STATUSES.map((s) => (
                    <option key={s} value={s}>{PARTNER_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
