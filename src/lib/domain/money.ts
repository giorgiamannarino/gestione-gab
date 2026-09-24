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

export function formatCents(cents: Cents, opts: FormatOptions = {}): string {
  const p = amountParts(cents, opts);
  return `${p.sign}${p.int},${p.dec}${p.symbol}`;
}
