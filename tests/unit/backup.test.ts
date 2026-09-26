import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { transactionsToCsv } from '../../src/lib/backup/csv';
import { encryptJson } from '../../src/lib/backup/crypto';
import { BackupError, parseBackup } from '../../src/lib/backup/format';
import { makeBackup, readBackup, restoreBackup } from '../../src/lib/backup/service';
import { deleteTransaction, getBackupInfo, loadAll, openAppDb, pendingChanges, replaceAll, restoreTransactions, saveEntry } from '../../src/lib/db/repo';
import { DEFAULT_SETTINGS, type AppData } from '../../src/lib/domain/types';
import { ctx, pockets, recurring, tx } from './fixtures';

let dbn = 0;
const freshDb = () => openAppDb(`test-${++dbn}`);

const sample = (): AppData => ({
  groups: [{ id: 'g1', name: 'Banca', order: 0 }],
  pockets,
  categories: [{ id: 'c1', name: 'Spesa', icon: 'cart', color: 'verde', archived: false, order: 0 }],
  transactions: [
    tx({ id: 't1', date: '2030-01-23', kind: 'income', legs: [{ pocketId: 'main', amount: 200000 }] }),
    tx({ id: 't2', date: '2030-01-24', kind: 'expense', categoryId: 'c1', description: 'Spesa; "grande"', legs: [{ pocketId: 'home', amount: -1230 }] }),
  ],
  recurring,
  valuations: [{ id: 'v1', pocketId: 'inv1', date: '2030-01-31', value: 305000 }],
  settings: { ...DEFAULT_SETTINGS, safetyMargin: 5000 },
});

describe('database', () => {
  it('salva uscita e arrotondamento insieme, li aggiorna e li elimina insieme', async () => {
    const db = await freshDb();
    await replaceAll(db, { ...sample(), transactions: [] });
    const { tx: e, roundup } = await saveEntry(db, { kind: 'expense', date: '2030-01-24', amount: 1230, fromPocketId: 'fun', description: 'Bar' }, ctx);
    expect(roundup?.legs[1]).toEqual({ pocketId: 'coins', amount: 70 });

    await saveEntry(db, { kind: 'expense', date: '2030-01-24', amount: 1230, fromPocketId: 'fun', description: 'Bar', roundup: false }, ctx, e.id);
    expect((await loadAll(db)).transactions).toHaveLength(1);

    await saveEntry(db, { kind: 'expense', date: '2030-01-24', amount: 1800, fromPocketId: 'fun', description: 'Bar' }, ctx, e.id);
    expect((await loadAll(db)).transactions).toHaveLength(2);

    const removed = await deleteTransaction(db, e.id);
    expect(removed).toHaveLength(2);
    expect((await loadAll(db)).transactions).toHaveLength(0);
    expect((await getBackupInfo(db)).deletedSince).toBe(1);

    await restoreTransactions(db, removed);
    expect((await loadAll(db)).transactions).toHaveLength(2);
    expect((await getBackupInfo(db)).deletedSince).toBe(0);
  });
});

describe('backup e ripristino', () => {
  it('ripristina esattamente lo stato del backup', async () => {
    const a = await freshDb();
    await replaceAll(a, sample());
    const blob = await makeBackup(a, '0.1.0', { now: new Date('2030-10-23T10:00:00Z') });
    expect(blob.name).toBe('mokash-backup-2030-10-23.json');

    const b = await freshDb();
    await replaceAll(b, { ...sample(), transactions: [], pockets: pockets.slice(0, 2) });
    const read = await readBackup(blob.json);
    if (read.status !== 'ok') throw new Error();
    expect(read.summary.message).toBe('Stai per ripristinare 2 movimenti, backup del 23/10/2030');
    await restoreBackup(b, read.backup);

    const restored = await loadAll(b);
    const original = await loadAll(a);
    const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((x, y) => x.id.localeCompare(y.id));
    for (const k of ['groups', 'pockets', 'categories', 'transactions', 'recurring', 'valuations'] as const) {
      expect(byId(restored[k] as { id: string }[])).toEqual(byId(original[k] as { id: string }[]));
    }
    expect(restored.settings).toEqual(original.settings);
    expect(pendingChanges(restored.transactions, await getBackupInfo(b))).toBe(0);
  });

  it('backup cifrato: serve la password giusta', async () => {
    const db = await freshDb();
    await replaceAll(db, sample());
    const blob = await makeBackup(db, '0.1.0', { password: 'cavallo-batteria' });
    expect(blob.json).not.toContain('Spesa');
    expect((await readBackup(blob.json)).status).toBe('needs-password');
    await expect(readBackup(blob.json, 'sbagliata')).rejects.toThrow('Password errata');
    const ok = await readBackup(blob.json, 'cavallo-batteria');
    expect(ok.status === 'ok' && ok.backup.data.transactions.length).toBe(2);
  });

  it('rifiuta file non validi con messaggi chiari', async () => {
    await expect(readBackup('ciao')).rejects.toThrow(BackupError);
    expect(() => parseBackup({ format: 'altro' })).toThrow('non è un backup');
    expect(() => parseBackup({ format: 'conti-backup', version: 99, data: {} })).toThrow('più recente');
    const bad = { format: 'conti-backup', version: 1, data: { ...sample(), transactions: [{ id: 'x', date: '2030-01-01', kind: 'expense', legs: [{ pocketId: 'nessuno', amount: 1 }] }] } };
    expect(() => parseBackup(bad)).toThrow('movimento non valido');
  });

  it('non contiene il PIN di blocco', async () => {
    const db = await freshDb();
    await replaceAll(db, sample());
    await db.put('meta', { key: 'lock', value: { hash: 'segreto' } });
    expect((await makeBackup(db, '0.1.0')).json).not.toContain('segreto');
  });

  it('conta i movimenti non ancora inclusi', async () => {
    const txs = sample().transactions.map((t, i) => ({ ...t, updatedAt: i === 0 ? 100 : 300 }));
    expect(pendingChanges(txs, { lastAt: 200, deletedSince: 2 })).toBe(3);
    expect(pendingChanges(txs, { deletedSince: 0 })).toBe(2);
  });

  it('cifra con Web Crypto in formato leggibile', async () => {
    const env = await encryptJson('{"a":1}', 'x', 1000);
    expect(env.kdf.iterations).toBe(1000);
    expect(env.cipher.name).toBe('AES-GCM');
  });
});

describe('CSV', () => {
  it('separatore ;, decimali con virgola, testo protetto', () => {
    const csv = transactionsToCsv(sample());
    expect(csv.startsWith('﻿Data;Tipo;')).toBe(true);
    expect(csv).toContain('24/01/2030;Uscita;"Spesa; ""grande""";Spesa;Casa;-12,30;');
    expect(csv).toContain('23/01/2030;Entrata;x;;Conto;2000,00;');
  });
});
