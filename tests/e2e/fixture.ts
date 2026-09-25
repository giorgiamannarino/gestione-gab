// Backup di ESEMPIO con dati INVENTATI, per test e screenshot.
const pk = (id: string, name: string, groupId: string, color: string, icon: string, openingBalance: number, extra: object = {}) => ({
  id, name, groupId, color, icon, isRevolut: groupId === 'rev', openingBalance, openingDate: '2030-08-23', archived: false, order: 0, ...extra,
});

let n = 0;
const tx = (date: string, kind: string, legs: [string, number][], description: string, categoryId?: string, extra: object = {}) => ({
  id: `e${++n}`, date, kind, legs: legs.map(([pocketId, amount]) => ({ pocketId, amount })), description, categoryId,
  source: 'manual', createdAt: 1_900_000_000_000 + n, updatedAt: 1_900_000_000_000 + n, ...extra,
});

export function exampleBackup() {
  const pockets = [
    pk('main', 'Conto', 'banca', 'indaco', 'landmark', 41200, { role: 'main' }),
    pk('save', 'Risparmi', 'deposito', 'acqua', 'piggy-bank', 480000, { role: 'reserve' }),
    pk('bills', 'Fondo bollette', 'deposito', 'ardesia', 'zap', 12000, { role: 'bills' }),
    pk('fp', 'Fondo pensione', 'inv', 'viola', 'shield-check', 290000, { role: 'investment' }),
    pk('pac', 'Piano accumulo', 'inv', 'cielo', 'trending-up', 350000, { role: 'investment' }),
    pk('subs', 'Abbonamenti', 'rev', 'cielo', 'repeat', 3500),
    pk('fun', 'Svago', 'rev', 'arancio', 'sparkles', 12000),
    pk('home', 'Casa', 'rev', 'verde', 'sofa', 8000),
    pk('love', 'Coppia', 'rev', 'magenta', 'heart', 6000),
    pk('car', 'Auto', 'rev', 'ardesia', 'car', 30000),
    pk('coins', 'Savings', 'rev', 'ocra', 'coins', 1500, { role: 'savings' }),
  ].map((p, i) => ({ ...p, order: i }));

  const cats = [
    ['spesa', 'Spesa', 'shopping-cart', 'verde'], ['bar', 'Bar e ristoranti', 'utensils', 'arancio'], ['carburante', 'Carburante', 'fuel', 'indaco'],
    ['abbonamenti', 'Abbonamenti', 'repeat', 'cielo'], ['regali', 'Regali', 'gift', 'magenta'], ['svago', 'Svago', 'sparkles', 'viola'],
    ['stipendio', 'Stipendio', 'landmark', 'verde'], ['altro', 'Altro', 'circle-dashed', 'ardesia'],
  ].map(([id, name, icon, color], order) => ({ id, name, icon, color, archived: false, order }));
  const system = [
    { id: 'sys-transfer', name: 'Giroconto', icon: 'arrow-right-left', color: 'ardesia', system: 'transfer', excludedFromStats: true, archived: false, order: 900 },
    { id: 'sys-adjustment', name: 'Rettifica', icon: 'scale', color: 'ardesia', system: 'adjustment', excludedFromStats: true, archived: false, order: 901 },
    { id: 'sys-roundup', name: 'Arrotondamento', icon: 'coins', color: 'ocra', system: 'roundup', excludedFromStats: true, archived: false, order: 902 },
  ];

  const transactions: object[] = [];
  const periods = [['2030-08-23', '08'], ['2030-09-23', '09']] as const;
  for (const [start, m] of periods) {
    const y = start.slice(0, 7);
    transactions.push(
      tx(start, 'income', [['main', 231000]], 'Stipendio', 'stipendio', { autoKey: `salary:${y}`, source: 'plan' }),
      tx(start, 'transfer', [['main', -10000], ['fp', 10000]], 'Fondo pensione', 'sys-transfer'),
      tx(start, 'transfer', [['main', -10000], ['pac', 10000]], 'Piano accumulo', 'sys-transfer'),
      tx(start, 'transfer', [['main', -93700], ['subs', 3700], ['fun', 40000], ['home', 30000], ['love', 5000], ['car', 15000]], 'Giro Revolut', 'sys-transfer'),
      tx(start, 'transfer', [['main', -10000], ['bills', 10000]], 'Fondo bollette', 'sys-transfer'),
      tx(start, 'transfer', [['main', -95000], ['save', 95000]], 'Risparmio del mese', 'sys-transfer'),
      tx(`2030-${m}-24`, 'expense', [['main', -2604]], 'Assicurazione', 'altro'),
    );
    const spese: [string, string, number, string][] = [
      ['25', 'fun', 450, 'bar'], ['26', 'home', 4280, 'spesa'], ['27', 'main', 5200, 'carburante'], ['29', 'fun', 2600, 'regali'],
      ['30', 'home', 1830, 'spesa'], ['01', 'love', 3400, 'bar'], ['03', 'fun', 1200, 'svago'], ['05', 'home', 5620, 'spesa'],
    ];
    for (const [d, p, amount, c] of spese) {
      const month = Number(d) >= 23 ? m : String(Number(m) + 1).padStart(2, '0');
      const date = `2030-${month}-${d}`;
      const desc = { bar: 'Bar', spesa: 'Supermercato', carburante: 'Carburante', regali: 'Fiori', svago: 'Cinema' }[c]!;
      const e = tx(date, 'expense', [[p, -amount]], desc, c, { roundup: p !== 'main' });
      transactions.push(e);
      if (p !== 'main') {
        const r = amount % 100 === 0 ? 100 : 100 - (amount % 100);
        transactions.push(tx(date, 'roundup', [[p, -r], ['coins', r]], `Arrotondamento · ${desc}`, 'sys-roundup', { parentId: (e as { id: string }).id }));
      }
    }
  }
  // Periodo corrente (dal 23 ottobre): nessuno stipendio ancora, qualche spesa.
  transactions.push(
    tx('2030-10-24', 'expense', [['home', -1800]], 'Supermercato', 'spesa', { roundup: true }),
    tx('2030-10-25', 'expense', [['main', -4800]], 'Carburante', 'carburante'),
  );

  const recurring = [
    { id: 'ass', name: 'Assicurazione', kind: 'debit', amount: 2604, fromPocketId: 'main', day: 23, categoryId: 'altro', active: true, order: 0 },
    { id: 'fuel', name: 'Benzina', kind: 'budget', amount: 9000, fromPocketId: 'main', categoryId: 'carburante', active: true, order: 1 },
    { id: 'fp', name: 'Fondo pensione', kind: 'allocation', amount: 10000, fromPocketId: 'main', toPocketId: 'fp', auto: true, active: true, order: 2 },
    { id: 'pac', name: 'Piano accumulo', kind: 'allocation', amount: 10000, fromPocketId: 'main', toPocketId: 'pac', auto: true, active: true, order: 3 },
    { id: 'bills', name: 'Fondo bollette', kind: 'allocation', amount: 10000, fromPocketId: 'main', toPocketId: 'bills', active: true, order: 4 },
    { id: 'subs', name: 'Abbonamenti', kind: 'allocation', amount: 0, amountFromDebits: true, fromPocketId: 'main', toPocketId: 'subs', mode: 'topUp', active: true, order: 5 },
    { id: 'love', name: 'Coppia', kind: 'allocation', amount: 5000, fromPocketId: 'main', toPocketId: 'love', active: true, order: 6 },
    { id: 'home', name: 'Casa', kind: 'allocation', amount: 30000, fromPocketId: 'main', toPocketId: 'home', mode: 'topUp', active: true, order: 7 },
    { id: 'fun', name: 'Svago', kind: 'allocation', amount: 40000, fromPocketId: 'main', toPocketId: 'fun', mode: 'topUp', active: true, order: 8 },
    { id: 'car', name: 'Auto', kind: 'allocation', amount: 15000, fromPocketId: 'main', toPocketId: 'car', mode: 'reserve', active: true, order: 9 },
    { id: 'net', name: 'Internet', kind: 'debit', amount: 995, fromPocketId: 'subs', day: 25, categoryId: 'abbonamenti', active: true, order: 10 },
    { id: 'mus', name: 'Musica', kind: 'debit', amount: 2099, fromPocketId: 'subs', day: 19, categoryId: 'abbonamenti', active: true, order: 11 },
    { id: 'tv', name: 'Serie TV', kind: 'debit', amount: 599, fromPocketId: 'subs', day: 17, categoryId: 'abbonamenti', active: true, order: 12 },
  ];

  return {
    format: 'conti-backup',
    version: 1,
    createdAt: '2030-10-20T09:00:00.000Z',
    app: 'test',
    data: {
      groups: [
        { id: 'banca', name: 'Banca', order: 0 }, { id: 'deposito', name: 'Deposito', order: 1 },
        { id: 'inv', name: 'Investimenti', order: 2 }, { id: 'rev', name: 'Revolut', order: 3 },
      ],
      pockets, categories: [...cats, ...system], transactions, recurring,
      valuations: [{ id: 'v1', pocketId: 'fp', date: '2030-09-30', value: 312400 }, { id: 'v2', pocketId: 'fp', date: '2030-10-20', value: 318900 }],
      settings: { salaryDay: 23, safetyMargin: 0, weeklyBackupReminder: true, salaryCategoryId: 'stipendio', nextBill: { month: '2030-11', amount: 19000 } },
    },
  };
}
