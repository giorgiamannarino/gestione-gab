/**
 * Import del foglio spese Excel, interamente nel browser (il file non lascia il telefono).
 *
 * Struttura attesa:
 * - una riga di intestazione con "DATA" (col. B) e "VOCE" (col. C);
 * - da D in poi, a coppie di colonne unite: nome del pocket nella sinistra,
 *   formula "=saldo_iniziale+SUM(...)" nella destra;
 * - sotto: data, voce e importi nella colonna di sinistra del pocket coinvolto.
 * Il range delle formule SUM viene ignorato (in alcuni pocket somma la colonna sbagliata):
 * si prende solo la costante iniziale e si leggono sempre le colonne di sinistra.
 * Gli importi, arrotondamenti compresi, sono importati così come sono.
 */
import type { CellObject, WorkSheet } from 'xlsx';
import { roundupFor } from '../domain/roundup';
import type { AppData, ISODate, Leg, Pocket, Transaction, TxKind } from '../domain/types';
import { normalizeVoce, type AppConfig } from './config';

export class ImportError extends Error {}

export interface SheetColumn {
  code: string;
  /** Indice (0-based) della colonna con gli importi. */
  col: number;
  opening: number; // centesimi
  openingFound: boolean;
}

export interface SheetRow {
  row: number; // numero di riga Excel (1-based)
  date: ISODate;
  voce: string;
  amounts: Map<string, number>; // codice → centesimi
}

export interface ParsedSheet {
  columns: SheetColumn[];
  rows: SheetRow[];
}

export type Anomaly =
  | { type: 'unbalanced-transfer'; row: number; voce: string; date: ISODate; out: number; in: number }
  | { type: 'one-sided-transfer'; row: number; voce: string; date: ISODate; pocket: string; amount: number }
  | { type: 'roundup-not-deducted'; row: number; voce: string; date: ISODate; pocket: string; roundup: number }
  | { type: 'roundup-mismatch'; row: number; voce: string; date: ISODate; expense: number; roundup: number; expected: number }
  | { type: 'missing-opening'; pocket: string }
  | { type: 'unknown-voce'; voce: string; count: number };

const COL_B = 1;
const COL_C = 2;
const COL_D = 3;

function cellAt(ws: WorkSheet, r: number, c: number): CellObject | undefined {
  // Indirizzo A1 senza dipendere da XLSX.utils (così il parser resta leggero).
  let col = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) col = String.fromCharCode(65 + ((n - 1) % 26)) + col;
  return ws[`${col}${r + 1}`] as CellObject | undefined;
}

function text(c?: CellObject): string {
  return c?.v === undefined || c.v === null ? '' : String(c.v).trim();
}

