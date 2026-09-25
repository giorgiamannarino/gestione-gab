/**
 * Stato dell'app: dati caricati da IndexedDB, saldi calcolati, azioni.
 * Ogni azione scrive nel database e poi ricarica: il database è l'unica fonte di verità.
 */
import { balances } from '../domain/balances';
import { today, periodOf, shiftPeriod, type Period } from '../domain/dates';
import { formatCents } from '../domain/money';
import { buildAdjustment, buildEntry, type Ctx, type EntryInput } from '../domain/transactions';
import { DEFAULT_SETTINGS, type AppData, type Id, type Recurring, type Settings, type Transaction } from '../domain/types';
import { buildPlan } from '../domain/plan';
import { addMonths, splitBill } from '../domain/stats';
import {
  deleteItem, deleteTransaction, getBackupInfo, getMeta, loadAll, openAppDb, pendingChanges, putItem, putTransactions,
  replaceAll, restoreTransactions, saveEntry, saveSettings, setMeta, type BackupInfo, type DB,
} from '../db/repo';
import type { DataStore } from '../db/schema';
import { DB_NAME } from '../db/schema';
import { showToast } from '../ui/toast.svelte';
import { notify, REMINDER_HOUR, REMINDER_TEXT } from './notify';

const EMPTY: AppData = { groups: [], pockets: [], categories: [], transactions: [], recurring: [], valuations: [], settings: DEFAULT_SETTINGS };

class AppStore {
  db: DB | null = null;
  ready = $state(false);
  error = $state<string | null>(null);
  data = $state<AppData>(EMPTY);
  onboarded = $state(false);
  backupInfo = $state<BackupInfo>({ deletedSince: 0 });
  persisted = $state<boolean | null>(null);
  today = $state(today());

  balances = $derived(balances(this.data.pockets, this.data.transactions));
  period: Period = $derived(periodOf(this.today, this.data.settings.salaryDay));
  pending = $derived(pendingChanges(this.data.transactions, this.backupInfo));
  activePockets = $derived(this.data.pockets.filter((p) => !p.archived).sort((a, b) => a.order - b.order));
  mainPocket = $derived(this.data.pockets.find((p) => p.role === 'main'));
  savingsTarget = $derived(this.data.pockets.find((p) => p.role === 'reserve' && !p.archived));
  total = $derived([...this.balances.entries()].filter(([id]) => this.data.pockets.find((p) => p.id === id && !p.archived)).reduce((a, [, v]) => a + v, 0));

  ctx(): Ctx {
    return { pockets: this.data.pockets, newId: () => crypto.randomUUID(), now: () => Date.now() };
  }

  /** "Non ancora" sul banner delle bollette: nascosto fino a domani. */
  billSnooze = $state('');

  /** Dal mese della prossima bolletta stimata, finché non viene registrata. */
  get billDue(): { month: string; estimate: number } | null {
    const nb = this.data.settings.nextBill;
    const bills = this.data.pockets.find((p) => p.role === 'bills' && !p.archived);
    if (!nb || !bills || this.today.slice(0, 7) < nb.month || this.billSnooze === this.today) return null;
    if (this.txByKey(`bill:${nb.month}`)) return null;
    return { month: nb.month, estimate: nb.amount };
  }

  async snoozeBill(): Promise<void> {
    this.billSnooze = this.today;
    await setMeta(this.db!, 'billSnooze', this.today);
  }

