/**
 * Importi in centesimi interi. Mai numeri decimali per i soldi.
 *
 * La formattazione è fatta a mano: `Intl.NumberFormat('it-IT')` non mette il
 * separatore delle migliaia sotto i 10.000 (scrive "1234,56 €"), mentre
 * vogliamo sempre "1.234,56 €".
 */
export type Cents = number;

const NBSP = ' ';
const MINUS = '−';

export interface FormatOptions {
  /** Mostra "+" davanti agli importi positivi. */
  signed?: boolean;
  /** Aggiunge " €" in coda (default: sì). */
  symbol?: boolean;
}

export interface AmountParts {
  sign: '' | '+' | typeof MINUS;
  int: string;
  dec: string;
  symbol: string;
}

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function amountParts(cents: Cents, opts: FormatOptions = {}): AmountParts {
  if (!Number.isInteger(cents)) throw new Error(`Importo non intero: ${cents}`);
  const abs = Math.abs(cents);
  const sign = cents < 0 ? MINUS : cents > 0 && opts.signed ? '+' : '';
  return {
    sign,
    int: groupThousands(Math.floor(abs / 100)),
    dec: String(abs % 100).padStart(2, '0'),
    symbol: opts.symbol === false ? '' : `${NBSP}€`,
  };
}

/** "1.234,56" / "1234.5" / "12" / "-3,9 €" → centesimi. Null se non è un importo. */
export function parseEuroInput(s: string): Cents | null {
  let t = s.replace(/[\s€ ]/g, '').replace('−', '-');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const neg = t.startsWith('-');
  const [i, d = ''] = t.replace('-', '').split('.');
  const cents = Number(i) * 100 + Number(d.padEnd(2, '0'));
  return neg ? -cents : cents;
}

export function formatCents(cents: Cents, opts: FormatOptions = {}): string {
  const p = amountParts(cents, opts);
  return `${p.sign}${p.int},${p.dec}${p.symbol}`;
}
