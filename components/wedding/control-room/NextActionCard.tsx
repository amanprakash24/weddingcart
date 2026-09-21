'use client';

import { ArrowRight } from 'lucide-react';
import type { ControlRoomView } from '@/lib/wedding/controlRoom';
import type { ActionTarget } from '@/lib/wedding/stage';
import CoordinatorPicker, { type StaffMember } from '@/components/wedding/plan/CoordinatorPicker';

export const TARGET_LABEL: Record<ActionTarget, string> = {
  overview: 'Overview',
  plan: 'Plan',
  functions: 'Functions & Services',
  money: 'Money',
  people: 'People',
};

// The one thing to do next — the first item of the same list "Needs attention" shows. The button goes where the work is done; the
// wedding's own transitions (complete, resume) are offered right here when they are the next action.
export default function NextActionCard({
  view, staff, coordinatorId, onAssignCoordinator, onOpen, onTransition,
}: {
  view: ControlRoomView;
  staff: StaffMember[];
  coordinatorId: string | null;
  onAssignCoordinator: (coordinatorId: string | null) => Promise<void>;
  onOpen: (target: ActionTarget) => void;
  onTransition: (to: 'COMPLETED' | 'PLANNING') => Promise<void>;
}) {
  const { next } = view;
  const more = view.attention.filter((a) => a.kind !== next.kind || a.title !== next.title).length;
  const calm = next.kind === 'ON_TRACK' || next.kind === 'NOTHING_TO_DO';
  const own = next.kind === 'CLOSE_WEDDING' ? { label: 'Mark as completed', run: () => onTransition('COMPLETED') } : next.kind === 'RESUME_WEDDING' ? { label: 'Resume planning', run: () => onTransition('PLANNING') } : null;
  const goes = !own && next.target !== 'overview' ? next.target : null;

  return (
    <section
      aria-label="Next action"
      className={`rounded-2xl border p-4 sm:p-6 ${calm ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Next action</p>
      <h2 className="mt-1 font-[Playfair_Display,serif] text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">{next.title}</h2>
      {next.detail && <p className="mt-1 text-sm text-gray-600">{next.detail}</p>}
      {more > 0 && <p className="mt-2 text-xs text-gray-500">{more} more {more === 1 ? 'thing needs' : 'things need'} attention — see below.</p>}
      {next.kind === 'MISSING_COORDINATOR' && (
        <div className="mt-4 max-w-md">
          <CoordinatorPicker current={coordinatorId} staff={staff} onAssign={onAssignCoordinator} label="Assign coordinator" />
        </div>
      )}
      {own && (
        <button type="button" onClick={own.run} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
          {own.label} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
      {goes && (
        <button type="button" onClick={() => onOpen(goes)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
          Open {TARGET_LABEL[goes]} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
