/**
 * Piano di inizio periodo: cosa spostare dove quando arriva lo stipendio,
 * cosa resta sul conto principale e quanto si può mettere da parte.
 */
import type { Cents } from './money';
import { roundupFor } from './roundup';
import type { Id, Pocket, Recurring } from './types';

export interface PlanLine {
  recurringId: Id;
  name: string;
  fromPocketId: Id;
  toPocketId?: Id;
  /** Quanto spostare davvero. */
  amount: Cents;
  /** Importo pieno della voce (per le ricariche: il livello da raggiungere). */
  target: Cents;
  /** Solo ricariche: quanto era rimasto sul pocket prima dello stipendio. */
  remaining?: Cents;
}

/** Le voci verso un pocket Revolut sono ricariche fino all'importo, salvo `topUp: false`. */
export function isTopUp(r: Recurring, pockets: Pocket[]): boolean {
  if (r.kind !== 'allocation' || r.topUp === false) return false;
  return pockets.find((p) => p.id === r.toPocketId)?.isRevolut ?? false;
}

export interface Plan {
  /** Spostamenti registrati da soli con lo stipendio (FP, PAC). */
  auto: PlanLine[];
  /** Checklist: spostamenti verso pocket Revolut. */
  revolut: PlanLine[];
  revolutTotal: Cents;
  /** Checklist: altri spostamenti (es. bollette). */
  others: PlanLine[];
  /** Cosa deve restare sul conto principale (addebiti e budget). */
  keep: PlanLine[];
  /** Totale di fissi e spostamenti. */
  fixedTotal: Cents;
  safetyMargin: Cents;
  /** Stipendio − fissi − margine (mai negativo). */
  saveable: Cents;
  /** Quanto era rimasto sul conto principale prima dello stipendio. */
  leftover: Cents;
}

/** Importo di una voce fissa. Per "abbonamenti" = addebiti del pocket + i loro arrotondamenti. */
export function recurringAmount(r: Recurring, all: Recurring[], pockets: Pocket[]): Cents {
  if (!r.amountFromDebits || !r.toPocketId) return r.amount;
  const target = pockets.find((p) => p.id === r.toPocketId);
  return all
    .filter((d) => d.active && d.kind === 'debit' && d.fromPocketId === r.toPocketId)
    .reduce((sum, d) => sum + d.amount + (target?.isRevolut ? roundupFor(d.amount) : 0), 0);
}

export function buildPlan(input: {
  salary: Cents;
  recurring: Recurring[];
  pockets: Pocket[];
  mainPocketId: Id;
  safetyMargin: Cents;
  leftover: Cents;
  /** Saldi dei pocket prima dello stipendio: servono per le ricariche. */
  balancesBefore?: Map<Id, Cents>;
}): Plan {
  const { recurring, pockets, mainPocketId } = input;
  const active = recurring.filter((r) => r.active).sort((a, b) => a.order - b.order);
  const line = (r: Recurring): PlanLine => {
    const target = recurringAmount(r, recurring, pockets);
    if (input.balancesBefore && r.toPocketId && isTopUp(r, pockets)) {
      const remaining = input.balancesBefore.get(r.toPocketId) ?? 0;
      return { recurringId: r.id, name: r.name, fromPocketId: r.fromPocketId, toPocketId: r.toPocketId, target, remaining, amount: Math.max(0, target - remaining) };
    }
    return { recurringId: r.id, name: r.name, fromPocketId: r.fromPocketId, toPocketId: r.toPocketId, target, amount: target };
  };
  const isRevolut = (id?: Id) => pockets.find((p) => p.id === id)?.isRevolut ?? false;

  const allocations = active.filter((r) => r.kind === 'allocation' && r.fromPocketId === mainPocketId);
  const auto = allocations.filter((r) => r.auto).map(line);
  const revolut = allocations.filter((r) => !r.auto && isRevolut(r.toPocketId)).map(line);
  const others = allocations.filter((r) => !r.auto && !isRevolut(r.toPocketId)).map(line);
  const keep = active.filter((r) => (r.kind === 'debit' || r.kind === 'budget') && r.fromPocketId === mainPocketId).map(line);

  const sum = (ls: PlanLine[]) => ls.reduce((a, l) => a + l.amount, 0);
  const fixedTotal = sum(auto) + sum(revolut) + sum(others) + sum(keep);
  return {
    auto,
    revolut,
    revolutTotal: sum(revolut),
    others,
    keep,
    fixedTotal,
    safetyMargin: input.safetyMargin,
    saveable: Math.max(0, input.salary - fixedTotal - input.safetyMargin),
    leftover: input.leftover,
  };
}
