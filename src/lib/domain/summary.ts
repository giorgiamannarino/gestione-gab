/**
 * Riepilogo di un periodo: tutti i numeri che servono per raccontare "cosa è successo questo mese".
 * Solo calcoli, nessun testo: le frasi le compone la schermata.
 */
import { balances } from './balances';
import { addDays, inPeriod, shiftPeriod, type Period } from './dates';
import type { Cents } from './money';
import { spendingByCategory, spendingByPocket, totalSpending, budgetSpent, debitDate, debitKey } from './stats';
import type { AppData, Id, ISODate } from './types';

export interface NamedAmount {
  id: Id;
  name: string;
  amount: Cents;
}

export interface PeriodSummary {
  period: Period;
  /** Giorni trascorsi del periodo (fino a oggi compreso) e giorni totali. */
  daysElapsed: number;
  daysTotal: number;
  isCurrent: boolean;
  wealthStart: Cents;
  wealthEnd: Cents;
  salary?: { amount: Cents; date: ISODate };
  otherIncome: NamedAmount[];
  /** Variazione dei pocket "da parte" (risparmi e investimenti) nel periodo. */
  saved: NamedAmount[];
  savedTotal: Cents;
  /** Giroconti per pocket di destinazione (esclusi gli arrotondamenti). */
  transfersIn: (NamedAmount & { group: string })[];
  spending: {
    total: Cents;
    count: number;
    dailyAvg: Cents;
    prevTotal: Cents;
    byCategory: (NamedAmount & { share: number })[];
    byPocket: NamedAmount[];
    biggest?: { description: string; amount: Cents; date: ISODate; pocket: string };
    busiestDay?: { date: ISODate; amount: Cents; count: number };
    topDescriptions: { description: string; count: number; amount: Cents }[];
  };
  roundups: { total: Cents; count: number; pocket?: string };
  budgets: { name: string; spent: Cents; budget: Cents }[];
  debits: { confirmed: NamedAmount[]; pending: (NamedAmount & { date: ISODate })[] };
  adjustments: { count: number; total: Cents };
  investments: { id: Id; name: string; start: Cents; end: Cents; value?: Cents }[];
  groups: { name: string; start: Cents; end: Cents }[];
}

function daysBetween(a: ISODate, b: ISODate): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb!, mb! - 1, db!) - Date.UTC(ya!, ma! - 1, da!)) / 86_400_000) + 1;
}

