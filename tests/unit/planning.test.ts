import { describe, expect, it } from 'vitest';
import { periodOf } from '../../src/lib/domain/dates';
import { categoryAnomalies, dailyAllowance, deadlineMonthly, lastWeekSummary, mondayOf, nextYear, noSpendStreak, paydaysUntil, tagSummary } from '../../src/lib/domain/planning';
import { tx } from './fixtures';

describe('oggi puoi spendere', () => {
  const p = periodOf('2030-11-01', 23); // 23 ott – 22 nov: 31 giorni
  // Budget 310 € → 10 € al giorno. Il 27 ottobre è il 5° giorno: maturati 50 €.
  const on27 = (spent: number) => dailyAllowance(31000 - spent, spent, '2030-10-27', p);

  it('quota giornaliera e giorni che mancano', () => {
    expect(on27(4000)).toMatchObject({ daily: 1000, dayIndex: 5, daysLeft: 27 });
  });

  it('in linea: oggi la quota piena', () => {
    expect(on27(4000)).toMatchObject({ today: 1000, pace: 'ok' });
  });

  it('se nei giorni prima si è speso meno, il risparmio si somma', () => {
    expect(on27(1500)).toMatchObject({ today: 3500, pace: 'ok' }); // 50 − 15
  });

  it('se si è speso di più, si toglie dalla quota di oggi', () => {
    expect(on27(4600)).toMatchObject({ today: 400, pace: 'tight' }); // 50 − 46
  });

  it('sotto il programma: avviso finché non si torna in pari', () => {
    expect(on27(6200)).toMatchObject({ today: 0, overBy: 1200, pace: 'over' });
    // Qualche giorno dopo senza spese si torna in pari: 9° giorno, maturati 90 €.
    expect(dailyAllowance(31000 - 6200, 6200, '2030-10-31', p)).toMatchObject({ today: 2800, pace: 'ok' });
  });

  it('mai più del saldo reale', () => {
    expect(dailyAllowance(500, 0, '2030-11-20', p).today).toBeLessThanOrEqual(500);
  });
});

describe('scadenze', () => {
  it('conta gli stipendi prima della scadenza', () => {
    expect(paydaysUntil('2030-11-05', '2031-03-10', 23)).toBe(4); // 23 nov, dic, gen, feb
    expect(paydaysUntil('2030-11-23', '2031-03-10', 23)).toBe(3); // oggi è già il giorno di paga
    expect(paydaysUntil('2030-11-05', '2030-11-10', 23)).toBe(1); // nessuno stipendio prima: almeno 1
  });

  it('accantonamento mensile arrotondato all\'euro, al netto di quanto già messo da parte', () => {
    expect(deadlineMonthly({ amount: 45000, dueDate: '2031-03-10' }, '2030-11-05', 23)).toMatchObject({ monthly: 11300, paydays: 4 });
    expect(deadlineMonthly({ amount: 45000, dueDate: '2031-03-10' }, '2030-11-05', 23, 15000).monthly).toBe(7500);
    expect(deadlineMonthly({ amount: 45000, dueDate: '2031-03-10' }, '2030-11-05', 23, 50000).monthly).toBe(0);
  });

  it('scadenza annuale: stessa data dell\'anno dopo', () => {
    expect(nextYear('2031-03-10')).toBe('2032-03-10');
    expect(nextYear('2032-02-29')).toBe('2033-02-28');
  });
});

describe('settimana in breve', () => {
  const e = (date: string, cents: number, desc = 'x', categoryId?: string) =>
    tx({ date, kind: 'expense', description: desc, categoryId, legs: [{ pocketId: 'fun', amount: -cents }] });

  it('lunedì della settimana', () => {
    expect(mondayOf('2030-11-06')).toBe('2030-11-04'); // mercoledì → lunedì
    expect(mondayOf('2030-11-04')).toBe('2030-11-04');
    expect(mondayOf('2030-11-10')).toBe('2030-11-04'); // domenica
  });

  it('settimana scorsa confrontata con quella prima, senza categorie escluse', () => {
    const txs = [
      e('2030-10-28', 2000), e('2030-11-01', 5500, 'Cena'), e('2030-11-03', 999, 'Rettifica', 'adj'), // 28 ott – 3 nov
      e('2030-10-22', 5000), // settimana prima
      e('2030-11-04', 7777), // settimana corrente: non conta
    ];
    const w = lastWeekSummary(txs, new Set(['adj']), '2030-11-06');
    expect(w).toMatchObject({ from: '2030-10-28', to: '2030-11-03', total: 7500, count: 2, prevTotal: 5000 });
    expect(w.biggest).toEqual({ description: 'Cena', amount: 5500 });
    expect(w.change).toBeCloseTo(0.5);
  });
});

describe('spese fuori dal solito', () => {
  it('segnala solo categorie ben sopra la media dei periodi precedenti', () => {
    const cur = new Map([['bar', 18600], ['spesa', 30000], ['cinema', 1500]]);
    const prev = [new Map([['bar', 12000], ['spesa', 29000]]), new Map([['bar', 14600], ['spesa', 31000], ['cinema', 500]]), new Map()];
    const a = categoryAnomalies(cur, prev);
    expect(a.map((x) => x.id)).toEqual(['bar']); // cinema +200% ma solo +10 €: sotto la soglia dei 20 €
    expect(a[0]).toMatchObject({ amount: 18600, average: 13300 });
  });

  it('senza storico non segnala nulla', () => {
    expect(categoryAnomalies(new Map([['bar', 50000]]), [new Map()])).toEqual([]);
  });
});

describe('giorni senza spese', () => {
  const e = (date: string, pocketId = 'fun') => tx({ date, kind: 'expense', legs: [{ pocketId, amount: -500 }] });

  it('serie attuale (oggi compreso) e record', () => {
    const txs = [e('2030-11-01'), e('2030-11-02'), e('2030-11-09'), e('2030-11-10', 'home')];
    // 3–8 novembre: 6 giorni senza spese (record); dal 10 a oggi 12: 3 giorni.
    expect(noSpendStreak(txs, 'fun', '2030-11-12', '2030-11-01')).toEqual({ current: 3, best: 6 });
  });

  it('se oggi si è speso la serie è 0', () => {
    expect(noSpendStreak([e('2030-11-12')], 'fun', '2030-11-12', '2030-11-01').current).toBe(0);
  });
});

describe('etichette', () => {
  it('totale speso e movimenti per etichetta, senza distinguere maiuscole', () => {
    const txs = [
      tx({ date: '2030-06-01', kind: 'expense', tag: 'Weekend Roma', legs: [{ pocketId: 'fun', amount: -4500 }] }),
      tx({ date: '2030-06-02', kind: 'expense', tag: 'weekend roma', legs: [{ pocketId: 'home', amount: -2000 }] }),
      tx({ date: '2030-06-02', kind: 'roundup', tag: 'Weekend Roma', legs: [{ pocketId: 'home', amount: -100 }, { pocketId: 'coins', amount: 100 }] }),
      tx({ date: '2030-06-02', kind: 'transfer', tag: 'Weekend Roma', legs: [{ pocketId: 'main', amount: -10000 }, { pocketId: 'fun', amount: 10000 }] }),
      tx({ date: '2030-07-01', kind: 'expense', legs: [{ pocketId: 'fun', amount: -999 }] }),
    ];
    expect(tagSummary(txs)).toEqual([{ tag: 'Weekend Roma', spent: 6500, count: 3, first: '2030-06-01', last: '2030-06-02' }]);
  });
});
