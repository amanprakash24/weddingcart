'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SourceType } from '@/components/crm/types';
import type { LeadWorkspace } from './types';
import { useRouter } from 'next/navigation';
import LeadWorkspaceHeader from './LeadWorkspaceHeader';
import type { StageTransitionInput } from './StageControl';
import ConvertToWeddingDialog, { type ConvertToWeddingInput } from './ConvertToWeddingDialog';
import ClientCard from './ClientCard';
import VendorInterestPanel from './VendorInterestPanel';
import Timeline from './Timeline';
import TaskPanel from './TaskPanel';
import InsightsPanel from './InsightsPanel';
import QuotationPanel, { type QuotationPanelHandle } from './QuotationPanel';
import WhatsAppCard from './WhatsAppCard';
import { JourneyStepper, NextActionCard } from './JourneyParts';
import { AcceptDialog, BookingDialog, ConfirmBookingDialog, DeclineDialog, NotProceedingDialog } from './JourneyDialogs';
import { useQuotations } from './useQuotations';
import {
  bookingChip,
  deriveJourney,
  journeySteps,
  nextAction,
  pickCurrentQuotation,
  quotationChip,
  type SecondaryActionId,
} from '@/lib/crm/leadJourney';
import { describeLostReason, toStageReason, type NotProceedingKey } from '@/lib/crm/notProceeding';
import { eventDateWords } from '@/lib/crm/eventDate';
import { journeyMessage, whatsappUrl } from '@/lib/crm/journeyMessage';
import { buildFollowUpMessage, buildQuotationMessage, formatQuoteDate } from '@/lib/quotation/message';

async function postJson(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.error ?? 'Request failed');
}

const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', PHONE: 'phone', IN_PERSON: 'in person', OTHER: 'another channel' };
type Dialog = 'accept' | 'decline' | 'booking' | 'confirm' | 'not-proceeding' | 'convert' | null;

