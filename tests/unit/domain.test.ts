import { describe, expect, it } from 'vitest';
import { balances, balanceSeries, sumBalances } from '../../src/lib/domain/balances';
import { periodLabel, periodOf, shiftPeriod } from '../../src/lib/domain/dates';
import { buildPlan, forecastAllocation, recurringAmount, splitMargin } from '../../src/lib/domain/plan';
import { addMonths, billAvailable, billExpectedIn, billReferencePeriod, billShortfall, budgetSpent, dailySpending, dueDebits, pocketPeriodStats, spendingByCategory, splitBill, totalSpending } from '../../src/lib/domain/stats';
import { buildAdjustment, buildEntry, roundupPreview, roundupTxFor } from '../../src/lib/domain/transactions';
import { ctx, pockets, recurring, tx } from './fixtures';

describe('periodi', () => {
  it('va dal 23 al 22 del mese dopo', () => {
    expect(periodOf('2030-01-23', 23)).toEqual({ key: '2030-01', start: '2030-01-23', end: '2030-02-22' });
    expect(periodOf('2030-02-22', 23).key).toBe('2030-01');
    expect(periodOf('2030-01-05', 23)).toEqual({ key: '2029-12', start: '2029-12-23', end: '2030-01-22' });
  });

  it('gestisce giorni oltre la fine del mese', () => {
    const p = periodOf('2030-02-28', 31);
    expect(p.start).toBe('2030-02-28');
    expect(p.end).toBe('2030-03-30');
  });

  it('si sposta avanti e indietro e ha un\'etichetta italiana', () => {
    const p = periodOf('2030-01-23', 23);
    expect(shiftPeriod(p, 1, 23).start).toBe('2030-02-23');
    expect(shiftPeriod(p, -2, 23).start).toBe('2029-11-23');
    expect(periodLabel(p)).toBe('23 gen – 22 feb');
  });
});

describe('saldi nel tempo', () => {
  const txs = [
    tx({ date: '2030-01-23', kind: 'income', legs: [{ pocketId: 'main', amount: 200000 }] }),
    tx({ date: '2030-02-10', kind: 'expense', legs: [{ pocketId: 'main', amount: -5000 }] }),
    tx({ date: '2030-03-01', kind: 'transfer', legs: [{ pocketId: 'main', amount: -10000 }, { pocketId: 'save', amount: 10000 }] }),
  ];

  it('saldo = iniziale + movimenti, senza azzeramenti tra periodi', () => {
    const now = balances(pockets, txs);
    expect(now.get('main')).toBe(10000 + 200000 - 5000 - 10000);
    expect(now.get('save')).toBe(510000);
  });

  it('calcola il saldo a una data', () => {
    expect(balances(pockets, txs, '2030-02-09').get('main')).toBe(210000);
    expect(balances(pockets, txs, '2030-02-10').get('main')).toBe(205000);
  });

  it('i giroconti non cambiano il totale', () => {
    const before = sumBalances(balances(pockets, txs, '2030-02-28'));
    expect(sumBalances(balances(pockets, txs))).toBe(before);
  });

  it('serie del saldo', () => {
    expect(balanceSeries(pockets[0]!, txs, ['2030-01-22', '2030-02-22', '2030-03-22'])).toEqual([10000, 205000, 195000]);
  });
});

