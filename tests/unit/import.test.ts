// Importer Excel su un file di ESEMPIO INVENTATO, generato qui (nessun file reale nel repository).
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { balances } from '../../src/lib/domain/balances';
import { ConfigError, parseConfig } from '../../src/lib/import/config';
import { buildImport, ImportError, parseSheet } from '../../src/lib/import/excel';

const CONFIG = {
  formato: 'conti-config',
  versione: 1,
  gruppi: [{ id: 'banca', nome: 'Banca' }, { id: 'app', nome: 'App' }],
  pocket: [
    { id: 'conto', codice: 'CC', nome: 'Conto', gruppo: 'banca', ruolo: 'main' },
    { id: 'depo', codice: 'DEP', nome: 'Deposito', gruppo: 'banca' },
    { id: 'fondo', codice: 'FND', nome: 'Fondo', gruppo: 'banca', ruolo: 'investment' },
    { id: 'svago', codice: 'APP - SVAGO', nome: 'Svago', gruppo: 'app', revolut: true },
    { id: 'casa', codice: 'APP - CASA', nome: 'Casa', gruppo: 'app', revolut: true },
    { id: 'monete', codice: 'APP - MONETE', nome: 'Monete', gruppo: 'app', revolut: true, ruolo: 'savings' },
    { id: 'bollette', nome: 'Bollette', gruppo: 'banca', ruolo: 'bills' },
  ],
  voci: { 'PAGA': 'stipendio', 'CAFFÈ': 'bar', 'SPESA': 'spesa' },
  fissi: [
    { id: 'tassa', nome: 'Tassa', tipo: 'addebito', importo: 12.5, da: 'conto', giorno: 5 },
    { id: 'giro-casa', nome: 'Casa', tipo: 'spostamento', importo: 100, da: 'conto', a: 'casa' },
  ],
  impostazioni: { giornoStipendio: 27, margineSicurezza: 50, prossimaBolletta: { mese: '2031-03', importo: 180 } },
};

/** Foglio come quello reale: intestazione in riga 5, celle degli importi unite a coppie. */
function exampleWorkbook(): XLSX.WorkBook {
  const d = (s: string) => (Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8)) / 86400000) + 25569;
  const aoa: unknown[][] = [
    [], [], [null, null, null, 'periodo finto'], [],
    [null, 'DATA', 'VOCE', 'CC', null, 'DEP', null, 'FND', null, 'APP - SVAGO', null, 'APP - CASA', null, 'APP - MONETE', null, null, 'CC', 'VECCHIO PIANO', 999],
    [null, d('2031-02-27'), 'PAGA', 1800],
    [null, d('2031-02-27'), 'GIRO APP ', -500, null, null, null, null, null, 300, null, 250],
    [null, d('2031-02-27'), 'GIRO DEPOSITO', -800, null, 800],
    [null, d('2031-02-28'), 'CAFFÈ', null, null, null, null, null, null, -1.5, null, null, null, 0.5],
    [null, d('2031-03-01'), 'SPESA', null, null, null, null, null, null, null, null, -20, null, 0.99],
    [null, d('2031-03-02'), 'GIRO DEPOSITO', null, null, null, null, null, null, -10],
    [null, d('2031-03-03'), 'FARMACIA', -7.3],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Formule del saldo: costante + SUM su un range volutamente SBAGLIATO per FND (colonna destra).
  const f = (cell: string, formula: string, v: number) => (ws[cell] = { t: 'n', f: formula, v });
  f('E5', '100.25+SUM(D6:D30)', 0);
  f('G5', '2000+SUM(F6:F36)', 0);
  f('I5', '500+SUM(I7:I36)', 0);
  f('K5', '12.5+SUM(J7:J36)', 0);
  f('M5', '0+SUM(L6:L36)', 0);
  f('O5', '3.2+SUM(N6:N35)', 0);
  ws['!merges'] = [XLSX.utils.decode_range('J9:K9'), XLSX.utils.decode_range('D6:E6')];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['modello vuoto']]), 'MODELLO');
  XLSX.utils.book_append_sheet(wb, ws, 'FEB-MAR');
  return wb;
}

/** Ciclo completo come nel browser: scrittura su file .xlsx e rilettura. */
function roundTrip(wb: XLSX.WorkBook): XLSX.WorkBook {
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return XLSX.read(bytes, { type: 'array', cellFormula: true });
}

