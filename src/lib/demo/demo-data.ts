/**
 * Dati di ESEMPIO, tutti INVENTATI, solo per l'anteprima di sviluppo (mai nella build pubblicata).
 * Le date sono costruite attorno a oggi: due periodi completi e il periodo corrente in corso.
 */
import { SYSTEM_CATEGORIES, DEFAULT_CATEGORIES } from '../import/config';
import { addDays, periodOf, shiftPeriod, today as todayFn } from '../domain/dates';
import { roundupFor } from '../domain/roundup';
import type { AppData, ISODate, Pocket, Recurring, Transaction, TxKind } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';

export function demoData(todayDate: ISODate = todayFn()): AppData {
  const day = 23;
  const cur = periodOf(todayDate, day);
  const periods = [shiftPeriod(cur, -2, day), shiftPeriod(cur, -1, day)];
  const opening = periods[0]!.start;

  const pk = (id: string, name: string, groupId: string, color: Pocket['color'], icon: string, openingBalance: number, extra: Partial<Pocket> = {}): Pocket => ({
    id, name, groupId, color, icon, isRevolut: groupId === 'revolut', openingBalance, openingDate: opening, archived: false, order: 0, ...extra,
  });
  const pockets = [
    pk('isp', 'Intesa', 'intesa', 'indaco', 'landmark', 38420, { role: 'main' }),
    pk('bg', 'Risparmi', 'generali', 'acqua', 'piggy-bank', 412000, { role: 'reserve' }),
    pk('bollette', 'Fondo bollette', 'generali', 'ardesia', 'zap', 9000, { role: 'bills' }),
    pk('fp', 'Fondo Pensione', 'investimenti', 'viola', 'shield-check', 280000, { role: 'investment' }),
    pk('pac', 'Piano Accumulo', 'investimenti', 'cielo', 'trending-up', 340000, { role: 'investment' }),
    pk('abb', 'Abbonamenti', 'revolut', 'cielo', 'repeat', 2200),
    pk('coppia', 'Coppia', 'revolut', 'magenta', 'heart', 16500),
    pk('casa', 'Casa', 'revolut', 'verde', 'sofa', 4800),
    pk('svago', 'Svago', 'revolut', 'arancio', 'sparkles', 9000),
    pk('auto', 'Auto', 'revolut', 'ardesia', 'car', 22000),
    pk('savings', 'Savings', 'revolut', 'ocra', 'coins', 640, { role: 'savings' }),
  ].map((p, i) => ({ ...p, order: i }));

  const recurring: Recurring[] = [
    { id: 'assic', name: 'Assicurazione', kind: 'debit', amount: 2604, fromPocketId: 'isp', day: 23, categoryId: 'altro', active: true, order: 0 },
    { id: 'benzina', name: 'Benzina', kind: 'budget', amount: 9000, fromPocketId: 'isp', categoryId: 'carburante', active: true, order: 1 },
    { id: 'fp', name: 'Fondo Pensione', kind: 'allocation', amount: 10000, fromPocketId: 'isp', toPocketId: 'fp', auto: true, active: true, order: 2 },
    { id: 'pac', name: 'Piano Accumulo', kind: 'allocation', amount: 10000, fromPocketId: 'isp', toPocketId: 'pac', auto: true, active: true, order: 3 },
    { id: 'bollette', name: 'Fondo bollette', kind: 'allocation', amount: 10000, fromPocketId: 'isp', toPocketId: 'bollette', active: true, order: 4 },
    { id: 'abb', name: 'Abbonamenti', kind: 'allocation', amount: 0, amountFromDebits: true, fromPocketId: 'isp', toPocketId: 'abb', mode: 'topUp', active: true, order: 5 },
    { id: 'coppia', name: 'Coppia', kind: 'allocation', amount: 5000, fromPocketId: 'isp', toPocketId: 'coppia', active: true, order: 6 },
    { id: 'casa', name: 'Casa', kind: 'allocation', amount: 30000, fromPocketId: 'isp', toPocketId: 'casa', mode: 'topUp', active: true, order: 7 },
    { id: 'svago', name: 'Svago', kind: 'allocation', amount: 40000, fromPocketId: 'isp', toPocketId: 'svago', mode: 'topUp', active: true, order: 8 },
    { id: 'auto', name: 'Auto', kind: 'allocation', amount: 15000, fromPocketId: 'isp', toPocketId: 'auto', mode: 'reserve', reserveExtra: 10000, active: true, order: 9 },
    { id: 'internet', name: 'Internet', kind: 'debit', amount: 995, fromPocketId: 'abb', day: 25, categoryId: 'abbonamenti', active: true, order: 10 },
    { id: 'musica', name: 'Musica', kind: 'debit', amount: 2099, fromPocketId: 'abb', day: 19, categoryId: 'abbonamenti', active: true, order: 11 },
    { id: 'serie', name: 'Serie TV', kind: 'debit', amount: 599, fromPocketId: 'abb', day: 17, categoryId: 'abbonamenti', active: true, order: 12 },
  ];

  const txs: Transaction[] = [];
  let seq = 0;
  const base = Date.now() - 90 * 86_400_000;
  const add = (date: ISODate, kind: TxKind, legs: [string, number][], description: string, categoryId?: string, extra: Partial<Transaction> = {}) => {
    const t: Transaction = {
      id: `demo-${++seq}`, date, kind, legs: legs.map(([pocketId, amount]) => ({ pocketId, amount })), description, categoryId,
      source: 'manual', createdAt: base + seq, updatedAt: base + seq, ...extra,
    };
    txs.push(t);
    return t;
  };
  const revolut = new Set(pockets.filter((p) => p.isRevolut && p.role !== 'savings').map((p) => p.id));
  const spend = (date: ISODate, pocket: string, amount: number, description: string, categoryId: string) => {
    if (date > todayDate) return;
    const e = add(date, 'expense', [[pocket, -amount]], description, categoryId, revolut.has(pocket) ? { roundup: true } : {});
    if (revolut.has(pocket)) {
      const r = roundupFor(amount);
      add(date, 'roundup', [[pocket, -r], ['savings', r]], `Arrotondamento · ${description}`, 'sys-roundup', { parentId: e.id });
    }
  };

  // Spese tipiche di un periodo: [giorno dall'inizio, pocket, importo, descrizione, categoria]
  const pattern: [number, string, number, string, string][] = [
    [0, 'svago', 390, 'Bar', 'bar'], [1, 'casa', 4230, 'Supermercato', 'spesa'], [2, 'isp', 4500, 'Carburante', 'carburante'],
    [4, 'coppia', 3800, 'Pizzeria', 'bar'], [6, 'svago', 2600, 'Fiori', 'regali'], [8, 'casa', 1875, 'Supermercato', 'spesa'],
    [10, 'svago', 1200, 'Cinema', 'svago'], [12, 'isp', 3900, 'Carburante', 'carburante'], [14, 'casa', 5610, 'Supermercato', 'spesa'],
    [16, 'svago', 450, 'Bar', 'bar'], [19, 'coppia', 2400, 'Aperitivo', 'bar'], [22, 'casa', 2290, 'Supermercato', 'spesa'],
    [25, 'svago', 1999, 'Libro', 'svago'],
  ];
  const salaries = [231500, 234500];

  periods.forEach((p, i) => {
    const d0 = p.start;
    add(d0, 'income', [['isp', salaries[i]!]], 'Stipendio', 'stipendio', { source: 'plan', autoKey: `salary:${p.key}` });
    for (const r of recurring.filter((x) => x.kind === 'allocation')) {
      const amount = r.amountFromDebits ? 3700 : r.amount;
      add(d0, 'transfer', [['isp', -amount], [r.toPocketId!, amount]], r.name, 'sys-transfer', { source: 'plan', autoKey: `plan:${r.id}:${p.key}` });
    }
    add(d0, 'transfer', [['isp', -(i === 0 ? 95000 : 99196)], ['bg', i === 0 ? 95000 : 99196]], 'Risparmio del mese', 'sys-transfer', { source: 'plan', autoKey: `plan:save:${p.key}` });
    for (const r of recurring.filter((x) => x.kind === 'debit')) {
      let date = d0;
      for (let k = 0; k < 31; k++) {
        const dd = addDays(d0, k);
        if (Number(dd.slice(8)) === r.day) {
          date = dd;
          break;
        }
      }
      const e = add(date, 'expense', [[r.fromPocketId, -r.amount]], r.name, r.categoryId, { source: 'recurring', autoKey: `rec:${r.id}:${p.key}`, roundup: revolut.has(r.fromPocketId) || undefined });
      if (revolut.has(r.fromPocketId)) {
        const ru = roundupFor(r.amount);
        add(date, 'roundup', [[r.fromPocketId, -ru], ['savings', ru]], `Arrotondamento · ${r.name}`, 'sys-roundup', { parentId: e.id });
      }
    }
    for (const [off, pocket, amount, desc, cat] of pattern) spend(addDays(d0, off), pocket, amount + i * 70, desc, cat);
  });

  // Periodo corrente: stipendio ancora da inserire, qualche spesa già fatta.
  for (const [off, pocket, amount, desc, cat] of pattern.slice(0, 5)) spend(addDays(cur.start, off), pocket, amount, desc, cat);
  // Una rettifica di esempio, esclusa dalle statistiche.
  add(periods[1]!.start, 'adjustment', [['isp', -1230]], 'Rettifica saldo', 'sys-adjustment');

  const valuations = [
    { id: 'demo-v1', pocketId: 'fp', date: addDays(periods[0]!.end, -2), value: 292400 },
    { id: 'demo-v2', pocketId: 'fp', date: addDays(periods[1]!.end, -2), value: 305800 },
    { id: 'demo-v3', pocketId: 'pac', date: addDays(periods[1]!.end, -2), value: 351200 },
  ];

  const nextMonth = addDays(cur.end, 5).slice(0, 7);
  return {
    groups: [
      { id: 'intesa', name: 'Intesa', order: 0 }, { id: 'generali', name: 'Generali', order: 1 },
      { id: 'investimenti', name: 'Investimenti', order: 2 }, { id: 'revolut', name: 'Revolut', order: 3 },
    ],
    pockets,
    categories: [...DEFAULT_CATEGORIES, ...SYSTEM_CATEGORIES],
    transactions: txs,
    recurring,
    valuations,
    settings: { ...DEFAULT_SETTINGS, eveningReminder: true, salaryDay: day, salaryCategoryId: 'stipendio', nextBill: { month: nextMonth, amount: 19000 } },
  };
}