describe('arrotondamento sui movimenti', () => {
  it('si crea per uscite da pocket Revolut e va nei Savings', () => {
    const e = buildEntry({ kind: 'expense', date: '2030-01-24', amount: 1230, fromPocketId: 'fun', description: 'Bar' }, ctx);
    const r = roundupTxFor(e, ctx)!;
    expect(r.legs).toEqual([{ pocketId: 'fun', amount: -70 }, { pocketId: 'coins', amount: 70 }]);
    expect(r.parentId).toBe(e.id);
    const b = balances(pockets, [e, r]);
    expect(b.get('fun')).toBe(8000 - 1230 - 70);
    expect(b.get('coins')).toBe(880 + 70);
  });

  it('importo tondo → 1,00 €, anteprima coerente', () => {
    expect(roundupPreview({ kind: 'expense', amount: 1800, fromPocketId: 'home' }, pockets)).toBe(100);
  });

  it('non si applica a entrate, giroconti, pocket non Revolut, rettifiche o se disattivato', () => {
    expect(roundupPreview({ kind: 'income', amount: 1230, fromPocketId: 'fun' }, pockets)).toBe(0);
    expect(roundupPreview({ kind: 'transfer', amount: 1230, fromPocketId: 'fun' }, pockets)).toBe(0);
    expect(roundupPreview({ kind: 'expense', amount: 1230, fromPocketId: 'main' }, pockets)).toBe(0);
    expect(roundupPreview({ kind: 'expense', amount: 1230, fromPocketId: 'fun', roundup: false }, pockets)).toBe(0);
    const adj = buildAdjustment('fun', 1000, 1230, '2030-01-24', ctx)!;
    expect(roundupTxFor(adj, ctx)).toBeNull();
  });

  it('si aggiorna modificando l\'uscita e sparisce se non serve più', () => {
    const e = buildEntry({ kind: 'expense', date: '2030-01-24', amount: 1230, fromPocketId: 'fun', description: 'Bar' }, ctx);
    const r1 = roundupTxFor(e, ctx)!;
    const e2 = buildEntry({ kind: 'expense', date: '2030-01-25', amount: 450, fromPocketId: 'fun', description: 'Bar' }, ctx, e);
    const r2 = roundupTxFor(e2, ctx, r1)!;
    expect(r2.id).toBe(r1.id);
    expect(r2.date).toBe('2030-01-25');
    expect(r2.legs[1]!.amount).toBe(50);
    const e3 = buildEntry({ kind: 'expense', date: '2030-01-25', amount: 450, fromPocketId: 'main', description: 'Bar' }, ctx, e);
    expect(roundupTxFor(e3, ctx, r1)).toBeNull();
  });
});

describe('giroconti e rettifiche', () => {
  it('giroconto uno-a-molti a somma zero', () => {
    const t = buildEntry(
      { kind: 'transfer', date: '2030-01-23', amount: 0 + 45000, fromPocketId: 'main', splits: [{ pocketId: 'fun', amount: 40000 }, { pocketId: 'love', amount: 5000 }], description: 'Giro' },
      ctx,
    );
    expect(t.legs).toEqual([{ pocketId: 'main', amount: -45000 }, { pocketId: 'fun', amount: 40000 }, { pocketId: 'love', amount: 5000 }]);
    expect(t.legs.reduce((a, l) => a + l.amount, 0)).toBe(0);
  });

  it('rettifica per la differenza, nessuna se il saldo coincide', () => {
    expect(buildAdjustment('main', 6225, 6000, '2030-01-24', ctx)!.legs).toEqual([{ pocketId: 'main', amount: -225 }]);
    expect(buildAdjustment('main', 6225, 6225, '2030-01-24', ctx)).toBeNull();
  });
});

