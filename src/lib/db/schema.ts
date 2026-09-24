/**
 * Schema IndexedDB con versioni e migrazioni.
 *
 * Regola d'oro: una migrazione non si modifica MAI dopo essere stata pubblicata.
 * Per cambiare lo schema si aggiunge una nuova versione in coda a MIGRATIONS.
 * Le migrazioni devono trasformare i dati, mai cancellarli.
 */
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Category, Group, Pocket, Recurring, Transaction, Valuation } from '../domain/types';

export const DB_NAME = 'conti';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface ContiDB extends DBSchema {
  groups: { key: string; value: Group };
  pockets: { key: string; value: Pocket };
  categories: { key: string; value: Category };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-date': string; 'by-parent': string; 'by-autoKey': string };
  };
  recurring: { key: string; value: Recurring };
  valuations: { key: string; value: Valuation; indexes: { 'by-pocket': string } };
  meta: { key: string; value: MetaRecord };
}

export type Store = StoreNames<ContiDB>;
export const DATA_STORES = ['groups', 'pockets', 'categories', 'transactions', 'recurring', 'valuations'] as const;
export type DataStore = (typeof DATA_STORES)[number];

type UpgradeTx = IDBPTransaction<ContiDB, Store[], 'versionchange'>;
type Migration = (db: IDBPDatabase<ContiDB>, tx: UpgradeTx) => void | Promise<void>;

/** MIGRATIONS[i] porta il database dalla versione i alla i+1. */
export const MIGRATIONS: Migration[] = [
  // v1: schema iniziale
  (db) => {
    db.createObjectStore('groups', { keyPath: 'id' });
    db.createObjectStore('pockets', { keyPath: 'id' });
    db.createObjectStore('categories', { keyPath: 'id' });
    const txs = db.createObjectStore('transactions', { keyPath: 'id' });
    txs.createIndex('by-date', 'date');
    txs.createIndex('by-parent', 'parentId');
    txs.createIndex('by-autoKey', 'autoKey');
    db.createObjectStore('recurring', { keyPath: 'id' });
    const val = db.createObjectStore('valuations', { keyPath: 'id' });
    val.createIndex('by-pocket', 'pocketId');
    db.createObjectStore('meta', { keyPath: 'key' });
  },
];

export const DB_VERSION = MIGRATIONS.length;
