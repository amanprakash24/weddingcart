'use client';

import { useMemo, useState } from 'react';

// Guest management (Client OS phase 1, founder-approved design 19–20 Nov 2026). Used by the couple's My Wedding
// (clientMode) and the staff wedding workspace. Each guest has a side, family group, relation, VIP flag, "comes with",
// the functions they are invited to (with their answer for each), people with them and special requirements.
// A guest with no function rows is invited to every function (lib/guest/invitations.ts).

type EventOption = { id: string; type: string; label: string | null; date?: string | Date | null };
type Answer = 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE';
type Side = 'BRIDE' | 'GROOM' | 'BOTH';
type Guest = {
  id: string; name: string; phone: string | null; email: string | null; category: string | null;
  accompanyingGuests: number; rsvpStatus: string; rsvpToken: string;
  notes?: string | null; side?: string | null; familyGroup?: string | null; relation?: string | null;
  isVip?: boolean; pairedGuestId?: string | null;
  functionResponses: { status: string; weddingEvent: EventOption }[];
};

const ANSWER: Record<Answer, { word: string; cls: string }> = {
  ATTENDING: { word: 'Coming', cls: 'bg-[#E3F4E6] text-[#1F6A41]' },
  NOT_ATTENDING: { word: 'Not coming', cls: 'bg-[#FDE1E6] text-[#A3203F]' },
  MAYBE: { word: 'Maybe', cls: 'bg-[#FFF0D6] text-[#8A5A00]' },
  PENDING: { word: 'Waiting', cls: 'bg-[#F1ECEA] text-[#6E4F4A]' },
};
const SIDE: Record<Side, { word: string; cls: string }> = {
  BRIDE: { word: 'Bride', cls: 'bg-[#FCE8EF] text-[#9B1C4C]' },
  GROOM: { word: 'Groom', cls: 'bg-[#E6EEFF] text-[#2448A8]' },
  BOTH: { word: 'Both', cls: 'bg-[#F1ECEA] text-[#5E3A35]' },
};
const answerOf = (s: string): Answer => (s in ANSWER ? (s as Answer) : 'PENDING');
// 'HALDI' (a function type) reads as 'Haldi'; a label someone typed is shown as they wrote it.
const fnName = (e: EventOption) => { const raw = (e.label || e.type).trim(); return raw === raw.toUpperCase() ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw; };
const shortDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '');
const NO_GROUP = 'No family group';

type Form = {
  name: string; phone: string; accompanyingGuests: number; side: Side | ''; familyGroup: string; relation: string;
  isVip: boolean; pairedGuestId: string; notes: string; invited: Record<string, boolean>;
};

const card = 'rounded-[20px] border border-white bg-white/90 shadow-[inset_0_1px_0_#fff,0_5px_0_#F1DAD3,0_6px_0_#E8C9C0,0_22px_40px_rgba(140,60,60,0.12)]';
const btn = 'inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#D9466F] focus-visible:ring-offset-2 disabled:opacity-50';
const gold = `${btn} bg-gradient-to-b from-[#CFA65A] to-[#A97C33] text-white shadow-[0_4px_0_#8C6526]`;
const rose = `${btn} bg-gradient-to-b from-[#E8607F] to-[#C23A60] text-white shadow-[0_3px_0_#9A2B4C]`;
const ghost = `${btn} bg-white text-[#5E3A35] ring-1 ring-inset ring-[#EBCFC7] hover:ring-[#D9466F]`;
const field = 'flex flex-col gap-1.5 text-xs font-semibold text-[#6E4F4A]';
const input = 'min-h-[42px] w-full rounded-xl border border-[#EBCFC7] bg-white px-3 text-sm font-normal text-[#3A2224] outline-none focus-visible:ring-2 focus-visible:ring-[#D9466F]';
const chip = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold';