describe('piano di inizio mese', () => {
  it('abbonamenti = addebiti + arrotondamenti (36,93 + 0,07 = 37,00)', () => {
    expect(recurringAmount(recurring.find((r) => r.id === 's')!, recurring, pockets)).toBe(3700);
  });

  it('2.345,00 → fissi e pocket 1.353,04 → da parte 991,96', () => {
    const plan = buildPlan({ salary: 234500, recurring, pockets, mainPocketId: 'main', safetyMargin: 0, leftover: 6225 });
    expect(plan.fixedTotal).toBe(135304);
    expect(plan.saveable).toBe(99196);
    expect(plan.auto.map((l) => l.amount)).toEqual([10000, 10000]);
    expect(plan.revolutTotal).toBe(93700);
    expect(plan.others.map((l) => l.name)).toEqual(['Bollette']);
    expect(plan.keep.map((l) => l.amount)).toEqual([2604, 9000]);
    expect(plan.leftover).toBe(6225);
  });

  it('considera il margine di sicurezza e non va mai sotto zero', () => {
    expect(buildPlan({ salary: 234500, recurring, pockets, mainPocketId: 'main', safetyMargin: 10000, leftover: 0 }).saveable).toBe(89196);
    expect(buildPlan({ salary: 100000, recurring, pockets, mainPocketId: 'main', safetyMargin: 0, leftover: 0 }).saveable).toBe(0);
  });

  describe('modalità degli spostamenti', () => {
    // Abbonamenti, Casa e Svago si ricaricano; Coppia è a importo pieno; Auto è una riserva.
    const rec = recurring.map((r) =>
      ['s', 'h', 'u'].includes(r.id) ? { ...r, mode: 'topUp' as const } : r.id === 'c' ? { ...r, mode: 'reserve' as const } : r,
    );
    const plan = (before: [string, number][], taken: [string, number][]) =>
      buildPlan({ salary: 234500, recurring: rec, pockets, mainPocketId: 'main', safetyMargin: 0, leftover: 0, balancesBefore: new Map(before), takenPrev: new Map(taken) });
    const amount = (p: ReturnType<typeof plan>, id: string) => p.revolut.find((l) => l.recurringId === id)!.amount;

    it('ricarica: solo quanto manca, "già a posto" se c\'è abbastanza', () => {
      const p = plan([['home', 2000], ['fun', 45000], ['subs', -500], ['love', 4000]], []);
      expect(amount(p, 'h')).toBe(28000); // 300 − 20 rimasti
      expect(amount(p, 'u')).toBe(0); // già oltre l'importo
      expect(amount(p, 's')).toBe(4200); // in rosso: 37 + 5
      expect(amount(p, 'l')).toBe(5000); // Coppia: sempre pieno, anche con soldi rimasti
      expect(p.others[0]!.amount).toBe(10000); // non Revolut: pieno
    });

    it('riserva: nulla preso → metà del budget', () => {
      expect(amount(plan([], [['car', 0]]), 'c')).toBe(7500);
    });

    it('riserva: preso meno del budget → preso + 100 €', () => {
      expect(amount(plan([], [['car', 4000]]), 'c')).toBe(14000);
    });

    it('riserva: preso almeno il budget → reintegra quanto preso', () => {
      expect(amount(plan([], [['car', 15000]]), 'c')).toBe(15000);
      expect(amount(plan([], [['car', 20000]]), 'c')).toBe(20000);
    });

    it('la differenza va nel risparmio proposto', () => {
      const p = plan([['home', 2000], ['fun', 45000]], [['car', 0]]);
      const diff = 2000 + 40000 + 7500; // casa, svago, metà auto
      expect(p.saveable).toBe(99196 + diff);
    });

    it('riserva con extra personalizzato', () => {
      const custom = rec.map((r) => (r.id === 'c' ? { ...r, reserveExtra: 5000 } : r));
      const p = buildPlan({ salary: 234500, recurring: custom, pockets, mainPocketId: 'main', safetyMargin: 0, leftover: 0, takenPrev: new Map([['car', 4000]]) });
      expect(p.revolut.find((l) => l.recurringId === 'c')!.amount).toBe(9000);
    });
  });

  describe('margine di sicurezza e avanzo', () => {
    const plan = (margin: number, leftover: number) =>
      buildPlan({ salary: 234500, recurring, pockets, mainPocketId: 'main', safetyMargin: margin, leftover });

    it('margine 50, avanzati 20 → dallo stipendio se ne tengono solo 30', () => {
      const p = plan(5000, 2000);
      expect(p.marginFromLeftover).toBe(2000);
      expect(p.marginFromSalary).toBe(3000);
      expect(p.leftoverExcess).toBe(0);
      expect(p.saveable).toBe(99196 - 3000);
    });

    it('margine 50, avanzati 60 → 50 restano come margine, 10 spostabili sui risparmi', () => {
      const p = plan(5000, 6000);
      expect(p.marginFromLeftover).toBe(5000);
      expect(p.marginFromSalary).toBe(0);
      expect(p.leftoverExcess).toBe(1000);
      expect(p.saveable).toBe(99196);
    });

    it('senza avanzo il margine si tiene tutto dallo stipendio', () => {
      expect(plan(5000, 0)).toMatchObject({ marginFromSalary: 5000, leftoverExcess: 0, saveable: 94196 });
      expect(plan(5000, -800)).toMatchObject({ marginFromSalary: 5000, leftoverExcess: 0 });
    });

    it('senza margine tutto l\'avanzo è spostabile', () => {
      expect(splitMargin(0, 6225)).toEqual({ fromLeftover: 0, fromSalary: 0, excess: 6225 });
    });
  });

  it('ignora le voci disattivate', () => {
    const rec = recurring.map((r) => (r.id === 'c' ? { ...r, active: false } : r));
    expect(buildPlan({ salary: 234500, recurring: rec, pockets, mainPocketId: 'main', safetyMargin: 0, leftover: 0 }).saveable).toBe(114196);
  });
});