export default function LeadWorkspaceClient({ sourceType, id }: { sourceType: SourceType; id: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<LeadWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showReason, setShowReason] = useState(false);
  const [followUps, setFollowUps] = useState(0);
  const panelRef = useRef<QuotationPanelHandle>(null);
  const quoteAnchor = useRef<HTMLDivElement>(null);

  const basePath = `/api/crm/leads/${sourceType}/${id}`;

  // Returns the reload's promise so a caller can wait for the authoritative result before it tells the operator it is done.
  const load = useCallback((): Promise<void> => {
    setLoading(true);
    return fetch(basePath)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Failed to load');
        setWorkspace(body.data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [basePath]);

  // Deferred via setTimeout (matching CrmDashboardClient.tsx's fetchLeads
  // pattern) so the fetch-triggering setState isn't called synchronously
  // within the effect body itself (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const quotesApi = useQuotations({ sourceType, sourceId: id, onChanged: load });
  const current = useMemo(() => pickCurrentQuotation(quotesApi.quotations), [quotesApi.quotations]);

  // Each panel fails independently (per the plan) since the aggregate GET
  // succeeds/fails as one unit and every mutation just reloads that same
  // aggregate — no separate per-panel fetch to go stale or fail alone.
  const addNote = async (detail: string) => {
    await postJson(`${basePath}/notes`, { detail });
    load();
  };
  const addTask = async (title: string) => {
    await postJson(`${basePath}/tasks`, { title });
    load();
  };
  const completeTask = async (taskId: string, status: 'DONE' | 'CANCELLED') => {
    await postJson(`${basePath}/tasks/${taskId}`, { status }, 'PATCH');
    load();
  };
  const transitionStage = async (input: StageTransitionInput) => {
    await postJson(`${basePath}/stage`, input, 'PATCH');
    load();
  };
  const assign = async (assignedToId: string | null) => {
    await postJson(`${basePath}/assign`, { assignedToId }, 'PATCH');
    load();
  };
  // Navigates straight into the new Workspace on success rather than
  // reloading this now-locked one — there's nothing left to do here.
  const convert = async (input: ConvertToWeddingInput) => {
    const res = await fetch(`${basePath}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.error ?? 'Failed to create Wedding Workspace');
    router.push(`/admin/weddings/${payload.data.id}`);
  };

  // Only the initial load blanks the page — a mutation-triggered reload
  // (add note/task, complete task) keeps the current content visible and
  // swaps it in place once the refetch resolves, instead of flashing back
  // to a bare "Loading…" state (which, combined with every /admin page
  // still rendering the public Navbar/Footer, was jumping the scroll
  // position to the footer on every note/task submit).
  if (loading && !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-gray-400 text-sm">Loading…</div>;
  }
  if (error || !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-red-500 text-sm">{error ?? 'Not found'}</div>;
  }

  const { subject, customer, weddingDetails } = workspace;
  const customerName = customer.name ?? customer.phone;
  const state = deriveJourney({ pipelineStage: subject.pipelineStage, hasWedding: !!subject.wedding, quotation: current, sourceType: subject.sourceType });
  const eventDate = eventDateWords(weddingDetails.date);
  const sentOn = current?.sentAt ? formatQuoteDate(current.sentAt) : null;
  const acceptedOn = current?.acceptedAt ? formatQuoteDate(current.acceptedAt) : null;
  const acceptedVia = current?.acceptedChannel ? CHANNEL_LABEL[current.acceptedChannel] ?? current.acceptedChannel : null;
  const lost = describeLostReason(subject.lostReason, subject.lostReasonDetail);
  const closedReason = subject.pipelineStage === 'LOST' ? [lost.label, lost.detail].filter(Boolean).join(' — ') : current?.booking?.status === 'CLOSED' ? 'The booking was closed' : null;
  const weddingNumber = subject.wedding?.weddingNumber ?? null;
  const busy = quotesApi.busyId !== null;
  const canSend = !!current && current.status === 'DRAFT' && current.items.length > 0 && !!current.validUntil && new Date(current.validUntil).getTime() > new Date().getTime();

  const action = nextAction(state, {
    sourceType,
    customerName,
    canSend,
    sentOn,
    validUntil: current?.validUntil ? formatQuoteDate(current.validUntil) : null,
    acceptedOn,
    acceptedVia,
    weddingNumber,
    closedReason,
    followUps,
  });
  const steps = journeySteps(state, current, {
    enquiryOn: formatQuoteDate(subject.createdAt),
    sentOn,
    acceptedOn,
    acceptedVia: acceptedVia ? acceptedVia.charAt(0).toUpperCase() + acceptedVia.slice(1) : null,
    weddingNumber,
  });
  const message = journeyMessage(state, { quotation: current, customerName, eventDate, sentOn, weddingNumber });
  const canOpenWhatsApp = whatsappUrl(customer.phone, '') !== null;

  const scrollToQuote = () => quoteAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ---- what the buttons do (each one only calls an existing route) ----------------------------------------------------

  const sendQuote = async () => {
    if (!current) return;
    const text = buildQuotationMessage(current, customerName, { eventDate });
    const url = whatsappUrl(customer.phone, text);
    // Open the WhatsApp tab straight away (a popup opened after an await is blocked), then point it at the message once the
    // quote has been marked as sent — or close it if the server refused.
    const win = url ? window.open('about:blank', '_blank') : null;
    if (win) win.opener = null;
    const sent = await quotesApi.act(current.id, '/send', undefined, 'Quote marked as sent.');
    if (sent && win && url) {
      win.location.href = url;
    } else {
      win?.close();
      if (sent) {
        try {
          await navigator.clipboard.writeText(text);
          quotesApi.setNotice(url ? 'Quote marked as sent. Your browser blocked WhatsApp, so the message is copied — paste it into WhatsApp.' : 'Quote marked as sent. This number can’t be opened in WhatsApp, so the message is copied — send it yourself.');
        } catch {
          quotesApi.setNotice('Quote marked as sent, but the message could not be copied automatically.');
        }
      }
    }
  };

  const followUp = async () => {
    if (!current) return;
    const text = buildFollowUpMessage(current, customerName, sentOn);
    const url = whatsappUrl(customer.phone, text);
    if (url) window.open(url, '_blank', 'noopener');
    else {
      try {
        await navigator.clipboard.writeText(text);
        quotesApi.setNotice('Follow-up message copied — send it yourself.');
      } catch {
        /* nothing more to do */
      }
    }
    setFollowUps((n) => n + 1);
    try {
      await addNote('Follow-up message sent on WhatsApp');
    } catch (e) {
      quotesApi.setLoadError((e as Error).message);
    }
  };

  // Revise = make an editable copy of the quote, then open it so the prices can be changed straight away.
  const reviseQuote = async () => {
    if (!current) return;
    const done = await quotesApi.act(current.id, '/revise', undefined, 'Revision created. Change the prices below, add a valid-until date, then send it.');
    if (done?.data) {
      panelRef.current?.editRevision(done.data);
      scrollToQuote();
    }
  };

  const sendJourneyMessage = () => {
    if (!message) return;
    if (message.kind === 'follow-up') return void followUp();
    if (message.kind === 'quote') return void sendQuote();
    const url = whatsappUrl(customer.phone, message.text);
    if (url) window.open(url, '_blank', 'noopener');
  };
  const copyMessage = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message.text);
      quotesApi.setNotice('Message copied — paste it into WhatsApp.');
    } catch {
      quotesApi.setNotice('Could not copy automatically — select the text and copy it.');
    }
  };

  const onPrimary = async () => {
    switch (action.id) {
      case 'create-quote':
        panelRef.current?.startCreate();
        scrollToQuote();
        break;
      case 'finish-quote':
        panelRef.current?.startEdit();
        scrollToQuote();
        break;
      case 'send-quote':
        await sendQuote();
        break;
      case 'follow-up':
        await followUp();
        break;
      case 'revise-quote':
        await reviseQuote();
        break;
      case 'create-booking':
        setDialog('booking');
        break;
      case 'mark-booked':
        try {
          await transitionStage({ toStage: 'WON' });
        } catch (e) {
          quotesApi.setLoadError((e as Error).message);
        }
        break;
      case 'confirm-booking':
        setDialog('confirm');
        break;
      case 'manage-wedding':
        if (subject.wedding) router.push(`/admin/weddings/${subject.wedding.id}`);
        break;
      case 'create-wedding':
        setDialog('convert');
        break;
      case 'view-reason':
        setShowReason((v) => !v);
        break;
    }
  };
  const onSecondary = (secondary: SecondaryActionId) => {
    if (secondary === 'revise-quote') return void reviseQuote();
    setDialog(secondary === 'customer-accepted' ? 'accept' : secondary === 'customer-declined' ? 'decline' : 'not-proceeding');
  };

  // ---- dialogs: each resolves to an error message, or null when it worked ---------------------------------------------

  const failure = (fallback: string) => quotesApi.lastError.current ?? fallback;

  const saveAcceptance = async (channel: string, note: string) => {
    if (!current) return 'There is no quote to accept.';
    const done = await quotesApi.act(current.id, '/accept', { channel, note: note.trim() || null }, 'Recorded. This is not a confirmed booking yet — create the booking next.');
    if (!done) return failure('Could not record the acceptance.');
    setDialog(null);
    return null;
  };
  const saveDecline = async (reason: string) => {
    if (!current) return 'There is no quote to decline.';
    const done = await quotesApi.act(current.id, '/reject', { reason });
    if (!done) return failure('Could not record the decline.');
    setDialog(null);
    return null;
  };
  const saveBooking = async (v: { weddingDate: string; guestCount: string; city: string }) => {
    if (!current) return 'There is no accepted quote.';
    const guests = Math.max(0, Math.floor(Number(v.guestCount) || 0));
    const done = await quotesApi.act(
      current.id,
      '/create-booking',
      { weddingDate: v.weddingDate || null, guestCount: guests > 0 ? guests : null, city: v.city || null },
      'Booking created. It is pending until you confirm it.'
    );
    if (!done) return failure('Could not create the booking.');
    setDialog(null);
    return null;
  };
  const saveConfirm = async () => {
    if (!current?.booking) return 'There is no booking to confirm.';
    const done = await quotesApi.setBookingStatus(current.id, current.booking.id, 'confirmed', 'Booking confirmed — the wedding has been set up.');
    if (!done) return failure('Could not confirm the booking. Try again — it is safe to retry.');
    setDialog(null);
    return null;
  };
  const saveNotProceeding = async (key: NotProceedingKey, detail: string) => {
    const chosen = toStageReason(key, detail);
    if ('error' in chosen) return chosen.error;
    // A pending booking is closed first: if closing the lead then failed, nothing is left half-open the other way round.
    const booking = current?.booking;
    let bookingClosed = false;
    if (current && booking && (booking.status === 'NEW' || booking.status === 'CONTACTED')) {
      const closed = await quotesApi.setBookingStatus(current.id, booking.id, 'closed');
      if (!closed) return failure('Could not close the pending booking.');
      bookingClosed = true;
    }
    try {
      await transitionStage({ toStage: 'LOST', reason: chosen.reason, reasonDetail: chosen.reasonDetail });
    } catch (e) {
      return `${bookingClosed ? 'The booking was closed, but the lead could not be: ' : ''}${(e as Error).message}`;
    }
    setDialog(null);
    return null;
  };

  const reasonPanel =
    state === 'NOT_PROCEEDING' && showReason ? (
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
        <b>Reason:</b> {closedReason ?? 'Marked as not proceeding'}
        {acceptedOn && <p className="mt-1 text-gray-500">The customer’s acceptance ({acceptedOn}{acceptedVia ? `, ${acceptedVia}` : ''}) is still shown in the journey and the timeline.</p>}
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pb-28 sm:p-6 sm:pb-6">
      <LeadWorkspaceHeader
        subject={subject}
        customerName={customerName}
        weddingDate={eventDate ?? weddingDetails.date}
        guestCount={weddingDetails.guestCount}
        city={customer.city}
        chips={{ quotation: quotationChip(current, state), booking: bookingChip(current, state) }}
        onTransition={transitionStage}
        onAssign={assign}
        nextAction={<NextActionCard action={action} busy={busy} onPrimary={onPrimary} onSecondary={onSecondary} reasonPanel={reasonPanel} />}
      />

      <JourneyStepper steps={steps} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <div ref={quoteAnchor} className="scroll-mt-4 lg:col-start-1 lg:row-start-1">
          <QuotationPanel
            ref={panelRef}
            api={quotesApi}
            current={current}
            state={state}
            sourceType={sourceType}
            sourceId={id}
            readOnly={!!subject.wedding || state === 'NOT_PROCEEDING'}
            customerName={customerName}
            eventDate={eventDate}
            guestCount={weddingDetails.guestCount}
            weddingNumber={weddingNumber}
            closedReason={closedReason}
            onChanged={load}
            prefill={
              workspace.vendorInterest.length > 0
                ? workspace.vendorInterest.map((v) => ({
                    description: v.vendorName || v.vendorCategory,
                    category: v.vendorCategory,
                    vendorId: v.vendorId || undefined,
                  }))
                : weddingDetails.services.map((service) => ({ description: service, category: service }))
            }
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="order-2 lg:order-1">
            <ClientCard customer={customer} details={weddingDetails} sourceType={sourceType} />
          </div>
          <div className="order-1 lg:order-2">
            <WhatsAppCard message={message} customerName={customerName} phone={customer.phone} canOpen={canOpenWhatsApp} busy={busy} onSend={sendJourneyMessage} onCopy={copyMessage} />
          </div>
          <div className="order-3">
            <VendorInterestPanel vendorInterest={workspace.vendorInterest} />
          </div>
        </div>

        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <Timeline
            activities={workspace.timeline}
            onAddNote={addNote}
            lostReasonText={subject.pipelineStage === 'LOST' ? [lost.label, lost.detail].filter(Boolean).join(' — ') : null}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TaskPanel tasks={workspace.tasks} onAddTask={addTask} onCompleteTask={completeTask} readOnly={!!subject.wedding} />
        <InsightsPanel insights={workspace.insights} />
      </div>

      {/* Phone: the one Next action stays within thumb reach, just above the admin's bottom navigation. */}
      <div className="fixed inset-x-0 bottom-[54px] z-30 border-t border-gray-200 bg-white px-3.5 py-2.5 shadow-[0_-6px_18px_rgba(17,24,39,0.06)] md:hidden">
        <button
          type="button"
          disabled={busy}
          onClick={onPrimary}
          className={`flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-base font-semibold text-white disabled:opacity-50 ${
            action.quiet ? 'bg-gray-900' : 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-md'
          }`}
        >
          {busy ? 'Working…' : action.label}
        </button>
      </div>

      {dialog === 'accept' && <AcceptDialog customerName={customerName} onSave={saveAcceptance} onClose={() => setDialog(null)} />}
      {dialog === 'decline' && <DeclineDialog customerName={customerName} onSave={saveDecline} onClose={() => setDialog(null)} />}
      {dialog === 'booking' && (
        <BookingDialog
          onSave={saveBooking}
          onClose={() => setDialog(null)}
          defaults={{
            // Only an exact YYYY-MM-DD is offered; free-text dates are left blank for staff to enter.
            weddingDate: weddingDetails.date && /^\d{4}-\d{2}-\d{2}$/.test(weddingDetails.date) ? weddingDetails.date : '',
            guestCount: weddingDetails.guestCount ? String(weddingDetails.guestCount) : '',
            city: customer.city ?? '',
          }}
        />
      )}
      {dialog === 'confirm' && <ConfirmBookingDialog advanceAmount={current?.advanceAmount ?? 0} onSave={saveConfirm} onClose={() => setDialog(null)} />}
      {dialog === 'not-proceeding' && (
        <NotProceedingDialog
          customerName={customerName}
          hasPendingBooking={!!current?.booking && (current.booking.status === 'NEW' || current.booking.status === 'CONTACTED')}
          onSave={saveNotProceeding}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'convert' && (
        <ConvertToWeddingDialog
          defaultCity={customer.city ?? ''}
          onClose={() => setDialog(null)}
          onConvert={async (input) => {
            await convert(input);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
