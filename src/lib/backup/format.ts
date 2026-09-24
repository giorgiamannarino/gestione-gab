/**
 * Formato del backup: copia completa e cumulativa di tutti i dati, con versione.
 * Il blocco con PIN NON è incluso: ripristinare un backup è proprio la via
 * d'uscita quando il PIN viene dimenticato.
 */
import { formatDate, toISODate } from '../domain/dates';
import { DEFAULT_SETTINGS, type AppData } from '../domain/types';

export const BACKUP_FORMAT = 'conti-backup';
/** Versione del formato dei dati. Si incrementa quando cambia AppData. */
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string; // ISO 8601
  app: string;
  data: AppData;
}

export function createBackup(data: AppData, now: Date, appVersion: string): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), app: appVersion, data };
}

export function backupFileName(now: Date): string {
  return `conti-backup-${toISODate(now)}.json`;
}

/** Migrazioni del formato: BACKUP_MIGRATIONS[v] porta i dati dalla versione v alla v+1. */
const BACKUP_MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

export class BackupError extends Error {}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => Number.isInteger(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isDate = (x: unknown) => isStr(x) && /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Valida e migra un backup letto da file. Lancia BackupError con un messaggio comprensibile. */
export function parseBackup(raw: unknown): BackupFile {
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError('Il file non è un backup di questa app.');
  }
  if ('encrypted' in raw) throw new BackupError('Il backup è cifrato: serve la password.');
  const version = raw.version;
  if (!isInt(version) || version < 1) throw new BackupError('Il backup ha una versione non valida.');
  if (version > BACKUP_VERSION) {
    throw new BackupError("Il backup è stato creato da una versione più recente dell'app. Aggiorna l'app e riprova.");
  }
  if (!isObj(raw.data)) throw new BackupError('Il backup è incompleto.');
  let data: Record<string, unknown> = raw.data;
  for (let v = version; v < BACKUP_VERSION; v++) data = BACKUP_MIGRATIONS[v]!(data);

  const d = data as Record<string, unknown>;
  for (const k of ['groups', 'pockets', 'categories', 'transactions', 'recurring', 'valuations']) {
    if (!Array.isArray(d[k])) throw new BackupError(`Il backup è incompleto (manca "${k}").`);
  }
  const pockets = d.pockets as unknown[];
  const pocketIds = new Set<string>();
  for (const p of pockets) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !isInt(p.openingBalance) || !isDate(p.openingDate)) {
      throw new BackupError('Il backup contiene un pocket non valido.');
    }
    pocketIds.add(p.id);
  }
  const txIds = new Set<string>();
  for (const t of d.transactions as unknown[]) {
    const ok =
      isObj(t) &&
      isStr(t.id) &&
      isDate(t.date) &&
      isStr(t.kind) &&
      Array.isArray(t.legs) &&
      t.legs.every((l) => isObj(l) && isStr(l.pocketId) && pocketIds.has(l.pocketId) && isInt(l.amount));
    if (!ok) throw new BackupError('Il backup contiene un movimento non valido.');
    if (txIds.has(t.id as string)) throw new BackupError('Il backup contiene movimenti duplicati.');
    txIds.add(t.id as string);
  }
  const settings = isObj(d.settings) ? d.settings : {};
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: isStr(raw.createdAt) ? raw.createdAt : new Date(0).toISOString(),
    app: isStr(raw.app) ? raw.app : '',
    data: { ...(d as unknown as AppData), settings: { ...DEFAULT_SETTINGS, ...settings } },
  };
}

export interface BackupSummary {
  transactions: number;
  pockets: number;
  date: string;
  /** "Stai per ripristinare 124 movimenti, backup del 23/10/2026" */
  message: string;
}

export function summarize(b: BackupFile): BackupSummary {
  const transactions = b.data.transactions.filter((t) => t.kind !== 'roundup').length;
  const date = formatDate(toISODate(new Date(b.createdAt)));
  const word = transactions === 1 ? 'movimento' : 'movimenti';
  return {
    transactions,
    pockets: b.data.pockets.length,
    date,
    message: `Stai per ripristinare ${transactions.toLocaleString('it-IT')} ${word}, backup del ${date}`,
  };
}