describe('bollette', () => {
  it('se esce meno del fondo, il resto torna ai risparmi', () => {
    expect(splitBill(20000, 17350)).toEqual({ rest: 2650, shortfall: 0 });
  });
  it('se esce di più, segnala quanto manca', () => {
    expect(splitBill(20000, 23000)).toEqual({ rest: 0, shortfall: 3000 });
    expect(splitBill(-500, 1000)).toEqual({ rest: 0, shortfall: 1000 });
  });
  it('bolletta attesa nel periodo: per mese o, se rimandata, per periodo', () => {
    const ott = periodOf('2030-10-25', 23); // 23 ott – 22 nov
    expect(billExpectedIn({ month: '2030-11' }, ott)).toBe(true);
    expect(billExpectedIn({ month: '2030-12' }, ott)).toBe(false);
    expect(billExpectedIn({ month: '2030-10', period: '2030-11' }, ott)).toBe(false); // rimandata al periodo dopo
    expect(billExpectedIn({ month: '2030-10', period: '2030-10' }, ott)).toBe(true);
  });

  it('i soldi per una bolletta sono quelli messi da parte fino al suo periodo', () => {
    expect(billReferencePeriod('2030-11', 23)).toMatchObject({ start: '2030-10-23', end: '2030-11-22' });
    // Uscita in ritardo: nel fondo ora ci sono 420 (320 + 100 del mese nuovo) ma alla bolletta ne spettano 320.
    expect(billAvailable(42000, 32000)).toBe(32000);
    // Uscita in tempo: tutto il fondo attuale.
    expect(billAvailable(32000, 32000)).toBe(32000);
    expect(billAvailable(-100, 5000)).toBe(0);
  });

  it('quanto mancherà nel fondo, contando l\'accantonamento', () => {
    expect(billShortfall(8000, 10000, 20000)).toBe(2000);
    expect(billShortfall(15000, 10000, 20000)).toBe(0);
    expect(billShortfall(-500, 10000, 12000)).toBe(2000);
  });

  it('prossima bolletta dopo due mesi, anche a cavallo d\'anno', () => {
    expect(addMonths('2030-11', 2)).toBe('2031-01');
  });
  it('spese giorno per giorno, senza giroconti e rettifiche', () => {
    const p = periodOf('2030-01-23', 23);
    const txs = [
      tx({ date: '2030-01-24', kind: 'expense', legs: [{ pocketId: 'home', amount: -1800 }] }),
      tx({ date: '2030-01-24', kind: 'expense', legs: [{ pocketId: 'fun', amount: -450 }] }),
      tx({ date: '2030-01-24', kind: 'transfer', legs: [{ pocketId: 'main', amount: -100 }, { pocketId: 'fun', amount: 100 }] }),
      tx({ date: '2030-01-25', kind: 'adjustment', legs: [{ pocketId: 'main', amount: -999 }] }),
    ];
    expect(Object.fromEntries(dailySpending(txs, p, []))).toEqual({ '2030-01-24': { amount: 2250, count: 2 } });
  });
});

