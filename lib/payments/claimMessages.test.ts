import { describe, test, expect } from 'bun:test';
import { claimNotReceivedMessage, claimReceivedMessage, couplePaidMessage } from './claimMessages';

describe('the WhatsApp messages around "I have paid"', () => {
  test('the couple tells the business what to look for', () => {
    expect(couplePaidMessage({ businessName: 'Swayamvar Hall', coupleName: ' Rahul Kumar ', number: 'SWA-QTN-202610-0001', amount: 60000, utr: '412345678901' })).toBe(
      'Namaste Swayamvar Hall,\nI have paid ₹60,000 by UPI for quotation SWA-QTN-202610-0001.\nUPI reference (UTR): 412345678901\nPlease check and confirm it.\n— Rahul Kumar'
    );
    expect(couplePaidMessage({ businessName: 'Swayamvar Hall', coupleName: null, number: 'Q1', amount: 1, utr: 'X' })).not.toContain('—');
  });

  test('the business says it received the money — and whether that confirmed the booking', () => {
    const base = { customerName: 'Rahul Kumar', businessName: 'Swayamvar Hall', number: 'SWA-QTN-202610-0001', amount: 60000 };
    expect(claimReceivedMessage({ ...base, confirmed: true })).toBe(
      'Namaste Rahul ji,\nWe have received your payment of ₹60,000 for quotation SWA-QTN-202610-0001. Thank you!\nYour booking is confirmed.\nYou can see it on your quotation link.\n— Swayamvar Hall'
    );
    expect(claimReceivedMessage({ ...base, confirmed: false })).toContain('It is recorded against your booking.');
    expect(claimReceivedMessage({ ...base, confirmed: false })).not.toContain('confirmed');
  });

  test('the business says it could not find the money, with its reason', () => {
    const base = { customerName: 'Rahul Kumar', businessName: 'Swayamvar Hall', number: 'Q1', amount: 5000, utr: '999999999999' };
    const text = claimNotReceivedMessage({ ...base, reason: 'We cannot find this reference in our account' });
    expect(text).toContain('We could not find your payment of ₹5,000 (UTR 999999999999) for quotation Q1.');
    expect(text).toContain('\nWe cannot find this reference in our account.\n');
    expect(claimNotReceivedMessage({ ...base, reason: 'Wrong amount.' })).toContain('\nWrong amount.\n');
    expect(claimNotReceivedMessage({ ...base, reason: null }).split('\n')).toHaveLength(4);
  });
});
