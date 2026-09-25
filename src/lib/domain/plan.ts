/**
 * Piano di inizio periodo: cosa spostare dove quando arriva lo stipendio,
 * cosa resta sul conto principale e quanto si può mettere da parte.
 */
import type { Cents } from './money';
import { roundupFor } from './roundup';
import type { ISODate, Id, Pocket, Recurring } from './types';

export interface PlanLine {
  recurringId: Id;
  name: string;
  fromPocketId: Id;
  toPocketId?: Id;
  /** Quanto spostare davvero. */
  amount: Cents;
  /** Importo pieno della voce (per le ricariche: il livello da raggiungere). */
  target: Cents;
  mode: AllocationMode;
  /** Ricarica: quanto era rimasto sul pocket prima dello stipendio. */
  remaining?: Cents;
  /** Riserva: quanto è uscito dal pocket nel periodo precedente. */
  taken?: Cents;
  /** Scadenza: data del pagamento e stipendi che restano per accantonare (questo compreso). */
  dueDate?: ISODate;
  paydays?: number;
}

export type AllocationMode = NonNullable<Recurring['mode']> | 'full';

/** Extra predefinito per le riserve quando è stato preso meno del budget. */
export const DEFAULT_RESERVE_EXTRA: Cents = 10_000;

/**
 * Importo da spostare secondo la modalità della voce.
 * - full: sempre l'importo pieno.
 * - topUp: solo quanto manca per arrivare all'importo.
 * - reserve: nulla preso → metà del budget; preso meno del budget → preso + extra; altrimenti → preso.
 */
export function allocationAmount(mode: AllocationMode, target: Cents, info: { remaining?: Cents; taken?: Cents; extra?: Cents }): Cents {
  switch (mode) {
    case 'topUp':
      return Math.max(0, target - (info.remaining ?? 0));
    case 'reserve': {
      const taken = Math.max(0, info.taken ?? 0);
      if (taken === 0) return Math.round(target / 2);
      return taken < target ? taken + (info.extra ?? DEFAULT_RESERVE_EXTRA) : taken;
    }
    default:
      return target;
  }
}

export interface Plan {
  /** Spostamenti registrati da soli con lo stipendio (FP, PAC). */
  auto: PlanLine[];
  /** Checklist: spostamenti verso pocket Revolut. */
  revolut: PlanLine[];
  revolutTotal: Cents;
  /** Checklist: altri spostamenti (es. bollette). */
  others: PlanLine[];
  /** Checklist: accantonamenti per le scadenze (bollo, assicurazione…). */
  deadlines: PlanLine[];
  /** Cosa deve restare sul conto principale (addebiti e budget). */
  keep: PlanLine[];
  /** Totale di fissi e spostamenti. */
  fixedTotal: Cents;
  /** Margine di sicurezza da avere sul conto principale. */
  safetyMargin: Cents;
  /** Parte del margine già coperta da quanto era rimasto prima dello stipendio. */
  marginFromLeftover: Cents;
  /** Parte del margine da tenere dallo stipendio (margine − rimasto, mai negativo). */
  marginFromSalary: Cents;
  /** Stipendio − fissi − margine da tenere dallo stipendio (mai negativo). */
  saveable: Cents;
  /** Quanto era rimasto sul conto principale prima dello stipendio. */
  leftover: Cents;
  /** Rimasto oltre il margine: spostabile sui risparmi. */
  leftoverExcess: Cents;
}

/**
 * Margine di sicurezza e avanzo: quello che è rimasto sul conto principale conta per il margine.
 * Margine 50, rimasti 20 → dallo stipendio se ne tengono 30. Margine 50, rimasti 60 → nulla
 * dallo stipendio, 50 restano come margine e 10 sono spostabili sui risparmi.
 */
export function splitMargin(margin: Cents, leftover: Cents) {
  const left = Math.max(0, leftover);
  const fromLeftover = Math.min(margin, left);
  return { fromLeftover, fromSalary: margin - fromLeftover, excess: left - fromLeftover };
}

