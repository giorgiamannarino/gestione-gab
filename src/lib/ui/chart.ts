/** Utilità per i grafici: scale "pulite" ed etichette degli assi. */
import type { Cents } from '../domain/money';

/** Tacche dell'asse con valori tondi (1, 2, 2,5, 5 × 10^n), da 0 a ≥ max. */
export function niceTicks(maxCents: Cents, count = 4): Cents[] {
  const maxEuro = Math.max(1, maxCents / 100);
  const step = niceStep(maxEuro / count);
  const ticks: Cents[] = [];
  for (let v = 0; v < maxEuro + step * 0.999; v += step) ticks.push(Math.round(v * 100));
  return ticks;
}

function niceStep(rough: number): number {
  const pow = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
}

/**
 * Tacche tonde che coprono [min, max] senza partire per forza da zero.
 * Solo per i grafici a linee: la linea codifica una posizione, non una lunghezza.
 */
export function niceDomain(minCents: Cents, maxCents: Cents, count = 3): Cents[] {
  const lo = minCents / 100;
  const hi = maxCents / 100;
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  const step = niceStep(span / count);
  const start = Math.floor(lo / step) * step;
  const ticks: Cents[] = [];
  for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Math.round(v * 100));
  if (ticks.length < 2) ticks.push(Math.round((start + step) * 100));
  return ticks;
}

/** Etichetta d'asse compatta: "1.500 €", "12k €". */
export function axisLabel(cents: Cents): string {
  const euro = Math.round(cents / 100);
  if (Math.abs(euro) >= 10000) return `${Math.round(euro / 1000)}k €`;
  return `${String(euro).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
}
