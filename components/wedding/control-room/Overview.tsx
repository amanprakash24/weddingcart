'use client';

import { AlertTriangle, Check, CircleDashed, X } from 'lucide-react';
import type { ControlRoomView, JourneyStep, PulseCard, Tone, VendorRow } from '@/lib/wedding/controlRoom';
import type { ActionTarget } from '@/lib/wedding/stage';
import NextActionCard, { TARGET_LABEL } from './NextActionCard';
import type { StaffMember } from '@/components/wedding/plan/CoordinatorPicker';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const card = 'rounded-2xl border border-gray-100 bg-white p-4 sm:p-5';
const h2 = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';

const TONE_DOT: Record<Tone, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', neutral: 'bg-gray-300' };
const TONE_TEXT: Record<Tone, string> = { ok: 'text-gray-900', warn: 'text-amber-800', bad: 'text-red-700', neutral: 'text-gray-500' };

// ---- money ---------------------------------------------------------------------------------------------------------------

function Money({ view }: { view: ControlRoomView }) {
  const m = view.money;
  const tiles: { label: string; value: string; note?: string; strong?: boolean }[] =
    m.mode === 'agreement'
      ? [
          { label: 'Total', value: rupees(m.total ?? 0) },
          { label: 'Advance', value: rupees(m.advance ?? 0), note: m.advanceStatus === 'partial' ? `${rupees(m.advancePending)} pending` : m.advanceStatus === 'paid' ? 'received' : m.advanceStatus === 'notSent' ? 'invoice not sent' : m.advanceStatus === 'notInvoiced' ? 'not invoiced' : m.advanceStatus === 'unpaid' ? 'pending' : undefined },
          { label: 'Received', value: rupees(m.received), strong: true },
          { label: 'Balance', value: rupees(m.balance ?? 0), note: 'after the advance' },
        ]
      : m.mode === 'invoices'
        ? [
            { label: 'Invoiced', value: rupees(m.total ?? 0) },
            { label: 'Received', value: rupees(m.received), strong: true },
            { label: 'Pending', value: rupees(m.stillToCome) },
          ]
        : [];

  return (
    <section aria-label="Money" className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={h2}>Money</h2>
        {m.quotationNumber && <span className="text-[11px] text-gray-400">as agreed in {m.quotationNumber}</span>}
      </div>
      {tiles.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{m.headline}</p>
      ) : (
        <>
          <dl className={`mt-3 grid grid-cols-1 gap-2 ${tiles.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            {tiles.map((t) => (
              <div key={t.label} className={`rounded-xl p-3 ${t.strong ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <dt className="text-[11px] uppercase tracking-wide text-gray-500">{t.label}</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 sm:text-xl">{t.value}</dd>
                {t.note && <dd className="text-[11px] text-gray-500">{t.note}</dd>}
              </div>
            ))}
          </dl>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`${Math.round(m.progress * 100)}% received`}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(m.progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-gray-700">{m.headline}</p>
        </>
      )}
    </section>
  );
}

// ---- pulse ---------------------------------------------------------------------------------------------------------------

