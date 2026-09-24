import { describe, expect, it } from 'vitest';
import { centsToKeypad, keypadToCents, pressKey, type KeypadKey } from '../../src/lib/domain/keypad';

const type = (keys: string, from = '') =>
  [...keys].reduce((s, k) => pressKey(s, (k === '<' ? 'back' : k) as KeypadKey), from);

describe('tastierino', () => {
  it('compone importi con la virgola', () => {
    expect(type('12,3')).toBe('12,3');
    expect(keypadToCents('12,3')).toBe(1230);
    expect(keypadToCents(type('12,30'))).toBe(1230);
  });

  it('limita a due decimali e a una sola virgola', () => {
    expect(type('1,234')).toBe('1,23');
    expect(type('1,,2')).toBe('1,2');
  });

  it('non accetta zeri iniziali e antepone lo 0 alla virgola', () => {
    expect(type('007')).toBe('7');
    expect(type(',5')).toBe('0,5');
    expect(keypadToCents('0,5')).toBe(50);
  });

  it('cancella con backspace', () => {
    expect(type('12,3<<')).toBe('12');
    expect(type('<')).toBe('');
  });

  it('limita le cifre intere', () => {
    expect(type('123456789')).toBe('1234567');
  });

  it('converte da centesimi a stringa del tastierino', () => {
    expect(centsToKeypad(1230)).toBe('12,3');
    expect(centsToKeypad(1205)).toBe('12,05');
    expect(centsToKeypad(1800)).toBe('18');
    expect(centsToKeypad(0)).toBe('');
    expect(keypadToCents(centsToKeypad(99999))).toBe(99999);
  });

  it('stringa vuota o "0," valgono zero', () => {
    expect(keypadToCents('')).toBe(0);
    expect(keypadToCents('0,')).toBe(0);
  });
});
