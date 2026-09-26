/**
 * Strumenti di pianificazione: quanto si può spendere al giorno, scadenze annuali, etichette.
 */
import { addDays, parseISODate, shiftPeriod, type Period } from './dates';
import type { Cents } from './money';
import type { Deadline, ISODate, Transaction } from './types';

export function daysBetween(a: ISODate, b: ISODate): number {
  const x = parseISODate(a);
  const y = parseISODate(b);
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86_400_000);
}

/** ok: oggi c'è almeno la quota piena · tight: meno della quota (giorni prima un po' oltre) · over: sotto il programma. */
export type Pace = 'ok' | 'tight' | 'over';

/**
 * Quanto si può spendere oggi, con i giorni precedenti che contano.
 * Il budget del periodo (saldo + già speso nel periodo) si divide in una quota al giorno.
 * Oggi = quote maturate fino a oggi compreso − speso nel periodo (oggi compreso):
 * se nei giorni prima si è speso meno il risparmio si somma, se di più si sottrae.
 * Mai più del saldo reale. Sotto zero si è "oltre il programma" finché non si torna in pari.
 */
export function dailyAllowance(balance: Cents, spentSoFar: Cents, today: ISODate, p: Period) {
  const daysTotal = daysBetween(p.start, p.end) + 1;
  const dayIndex = Math.min(daysTotal, Math.max(1, daysBetween(p.start, today) + 1));
  const daysLeft = daysTotal - dayIndex + 1;
  const budget = Math.max(0, balance + spentSoFar);
  const daily = Math.floor(budget / daysTotal);
  const planned = Math.floor((budget * dayIndex) / daysTotal);
  const raw = planned - spentSoFar;
  const today_ = Math.min(raw, Math.max(0, balance));
  const pace: Pace = raw < 0 ? 'over' : raw < daily ? 'tight' : 'ok';
  return { today: Math.max(0, today_), overBy: raw < 0 ? -raw : 0, daily, daysLeft, dayIndex, pace };
}

/**
 * Stipendi da quello del periodo `p` (compreso) fino all'ultimo prima della scadenza
 * (anche lo stesso giorno). 0 se lo stipendio del periodo arriva già dopo la scadenza.
 */
export function paydaysUntil(p: Period, due: ISODate, salaryDay: number): number {
  let n = 0;
  for (let q = p; q.start <= due; q = shiftPeriod(q, 1, salaryDay)) n++;
  return n;
}

/**
 * Accantonamento per una scadenza nel periodo `p`: quanto manca (importo − già accantonato
 * negli stipendi precedenti) diviso gli stipendi che restano, arrotondato all'euro in su
 * (mai oltre quanto manca). Dopo l'ultimo stipendio prima della scadenza è 0.
 */
export function deadlineInstalment(d: Pick<Deadline, 'amount' | 'dueDate'>, p: Period, salaryDay: number, saved = 0) {
  const missing = Math.max(0, d.amount - Math.max(0, saved));
  const paydays = paydaysUntil(p, d.dueDate, salaryDay);
  const amount = missing === 0 || paydays === 0 ? 0 : Math.min(missing, Math.ceil(missing / paydays / 100) * 100);
  return { amount, paydays, missing };
}

/** Stessa data dell'anno dopo (29 febbraio → 28). */
export function nextYear(date: ISODate): ISODate {
  const { y, m, d } = parseISODate(date);
  const last = new Date(y + 1, m, 0).getDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

// ── Settimana in breve ──

/** Lunedì della settimana che contiene la data. */
export function mondayOf(date: ISODate): ISODate {
  const { y, m, d } = parseISODate(date);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // lunedì = 0
  return addDays(date, -dow);
}

function spendingBetween(txs: Transaction[], from: ISODate, to: ISODate, excluded: Set<string>) {
  const list = txs.filter((t) => t.kind === 'expense' && t.date >= from && t.date <= to && !(t.categoryId && excluded.has(t.categoryId)));
  const amount = (t: Transaction) => -t.legs.reduce((a, l) => a + l.amount, 0);
  const biggest = [...list].sort((a, b) => amount(b) - amount(a))[0];
  return { total: list.reduce((a, t) => a + amount(t), 0), count: list.length, biggest: biggest ? { description: biggest.description, amount: amount(biggest) } : undefined };
}

/** La settimana scorsa (lunedì–domenica) confrontata con quella prima. */
export function lastWeekSummary(txs: Transaction[], excluded: Set<string>, today: ISODate) {
  const from = addDays(mondayOf(today), -7);
  const to = addDays(from, 6);
  const week = spendingBetween(txs, from, to, excluded);
  const prev = spendingBetween(txs, addDays(from, -7), addDays(from, -1), excluded);
  return { from, to, ...week, prevTotal: prev.total, change: prev.total > 0 ? (week.total - prev.total) / prev.total : null };
}

// ── Spese fuori dal solito ──

/**
 * Categorie in cui nel periodo si è già speso almeno il 30% (e almeno 20 €) in più
 * della media dei periodi precedenti (solo quelli con dati).
 */
export function categoryAnomalies(current: Map<string, Cents>, previous: Map<string, Cents>[], minRatio = 1.3, minDiff = 2000) {
  const out: { id: string; amount: Cents; average: Cents; change: number }[] = [];
  const withData = previous.filter((m) => m.size > 0);
  if (!withData.length) return out;
  for (const [id, amount] of current) {
    const average = Math.round(withData.reduce((a, m) => a + (m.get(id) ?? 0), 0) / withData.length);
    if (average > 0 && amount >= average * minRatio && amount - average >= minDiff) out.push({ id, amount, average, change: (amount - average) / average });
  }
  return out.sort((a, b) => b.amount - b.average - (a.amount - a.average));
}

// ── Giorni senza spese ──

/**
 * Giorni consecutivi senza spese dal pocket, fino a oggi compreso (se oggi si è speso: 0),
 * e il record da quando esiste il pocket.
 */
export function noSpendStreak(txs: Transaction[], pocketId: string, today: ISODate, since: ISODate) {
  const days = new Set(txs.filter((t) => t.kind === 'expense' && t.legs.some((l) => l.pocketId === pocketId && l.amount < 0)).map((t) => t.date));
  let current = 0;
  for (let d = today; d >= since && !days.has(d); d = addDays(d, -1)) current++;
  let best = 0;
  let run = 0;
  for (let d = since; d <= today; d = addDays(d, 1)) {
    run = days.has(d) ? 0 : run + 1;
    if (run > best) best = run;
  }
  return { current, best };
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