  /**
   * Bolletta pagata dal Fondo bollette: se costa meno del fondo, il resto va sui risparmi;
   * se costa di più il fondo va in negativo e lo si segnala. Poi la stima passa a due mesi dopo.
   */
  async registerBill(amount: number, date: string): Promise<{ rest: number; shortfall: number }> {
    const due = this.billDue;
    const bills = this.data.pockets.find((p) => p.role === 'bills' && !p.archived);
    if (!due || !bills || amount <= 0) return { rest: 0, shortfall: 0 };
    const reserve = this.savingsTarget;
    const { rest, shortfall } = splitBill(this.balances.get(bills.id) ?? 0, amount);
    const ctx = this.ctx();
    const category = this.data.categories.find((c) => c.id === 'bollette' && !c.archived)?.id;
    const txs: Transaction[] = [];
    // Il fondo non basta: la differenza arriva prima dai risparmi, così il fondo non va in negativo.
    if (shortfall > 0 && reserve) {
      txs.push(buildEntry({ kind: 'transfer', date, amount: shortfall, fromPocketId: reserve.id, splits: [{ pocketId: bills.id, amount: shortfall }], description: 'Integrazione bollette', categoryId: 'sys-transfer', source: 'plan', autoKey: `bill-cover:${due.month}` }, ctx));
    }
    txs.push(buildEntry({ kind: 'expense', date, amount, fromPocketId: bills.id, description: 'Bollette', categoryId: category, source: 'plan', autoKey: `bill:${due.month}` }, ctx));
    if (rest > 0 && reserve) {
      txs.push(buildEntry({ kind: 'transfer', date, amount: rest, fromPocketId: bills.id, splits: [{ pocketId: reserve.id, amount: rest }], description: 'Avanzo bollette', categoryId: 'sys-transfer', source: 'plan', autoKey: `bill-rest:${due.month}` }, ctx));
    }
    txs.forEach((t, i) => (t.createdAt += i));
    const before = $state.snapshot(this.data.settings) as Settings;
    await putTransactions(this.db!, txs);
    await saveSettings(this.db!, { ...before, nextBill: { month: addMonths(due.month, 2), amount } });
    await this.reload();
    const message =
      shortfall > 0
        ? reserve
          ? `Bollette registrate, ${formatCents(shortfall)} presi da ${reserve.name}`
          : `Bollette registrate: il fondo non bastava, mancano ${formatCents(shortfall)}`
        : rest > 0 && reserve
          ? `Bollette registrate, ${formatCents(rest)} tornati su ${reserve.name}`
          : 'Bollette registrate';
    showToast(message, {
      tone: shortfall > 0 && !reserve ? 'error' : 'success',
      undo: async () => {
        for (const t of txs) await deleteTransaction(this.db!, t.id);
        await saveSettings(this.db!, before);
        await this.reload();
      },
    });
    return { rest, shortfall };
  }

  /** Dopo le 20, se oggi non è stato inserito nessun movimento a mano. */
  get eveningReminderDue(): boolean {
    if (!this.data.settings.eveningReminder || new Date().getHours() < REMINDER_HOUR) return false;
    return !this.data.transactions.some((t) => t.date === this.today && (t.kind === 'expense' || t.kind === 'income') && t.source === 'manual');
  }

  /** Mostra la notifica serale al massimo una volta al giorno, se l'app è aperta. */
  async checkEveningReminder(): Promise<void> {
    if (!this.db || !this.eveningReminderDue) return;
    if ((await getMeta(this.db, 'lastReminder', '')) === this.today) return;
    if (await notify('Conti', REMINDER_TEXT)) await setMeta(this.db, 'lastReminder', this.today);
  }

  async init(): Promise<void> {
    try {
      this.db = await openAppDb();
      await this.reload();
      this.onboarded = await getMeta(this.db, 'onboarded', false);
      this.billSnooze = await getMeta(this.db, 'billSnooze', '');
      this.persisted = (await navigator.storage?.persisted?.()) ?? null;
    } catch (e) {
      this.error = "Non riesco ad aprire i dati sul telefono. Chiudi e riapri l'app; se il problema resta, ripristina un backup.";
      console.error(e);
    }
    this.ready = true;
    // Aggiorna "oggi" se l'app resta aperta a cavallo della mezzanotte.
    setInterval(() => {
      const t = today();
      if (t !== this.today) this.today = t;
      void this.checkEveningReminder();
    }, 60_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void this.checkEveningReminder());
    void this.checkEveningReminder();
  }

  async reload(): Promise<void> {
    const db = this.db!;
    const [data, info] = await Promise.all([loadAll(db), getBackupInfo(db)]);
    this.data = data;
    this.backupInfo = info;
  }

  async requestPersistence(): Promise<boolean> {
    try {
      this.persisted = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      this.persisted = false;
    }
    return this.persisted;
  }

  // ── Movimenti ──

  async saveEntry(input: EntryInput, existingId?: Id): Promise<Transaction> {
    const db = this.db!;
    const before = existingId ? this.withChildren(existingId) : [];
    const { tx } = await saveEntry(db, input, this.ctx(), existingId);
    await this.reload();
    const label = input.kind === 'expense' ? 'Uscita' : input.kind === 'income' ? 'Entrata' : 'Giroconto';
    const saved = input.kind === 'transfer' ? 'salvato' : 'salvata';
    showToast(existingId ? 'Movimento aggiornato' : `${label} di ${formatCents(input.amount)} ${saved}`, {
      tone: 'success',
      undo: async () => {
        await deleteTransaction(db, tx.id);
        if (before.length) await restoreTransactions(db, before);
        await this.reload();
      },
    });
    return tx;
  }

  withChildren(id: Id): Transaction[] {
    return this.data.transactions.filter((t) => t.id === id || t.parentId === id).map((t) => $state.snapshot(t) as Transaction);
  }

