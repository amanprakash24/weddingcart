/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { CONFIRMED_NOTICE, FOLLOW_UP_SENT_NOTE, NOT_YET_NOTICE, pendingPrompt, pendingStillValid, startPending } from './whatsappConfirm';

const draft = { id: 'q1', status: 'DRAFT' };
const sent = { id: 'q1', status: 'SENT' };

describe('opening WhatsApp records nothing — only "Yes, it\'s sent" does', () => {
  test('a pending quote send stays valid for the same draft with the same message', () => {
    const p = startPending('quote', 'q1', 'MSG', 'whatsapp');
    expect(pendingStillValid(p, draft, 'MSG')).toBe(true);
  });

  test('editing the draft (message text changes) cancels the pending confirmation', () => {
    const p = startPending('quote', 'q1', 'MSG total ₹1,00,000', 'whatsapp');
    expect(pendingStillValid(p, draft, 'MSG total ₹90,000')).toBe(false);
  });

  test('a different quote, a quote that is no longer a draft, or no quote → not valid', () => {
    const p = startPending('quote', 'q1', 'MSG', 'whatsapp');
    expect(pendingStillValid(p, { id: 'q2', status: 'DRAFT' }, 'MSG')).toBe(false);
    expect(pendingStillValid(p, sent, 'MSG')).toBe(false); // already marked sent (e.g. in another tab)
    expect(pendingStillValid(p, null, null)).toBe(false);
    expect(pendingStillValid(null, draft, 'MSG')).toBe(false);
  });

  test('a pending follow-up belongs to a SENT quote', () => {
    const p = startPending('follow-up', 'q1', 'NUDGE', 'whatsapp');
    expect(pendingStillValid(p, sent, 'NUDGE')).toBe(true);
    expect(pendingStillValid(p, { id: 'q1', status: 'ACCEPTED' }, 'NUDGE')).toBe(false);
  });
});

describe('wording — never claims something was sent before the operator confirms', () => {
  test('after opening WhatsApp / copying the message', () => {
    expect(pendingPrompt(startPending('quote', 'q1', 'M', 'whatsapp')).opened).toContain('nothing is marked as sent until you do');
    expect(pendingPrompt(startPending('quote', 'q1', 'M', 'copied')).opened).toContain('copied');
    expect(pendingPrompt(startPending('follow-up', 'q1', 'M', 'whatsapp')).question).toBe('Did you press Send in WhatsApp for the follow-up?');
  });

  test('"Not yet" keeps the quote a draft; confirmations say what was confirmed', () => {
    expect(NOT_YET_NOTICE.quote).toContain('still a draft');
    expect(CONFIRMED_NOTICE.quote).toBe('Confirmed: quote sent.');
    expect(FOLLOW_UP_SENT_NOTE).toContain('confirmed by staff');
  });
});
