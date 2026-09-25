/** Statistiche di spesa per periodo. Rettifiche, giroconti e arrotondamenti non sono spese. */
import type { Cents } from './money';
import { inPeriod, type Period } from './dates';
import type { Category, Id, ISODate, Recurring, Transaction } from './types';

function isSpending(tx: Transaction, excluded: Set<Id>): boolean {
  return tx.kind === 'expense' && !(tx.categoryId && excluded.has(tx.categoryId));
}

function excludedSet(categories: Category[]): Set<Id> {
  return new Set(categories.filter((c) => c.excludedFromStats).map((c) => c.id));
}

/** Spese per categoria nel periodo (importi positivi). Chiave "" = senza categoria. */
export function spendingByCategory(txs: Transaction[], p: Period, categories: Category[]): Map<Id, Cents> {
  const ex = excludedSet(categories);
  const out = new Map<Id, Cents>();
  for (const t of txs) {
    if (!inPeriod(t.date, p) || !isSpending(t, ex)) continue;
    const k = t.categoryId ?? '';
    out.set(k, (out.get(k) ?? 0) - t.legs.reduce((a, l) => a + l.amount, 0));
  }
  return out;
}

export function spendingByPocket(txs: Transaction[], p: Period, categories: Category[]): Map<Id, Cents> {
  const ex = excludedSet(categories);
  const out = new Map<Id, Cents>();
  for (const t of txs) {
    if (!inPeriod(t.date, p) || !isSpending(t, ex)) continue;
    for (const l of t.legs) out.set(l.pocketId, (out.get(l.pocketId) ?? 0) - l.amount);
  }
  return out;
}

export function totalSpending(txs: Transaction[], p: Period, categories: Category[]): Cents {
  return [...spendingByCategory(txs, p, categories).values()].reduce((a, b) => a + b, 0);
}

export function totalIncome(txs: Transaction[], p: Period): Cents {
  return txs
    .filter((t) => t.kind === 'income' && inPeriod(t.date, p))
    .reduce((a, t) => a + t.legs.reduce((s, l) => s + l.amount, 0), 0);
}

/** Speso su un budget (es. benzina): uscite della sua categoria dal suo pocket nel periodo. */
export function budgetSpent(budget: Recurring, txs: Transaction[], p: Period): Cents {
  return txs
    .filter((t) => t.kind === 'expense' && inPeriod(t.date, p) && t.categoryId === budget.categoryId)
    .flatMap((t) => t.legs)
    .filter((l) => l.pocketId === budget.fromPocketId)
    .reduce((a, l) => a - l.amount, 0);
}

/** Spese giorno per giorno nel periodo (per il calendario). */
export function dailySpending(txs: Transaction[], p: Period, categories: Category[]): Map<ISODate, { amount: Cents; count: number }> {
  const ex = excludedSet(categories);
  const out = new Map<ISODate, { amount: Cents; count: number }>();
  for (const t of txs) {
    if (!inPeriod(t.date, p) || !isSpending(t, ex)) continue;
    const d = out.get(t.date) ?? { amount: 0, count: 0 };
    out.set(t.date, { amount: d.amount - t.legs.reduce((a, l) => a + l.amount, 0), count: d.count + 1 });
  }
  return out;
}

/**
 * Bolletta pagata dal fondo: se costa meno del fondo, il resto torna nei risparmi;
 * se costa di più, la differenza è ciò che manca (il fondo va in negativo).
 */
export function splitBill(fund: Cents, bill: Cents): { rest: Cents; shortfall: Cents } {
  const available = Math.max(0, fund);
  return { rest: Math.max(0, available - bill), shortfall: Math.max(0, bill - available) };
}

/** Mese "YYYY-MM" spostato di n mesi. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Movimenti di un pocket nel periodo, fino a oggi. Le rettifiche sono a parte. */
export function pocketPeriodStats(pocketId: Id, txs: Transaction[], p: Period) {
  let spent = 0;
  let received = 0;
  let movedOut = 0;
  let adjusted = 0;
  for (const t of txs) {
    if (!inPeriod(t.date, p)) continue;
    for (const l of t.legs) {
      if (l.pocketId !== pocketId) continue;
      if (t.kind === 'adjustment') adjusted += l.amount;
      else if (l.amount > 0) received += l.amount;
      else if (t.kind === 'transfer') movedOut -= l.amount;
      else spent -= l.amount; // uscite e arrotondamenti pagati da questo pocket
    }
  }
  /** Tutto ciò che è uscito (serve per le riserve). */
  return { spent, received, movedOut, adjusted, taken: spent + movedOut };
}

/** Chiave di deduplica di un addebito fisso nel periodo. */
export function debitKey(r: Recurring, p: Period): string {
  return `rec:${r.id}:${p.key}`;
}

/** Data dell'addebito dentro il periodo (il giorno del mese che cade nel periodo). */
export function debitDate(r: Recurring, p: Period): ISODate | null {
  if (!r.day) return null;
  for (let d = p.start; d <= p.end; d = nextDay(d)) {
    const day = Number(d.slice(8));
    const lastOfMonth = new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0).getDate();
    if (day === Math.min(r.day, lastOfMonth)) return d;
  }
  return null;
}

function nextDay(d: ISODate): ISODate {
  const [y, m, dd] = d.split('-').map(Number);
  const n = new Date(y!, m! - 1, dd! + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Addebiti fissi del periodo già scaduti e non ancora registrati: da confermare con un tocco. */
export function dueDebits(recurring: Recurring[], txs: Transaction[], p: Period, todayDate: ISODate): { recurring: Recurring; date: ISODate }[] {
  const done = new Set(txs.map((t) => t.autoKey).filter(Boolean));
  return recurring
    .filter((r) => r.active && r.kind === 'debit')
    .map((r) => ({ recurring: r, date: debitDate(r, p) }))
    .filter((x): x is { recurring: Recurring; date: ISODate } => !!x.date && x.date <= todayDate && !done.has(debitKey(x.recurring, p)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