  async deleteTx(id: Id, message = 'Movimento eliminato'): Promise<void> {
    const db = this.db!;
    const removed = await deleteTransaction(db, id);
    await this.reload();
    showToast(message, {
      undo: async () => {
        await restoreTransactions(db, removed);
        await this.reload();
      },
    });
  }

  /** Rettifica: porta i pocket ai saldi reali. Restituisce quante rettifiche ha creato. */
  async adjust(real: Map<Id, number>, date = this.today): Promise<number> {
    const cat = this.data.categories.find((c) => c.system === 'adjustment')?.id;
    const txs = [...real]
      .map(([id, value]) => buildAdjustment(id, this.balances.get(id) ?? 0, value, date, this.ctx(), cat))
      .filter((t): t is Transaction => !!t);
    if (!txs.length) return 0;
    await putTransactions(this.db!, txs);
    await this.reload();
    showToast(txs.length === 1 ? 'Saldo allineato' : `${txs.length} saldi allineati`, {
      tone: 'success',
      undo: async () => {
        for (const t of txs) await deleteTransaction(this.db!, t.id);
        await this.reload();
      },
    });
    return txs.length;
  }

  // ── Voci automatiche ──

  txByKey(key: string): Transaction | undefined {
    return this.data.transactions.find((t) => t.autoKey === key);
  }

  async confirmDebit(r: Recurring, date: string, key: string): Promise<void> {
    if (r.toPocketId) {
      // Giroconto programmato (es. Generali → Fondo Pensione).
      await this.saveEntry({
        kind: 'transfer', date, amount: r.amount, fromPocketId: r.fromPocketId, splits: [{ pocketId: r.toPocketId, amount: r.amount }],
        description: r.name, categoryId: 'sys-transfer', source: 'recurring', autoKey: key,
      });
      return;
    }
    await this.saveEntry({
      kind: 'expense', date, amount: r.amount, fromPocketId: r.fromPocketId, description: r.name,
      categoryId: r.categoryId, source: 'recurring', autoKey: key,
    });
  }

