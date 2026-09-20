'use client';

import { Copy, MessageCircle } from 'lucide-react';
import type { JourneyMessage } from '@/lib/crm/journeyMessage';

// The customer-facing message, shown as it will look in WhatsApp. The operator sends it themselves: the button opens
// WhatsApp with this text prepared (or Copy, when the phone number is not a usable mobile number).

// *bold* — the same emphasis WhatsApp itself renders.
function renderWhatsAppText(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <b key={i}>{part.slice(1, -1)}</b> : <span key={i}>{part}</span>
  );
}

export default function WhatsAppCard({
  message,
  customerName,
  phone,
  canOpen,
  busy,
  onSend,
  onCopy,
}: {
  message: JourneyMessage | null;
  customerName: string;
  phone: string;
  canOpen: boolean; // the number is a usable mobile number
  busy: boolean;
  onSend: () => void;
  onCopy: () => void;
}) {
  if (!message) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5" aria-label="Message to customer">
        <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400">Message to customer</h2>
        <p className="mt-2 text-sm text-gray-500">Nothing to send right now. Add a note in the timeline if you spoke to them.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-gray-100 bg-white" aria-label="Message to customer">
      <div className="px-5 pb-2 pt-4">
        <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400">Message to customer</h2>
        <div className="mt-0.5 font-semibold text-gray-900">{message.label}</div>
      </div>
      <div className="mx-4 rounded-2xl bg-[#ECE5DD] p-3">
        <div className="flex items-center gap-2 pb-2.5 text-xs">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-rose-800">{customerName.charAt(0).toUpperCase()}</span>
          <div>
            <div className="font-bold text-gray-900">{customerName}</div>
            <div className="text-[11px] text-gray-500">{phone}</div>
          </div>
        </div>
        <div className="ml-auto max-w-[96%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-[#DCF8C6] px-3 py-2.5 text-[13px] leading-relaxed text-[#0B1F12] shadow-sm">
          {renderWhatsAppText(message.text)}
        </div>
      </div>
      <p className="px-5 pt-3 text-xs text-gray-500">{canOpen ? message.hint : 'This number can’t be opened in WhatsApp — copy the message and send it yourself.'}</p>
      <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3">
        {canOpen && (
          <button
            type="button"
            disabled={busy}
            onClick={onSend}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            {message.cta}
          </button>
        )}
        <button type="button" onClick={onCopy} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Copy className="h-4 w-4" />
          Copy message
        </button>
      </div>
    </section>
  );
}
