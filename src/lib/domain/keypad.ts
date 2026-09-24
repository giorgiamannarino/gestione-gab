/**
 * Logica del tastierino numerico per l'inserimento degli importi.
 * Lo stato è la stringa digitata ("12,3"), convertita in centesimi a parte.
 */
import type { Cents } from './money';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back';

const MAX_INT_DIGITS = 7; // fino a 9.999.999 €

export function pressKey(state: string, key: KeypadKey): string {
  if (key === 'back') return state.slice(0, -1);

  const [int = '', dec] = state.split(',');

  if (key === ',') {
    if (dec !== undefined) return state;
    return (int === '' ? '0' : int) + ',';
  }

  if (dec !== undefined) {
    return dec.length >= 2 ? state : state + key;
  }
  if (int === '0') return key; // niente zeri iniziali
  if (int.length >= MAX_INT_DIGITS) return state;
  return int + key;
}

export function keypadToCents(state: string): Cents {
  if (state === '') return 0;
  const [int = '0', dec = ''] = state.split(',');
  return Number(int || '0') * 100 + Number(dec.padEnd(2, '0'));
}

export function centsToKeypad(cents: Cents): string {
  if (cents === 0) return '';
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100);
  const dec = abs % 100;
  if (dec === 0) return String(int);
  return `${int},${String(dec).padStart(2, '0').replace(/0$/, '')}`;
}