/** Importo di una voce fissa. Per "abbonamenti" = addebiti del pocket + i loro arrotondamenti. */
export function recurringAmount(r: Recurring, all: Recurring[], pockets: Pocket[]): Cents {
  if (!r.amountFromDebits || !r.toPocketId) return r.amount;
  const target = pockets.find((p) => p.id === r.toPocketId);
  return all
    .filter((d) => d.active && d.kind === 'debit' && d.fromPocketId === r.toPocketId)
    .reduce((sum, d) => sum + d.amount + (target?.isRevolut ? roundupFor(d.amount) : 0), 0);
}

/**
 * Previsione per il prossimo inizio mese di una voce, con i dati di oggi:
 * saldo attuale (ricarica) e uscite del periodo finora (riserva).
 */
export function forecastAllocation(r: Recurring, all: Recurring[], pockets: Pocket[], balance: Cents, takenSoFar: Cents) {
  const target = recurringAmount(r, all, pockets);
  const mode: AllocationMode = r.mode ?? 'full';
  const extra = r.reserveExtra ?? DEFAULT_RESERVE_EXTRA;
  return { mode, target, extra, balance, taken: takenSoFar, amount: allocationAmount(mode, target, { remaining: balance, taken: takenSoFar, extra }) };
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
  /** Uscite di ogni pocket nel periodo precedente: servono per le riserve. */
  takenPrev?: Map<Id, Cents>;
  /** Accantonamenti delle scadenze per questo periodo. */
  deadlines?: PlanLine[];
}): Plan {
  const { recurring, pockets, mainPocketId } = input;
  const active = recurring.filter((r) => r.active).sort((a, b) => a.order - b.order);
  const line = (r: Recurring): PlanLine => {
    const target = recurringAmount(r, recurring, pockets);
    const base = { recurringId: r.id, name: r.name, fromPocketId: r.fromPocketId, toPocketId: r.toPocketId, target };
    const mode: AllocationMode = r.kind === 'allocation' && r.toPocketId ? (r.mode ?? 'full') : 'full';
    if (mode === 'topUp' && input.balancesBefore) {
      const remaining = input.balancesBefore.get(r.toPocketId!) ?? 0;
      return { ...base, mode, remaining, amount: allocationAmount(mode, target, { remaining }) };
    }
    if (mode === 'reserve' && input.takenPrev) {
      const taken = input.takenPrev.get(r.toPocketId!) ?? 0;
      return { ...base, mode, taken, amount: allocationAmount(mode, target, { taken, extra: r.reserveExtra }) };
    }
    return { ...base, mode: 'full', amount: target };
  };
  const isRevolut = (id?: Id) => pockets.find((p) => p.id === id)?.isRevolut ?? false;

  const allocations = active.filter((r) => r.kind === 'allocation' && r.fromPocketId === mainPocketId);
  const auto = allocations.filter((r) => r.auto).map(line);
  const revolut = allocations.filter((r) => !r.auto && isRevolut(r.toPocketId)).map(line);
  const others = allocations.filter((r) => !r.auto && !isRevolut(r.toPocketId)).map(line);
  // Restano sul conto solo spese vere e budget. I giroconti programmati (es. versamenti verso
  // FP e PAC) sono già coperti dagli spostamenti di inizio mese: contarli qui li raddoppierebbe.
  const keep = active
    .filter((r) => (r.kind === 'budget' || (r.kind === 'debit' && !r.toPocketId)) && r.fromPocketId === mainPocketId)
    .map(line);

  const deadlines = (input.deadlines ?? []).filter((l) => l.amount > 0);

  const sum = (ls: PlanLine[]) => ls.reduce((a, l) => a + l.amount, 0);
  const fixedTotal = sum(auto) + sum(revolut) + sum(others) + sum(deadlines) + sum(keep);
  const margin = splitMargin(input.safetyMargin, input.leftover);
  return {
    auto,
    revolut,
    revolutTotal: sum(revolut),
    others,
    deadlines,
    keep,
    fixedTotal,
    safetyMargin: input.safetyMargin,
    marginFromLeftover: margin.fromLeftover,
    marginFromSalary: margin.fromSalary,
    saveable: Math.max(0, input.salary - fixedTotal - margin.fromSalary),
    leftover: input.leftover,
    leftoverExcess: margin.excess,
  };
}