export function summarize(data: AppData, period: Period, today: ISODate): PeriodSummary {
  const { pockets, transactions: txs, categories, recurring } = data;
  const active = pockets.filter((p) => !p.archived);
  const pName = (id: Id) => pockets.find((p) => p.id === id)?.name ?? '—';
  const gName = (id: Id) => data.groups.find((g) => g.id === pockets.find((p) => p.id === id)?.groupId)?.name ?? '';
  const inP = txs.filter((t) => inPeriod(t.date, period));
  const endDate = today < period.end ? today : period.end;
  const before = balances(pockets, txs, addDays(period.start, -1));
  const after = balances(pockets, txs, endDate);
  const sum = (m: Map<Id, Cents>, ids: Id[]) => ids.reduce((a, id) => a + (m.get(id) ?? 0), 0);
  const activeIds = active.map((p) => p.id);

  // Entrate
  const salaryTx = inP.find((t) => t.kind === 'income' && (t.autoKey?.startsWith('salary:') || (data.settings.salaryCategoryId && t.categoryId === data.settings.salaryCategoryId)));
  const otherIncome = inP
    .filter((t) => t.kind === 'income' && t !== salaryTx)
    .map((t) => ({ id: t.id, name: t.description, amount: t.legs.reduce((a, l) => a + l.amount, 0) }));

  // Da parte: risparmi e investimenti
  const setAside = active.filter((p) => p.role === 'reserve' || p.role === 'investment');
  const saved = setAside.map((p) => ({ id: p.id, name: p.name, amount: (after.get(p.id) ?? 0) - (before.get(p.id) ?? 0) })).filter((x) => x.amount !== 0);

  // Giroconti per destinazione
  const tin = new Map<Id, Cents>();
  for (const t of inP.filter((x) => x.kind === 'transfer')) for (const l of t.legs) if (l.amount > 0) tin.set(l.pocketId, (tin.get(l.pocketId) ?? 0) + l.amount);
  const transfersIn = [...tin].map(([id, amount]) => ({ id, name: pName(id), amount, group: gName(id) })).sort((a, b) => b.amount - a.amount);

  // Spese
  const excluded = new Set(categories.filter((c) => c.excludedFromStats).map((c) => c.id));
  const spendTx = inP.filter((t) => t.kind === 'expense' && !(t.categoryId && excluded.has(t.categoryId)));
  const amountOf = (t: (typeof spendTx)[number]) => -t.legs.reduce((a, l) => a + l.amount, 0);
  const total = totalSpending(txs, period, categories);
  const byCat = [...spendingByCategory(txs, period, categories)].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const byDay = new Map<ISODate, { amount: Cents; count: number }>();
  for (const t of spendTx) {
    const d = byDay.get(t.date) ?? { amount: 0, count: 0 };
    byDay.set(t.date, { amount: d.amount + amountOf(t), count: d.count + 1 });
  }
  const busiest = [...byDay].sort((a, b) => b[1].amount - a[1].amount)[0];
  const biggestTx = [...spendTx].sort((a, b) => amountOf(b) - amountOf(a))[0];
  const descr = new Map<string, { description: string; count: number; amount: Cents }>();
  for (const t of spendTx) {
    const k = t.description.trim().toLowerCase();
    const d = descr.get(k) ?? { description: t.description, count: 0, amount: 0 };
    descr.set(k, { ...d, count: d.count + 1, amount: d.amount + amountOf(t) });
  }
  const daysElapsed = Math.max(1, Math.min(daysBetween(period.start, endDate), daysBetween(period.start, period.end)));

  // Arrotondamenti
  const rtx = inP.filter((t) => t.kind === 'roundup');
  const savingsLeg = rtx.flatMap((t) => t.legs).filter((l) => l.amount > 0);

  // Addebiti fissi
  const debitsAll = recurring.filter((r) => r.active && r.kind === 'debit');
  const keys = new Set(txs.map((t) => t.autoKey).filter(Boolean));
  const confirmed = debitsAll.filter((r) => keys.has(debitKey(r, period))).map((r) => ({ id: r.id, name: r.name, amount: r.amount }));
  const pending = debitsAll
    .filter((r) => !keys.has(debitKey(r, period)))
    .map((r) => ({ id: r.id, name: r.name, amount: r.amount, date: debitDate(r, period) ?? period.end }));

  const adj = inP.filter((t) => t.kind === 'adjustment');

  const investments = active
    .filter((p) => p.role === 'investment')
    .map((p) => {
      const v = data.valuations.filter((x) => x.pocketId === p.id && x.date <= endDate).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return { id: p.id, name: p.name, start: before.get(p.id) ?? 0, end: after.get(p.id) ?? 0, value: v?.value };
    });

  const groups = [...data.groups]
    .sort((a, b) => a.order - b.order)
    .map((g) => {
      const ids = active.filter((p) => p.groupId === g.id).map((p) => p.id);
      return { name: g.name, start: sum(before, ids), end: sum(after, ids), n: ids.length };
    })
    .filter((g) => g.n > 0)
    .map(({ n: _n, ...g }) => g);

  return {
    period,
    daysElapsed,
    daysTotal: daysBetween(period.start, period.end),
    isCurrent: today >= period.start && today <= period.end,
    wealthStart: sum(before, activeIds),
    wealthEnd: sum(after, activeIds),
    salary: salaryTx ? { amount: salaryTx.legs.reduce((a, l) => a + l.amount, 0), date: salaryTx.date } : undefined,
    otherIncome,
    saved,
    savedTotal: saved.reduce((a, s) => a + s.amount, 0),
    transfersIn,
    spending: {
      total,
      count: spendTx.length,
      dailyAvg: Math.round(total / daysElapsed),
      prevTotal: totalSpending(txs, shiftPeriod(period, -1, data.settings.salaryDay), categories),
      byCategory: byCat.map(([id, amount]) => ({ id, name: categories.find((c) => c.id === id)?.name ?? 'Senza categoria', amount, share: total ? amount / total : 0 })),
      byPocket: [...spendingByPocket(txs, period, categories)].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, amount]) => ({ id, name: pName(id), amount })),
      biggest: biggestTx ? { description: biggestTx.description, amount: amountOf(biggestTx), date: biggestTx.date, pocket: pName(biggestTx.legs[0]!.pocketId) } : undefined,
      busiestDay: busiest ? { date: busiest[0], ...busiest[1] } : undefined,
      topDescriptions: [...descr.values()].filter((d) => d.count > 1).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 3),
    },
    roundups: { total: savingsLeg.reduce((a, l) => a + l.amount, 0), count: rtx.length, pocket: savingsLeg[0] ? pName(savingsLeg[0].pocketId) : undefined },
    budgets: recurring.filter((r) => r.active && r.kind === 'budget').map((b) => ({ name: b.name, spent: budgetSpent(b, txs, period), budget: b.amount })),
    debits: { confirmed, pending },
    adjustments: { count: adj.length, total: adj.reduce((a, t) => a + t.legs.reduce((s, l) => s + l.amount, 0), 0) },
    investments,
    groups,
  };
}
