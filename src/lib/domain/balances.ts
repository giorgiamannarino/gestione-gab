/**
 * Saldi: mai salvati, sempre calcolati come saldo iniziale + movimenti.
 */
import type { Cents } from './money';
import type { Id, ISODate, Pocket, Transaction } from './types';

/** Saldo di ogni pocket alla fine del giorno `until` (incluso). Senza data: saldo attuale. */
export function balances(pockets: Pocket[], txs: Transaction[], until?: ISODate): Map<Id, Cents> {
  const out = new Map<Id, Cents>(pockets.map((p) => [p.id, p.openingBalance]));
  for (const tx of txs) {
    if (until && tx.date > until) continue;
    for (const leg of tx.legs) {
      if (out.has(leg.pocketId)) out.set(leg.pocketId, out.get(leg.pocketId)! + leg.amount);
    }
  }
  return out;
}

/** Saldo alla fine del giorno precedente a `date`. */
export function balancesBefore(pockets: Pocket[], txs: Transaction[], date: ISODate): Map<Id, Cents> {
  return balances(pockets, txs.filter((t) => t.date < date));
}

export function sumBalances(map: Map<Id, Cents>, ids?: Iterable<Id>): Cents {
  if (!ids) return [...map.values()].reduce((a, b) => a + b, 0);
  let s = 0;
  for (const id of ids) s += map.get(id) ?? 0;
  return s;
}

/** Serie del saldo di un pocket alla fine di ciascuna data indicata. */
export function balanceSeries(pocket: Pocket, txs: Transaction[], dates: ISODate[]): Cents[] {
  const sorted = [...dates].sort();
  const deltas = txs
    .flatMap((t) => t.legs.filter((l) => l.pocketId === pocket.id).map((l) => [t.date, l.amount] as const))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const res = new Map<ISODate, Cents>();
  let bal = pocket.openingBalance;
  let i = 0;
  for (const d of sorted) {
    while (i < deltas.length && deltas[i]![0] <= d) bal += deltas[i++]![1];
    res.set(d, bal);
  }
  return dates.map((d) => res.get(d)!);
}
