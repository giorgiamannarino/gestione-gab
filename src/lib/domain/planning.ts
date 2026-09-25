/**
 * Strumenti di pianificazione: quanto si può spendere al giorno, scadenze annuali, etichette.
 */
import { addDays, parseISODate, periodOf, type Period } from './dates';
import type { Cents } from './money';
import type { Deadline, ISODate, Transaction } from './types';

function daysBetween(a: ISODate, b: ISODate): number {
  const x = parseISODate(a);
  const y = parseISODate(b);
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86_400_000);
}

export type Pace = 'ok' | 'fast' | 'tooFast';

/**
 * Quanto si può spendere oggi: saldo diviso i giorni che mancano a fine periodo (oggi compreso).
 * Il ritmo confronta quanto resta con quanto dovrebbe restare spendendo in modo uniforme:
 * con meno dell'85% del previsto si va "veloce", sotto il 65% "troppo veloce".
 */
export function dailyAllowance(balance: Cents, spentSoFar: Cents, today: ISODate, p: Period) {
  const daysLeft = Math.max(1, daysBetween(today, p.end) + 1);
  const daysTotal = daysBetween(p.start, p.end) + 1;
  const perDay = Math.max(0, Math.floor(balance / daysLeft));
  const budget = balance + spentSoFar;
  const expected = budget > 0 ? (budget * daysLeft) / daysTotal : 0;
  const ratio = expected > 0 ? balance / expected : 1;
  const pace: Pace = balance <= 0 ? 'tooFast' : ratio < 0.65 ? 'tooFast' : ratio < 0.85 ? 'fast' : 'ok';
  return { perDay, daysLeft, pace, expected: Math.round(expected) };
}

/** Quanti stipendi arrivano da domani fino alla scadenza compresa (almeno 1). */
export function paydaysUntil(today: ISODate, due: ISODate, salaryDay: number): number {
  let n = 0;
  let p = periodOf(addDays(today, 1), salaryDay);
  // Primo stipendio utile: l'inizio del periodo successivo a oggi (o oggi stesso se è il giorno di paga).
  let next = p.start > today ? p.start : addDays(p.end, 1);
  while (next <= due) {
    n++;
    p = periodOf(next, salaryDay);
    next = addDays(p.end, 1);
  }
  return Math.max(1, n);
}

/**
 * Accantonamento per una scadenza: quanto manca (importo − già nel pocket dedicato, se indicato)
 * diviso gli stipendi che arrivano prima della scadenza, arrotondato all'euro in su.
 */
export function deadlineMonthly(d: Pick<Deadline, 'amount' | 'dueDate'>, today: ISODate, salaryDay: number, alreadySaved = 0) {
  const missing = Math.max(0, d.amount - Math.max(0, alreadySaved));
  const paydays = paydaysUntil(today, d.dueDate, salaryDay);
  const monthly = missing === 0 ? 0 : Math.ceil(missing / paydays / 100) * 100;
  return { monthly, paydays, missing, daysLeft: daysBetween(today, d.dueDate) };
}

/** Stessa data dell'anno dopo (29 febbraio → 28). */
export function nextYear(date: ISODate): ISODate {
  const { y, m, d } = parseISODate(date);
  const last = new Date(y + 1, m, 0).getDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Etichette usate, con totale delle spese e numero di movimenti. */
export function tagSummary(txs: Transaction[]) {
  const map = new Map<string, { tag: string; spent: Cents; count: number; first: ISODate; last: ISODate }>();
  for (const t of txs) {
    const tag = t.tag?.trim();
    if (!tag || t.kind === 'roundup') continue;
    const key = tag.toLowerCase();
    const e = map.get(key) ?? { tag, spent: 0, count: 0, first: t.date, last: t.date };
    const net = t.legs.reduce((a, l) => a + l.amount, 0);
    if (t.kind === 'expense') e.spent -= net;
    e.count++;
    if (t.date < e.first) e.first = t.date;
    if (t.date > e.last) e.last = t.date;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}
