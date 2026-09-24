import { describe, expect, it } from 'vitest';
import { axisLabel, niceDomain, niceTicks } from '../../src/lib/ui/chart';

describe('niceTicks', () => {
  it('produce tacche tonde che coprono il massimo', () => {
    expect(niceTicks(123400)).toEqual([0, 50000, 100000, 150000]);
    expect(niceTicks(700000)).toEqual([0, 200000, 400000, 600000, 800000]);
    expect(niceTicks(9000, 3)).toEqual([0, 5000, 10000]);
  });

  it('gestisce il massimo zero', () => {
    const t = niceTicks(0);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBeGreaterThan(0);
  });
});

describe('niceDomain', () => {
  it('copre il minimo e il massimo con tacche tonde, senza partire da zero', () => {
    const t = niceDomain(268500, 331400);
    expect(t[0]).toBeLessThanOrEqual(268500);
    expect(t.at(-1)).toBeGreaterThanOrEqual(331400);
    expect(t[0]).toBeGreaterThan(0);
    // Intervallo 629 € / 3 → passo tondo 250 €.
    expect(t).toEqual([250000, 275000, 300000, 325000, 350000]);
  });

  it('gestisce un valore costante', () => {
    const t = niceDomain(100000, 100000);
    expect(t[0]).toBeLessThanOrEqual(100000);
    expect(t.at(-1)).toBeGreaterThan(100000);
  });
});

describe('axisLabel', () => {
  it('formatta con punto delle migliaia o in k', () => {
    expect(axisLabel(150000)).toBe('1.500 €');
    expect(axisLabel(1200000)).toBe('12k €');
    expect(axisLabel(0)).toBe('0 €');
  });
});
