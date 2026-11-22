'use client';

import { useState } from 'react';
import { checkEnquiryForm, submitEnquiry } from '@/lib/enquiry/publicEnquiry';
import s from './venue.module.css';

// "Check your date" on the master venue page. Sends through the same enquiry flow as before (POST /api/enquiries via
// submitEnquiry, vendor looked up by slug), and only says "sent" when the server accepted it.
export default function VenueEnquiryCard({ slug, name, city }: { slug: string; name: string; city: string }) {
  const [form, setForm] = useState({ name: '', phone: '', eventDate: '', guestCount: '', eventType: 'wedding' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const problem = checkEnquiryForm(form);
    if (problem) return setError(problem);
    if (!form.name.trim()) return setError('Please enter your name.');
    setState('sending');
    const result = await submitEnquiry({
      vendorId: slug,
      vendorName: name,
      vendorCategory: 'venue',
      name: form.name.trim(),
      phone: form.phone,
      email: '',
      city,
      eventDate: form.eventDate,
      guestCount: form.guestCount,
      eventType: form.eventType,
      message: '',
    });
    if (!result.ok) {
      setState('idle');
      return setError(result.message);
    }
    setState('sent');
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.('event', 'generate_lead', { event_category: 'Enquiry', vendor_name: name, vendor_category: 'venue', vendor_city: city, event_type: form.eventType });
  }

  if (state === 'sent') {
    return (
      <div className={s.enq} role="status">
        <p className={`${s.serif} ${s.enqMsg}`} style={{ fontSize: 26 }}>Thank you. Your Wedding Expert will call you about {name}.</p>
      </div>
    );
  }

  return (
    <form className={s.enq} onSubmit={send} noValidate aria-label={`Check your date at ${name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p className={s.serif} style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>Check your date at {name}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#D9CBB8' }}>Your Wedding Expert confirms the date, hall and price with the venue.</p>
      </div>
      <label>Your name<input value={form.name} onChange={set('name')} autoComplete="name" required /></label>
      <label>Mobile<input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="10 digits" autoComplete="tel-national" required /></label>
      <label>Event date<input type="date" value={form.eventDate} onChange={set('eventDate')} required /></label>
      <label>Guests<input inputMode="numeric" value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 300" /></label>
      <label>Function
        <select value={form.eventType} onChange={set('eventType')}>
          <option value="wedding">Wedding</option>
          <option value="reception">Reception</option>
          <option value="engagement">Engagement</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button type="submit" className={s.goldBtn} disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Check availability'}</button>
      {error && <p className={s.enqMsg} role="alert" style={{ color: '#FBD5D5' }}>{error}</p>}
    </form>
  );
}
