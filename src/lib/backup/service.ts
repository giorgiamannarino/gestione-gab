/** Backup e ripristino end-to-end: dal database al file e ritorno. */
import { loadAll, markBackupDone, replaceAll, type DB } from '../db/repo';
import { decryptJson, encryptJson, isEncrypted } from './crypto';
import { BackupError, backupFileName, createBackup, parseBackup, summarize, type BackupFile, type BackupSummary } from './format';

export interface BackupBlob {
  name: string;
  json: string;
}

export async function makeBackup(db: DB, appVersion: string, opts: { password?: string; now?: Date } = {}): Promise<BackupBlob> {
  const now = opts.now ?? new Date();
  const file = createBackup(await loadAll(db), now, appVersion);
  const plain = JSON.stringify(file);
  const json = opts.password ? JSON.stringify(await encryptJson(plain, opts.password)) : plain;
  return { name: backupFileName(now), json };
}

/** Da chiamare solo quando il file è stato davvero salvato/condiviso. */
export async function confirmBackupSaved(db: DB, now = new Date()): Promise<void> {
  await markBackupDone(db, now.getTime());
}

export type ReadResult =
  | { status: 'ok'; backup: BackupFile; summary: BackupSummary }
  | { status: 'needs-password' };

/** Legge un file di backup; se è cifrato serve la password. Lancia BackupError/WrongPasswordError. */
export async function readBackup(text: string, password?: string): Promise<ReadResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Il file non è leggibile: non sembra un backup di questa app.');
  }
  if (isEncrypted(raw)) {
    if (password === undefined) return { status: 'needs-password' };
    raw = JSON.parse(await decryptJson(raw, password));
  }
  const backup = parseBackup(raw);
  return { status: 'ok', backup, summary: summarize(backup) };
}

/** Riporta l'app esattamente allo stato del backup. */
export async function restoreBackup(db: DB, backup: BackupFile): Promise<void> {
  await replaceAll(db, backup.data);
  // Il backup appena ripristinato è, per definizione, aggiornato.
  await markBackupDone(db, Date.now());
}
