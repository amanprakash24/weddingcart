import { describe, expect, it } from 'bun:test';
import { rupeesInWords } from './amountInWords';

describe('rupeesInWords', () => {
  it('writes amounts the Indian way', () => {
    expect(rupeesInWords(0)).toBe('Rupees Zero Only');
    expect(rupeesInWords(7)).toBe('Rupees Seven Only');
    expect(rupeesInWords(19)).toBe('Rupees Nineteen Only');
    expect(rupeesInWords(40)).toBe('Rupees Forty Only');
    expect(rupeesInWords(101)).toBe('Rupees One Hundred One Only');
    expect(rupeesInWords(15000)).toBe('Rupees Fifteen Thousand Only');
    expect(rupeesInWords(85500)).toBe('Rupees Eighty Five Thousand Five Hundred Only');
    expect(rupeesInWords(100000)).toBe('Rupees One Lakh Only');
    expect(rupeesInWords(8550000)).toBe('Rupees Eighty Five Lakh Fifty Thousand Only');
    expect(rupeesInWords(12345678)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
    expect(rupeesInWords(1500000000)).toBe('Rupees One Hundred Fifty Crore Only');
  });

  it('drops paise', () => {
    expect(rupeesInWords(250.75)).toBe('Rupees Two Hundred Fifty Only');
  });
});
