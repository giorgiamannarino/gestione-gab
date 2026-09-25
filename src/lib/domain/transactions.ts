/**
 * Costruzione dei movimenti: uscite (con arrotondamento Revolut), entrate,
 * giroconti uno-a-molti, rettifiche di saldo.
 */
import type { Cents } from './money';
import { roundupFor } from './roundup';
import type { Id, ISODate, Leg, Pocket, Transaction, TxSource } from './types';

export interface Ctx {
  pockets: Pocket[];
  newId: () => Id;
  now: () => number;
}

export interface EntryInput {
  kind: 'expense' | 'income' | 'transfer';
  date: ISODate;
  /** Importo positivo in centesimi. Per i giroconti: somma delle destinazioni. */
  amount: Cents;
  /** Uscite e giroconti. */
  fromPocketId?: Id;
  /** Entrate. */
  toPocketId?: Id;
  /** Giroconti: una o più destinazioni. */
  splits?: { pocketId: Id; amount: Cents }[];
  description: string;
  categoryId?: Id;
  note?: string;
  /** Etichetta di evento o viaggio. */
  tag?: string;
  roundup?: boolean;
  source?: TxSource;
  autoKey?: string;
}

export function savingsPocket(pockets: Pocket[]): Pocket | undefined {
  return pockets.find((p) => p.role === 'savings' && !p.archived);
}

function legsFor(input: EntryInput): Leg[] {
  if (!(input.amount > 0) || !Number.isInteger(input.amount)) throw new Error('Importo non valido');
  switch (input.kind) {
    case 'expense':
      if (!input.fromPocketId) throw new Error('Manca il pocket');
      return [{ pocketId: input.fromPocketId, amount: -input.amount }];
    case 'income':
      if (!input.toPocketId) throw new Error('Manca il pocket');
      return [{ pocketId: input.toPocketId, amount: input.amount }];
    case 'transfer': {
      const splits = (input.splits ?? []).filter((s) => s.amount !== 0);
      if (!input.fromPocketId || splits.length === 0) throw new Error('Giroconto incompleto');
      if (splits.some((s) => s.pocketId === input.fromPocketId)) throw new Error('Origine e destinazione coincidono');
      const total = splits.reduce((a, s) => a + s.amount, 0);
      return [{ pocketId: input.fromPocketId, amount: -total }, ...splits.map((s) => ({ pocketId: s.pocketId, amount: s.amount }))];
    }
  }
}

/** L'arrotondamento si applica solo alle uscite pagate da un pocket Revolut (non Savings). */
export function roundupApplies(tx: Pick<Transaction, 'kind' | 'legs' | 'roundup'>, pockets: Pocket[]): boolean {
  if (tx.kind !== 'expense' || tx.roundup === false) return false;
  const payer = pockets.find((p) => p.id === tx.legs[0]?.pocketId);
  const savings = savingsPocket(pockets);
  return !!payer && payer.isRevolut && !!savings && payer.id !== savings.id;
}

/** Anteprima dell'arrotondamento per il form (0 se non si applica). */
export function roundupPreview(input: Pick<EntryInput, 'kind' | 'amount' | 'fromPocketId' | 'roundup'>, pockets: Pocket[]): Cents {
  if (!input.fromPocketId || !(input.amount > 0)) return 0;
  const legs = [{ pocketId: input.fromPocketId, amount: -input.amount }];
  return roundupApplies({ kind: input.kind, legs, roundup: input.roundup }, pockets) ? roundupFor(input.amount) : 0;
}

/**
 * Arrotondamento collegato a un'uscita: nuovo, aggiornato o null se non serve più.
 * Riusa l'id di quello esistente così le modifiche restano collegate.
 */
export function roundupTxFor(tx: Transaction, ctx: Ctx, existing?: Transaction): Transaction | null {
  if (!roundupApplies(tx, ctx.pockets)) return null;
  const payer = tx.legs[0]!;
  const amount = roundupFor(payer.amount);
  const savings = savingsPocket(ctx.pockets)!;
  const now = ctx.now();
  return {
    id: existing?.id ?? ctx.newId(),
    date: tx.date,
    kind: 'roundup',
    legs: [
      { pocketId: payer.pocketId, amount: -amount },
      { pocketId: savings.id, amount },
    ],
    description: `Arrotondamento · ${tx.description}`,
    parentId: tx.id,
    source: tx.source,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildEntry(input: EntryInput, ctx: Ctx, existing?: Transaction): Transaction {
  const now = ctx.now();
  return {
    id: existing?.id ?? ctx.newId(),
    date: input.date,
    kind: input.kind,
    legs: legsFor(input),
    description: input.description.trim(),
    categoryId: input.categoryId,
    note: input.note?.trim() || undefined,
    tag: input.tag?.trim().slice(0, 60) || undefined,
    roundup: input.kind === 'expense' ? input.roundup !== false : undefined,
    source: input.source ?? existing?.source ?? 'manual',
    autoKey: input.autoKey ?? existing?.autoKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Rettifica: porta il saldo di un pocket al valore reale. Null se non c'è differenza. */
export function buildAdjustment(
  pocketId: Id,
  currentBalance: Cents,
  realBalance: Cents,
  date: ISODate,
  ctx: Ctx,
  categoryId?: Id,
): Transaction | null {
  const diff = realBalance - currentBalance;
  if (diff === 0) return null;
  const now = ctx.now();
  return {
    id: ctx.newId(),
    date,
    kind: 'adjustment',
    legs: [{ pocketId, amount: diff }],
    description: 'Rettifica saldo',
    categoryId,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };
}

/** Importo "principale" di un movimento, positivo, per le liste. */
export function txAmount(tx: Transaction): Cents {
  if (tx.kind === 'transfer' || tx.kind === 'roundup') {
    return tx.legs.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  }
  return Math.abs(tx.legs.reduce((a, l) => a + l.amount, 0));
}