let n = 0;
const opts = { newId: () => `t${++n}`, now: 1_900_000_000_000 };

describe('configurazione', () => {
  it('converte euro in centesimi e valida i riferimenti', () => {
    const c = parseConfig(CONFIG);
    expect(c.recurring[0]!.amount).toBe(1250);
    expect(c.settings.salaryDay).toBe(27);
    expect(c.settings.safetyMargin).toBe(5000);
    expect(c.settings.nextBill).toEqual({ month: '2031-03', amount: 18000 });
    expect(c.categories.some((k) => k.system === 'adjustment' && k.excludedFromStats)).toBe(true);
  });

  it('messaggi chiari sugli errori', () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
    expect(() => parseConfig({ ...CONFIG, fissi: [{ id: 'x', nome: 'X', tipo: 'addebito', importo: 1, da: 'nessuno' }] })).toThrow('inesistente');
    expect(() => parseConfig({ ...CONFIG, pocket: CONFIG.pocket.map((p) => ({ ...p, ruolo: undefined })) })).toThrow('main');
  });
});

describe('importer Excel', () => {
  const sheet = parseSheet(roundTrip(exampleWorkbook()).Sheets['FEB-MAR']!);
  const result = buildImport(sheet, parseConfig(CONFIG), opts);

  it('legge pocket, saldi iniziali dalle formule e ignora la tabella a destra', () => {
    expect(sheet.columns.map((c) => [c.code, c.opening])).toEqual([
      ['CC', 10025], ['DEP', 200000], ['FND', 50000], ['APP - SVAGO', 1250], ['APP - CASA', 0], ['APP - MONETE', 320],
    ]);
    expect(sheet.rows).toHaveLength(7);
    expect(sheet.rows[0]).toMatchObject({ row: 6, date: '2031-02-27', voce: 'PAGA' });
  });

  it('i saldi calcolati tornano con il file, senza replicare l\'errore delle formule', () => {
    const b = balances(result.data.pockets, result.data.transactions);
    expect(b.get('conto')).toBe(10025 + 180000 - 50000 - 80000 - 730);
    expect(b.get('depo')).toBe(200000 + 80000);
    expect(b.get('fondo')).toBe(50000);
    expect(b.get('svago')).toBe(1250 + 30000 - 150 - 1000);
    expect(b.get('casa')).toBe(25000 - 2000);
    expect(b.get('monete')).toBe(320 + 50 + 99);
    expect(b.get('bollette')).toBe(0);
  });

  it('classifica i movimenti e importa gli arrotondamenti così come sono', () => {
    const kinds = result.data.transactions.map((t) => [t.description, t.kind]);
    expect(kinds).toEqual([
      ['Paga', 'income'], ['Giro app', 'transfer'], ['Giro deposito', 'transfer'],
      ['Caffè', 'expense'], ['Arrotondamento · Caffè', 'roundup'],
      ['Spesa', 'expense'], ['Arrotondamento · Spesa', 'roundup'],
      ['Giro deposito', 'transfer'], ['Farmacia', 'expense'],
    ]);
    const spesa = result.data.transactions.find((t) => t.description === 'Spesa')!;
    const r = result.data.transactions.find((t) => t.parentId === spesa.id)!;
    expect(r.legs).toEqual([{ pocketId: 'monete', amount: 99 }]);
    expect(spesa.categoryId).toBe('spesa');
    expect(result.startDate).toBe('2031-02-27');
  });

  it('elenca le incongruenze senza correggerle', () => {
    const types = result.anomalies.map((a) => a.type);
    expect(result.anomalies).toContainEqual(expect.objectContaining({ type: 'unbalanced-transfer', row: 7, out: 50000, in: 55000 }));
    expect(result.anomalies).toContainEqual(expect.objectContaining({ type: 'one-sided-transfer', row: 11, amount: -1000 }));
    expect(types.filter((t) => t === 'roundup-not-deducted')).toHaveLength(2);
    expect(result.anomalies).toContainEqual(expect.objectContaining({ type: 'roundup-mismatch', expense: 2000, roundup: 99, expected: 100 }));
    expect(result.anomalies).toContainEqual({ type: 'unknown-voce', voce: 'FARMACIA', count: 1 });
  });

  it('errore chiaro se il foglio non ha la struttura attesa', () => {
    expect(() => parseSheet(XLSX.utils.aoa_to_sheet([['ciao']]))).toThrow(ImportError);
  });
});
