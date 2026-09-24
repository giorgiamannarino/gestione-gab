// Dati INVENTATI per i test.
import type { Pocket, Recurring, Transaction } from '../../src/lib/domain/types';

const base = { archived: false, openingDate: '2030-01-23', icon: 'wallet', color: 'indaco' as const };

export const pockets: Pocket[] = [
  { ...base, id: 'main', name: 'Conto', groupId: 'g1', isRevolut: false, role: 'main', openingBalance: 10000, order: 0 },
  { ...base, id: 'save', name: 'Risparmi', groupId: 'g2', isRevolut: false, openingBalance: 500000, order: 1 },
  { ...base, id: 'bills', name: 'Bollette', groupId: 'g2', isRevolut: false, role: 'bills', openingBalance: 0, order: 2 },
  { ...base, id: 'inv1', name: 'Fondo', groupId: 'g3', isRevolut: false, role: 'investment', openingBalance: 300000, order: 3 },
  { ...base, id: 'inv2', name: 'Piano', groupId: 'g3', isRevolut: false, role: 'investment', openingBalance: 360000, order: 4 },
  { ...base, id: 'subs', name: 'Abbonamenti', groupId: 'g4', isRevolut: true, openingBalance: 4000, order: 5 },
  { ...base, id: 'fun', name: 'Svago', groupId: 'g4', isRevolut: true, openingBalance: 8000, order: 6 },
  { ...base, id: 'home', name: 'Casa', groupId: 'g4', isRevolut: true, openingBalance: 400, order: 7 },
  { ...base, id: 'love', name: 'Coppia', groupId: 'g4', isRevolut: true, openingBalance: 4000, order: 8 },
  { ...base, id: 'car', name: 'Auto', groupId: 'g4', isRevolut: true, openingBalance: 0, order: 9 },
  { ...base, id: 'coins', name: 'Salvadanaio', groupId: 'g4', isRevolut: true, role: 'savings', openingBalance: 880, order: 10 },
];

let n = 0;
export const ids = () => `id${++n}`;
export const ctx = { pockets, newId: ids, now: () => 1_900_000_000_000 };

const r = (x: Partial<Recurring> & Pick<Recurring, 'id' | 'name' | 'kind' | 'fromPocketId'>): Recurring => ({
  amount: 0,
  active: true,
  order: 0,
  ...x,
});

/** Stessa struttura del piano reale, importi coerenti con l'esempio della specifica. */
export const recurring: Recurring[] = [
  r({ id: 'tax', name: 'Tassa', kind: 'debit', fromPocketId: 'main', amount: 2604, day: 23, order: 1 }),
  r({ id: 'fuel', name: 'Benzina', kind: 'budget', fromPocketId: 'main', amount: 9000, categoryId: 'cat-fuel', order: 2 }),
  r({ id: 'f', name: 'Fondo', kind: 'allocation', fromPocketId: 'main', toPocketId: 'inv1', amount: 10000, auto: true, order: 3 }),
  r({ id: 'p', name: 'Piano', kind: 'allocation', fromPocketId: 'main', toPocketId: 'inv2', amount: 10000, auto: true, order: 4 }),
  r({ id: 'b', name: 'Bollette', kind: 'allocation', fromPocketId: 'main', toPocketId: 'bills', amount: 10000, order: 5 }),
  r({ id: 's', name: 'Abbonamenti', kind: 'allocation', fromPocketId: 'main', toPocketId: 'subs', amountFromDebits: true, order: 6 }),
  r({ id: 'l', name: 'Coppia', kind: 'allocation', fromPocketId: 'main', toPocketId: 'love', amount: 5000, order: 7 }),
  r({ id: 'h', name: 'Casa', kind: 'allocation', fromPocketId: 'main', toPocketId: 'home', amount: 30000, order: 8 }),
  r({ id: 'u', name: 'Svago', kind: 'allocation', fromPocketId: 'main', toPocketId: 'fun', amount: 40000, order: 9 }),
  r({ id: 'c', name: 'Auto', kind: 'allocation', fromPocketId: 'main', toPocketId: 'car', amount: 15000, order: 10 }),
  r({ id: 'net', name: 'Internet', kind: 'debit', fromPocketId: 'subs', amount: 995, day: 25, order: 11 }),
  r({ id: 'mus', name: 'Musica', kind: 'debit', fromPocketId: 'subs', amount: 2099, day: 19, order: 12 }),
  r({ id: 'tv', name: 'Serie TV', kind: 'debit', fromPocketId: 'subs', amount: 599, day: 17, order: 13 }),
];

export function tx(p: Partial<Transaction> & Pick<Transaction, 'date' | 'kind' | 'legs'>): Transaction {
  return { id: ids(), description: 'x', source: 'manual', createdAt: 0, updatedAt: 0, ...p };
}
