/**
 * Accesso ai dati. Ogni scrittura che tocca più record (uscita + arrotondamento,
 * ripristino) avviene in una sola transazione IndexedDB: o tutto o niente.
 */
import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type AppData, type Id, type Settings, type Transaction } from '../domain/types';
import { buildEntry, roundupTxFor, type Ctx, type EntryInput } from '../domain/transactions';
import { DATA_STORES, DB_NAME, DB_VERSION, MIGRATIONS, type ContiDB, type DataStore } from './schema';

export type DB = IDBPDatabase<ContiDB>;

export interface BackupInfo {
  /** Momento dell'ultimo backup (ms). */
  lastAt?: number;
  /** Movimenti eliminati dopo l'ultimo backup. */
  deletedSince: number;
}

export async function openAppDb(name = DB_NAME): Promise<DB> {
  return openDB<ContiDB>(name, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < DB_VERSION; v++) await MIGRATIONS[v]!(db, tx);
    },
    blocked() {
      // Un'altra scheda tiene aperta una versione vecchia: verrà chiusa da `versionchange`.
    },
  }).then((db) => {
    db.addEventListener('versionchange', () => db.close());
    return db;
  });
}

// ── Meta ──

export async function getMeta<T>(db: DB, key: string, fallback: T): Promise<T> {
  const rec = await db.get('meta', key);
  return rec ? (rec.value as T) : fallback;
}

export async function setMeta(db: DB, key: string, value: unknown): Promise<void> {
  await db.put('meta', { key, value });
}

// ── Lettura completa ──

export async function loadAll(db: DB): Promise<AppData> {
  const tx = db.transaction([...DATA_STORES, 'meta'], 'readonly');
  const [groups, pockets, categories, transactions, recurring, valuations, settings] = await Promise.all([
    tx.objectStore('groups').getAll(),
    tx.objectStore('pockets').getAll(),
    tx.objectStore('categories').getAll(),
    tx.objectStore('transactions').getAll(),
    tx.objectStore('recurring').getAll(),
    tx.objectStore('valuations').getAll(),
    tx.objectStore('meta').get('settings'),
  ]);
  await tx.done;
  return {
    groups,
    pockets,
    categories,
    transactions,
    recurring,
    valuations,
    settings: { ...DEFAULT_SETTINGS, ...((settings?.value as Partial<Settings>) ?? {}) },
  };
}

/** Sostituisce TUTTI i dati (ripristino, import iniziale). Atomico. */
export async function replaceAll(db: DB, data: AppData): Promise<void> {
  const tx = db.transaction([...DATA_STORES, 'meta'], 'readwrite');
  for (const s of DATA_STORES) await tx.objectStore(s).clear();
  const puts: Promise<unknown>[] = [];
  for (const s of DATA_STORES) {
    const store = tx.objectStore(s);
    for (const item of data[s] as { id: string }[]) puts.push(store.put(item as never));
  }
  puts.push(tx.objectStore('meta').put({ key: 'settings', value: data.settings }));
  await Promise.all(puts);
  await tx.done;
}

// ── Scritture generiche (pocket, categorie, fissi, valutazioni, gruppi) ──

export async function putItem<S extends Exclude<DataStore, 'transactions'>>(db: DB, store: S, item: ContiDB[S]['value']): Promise<void> {
  await db.put(store, item);
}

export async function deleteItem(db: DB, store: Exclude<DataStore, 'transactions'>, id: Id): Promise<void> {
  await db.delete(store, id);
}

export async function saveSettings(db: DB, settings: Settings): Promise<void> {
  await setMeta(db, 'settings', settings);
}

// ── Movimenti ──

/**
 * Salva un movimento nuovo o modificato e mantiene allineato il suo arrotondamento.
 * Restituisce i record scritti (utile per "Annulla").
 */
export async function saveEntry(db: DB, input: EntryInput, ctx: Ctx, existingId?: Id): Promise<{ tx: Transaction; roundup: Transaction | null }> {
  const t = db.transaction('transactions', 'readwrite');
  const store = t.objectStore('transactions');
  const existing = existingId ? await store.get(existingId) : undefined;
  const oldRoundup = existing ? (await store.index('by-parent').getAll(existing.id)).find((x) => x.kind === 'roundup') : undefined;
  const tx = buildEntry(input, ctx, existing);
  const roundup = roundupTxFor(tx, ctx, oldRoundup);
  await store.put(tx);
  if (roundup) await store.put(roundup);
  else if (oldRoundup) await store.delete(oldRoundup.id);
  await t.done;
  return { tx, roundup };
}

/** Scrive movimenti già costruiti (rettifiche, import, annulla eliminazione). */
export async function putTransactions(db: DB, txs: Transaction[]): Promise<void> {
  const t = db.transaction('transactions', 'readwrite');
  await Promise.all(txs.map((x) => t.store.put(x)));
  await t.done;
}

/** Elimina un movimento insieme ai collegati (arrotondamento). Restituisce ciò che è stato eliminato. */
export async function deleteTransaction(db: DB, id: Id): Promise<Transaction[]> {
  const t = db.transaction(['transactions', 'meta'], 'readwrite');
  const store = t.objectStore('transactions');
  const main = await store.get(id);
  if (!main) {
    await t.done;
    return [];
  }
  const children = await store.index('by-parent').getAll(id);
  const removed = [main, ...children];
  for (const r of removed) await store.delete(r.id);
  const meta = t.objectStore('meta');
  const info = ((await meta.get('backup'))?.value as BackupInfo | undefined) ?? { deletedSince: 0 };
  await meta.put({ key: 'backup', value: { ...info, deletedSince: info.deletedSince + (main.kind === 'roundup' ? 0 : 1) } });
  await t.done;
  return removed;
}

/** Annulla un'eliminazione: rimette i record e corregge il contatore del backup. */
export async function restoreTransactions(db: DB, removed: Transaction[]): Promise<void> {
  const t = db.transaction(['transactions', 'meta'], 'readwrite');
  for (const r of removed) await t.objectStore('transactions').put(r);
  const meta = t.objectStore('meta');
  const info = ((await meta.get('backup'))?.value as BackupInfo | undefined) ?? { deletedSince: 0 };
  const main = removed.find((r) => !r.parentId);
  if (main && main.kind !== 'roundup') await meta.put({ key: 'backup', value: { ...info, deletedSince: Math.max(0, info.deletedSince - 1) } });
  await t.done;
}

// ── Stato del backup ──

export async function getBackupInfo(db: DB): Promise<BackupInfo> {
  return getMeta<BackupInfo>(db, 'backup', { deletedSince: 0 });
}

export async function markBackupDone(db: DB, at: number): Promise<void> {
  await setMeta(db, 'backup', { lastAt: at, deletedSince: 0 } satisfies BackupInfo);
}

/** Movimenti non ancora inclusi nell'ultimo backup (nuovi, modificati o eliminati). */
export function pendingChanges(txs: Transaction[], info: BackupInfo): number {
  const since = info.lastAt ?? -Infinity;
  return txs.filter((t) => t.kind !== 'roundup' && t.updatedAt > since).length + info.deletedSince;
}