  /**
   * Stipendio del periodo: quello registrato dal piano oppure, se importato o inserito
   * a mano, un'entrata sul conto principale con la categoria Stipendio.
   */
  get salaryTx(): Transaction | undefined {
    const byKey = this.txByKey(`salary:${this.period.key}`);
    if (byKey) return byKey;
    const main = this.mainPocket?.id;
    const cat = this.data.settings.salaryCategoryId;
    if (!main || !cat) return undefined;
    return this.data.transactions
      .filter((t) => t.kind === 'income' && t.categoryId === cat && t.date >= this.period.start && t.date <= this.period.end && t.legs.some((l) => l.pocketId === main))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))[0];
  }

  /**
   * Una voce del piano è fatta se c'è il suo giroconto automatico, oppure un giroconto
   * nel periodo (anche importato o manuale) dallo stesso pocket verso quello di destinazione.
   */
  planStatus(line: { recurringId: Id; fromPocketId: Id; toPocketId?: Id }): 'auto' | 'manual' | null {
    if (this.txByKey(`plan:${line.recurringId}:${this.period.key}`)) return 'auto';
    const found = this.data.transactions.some(
      (t) =>
        t.kind === 'transfer' &&
        !t.autoKey?.startsWith('plan:') &&
        t.date >= this.period.start &&
        t.date <= this.period.end &&
        t.legs.some((l) => l.pocketId === line.fromPocketId && l.amount < 0) &&
        t.legs.some((l) => l.pocketId === line.toPocketId && l.amount > 0),
    );
    return found ? 'manual' : null;
  }

  planFor(salary: number) {
    const main = this.mainPocket;
    const salaryTx = this.salaryTx;
    // Saldi prima dello stipendio: stabili anche mentre si spuntano le voci della checklist.
    const before = salaryTx ? this.balancesBeforeTx(salaryTx) : this.balances;
    const leftover = main ? (before.get(main.id) ?? 0) : 0;
    // Uscite di ogni pocket nel periodo precedente (spese, arrotondamenti, giroconti; non le rettifiche).
    const prev = shiftPeriod(this.period, -1, this.data.settings.salaryDay);
    const takenPrev = new Map<Id, number>();
    for (const t of this.data.transactions) {
      if (t.kind === 'adjustment' || t.date < prev.start || t.date > prev.end) continue;
      for (const l of t.legs) if (l.amount < 0) takenPrev.set(l.pocketId, (takenPrev.get(l.pocketId) ?? 0) - l.amount);
    }
    return buildPlan({
      salary, recurring: this.data.recurring, pockets: this.data.pockets, mainPocketId: main?.id ?? '',
      safetyMargin: this.data.settings.safetyMargin, leftover, balancesBefore: before, takenPrev,
    });
  }

  private balancesBeforeTx(tx: Transaction) {
    return balances(this.data.pockets, this.data.transactions.filter((t) => t.date < tx.date || (t.date === tx.date && t.createdAt < tx.createdAt)));
  }

  /** Registra lo stipendio e gli spostamenti automatici (FP, PAC). */
  async registerSalary(amount: number, date: string): Promise<void> {
    const main = this.mainPocket;
    if (!main) return;
    const key = this.period.key;
    const db = this.db!;
    const ctx = this.ctx();
    const txs: Transaction[] = [
      buildEntry({ kind: 'income', date, amount, toPocketId: main.id, description: 'Stipendio', categoryId: this.data.settings.salaryCategoryId, source: 'plan', autoKey: `salary:${key}` }, ctx),
    ];
    const plan = this.planFor(amount);
    for (const l of plan.auto) {
      if (!l.toPocketId || l.amount <= 0) continue;
      txs.push(buildEntry({ kind: 'transfer', date, amount: l.amount, fromPocketId: l.fromPocketId, splits: [{ pocketId: l.toPocketId, amount: l.amount }], description: l.name, categoryId: 'sys-transfer', source: 'plan', autoKey: `plan:${l.recurringId}:${key}` }, ctx));
    }
    // Garantisce l'ordine: stipendio prima degli spostamenti.
    txs.forEach((t, i) => (t.createdAt += i));
    await putTransactions(db, txs);
    await this.reload();
    showToast(`Stipendio di ${formatCents(amount)} registrato`, {
      tone: 'success',
      undo: async () => {
        for (const t of txs) await deleteTransaction(db, t.id);
        await this.reload();
      },
    });
  }

  /** Spunta/de-spunta una voce della checklist: registra o elimina il giroconto. */
  async togglePlanTransfer(line: { recurringId: Id; name: string; fromPocketId: Id; toPocketId?: Id; amount: number }, date: string): Promise<void> {
    const key = `plan:${line.recurringId}:${this.period.key}`;
    // Già fatto con un giroconto importato o manuale: non si duplica.
    if (this.planStatus(line) === 'manual') return;
    const existing = this.txByKey(key);
    if (existing) return this.deleteTx(existing.id, `${line.name}: spostamento annullato`);
    if (!line.toPocketId || line.amount <= 0) return;
    await this.saveEntry({ kind: 'transfer', date, amount: line.amount, fromPocketId: line.fromPocketId, splits: [{ pocketId: line.toPocketId, amount: line.amount }], description: line.name, categoryId: 'sys-transfer', source: 'plan', autoKey: key });
  }

  // ── Configurazione ──

  async put<S extends Exclude<DataStore, 'transactions'>>(store: S, item: AppData[S][number]): Promise<void> {
    await putItem(this.db!, store, $state.snapshot(item) as never);
    await this.reload();
  }

  async remove(store: Exclude<DataStore, 'transactions'>, id: Id): Promise<void> {
    await deleteItem(this.db!, store, id);
    await this.reload();
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await saveSettings(this.db!, { ...$state.snapshot(this.data.settings), ...patch });
    await this.reload();
  }

  async replaceData(data: AppData): Promise<void> {
    // IndexedDB non può copiare i proxy reattivi di Svelte: si salva una copia semplice.
    await replaceAll(this.db!, $state.snapshot(data) as AppData);
    await this.reload();
  }

  /** Solo anteprima di sviluppo: sostituisce tutto con dati inventati. Escluso dalla build pubblicata. */
  async loadDemo(): Promise<void> {
    if (!import.meta.env.DEV) return;
    const { demoData } = await import('../demo/demo-data');
    await this.replaceData(demoData(this.today));
    await setMeta(this.db!, 'backup', { deletedSince: 0 });
    await this.reload();
  }

  async finishOnboarding(): Promise<void> {
    await setMeta(this.db!, 'onboarded', true);
    this.onboarded = true;
  }

  async getMeta<T>(key: string, fallback: T): Promise<T> {
    return getMeta(this.db!, key, fallback);
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await setMeta(this.db!, key, $state.snapshot(value));
  }

  /** Cancella tutti i dati del telefono (serve per ripartire se il PIN è stato dimenticato). */
  async wipe(): Promise<void> {
    this.db?.close();
    await new Promise<void>((res) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
    location.hash = '';
    location.reload();
  }
}

export const app = new AppStore();
