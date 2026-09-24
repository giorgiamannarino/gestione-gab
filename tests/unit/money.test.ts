import { describe, expect, it } from 'vitest';
import { formatCents, parseEuroInput } from '../../src/lib/domain/money';

const NBSP = ' ';

describe('formatCents', () => {
  it('usa il punto per le migliaia anche sotto i 10.000', () => {
    expect(formatCents(123456)).toBe(`1.234,56${NBSP}€`);
    expect(formatCents(123456789)).toBe(`1.234.567,89${NBSP}€`);
  });

  it('gestisce centesimi e zero', () => {
    expect(formatCents(5)).toBe(`0,05${NBSP}€`);
    expect(formatCents(0)).toBe(`0,00${NBSP}€`);
  });

  it('usa il segno meno tipografico e il + opzionale', () => {
    expect(formatCents(-1230)).toBe(`−12,30${NBSP}€`);
    expect(formatCents(70, { signed: true })).toBe(`+0,70${NBSP}€`);
    expect(formatCents(0, { signed: true })).toBe(`0,00${NBSP}€`);
  });

  it('può omettere il simbolo', () => {
    expect(formatCents(9000, { symbol: false })).toBe('90,00');
  });

  it('legge gli importi scritti a mano', () => {
    expect(parseEuroInput('1.234,56')).toBe(123456);
    expect(parseEuroInput('1234.5')).toBe(123450);
    expect(parseEuroInput('62,25 €')).toBe(6225);
    expect(parseEuroInput('1.500')).toBe(150000);
    expect(parseEuroInput('-3,9')).toBe(-390);
    expect(parseEuroInput('12')).toBe(1200);
    expect(parseEuroInput('abc')).toBeNull();
    expect(parseEuroInput('1,234')).toBeNull();
    expect(parseEuroInput('')).toBeNull();
  });

  it('rifiuta importi non interi', () => {
    expect(() => formatCents(12.5)).toThrow();
  });
});