function Pulse({ cards, onOpen }: { cards: PulseCard[]; onOpen: (t: ActionTarget) => void }) {
  return (
    <section aria-label="Wedding pulse">
      <h2 className={`${h2} mb-2`}>Wedding pulse</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <button key={c.key} type="button" onClick={() => onOpen(c.target)} className="rounded-2xl border border-gray-100 bg-white p-3 text-left hover:border-gray-300 sm:p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-400">
              <span className={`h-2 w-2 rounded-full ${TONE_DOT[c.tone]}`} aria-hidden /> {c.label}
            </div>
            <div className={`mt-1 text-sm font-semibold sm:text-base ${TONE_TEXT[c.tone]}`}>{c.value}</div>
            {c.detail && <div className="mt-0.5 truncate text-xs text-gray-500">{c.detail}</div>}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---- journey -------------------------------------------------------------------------------------------------------------

function Journey({ steps }: { steps: JourneyStep[] }) {
  return (
    <section aria-label="Wedding journey" className={card}>
      <h2 className={h2}>Journey</h2>
      <ol className="mt-3 grid grid-cols-5 gap-1">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-col items-center text-center" aria-current={s.state === 'current' ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : s.state === 'todo' ? 'bg-gray-200' : 'bg-gray-800'}`} />
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${s.state === 'done' ? 'border-gray-800 bg-gray-800 text-white' : s.state === 'current' ? 'border-amber-500 bg-amber-100 text-amber-800 ring-4 ring-amber-100' : 'border-gray-200 bg-white text-gray-300'}`}>
                {s.state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'bg-transparent' : steps[i + 1].state === 'todo' ? 'bg-gray-200' : 'bg-gray-800'}`} />
            </div>
            <span className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${s.state === 'current' ? 'font-bold text-gray-900' : s.state === 'done' ? 'font-medium text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---- needs attention -----------------------------------------------------------------------------------------------------

function Attention({ view, onOpen }: { view: ControlRoomView; onOpen: (t: ActionTarget) => void }) {
  return (
    <section aria-label="Needs attention" className={card}>
      <h2 className={h2}>Needs attention</h2>
      {view.attention.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" aria-hidden /> Nothing needs attention right now.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {view.attention.map((a) => (
            <li key={`${a.kind}-${a.title}`} className="flex items-start justify-between gap-3 rounded-xl bg-amber-50/70 px-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  {a.detail && <p className="text-xs text-gray-500">{a.detail}</p>}
                </div>
              </div>
              {a.target !== 'overview' && (
                <button type="button" onClick={() => onOpen(a.target)} className="shrink-0 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50">
                  {TARGET_LABEL[a.target]}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- today / upcoming ----------------------------------------------------------------------------------------------------

function TodayUpcoming({ view }: { view: ControlRoomView }) {
  const { todayItems, upcomingItems } = view;
  return (
    <section aria-label="Today and upcoming" className={card}>
      <h2 className={h2}>Today</h2>
      {todayItems.length === 0 ? <p className="mt-2 text-sm text-gray-500">Nothing scheduled for today.</p> : (
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm text-gray-800">{todayItems.map((i, k) => <li key={k} className="flex gap-2"><span className="text-gray-400">{i.kind === 'function' ? '●' : '○'}</span>{i.label}</li>)}</ul>
      )}
      {view.tasks.overdue > 0 && <p className="mt-2 text-sm font-medium text-red-700">{view.tasks.overdue} {view.tasks.overdue === 1 ? 'task is' : 'tasks are'} overdue.</p>}
      <h2 className={`${h2} mt-4`}>Upcoming</h2>
      {upcomingItems.length === 0 ? <p className="mt-2 text-sm text-gray-500">Nothing dated coming up.</p> : (
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm text-gray-800">
          {upcomingItems.map((i, k) => <li key={k} className="flex justify-between gap-3"><span>{i.label}</span><span className="shrink-0 text-gray-500">{i.when}</span></li>)}
        </ul>
      )}
    </section>
  );
}

// ---- functions & vendors -------------------------------------------------------------------------------------------------

function Functions({ view }: { view: ControlRoomView }) {
  return (
    <section aria-label="Functions" className={card}>
      <h2 className={h2}>Functions</h2>
      {view.functions.length === 0 ? <p className="mt-3 text-sm text-gray-500">No functions added yet.</p> : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {view.functions.map((f) => (
            <li key={f.id} className={`rounded-xl px-3 py-2 ${f.isToday ? 'bg-rose-50' : 'bg-gray-50'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900">{f.name}</span>
                <span className="shrink-0 text-sm text-gray-600">{f.isToday ? 'Today' : f.dateShort}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 text-xs text-gray-500">
                <span>{f.place ?? 'Place not set'}</span>
                <span>{f.services}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const VENDOR_ICON: Record<VendorRow['state'], React.ReactNode> = {
  confirmed: <Check className="h-4 w-4 text-emerald-600" aria-label="Confirmed" />,
  pending: <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Pending" />,
  declined: <X className="h-4 w-4 text-red-600" aria-label="Declined" />,
  unassigned: <CircleDashed className="h-4 w-4 text-gray-400" aria-label="Not assigned" />,
};
const VENDOR_WORD: Record<VendorRow['state'], string> = { confirmed: 'confirmed', pending: 'awaiting confirmation', declined: 'declined', unassigned: 'no vendor yet' };

function Vendors({ view }: { view: ControlRoomView }) {
  const real = view.vendors.filter((v) => v.state !== 'unassigned').length;
  return (
    <section aria-label="Vendors" className={card}>
      <h2 className={h2}>{view.vendors.length === 0 ? 'Vendors' : `${view.vendors.length} ${view.vendors.length === 1 ? 'service' : 'services'}${real !== view.vendors.length ? ` · ${real} with a vendor` : ''}`}</h2>
      {view.vendors.length === 0 ? <p className="mt-3 text-sm text-gray-500">No vendors or services yet.</p> : (
        <ul className="mt-3 grid grid-cols-1 gap-1.5">
          {view.vendors.map((v) => (
            <li key={v.key} className="flex items-center gap-2 text-sm">
              <span className="shrink-0">{VENDOR_ICON[v.state]}</span>
              <span className="min-w-0 truncate text-gray-900"><span className="font-medium">{v.state === 'unassigned' ? v.name : v.category}</span>{v.state !== 'unassigned' && <span className="text-gray-500"> · {v.name}</span>}</span>
              <span className="ml-auto shrink-0 text-xs text-gray-500">{VENDOR_WORD[v.state]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- the page ------------------------------------------------------------------------------------------------------------

export default function Overview({
  view, staff, coordinatorId, onAssignCoordinator, onOpen, onTransition,
}: {
  view: ControlRoomView;
  staff: StaffMember[];
  coordinatorId: string | null;
  onAssignCoordinator: (coordinatorId: string | null) => Promise<void>;
  onOpen: (target: ActionTarget) => void;
  onTransition: (to: 'COMPLETED' | 'PLANNING') => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <NextActionCard view={view} staff={staff} coordinatorId={coordinatorId} onAssignCoordinator={onAssignCoordinator} onOpen={onOpen} onTransition={onTransition} />
      <Money view={view} />
      <Pulse cards={view.pulse} onOpen={onOpen} />
      <Journey steps={view.journey} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Attention view={view} onOpen={onOpen} />
        <TodayUpcoming view={view} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Functions view={view} />
        <Vendors view={view} />
      </div>
    </div>
  );
}
