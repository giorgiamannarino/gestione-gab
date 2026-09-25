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

/**
 * Importo scritto a mano → centesimi. Null se non è un importo.
 * Accetta la virgola o il punto per i decimali ("180,50", "180.50", ",5", "180,"), i separatori
 * delle migliaia ("1.234,56", "1,234.56", "1'234", "1 234") e "€" o "euro" prima o dopo.
 * Un solo punto seguito da tre cifre ("1.500") indica le migliaia. Più di due decimali non sono un importo.
 */
export function parseEuroInput(s: string): Cents | null {
  let t = s.toLowerCase().replace(/euro?|€/g, '').replace(/[\s'’]/g, '').replace(/[−–]/g, '-');
  const neg = t.startsWith('-');
  t = t.replace(/^[-+]/, '');
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  // Il separatore decimale è l'ultimo, se non chiude un gruppo di migliaia.
  const last = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  let int = t;
  let dec = '';
  if (last >= 0) {
    const sep = t[last]!;
    const after = t.slice(last + 1);
    const mixed = t.includes(',') && t.includes('.');
    const repeated = t.indexOf(sep) !== last;
    // "1.500" sono migliaia; "1,500" invece ha tre decimali (la virgola è sempre decimale, se è una sola).
    const thousands = !mixed && after.length === 3 && (repeated || (sep === '.' && /^[1-9]\d{0,2}$/.test(t.slice(0, last))));
    if (!thousands && !repeated) {
      int = t.slice(0, last);
      dec = after;
    }
  }
  // Nella parte intera restano solo separatori delle migliaia, a gruppi di tre.
  if (/[.,]/.test(int) && !/^\d{1,3}([.,]\d{3})+$/.test(int)) return null;
  int = int.replace(/[.,]/g, '');
  if (!/^\d*$/.test(int) || !/^\d{0,2}$/.test(dec)) return null;
  const cents = Number(int || '0') * 100 + Number(dec.padEnd(2, '0'));
  return neg && cents ? -cents : cents;
}

/**
 * Messaggio per un campo importo, vuoto se va bene.
 * Di default serve un importo maggiore di zero; `optional` accetta il campo vuoto.
 */
export function euroInputError(s: string, opts: { optional?: boolean; allowZero?: boolean; allowNegative?: boolean } = {}): string {
  if (!s.trim()) return opts.optional ? '' : "Scrivi l'importo, per esempio 180,50.";
  const c = parseEuroInput(s);
  if (c === null) return /^[^.,]*[.,]\d{3,}\D*$/.test(s.trim()) ? 'Al massimo due decimali, per esempio 180,50.' : 'Importo non valido: scrivi per esempio 180,50.';
  if (c < 0 && !opts.allowNegative) return "L'importo non può essere negativo.";
  if (c === 0 && !opts.allowZero) return "L'importo deve essere maggiore di zero.";
  return '';
}

export function formatCents(cents: Cents, opts: FormatOptions = {}): string {
  const p = amountParts(cents, opts);
  return `${p.sign}${p.int},${p.dec}${p.symbol}`;
}
