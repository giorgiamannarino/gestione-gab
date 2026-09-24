/**
 * Regola di arrotondamento Revolut.
 * - Importo con centesimi: differenza fino all'euro successivo (12,30 → 0,70).
 * - Importo tondo: 1,00 € (18,00 → 1,00).
 * Si applica solo alle uscite da pocket Revolut (la decisione è del chiamante).
 */
import type { Cents } from './money';

export function roundupFor(expenseCents: Cents): Cents {
  const abs = Math.abs(expenseCents);
  if (!Number.isInteger(abs)) throw new Error(`Importo non intero: ${expenseCents}`);
  if (abs === 0) return 0;
  const rest = abs % 100;
  return rest === 0 ? 100 : 100 - rest;
}