/** Seriale Excel (sistema 1900) → data di calendario, senza passare dai fusi orari. */
function serialToISO(serial: number): ISODate {
  const ms = Math.round((serial - 25569) * 86400) * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function cellDate(c?: CellObject): ISODate | null {
  if (!c) return null;
  if (typeof c.v === 'number') return serialToISO(c.v);
  if (c.v instanceof Date) {
    const d = c.v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const m = typeof c.v === 'string' && c.v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : null;
}

function rangeRows(ws: WorkSheet): number {
  const ref = ws['!ref'];
  const m = ref?.match(/:[A-Z]+(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function parseSheet(ws: WorkSheet): ParsedSheet {
  const lastRow = rangeRows(ws);
  let header = -1;
  for (let r = 0; r < Math.min(lastRow, 50); r++) {
    if (text(cellAt(ws, r, COL_B)).toUpperCase() === 'DATA' && text(cellAt(ws, r, COL_C)).toUpperCase() === 'VOCE') {
      header = r;
      break;
    }
  }
  if (header < 0) throw new ImportError('Non trovo la riga di intestazione con "DATA" e "VOCE" nelle colonne B e C.');

  const columns: SheetColumn[] = [];
  for (let c = COL_D; ; c += 2) {
    const code = text(cellAt(ws, header, c));
    if (!code) break;
    const f = cellAt(ws, header, c + 1)?.f ?? '';
    const m = f.replace(/^=/, '').match(/^\s*(-?\d+(?:\.\d+)?)\s*\+\s*SUM\s*\(/i);
    columns.push({ code, col: c, opening: m ? Math.round(Number(m[1]) * 100) : 0, openingFound: !!m });
  }
  if (!columns.length) throw new ImportError('Non trovo i pocket nella riga di intestazione.');

  const rows: SheetRow[] = [];
  for (let r = header + 1; r < lastRow; r++) {
    const amounts = new Map<string, number>();
    for (const col of columns) {
      const v = cellAt(ws, r, col.col)?.v;
      if (typeof v === 'number' && v !== 0) amounts.set(col.code, Math.round(v * 100));
    }
    if (!amounts.size) continue;
    const date = cellDate(cellAt(ws, r, COL_B));
    if (!date) throw new ImportError(`Riga ${r + 1}: manca una data valida.`);
    rows.push({ row: r + 1, date, voce: text(cellAt(ws, r, COL_C)), amounts });
  }
  return { columns, rows };
}

export function prettyVoce(v: string): string {
  const s = v.trim().replace(/\s+/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ImportResult {
  data: AppData;
  anomalies: Anomaly[];
  startDate: ISODate;
}

/** Trasforma il foglio letto nei dati dell'app, usando la configurazione. */
export function buildImport(sheet: ParsedSheet, config: AppConfig, opts: { newId: () => string; now: number }): ImportResult {
  const anomalies: Anomaly[] = [];
  const startDate = sheet.rows.reduce<ISODate | null>((min, r) => (!min || r.date < min ? r.date : min), null) ?? new Date(opts.now).toISOString().slice(0, 10);

  const byCode = new Map(config.pockets.filter((p) => p.code).map((p) => [p.code!.toUpperCase(), p]));
  const openings = new Map(sheet.columns.map((c) => [c.code.toUpperCase(), c]));
  for (const c of sheet.columns) {
    if (!byCode.has(c.code.toUpperCase())) throw new ImportError(`La colonna "${c.code}" non corrisponde a nessun pocket della configurazione.`);
    if (!c.openingFound) anomalies.push({ type: 'missing-opening', pocket: c.code });
  }
  const pockets: Pocket[] = config.pockets.map((p) => ({
    ...p,
    openingBalance: p.code ? (openings.get(p.code.toUpperCase())?.opening ?? 0) : 0,
    openingDate: startDate,
  }));
  const pid = (code: string) => byCode.get(code.toUpperCase())!.id;
  const savings = pockets.find((p) => p.role === 'savings');
  const isRevolut = (id: string) => pockets.find((p) => p.id === id)?.isRevolut ?? false;

  const unknown = new Map<string, number>();
  const txs: Transaction[] = [];
  const make = (r: SheetRow, kind: TxKind, legs: Leg[], extra: Partial<Transaction> = {}): Transaction => ({
    id: opts.newId(),
    date: r.date,
    kind,
    legs,
    description: prettyVoce(r.voce) || 'Movimento',
    source: 'import',
    createdAt: opts.now + txs.length, // mantiene l'ordine delle righe
    updatedAt: opts.now,
    ...extra,
  });
  const categoryFor = (r: SheetRow) => {
    const c = config.voci[normalizeVoce(r.voce)];
    if (!c && r.voce) unknown.set(normalizeVoce(r.voce), (unknown.get(normalizeVoce(r.voce)) ?? 0) + 1);
    return c;
  };

  for (const r of sheet.rows) {
    const legs: Leg[] = [...r.amounts].map(([code, amount]) => ({ pocketId: pid(code), amount }));
    const neg = legs.filter((l) => l.amount < 0);
    const pos = legs.filter((l) => l.amount > 0);
    const isGiro = /^giro\b/i.test(r.voce.trim());

    // Uscita Revolut + arrotondamento nella colonna dei Savings.
    const sav = savings && pos.length === 1 && pos[0]!.pocketId === savings.id ? pos[0]! : undefined;
    if (sav && neg.length === 1 && isRevolut(neg[0]!.pocketId) && sav.amount <= 100 && !isGiro) {
      const payer = neg[0]!;
      const expense = make(r, 'expense', [payer], { categoryId: categoryFor(r), roundup: true });
      txs.push(expense);
      // Importato com'è: nel file l'arrotondamento non è sottratto a chi ha pagato.
      txs.push(make(r, 'roundup', [sav], { parentId: expense.id, description: `Arrotondamento · ${expense.description}`, categoryId: 'sys-roundup' }));
      anomalies.push({ type: 'roundup-not-deducted', row: r.row, voce: r.voce, date: r.date, pocket: payer.pocketId, roundup: sav.amount });
      const expected = roundupFor(payer.amount);
      if (expected !== sav.amount) {
        anomalies.push({ type: 'roundup-mismatch', row: r.row, voce: r.voce, date: r.date, expense: -payer.amount, roundup: sav.amount, expected });
      }
      continue;
    }

    if (legs.length === 1 && !isGiro) {
      const kind = legs[0]!.amount < 0 ? 'expense' : 'income';
      const roundup = kind === 'expense' && isRevolut(legs[0]!.pocketId) ? true : undefined;
      txs.push(make(r, kind, legs, { categoryId: categoryFor(r), roundup }));
      continue;
    }

    txs.push(make(r, 'transfer', legs, { categoryId: 'sys-transfer' }));
    if (legs.length === 1) {
      anomalies.push({ type: 'one-sided-transfer', row: r.row, voce: r.voce, date: r.date, pocket: legs[0]!.pocketId, amount: legs[0]!.amount });
    } else {
      const out = -neg.reduce((a, l) => a + l.amount, 0);
      const inn = pos.reduce((a, l) => a + l.amount, 0);
      if (out !== inn) anomalies.push({ type: 'unbalanced-transfer', row: r.row, voce: r.voce, date: r.date, out, in: inn });
    }
  }
  for (const [voce, count] of unknown) anomalies.push({ type: 'unknown-voce', voce, count });

  return {
    data: {
      groups: config.groups,
      pockets,
      categories: config.categories,
      transactions: txs,
      recurring: config.recurring,
      valuations: [],
      settings: config.settings,
    },
    anomalies,
    startDate,
  };
}

/** Descrizione in italiano di un'incongruenza, per l'onboarding. */
export function describeAnomaly(a: Anomaly, pocketName: (id: string) => string, eur: (c: number) => string): string {
  switch (a.type) {
    case 'unbalanced-transfer':
      return `Riga ${a.row} (${prettyVoce(a.voce)}): escono ${eur(a.out)} ma entrano ${eur(a.in)}.`;
    case 'one-sided-transfer':
      return `Riga ${a.row} (${prettyVoce(a.voce)}): giroconto con un solo lato, ${eur(a.amount)} su ${pocketName(a.pocket)}.`;
    case 'roundup-not-deducted':
      return `Riga ${a.row} (${prettyVoce(a.voce)}): arrotondamento di ${eur(a.roundup)} non sottratto a ${pocketName(a.pocket)}.`;
    case 'roundup-mismatch':
      return `Riga ${a.row} (${prettyVoce(a.voce)}): arrotondamento ${eur(a.roundup)} invece di ${eur(a.expected)}.`;
    case 'missing-opening':
      return `Colonna ${a.pocket}: non trovo il saldo iniziale nella formula, parto da 0.`;
    case 'unknown-voce':
      return `Voce "${prettyVoce(a.voce)}" (${a.count}) senza categoria.`;
  }
}
