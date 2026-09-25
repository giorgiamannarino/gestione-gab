import { describe, expect, it } from 'vitest';
import { periodOf } from '../../src/lib/domain/dates';
import { dailyAllowance, deadlineMonthly, nextYear, paydaysUntil, tagSummary } from '../../src/lib/domain/planning';
import { tx } from './fixtures';

describe('oggi puoi spendere', () => {
  const p = periodOf('2030-11-01', 23); // 23 ott – 22 nov: 31 giorni

  it('saldo diviso i giorni che mancano (oggi compreso)', () => {
    const r = dailyAllowance(15840, 24160, '2030-11-11', p); // 12 giorni al 22 compreso
    expect(r.daysLeft).toBe(12);
    expect(r.perDay).toBe(1320);
  });

  it('ritmo: in linea, veloce, troppo veloce', () => {
    // Budget 400 €, a metà periodo circa.
    expect(dailyAllowance(20000, 20000, '2030-11-07', p).pace).toBe('ok');
    expect(dailyAllowance(15000, 25000, '2030-11-07', p).pace).toBe('fast');
    expect(dailyAllowance(10000, 30000, '2030-11-07', p).pace).toBe('tooFast');
    expect(dailyAllowance(0, 40000, '2030-11-07', p)).toMatchObject({ perDay: 0, pace: 'tooFast' });
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