export default function GuestRsvp({ weddingId, events, initialGuests, clientMode = false }: { weddingId: string; events: EventOption[]; initialGuests: Guest[]; clientMode?: boolean }) {
  const [guests, setGuests] = useState(initialGuests);
  const [side, setSide] = useState<'all' | Side>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | Answer>('all');
  const [fn, setFn] = useState('all');
  const [group, setGroup] = useState('all');
  const [vipOnly, setVipOnly] = useState(false);
  const [byFamily, setByFamily] = useState(true);
  const [editing, setEditing] = useState<Guest | 'new' | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState('');
  // A save that fails says so (it used to fail silently: the list just snapped back).
  const [error, setError] = useState('');
  const base = clientMode ? `/api/customer/weddings/${weddingId}/guests` : `/api/weddings/${weddingId}/guests`;

  const invitedTo = (g: Guest) => (g.functionResponses.length ? events.filter((e) => g.functionResponses.some((r) => r.weddingEvent.id === e.id)) : events);
  const answerFor = (g: Guest, eventId: string): Answer => answerOf(g.functionResponses.find((r) => r.weddingEvent.id === eventId)?.status ?? 'PENDING');
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupNames = useMemo(() => [...new Set(guests.map((g) => g.familyGroup?.trim()).filter((x): x is string => !!x))].sort(), [guests]);

  const sideMatch = (g: Guest) => side === 'all' || g.side === side || g.side === 'BOTH';
  const inSide = guests.filter(sideMatch);
  const q = query.trim().toLowerCase();
  const list = inSide.filter((g) =>
    (!q || [g.name, g.phone, g.relation, g.familyGroup, g.category].join(' ').toLowerCase().includes(q)) &&
    (status === 'all' || answerOf(g.rsvpStatus) === status) &&
    (fn === 'all' || invitedTo(g).some((e) => e.id === fn)) &&
    (group === 'all' || (g.familyGroup?.trim() || NO_GROUP) === group) &&
    (!vipOnly || g.isVip));

  const people = (gs: Guest[]) => gs.reduce((n, g) => n + 1 + (g.accompanyingGuests || 0), 0);
  const withAnswer = (a: Answer) => inSide.filter((g) => answerOf(g.rsvpStatus) === a);
  const stats = [
    { label: 'Invited', value: inSide.length, sub: `${people(inSide)} people with companions`, cls: 'from-[#FFF0F2] to-[#FFE4EA]', color: '' },
    { label: 'Coming', value: withAnswer('ATTENDING').length, sub: `${people(withAnswer('ATTENDING'))} people`, cls: 'from-[#F1FAF2] to-[#E3F4E6]', color: 'text-[#1F6A41]' },
    { label: 'Waiting', value: withAnswer('PENDING').length + withAnswer('MAYBE').length, sub: `${withAnswer('MAYBE').length} said maybe`, cls: 'from-[#FFF8EC] to-[#FFEFD6]', color: 'text-[#8A5A00]' },
    { label: 'Not coming', value: withAnswer('NOT_ATTENDING').length, sub: `of ${inSide.length}`, cls: 'from-[#FFF0F2] to-[#FDE1E6]', color: 'text-[#A3203F]' },
    { label: 'VIP guests', value: inSide.filter((g) => g.isVip).length, sub: 'looked after first', cls: 'from-[#FFF4E8] to-[#FBE5D3]', color: 'text-[#8C5A1E]' },
  ];

  const groups = byFamily
    ? [...new Set(list.map((g) => g.familyGroup?.trim() || NO_GROUP))]
        .sort((a, b) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b)))
        .map((name) => ({ name, guests: list.filter((g) => (g.familyGroup?.trim() || NO_GROUP) === name) }))
    : [{ name: '', guests: list }];

  const reload = async () => {
    try {
      const res = await fetch(base);
      const body = await res.json();
      if (res.ok && body.success) setGuests(body.data);
    } catch { /* the saved change is already shown; the list refreshes next time */ }
  };

  const send = async (url: string, init: RequestInit): Promise<{ ok: boolean; data?: Guest }> => {
    setError('');
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.success !== false) return { ok: true, data: body.data };
      setError(body.error || 'That change was not saved. Please try again.');
    } catch {
      setError('Could not reach the server. Please check your internet connection and try again.');
    }
    return { ok: false };
  };

  const open = (g: Guest | 'new') => {
    setError('');
    setConfirmRemove(false);
    setEditing(g);
    const invited = Object.fromEntries(events.map((e) => [e.id, g === 'new' ? true : invitedTo(g).some((x) => x.id === e.id)]));
    setForm(g === 'new'
      ? { name: '', phone: '', accompanyingGuests: 0, side: side === 'all' ? '' : side, familyGroup: '', relation: '', isVip: false, pairedGuestId: '', notes: '', invited }
      : { name: g.name, phone: g.phone ?? '', accompanyingGuests: g.accompanyingGuests, side: (g.side as Side) ?? '', familyGroup: g.familyGroup ?? '', relation: g.relation ?? '', isVip: !!g.isVip, pairedGuestId: g.pairedGuestId ?? '', notes: g.notes ?? '', invited });
  };
  const close = () => { setEditing(null); setForm(null); setConfirmRemove(false); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !editing) return;
    if (!form.name.trim()) { setError('Please enter the guest’s name.'); return; }
    const current = editing === 'new' ? null : editing;
    const allInvited = events.every((e) => form.invited[e.id]);
    // Every function ticked on a guest who had no rows stays "invited to everything" (no rows); otherwise one row per
    // ticked function, keeping the answer they already gave.
    const functionResponses = allInvited && (!current || current.functionResponses.length === 0)
      ? []
      : events.filter((e) => form.invited[e.id]).map((e) => ({ weddingEventId: e.id, status: current ? answerFor(current, e.id) : 'PENDING' }));
    const payload = {
      name: form.name.trim(), phone: form.phone.trim() || null, email: current?.email ?? null, category: current?.category ?? null,
      accompanyingGuests: Math.max(0, Math.min(20, Number(form.accompanyingGuests) || 0)),
      rsvpStatus: current ? answerOf(current.rsvpStatus) : 'PENDING',
      notes: form.notes.trim() || null, side: form.side || null, familyGroup: form.familyGroup.trim() || null,
      relation: form.relation.trim() || null, isVip: form.isVip, pairedGuestId: form.pairedGuestId || null, functionResponses,
    };
    setSaving(true);
    const result = await send(current ? `${base}/${current.id}` : base, { method: current ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!result.ok) return;
    await reload(); // pairing may have changed another guest too
    close();
  };

  const quickStatus = async (g: Guest, rsvpStatus: Answer) => {
    const result = await send(`${base}/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...g, rsvpStatus, functionResponses: g.functionResponses.map((r) => ({ weddingEventId: r.weddingEvent.id, status: r.status })) }) });
    if (result.ok && result.data) { const saved = result.data; setGuests((cur) => cur.map((x) => (x.id === g.id ? saved : x))); }
  };

  const remove = async () => {
    if (!editing || editing === 'new') return;
    setSaving(true);
    const result = await send(`${base}/${editing.id}`, { method: 'DELETE' });
    setSaving(false);
    if (!result.ok) return;
    await reload();
    close();
  };

  const copyLink = async (g: Guest) => {
    const url = `${window.location.origin}/rsvp/${g.rsvpToken}`;
    try { await navigator.clipboard.writeText(url); setCopied(g.id); setTimeout(() => setCopied(''), 2000); }
    catch { window.prompt('Copy this RSVP link', url); }
  };

  const sideTab = (id: 'all' | Side, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={side === id} onClick={() => setSide(id)}
      className={`min-h-[38px] rounded-full px-4 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#D9466F] ${side === id ? 'bg-gradient-to-b from-[#E8607F] to-[#C23A60] text-white' : 'text-[#6E4F4A] hover:bg-[#FFF0F2]'}`}>{label}</button>
  );

  return (
    <section aria-labelledby="guests-title" className="rounded-[28px] bg-[#FBF1EE] bg-[radial-gradient(700px_400px_at_0%_0%,#FFE6EA_0%,rgba(255,230,234,0)_60%)] p-4 text-[#3A2224] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A2683A]">Guests &amp; RSVP</p>
          <h2 id="guests-title" className="mt-1 font-[family-name:var(--font-playfair)] text-3xl font-semibold text-[#7A2236]">Guests</h2>
        </div>
        <button type="button" className={gold} onClick={() => open('new')}>Add a guest</button>
      </div>

      <div role="tablist" aria-label="Whose guests" className={`${card} mt-4 inline-flex gap-1 rounded-full p-1`}>
        {sideTab('all', 'Everyone')}{sideTab('BRIDE', 'Bride side')}{sideTab('GROOM', 'Groom side')}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={`${card} bg-gradient-to-b px-4 py-3 ${s.cls}`}>
            <p className="text-xs font-semibold text-[#6E4F4A]">{s.label}</p>
            <p className={`font-[family-name:var(--font-playfair)] text-[26px] font-bold leading-tight ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-[#8A6B66]">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className={`${card} mt-4 flex flex-wrap items-end gap-3 p-4`}>
        <label className={`${field} min-w-[200px] flex-[2]`}>Search
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone, relation or family" className={input} />
        </label>
        <label className={`${field} min-w-[130px] flex-1`}>RSVP
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | Answer)} className={input}>
            <option value="all">Everyone</option><option value="ATTENDING">Coming</option><option value="PENDING">Waiting</option><option value="MAYBE">Maybe</option><option value="NOT_ATTENDING">Not coming</option>
          </select>
        </label>
        {events.length > 0 && (
          <label className={`${field} min-w-[130px] flex-1`}>Function
            <select value={fn} onChange={(e) => setFn(e.target.value)} className={input}>
              <option value="all">All functions</option>
              {events.map((e) => <option key={e.id} value={e.id}>{fnName(e)}</option>)}
            </select>
          </label>
        )}
        <label className={`${field} min-w-[150px] flex-1`}>Family group
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
            <option value="all">All groups</option>
            {groupNames.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value={NO_GROUP}>{NO_GROUP}</option>
          </select>
        </label>
        <label className="flex min-h-[42px] items-center gap-2 text-sm font-semibold text-[#6E4F4A]"><input type="checkbox" checked={vipOnly} onChange={() => setVipOnly(!vipOnly)} className="h-[18px] w-[18px] accent-[#D9466F]" /> VIP only</label>
        <label className="flex min-h-[42px] items-center gap-2 text-sm font-semibold text-[#6E4F4A]"><input type="checkbox" checked={byFamily} onChange={() => setByFamily(!byFamily)} className="h-[18px] w-[18px] accent-[#D9466F]" /> Group by family</label>
      </div>

      {error && !form && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className={`${card} min-w-0 flex-[999_1_560px] p-2`} aria-label="Guest list">
          {guests.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#8A6B66]">No guests yet. Add your first guest to start your list.</p>
          ) : list.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#8A6B66]">No guests match these filters.</p>
          ) : groups.map((grp) => (
            <div key={grp.name || 'all'}>
              {grp.name && (
                <div className="flex items-baseline gap-2 px-3 pb-1 pt-3">
                  <span className="font-[family-name:var(--font-playfair)] text-[17px] font-semibold text-[#6B2132]">{grp.name}</span>
                  <span className="text-xs text-[#8A6B66]">{grp.guests.length} {grp.guests.length === 1 ? 'guest' : 'guests'}</span>
                </div>
              )}
              <ul>
                {grp.guests.map((g) => {
                  const pair = g.pairedGuestId ? byId.get(g.pairedGuestId) : undefined;
                  const s = g.side && g.side in SIDE ? SIDE[g.side as Side] : null;
                  const a = ANSWER[answerOf(g.rsvpStatus)];
                  const selected = editing !== 'new' && editing?.id === g.id;
                  return (
                    <li key={g.id} className={`grid grid-cols-1 gap-2 rounded-2xl px-3 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,2.2fr)_auto] sm:items-center ${selected ? 'bg-[#FFEFF2] ring-1 ring-[#F7C7D2]' : 'hover:bg-[#FFF6F4]'}`}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          <span className="truncate">{g.name}</span>
                          {g.isVip && <span className={`${chip} bg-[#FBE5D3] text-[#8C5A1E]`}>VIP</span>}
                          {s && <span className={`${chip} ${s.cls}`}>{s.word}</span>}
                        </p>
                        <p className="text-xs text-[#8A6B66]">{g.phone || 'No number yet'}{g.accompanyingGuests ? ` · +${g.accompanyingGuests} with them` : ''}</p>
                        {pair && <p className="text-xs text-[#6E4F4A]">Comes with {pair.name}</p>}
                      </div>
                      <div className="min-w-0 text-[13px]">
                        <p className="truncate">{g.relation || <span className="text-[#A08883]">No relation added</span>}</p>
                        {g.notes && <p className="truncate text-xs text-[#8A6B66]" title={g.notes}>Needs: {g.notes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {invitedTo(g).map((e) => {
                          const fa = ANSWER[answerFor(g, e.id)];
                          return <span key={e.id} className={`${chip} ${fa.cls}`} title={`${fnName(e)}: ${fa.word}`}>{fnName(e)}</span>;
                        })}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <label className="sr-only" htmlFor={`rsvp-${g.id}`}>RSVP for {g.name}</label>
                        <select id={`rsvp-${g.id}`} value={answerOf(g.rsvpStatus)} onChange={(e) => quickStatus(g, e.target.value as Answer)} className={`min-h-[34px] rounded-full border-0 px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#D9466F] ${a.cls}`}>
                          {(Object.keys(ANSWER) as Answer[]).map((k) => <option key={k} value={k}>{ANSWER[k].word}</option>)}
                        </select>
                        <button type="button" onClick={() => copyLink(g)} className={`${ghost} min-h-[34px] px-3 text-xs`} aria-label={`Copy ${g.name}'s RSVP link`}>{copied === g.id ? 'Copied' : 'Copy link'}</button>
                        <button type="button" onClick={() => open(g)} className={`${rose} min-h-[34px] px-3 text-xs`}>Edit</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {form && editing && (
          <form onSubmit={save} aria-labelledby="guest-form-title"
            className={`${card} fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-b-none p-5 lg:sticky lg:top-4 lg:z-auto lg:max-h-none lg:w-[400px] lg:flex-none lg:rounded-b-[20px] motion-safe:lg:[transform:perspective(1200px)_rotateY(-3deg)]`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id="guest-form-title" className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-[#7A2236]">{editing === 'new' ? 'Add a guest' : 'Edit guest'}</h3>
              <button type="button" onClick={close} className={`${ghost} min-h-[36px] px-3`}>Close</button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <label className={field}>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>Mobile<input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10 digits" className={input} /></label>
                <label className={field}>People with them<input type="number" min={0} max={20} value={form.accompanyingGuests} onChange={(e) => setForm({ ...form, accompanyingGuests: Number(e.target.value) })} className={input} /></label>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-[#6E4F4A]">Side</legend>
                <div className="flex gap-2">
                  {(['BRIDE', 'GROOM', 'BOTH'] as Side[]).map((sd) => (
                    <label key={sd} className={`flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold ${form.side === sd ? 'bg-[#FFE6EC] text-[#B3335A] ring-1 ring-[#F7C7D2]' : 'bg-white text-[#6E4F4A] ring-1 ring-[#EBCFC7]'}`}>
                      <input type="radio" name="side" checked={form.side === sd} onChange={() => setForm({ ...form, side: sd })} className="accent-[#D9466F]" />
                      {sd === 'BOTH' ? 'Both' : `${SIDE[sd].word} side`}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>Family group<input list="guest-groups" value={form.familyGroup} onChange={(e) => setForm({ ...form, familyGroup: e.target.value })} placeholder="e.g. Sharma family" className={input} /></label>
                <label className={field}>Relation<input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="e.g. Mama, College friend" className={input} /></label>
              </div>
              <datalist id="guest-groups">{groupNames.map((n) => <option key={n} value={n} />)}</datalist>
              <label className={field}>Comes with
                <select value={form.pairedGuestId} onChange={(e) => setForm({ ...form, pairedGuestId: e.target.value })} className={input}>
                  <option value="">Nobody</option>
                  {guests.filter((g) => editing === 'new' || g.id !== editing.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" checked={form.isVip} onChange={(e) => setForm({ ...form, isVip: e.target.checked })} className="h-[18px] w-[18px] accent-[#D9466F]" /> VIP guest</label>
              {events.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-[#6E4F4A]">Invited to</legend>
                  <div className="flex flex-col gap-1.5">
                    {events.map((e) => {
                      const on = !!form.invited[e.id];
                      const fa = editing !== 'new' ? ANSWER[answerFor(editing, e.id)] : ANSWER.PENDING;
                      return (
                        <label key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#FCF5F2] px-3 py-2 text-sm">
                          <span className="flex items-center gap-2.5">
                            <input type="checkbox" checked={on} onChange={(ev) => setForm({ ...form, invited: { ...form.invited, [e.id]: ev.target.checked } })} className="h-[18px] w-[18px] accent-[#D9466F]" />
                            {fnName(e)} {e.date && <span className="text-xs text-[#8A6B66]">{shortDate(e.date)}</span>}
                          </span>
                          <span className={`${chip} ${on ? fa.cls : 'bg-[#F6F1EF] text-[#A08883]'}`}>{on ? fa.word : 'Not invited'}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <label className={field}>Special requirements<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={2000} placeholder="Food, wheelchair, a ground-floor room…" className={`${input} py-2`} /></label>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                {editing !== 'new' ? (
                  confirmRemove ? (
                    <span className="flex items-center gap-2 text-sm">Remove {editing.name}?
                      <button type="button" onClick={remove} disabled={saving} className={`${btn} min-h-[36px] bg-[#B4232A] px-3 text-white`}>Yes, remove</button>
                      <button type="button" onClick={() => setConfirmRemove(false)} className={`${ghost} min-h-[36px] px-3`}>No</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(true)} className={`${btn} px-1 text-[#B4232A]`}>Remove guest</button>
                  )
                ) : <span />}
                <span className="flex gap-2">
                  <button type="button" onClick={close} className={ghost}>Cancel</button>
                  <button type="submit" disabled={saving} className={gold}>{saving ? 'Saving…' : 'Save'}</button>
                </span>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
