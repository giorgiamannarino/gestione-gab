import { describe, expect, it } from 'vitest';
import { periodOf } from '../../src/lib/domain/dates';
import { summarize } from '../../src/lib/domain/summary';
import { demoData } from '../../src/lib/demo/demo-data';

describe('riepilogo del periodo', () => {
  const today = '2030-11-05';
  const data = demoData(today);
  const prev = periodOf('2030-10-01', 23); // periodo completo 23 set – 22 ott

  it('racconta un periodo completo con numeri coerenti', () => {
    const s = summarize(data, prev, today);
    expect(s.isCurrent).toBe(false);
    expect(s.salary?.amount).toBe(234500);
    expect(s.spending.count).toBeGreaterThan(5);
    expect(s.spending.total).toBe(s.spending.byCategory.reduce((a, c) => a + c.amount, 0));
    expect(s.spending.byCategory[0]!.share).toBeGreaterThan(0);
    expect(s.spending.biggest!.amount).toBeGreaterThanOrEqual(s.spending.byCategory.length ? 1 : 0);
    expect(s.roundups.count).toBeGreaterThan(0);
    expect(s.roundups.pocket).toBe('Savings');
    // Messo da parte = variazione di risparmi e investimenti.
    expect(s.savedTotal).toBe(s.saved.reduce((a, x) => a + x.amount, 0));
    expect(s.saved.find((x) => x.name === 'Fondo Pensione')!.amount).toBe(10000);
    // Patrimonio: giroconti e arrotondamenti non lo cambiano; entrate, spese e rettifiche sì.
    const income = (s.salary?.amount ?? 0) + s.otherIncome.reduce((a, x) => a + x.amount, 0);
    expect(s.wealthEnd - s.wealthStart).toBe(income - s.spending.total + s.adjustments.total);
    expect(s.debits.pending).toHaveLength(0);
    expect(s.groups.map((g) => g.name)).toEqual(['Intesa', 'Generali', 'Investimenti', 'Revolut']);
  });

  it('nel periodo in corso segnala stipendio mancante e addebiti in attesa', () => {
    const s = summarize(data, periodOf(today, 23), today);
    expect(s.isCurrent).toBe(true);
    expect(s.salary).toBeUndefined();
    expect(s.debits.pending.length).toBeGreaterThan(0);
    expect(s.daysElapsed).toBe(14); // dal 23 ottobre al 5 novembre
    expect(s.spending.dailyAvg).toBe(Math.round(s.spending.total / 14));
  });
});