describe('pagina del pocket', () => {
  const p = periodOf('2030-01-23', 23);
  const txs = [
    tx({ date: '2030-01-23', kind: 'transfer', legs: [{ pocketId: 'main', amount: -15000 }, { pocketId: 'car', amount: 15000 }] }),
    tx({ date: '2030-01-25', kind: 'expense', legs: [{ pocketId: 'car', amount: -3990 }] }),
    tx({ date: '2030-01-25', kind: 'roundup', legs: [{ pocketId: 'car', amount: -10 }, { pocketId: 'coins', amount: 10 }] }),
    tx({ date: '2030-01-26', kind: 'transfer', legs: [{ pocketId: 'car', amount: -1000 }, { pocketId: 'fun', amount: 1000 }] }),
    tx({ date: '2030-01-27', kind: 'adjustment', legs: [{ pocketId: 'car', amount: 500 }] }),
    tx({ date: '2030-02-23', kind: 'expense', legs: [{ pocketId: 'car', amount: -999 }] }),
  ];

  it('entrato, speso, spostato e rettifiche nel periodo', () => {
    expect(pocketPeriodStats('car', txs, p)).toEqual({ spent: 4000, received: 15000, movedOut: 1000, adjusted: 500, taken: 5000 });
  });

  it('previsione del prossimo mese secondo la regola della voce', () => {
    const car = { ...recurring.find((r) => r.id === 'c')!, mode: 'reserve' as const };
    expect(forecastAllocation(car, recurring, pockets, 10500, 5000).amount).toBe(15000); // presi 50 → 50 + 100
    expect(forecastAllocation(car, recurring, pockets, 15000, 0).amount).toBe(7500); // niente preso → metà
    const home = { ...recurring.find((r) => r.id === 'h')!, mode: 'topUp' as const };
    expect(forecastAllocation(home, recurring, pockets, 12000, 0).amount).toBe(18000); // 300 − 120 rimasti
    const love = recurring.find((r) => r.id === 'l')!;
    expect(forecastAllocation(love, recurring, pockets, 99999, 0).amount).toBe(5000); // pieno
  });
});

describe('statistiche', () => {
  const p = periodOf('2030-01-23', 23);
  const cats = [
    { id: 'cat-food', name: 'Spesa', icon: 'x', color: 'verde' as const, archived: false, order: 0 },
    { id: 'cat-fuel', name: 'Carburante', icon: 'x', color: 'indaco' as const, archived: false, order: 1 },
    { id: 'cat-adj', name: 'Rettifica', icon: 'x', color: 'ardesia' as const, archived: false, order: 2, excludedFromStats: true, system: 'adjustment' as const },
  ];
  const txs = [
    tx({ date: '2030-01-24', kind: 'expense', categoryId: 'cat-food', legs: [{ pocketId: 'home', amount: -1800 }] }),
    tx({ date: '2030-01-24', kind: 'roundup', legs: [{ pocketId: 'home', amount: -100 }, { pocketId: 'coins', amount: 100 }] }),
    tx({ date: '2030-01-25', kind: 'expense', categoryId: 'cat-fuel', legs: [{ pocketId: 'main', amount: -5200 }] }),
    tx({ date: '2030-01-26', kind: 'adjustment', categoryId: 'cat-adj', legs: [{ pocketId: 'main', amount: -999 }] }),
    tx({ date: '2030-02-23', kind: 'expense', categoryId: 'cat-food', legs: [{ pocketId: 'home', amount: -700 }] }),
  ];

  it('conta solo le uscite del periodo, esclude rettifiche e arrotondamenti', () => {
    expect(Object.fromEntries(spendingByCategory(txs, p, cats))).toEqual({ 'cat-food': 1800, 'cat-fuel': 5200 });
    expect(totalSpending(txs, p, cats)).toBe(7000);
  });

  it('budget benzina: speso nel periodo', () => {
    expect(budgetSpent(recurring.find((r) => r.id === 'fuel')!, txs, p)).toBe(5200);
  });

  it('addebiti da confermare: scaduti e non ancora registrati', () => {
    const due = dueDebits(recurring, [], p, '2030-02-18');
    expect(due.map((d) => [d.recurring.id, d.date])).toEqual([['tax', '2030-01-23'], ['net', '2030-01-25'], ['tv', '2030-02-17']]);
    const done = [tx({ date: '2030-01-23', kind: 'expense', autoKey: 'rec:tax:2030-01', legs: [{ pocketId: 'main', amount: -2604 }] })];
    expect(dueDebits(recurring, done, p, '2030-01-23')).toEqual([]);
  });
});
