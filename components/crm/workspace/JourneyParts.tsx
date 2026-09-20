'use client';

import { Check, X } from 'lucide-react';
import type { JourneyStep, NextAction, SecondaryActionId, StatusChip as Chip, Tone } from '@/lib/crm/leadJourney';

// The visual pieces of the Lead Workspace journey: the three status chips, the five-step strip and the Next-action
// card. They only display what lib/crm/leadJourney.ts worked out — no decisions are made here.

const TONE_CLASS: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  sky: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-slate-200 text-slate-700',
  dashed: 'border border-dashed border-gray-300 text-gray-500',
};

export function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-center text-[11.5px] font-bold leading-tight sm:whitespace-nowrap sm:text-xs ${TONE_CLASS[chip.tone]}`}>
      {chip.label}
    </span>
  );
}

// Quotation / Lead / Booking are three different facts and are always shown as three separate labelled chips.
export function StatusTrio({ quotation, lead, booking }: { quotation: Chip; lead: Chip; booking: Chip }) {
  const item = (label: string, chip: Chip) => (
    <div className="grid gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <StatusChip chip={chip} />
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2" aria-label="Where this deal stands">
      {item('Quotation', quotation)}
      {item('Lead', lead)}
      {item('Booking', booking)}
    </div>
  );
}

const NODE_CLASS: Record<JourneyStep['status'], string> = {
  done: 'border-gray-900 bg-gray-900 text-white',
  ok: 'border-emerald-600 bg-emerald-600 text-white',
  current: 'border-amber-500 bg-amber-100 text-amber-800 ring-4 ring-amber-500/20',
  upcoming: 'border-gray-200 bg-white text-gray-400',
  stopped: 'border-slate-300 bg-slate-200 text-slate-600',
};
const CONNECTOR_CLASS: Record<JourneyStep['status'], string> = {
  done: 'bg-gray-900',
  ok: 'bg-emerald-600',
  current: 'bg-gray-900',
  upcoming: 'bg-gray-200',
  stopped: 'bg-[repeating-linear-gradient(90deg,#c6cbd6_0_5px,transparent_5px_9px)]',
};

export function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-2 py-4 sm:px-5">
      <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 sm:px-0">Journey</div>
      <ol className="grid grid-cols-5">
        {steps.map((step, i) => (
          <li key={step.key} className="relative grid justify-items-center gap-1.5 px-1 text-center" aria-current={step.status === 'current' ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className={`absolute left-[-50%] top-[13px] h-0.5 w-full sm:top-[15px] ${CONNECTOR_CLASS[step.status]}`} />}
            <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold sm:h-8 sm:w-8 ${NODE_CLASS[step.status]}`}>
              {step.status === 'done' || step.status === 'ok' ? <Check className="h-4 w-4" /> : step.status === 'stopped' ? <X className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-[11.5px] font-bold leading-tight sm:text-[12.5px] ${step.status === 'upcoming' || step.status === 'stopped' ? 'text-gray-400' : 'text-gray-900'}`}>{step.label}</span>
            {step.sub && <span className={`hidden text-[11.5px] leading-tight sm:block ${step.status === 'stopped' ? 'text-slate-600' : 'text-gray-500'}`}>{step.sub}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// One prominent action. On a phone the button lives in the sticky bar instead (see LeadWorkspaceClient), so it is hidden here.
export function NextActionCard({
  action,
  busy,
  onPrimary,
  onSecondary,
  reasonPanel,
}: {
  action: NextAction;
  busy: boolean;
  onPrimary: () => void;
  onSecondary: (id: SecondaryActionId) => void;
  reasonPanel: React.ReactNode;
}) {
  const surface = action.id === 'manage-wedding' ? 'border-emerald-200 bg-emerald-50' : action.id === 'view-reason' ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50/70';
  return (
    <section aria-label="Next action" className={`grid gap-3 rounded-2xl border p-5 ${surface}`}>
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{action.id === 'view-reason' ? 'Status' : 'Next action'}</div>
        <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">{action.title}</h2>
      </div>
      <p className="text-sm text-gray-700">{action.why}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onPrimary}
        className={`hidden min-h-[52px] items-center justify-center rounded-xl px-5 text-base font-semibold text-white shadow-md transition-opacity disabled:opacity-50 md:inline-flex ${
          action.quiet ? 'bg-gray-900 shadow-none hover:bg-gray-800' : 'bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95'
        }`}
      >
        {busy ? 'Working…' : action.label}
      </button>
      {reasonPanel}
      {action.secondary.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {action.secondary.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => onSecondary(s.id)}
              className={`min-h-[40px] text-sm font-medium underline underline-offset-4 disabled:opacity-40 ${s.danger ? 'text-red-700' : 'text-gray-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
