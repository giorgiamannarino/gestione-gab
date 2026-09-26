/**
 * Stato dell'app: dati caricati da IndexedDB, saldi calcolati, azioni.
 * Ogni azione scrive nel database e poi ricarica: il database è l'unica fonte di verità.
 */
import { balances } from '../domain/balances';
import { addDays, monthName, today, periodOf, shiftPeriod, type Period } from '../domain/dates';
import { formatCents } from '../domain/money';
import { buildAdjustment, buildEntry, type Ctx, type EntryInput } from '../domain/transactions';
import { DEFAULT_SETTINGS, type AppData, type Deadline, type Id, type Recurring, type Settings, type Transaction } from '../domain/types';
import { buildPlan, coveredDeadlines, type PlanLine } from '../domain/plan';
import { daysBetween, deadlineInstalment, nextYear } from '../domain/planning';
import { addMonths, billAvailable, billExpectedIn, billReferencePeriod, splitBill } from '../domain/stats';
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

  // ── Scadenze annuali ──

  get deadlines(): Deadline[] {
    return [...(this.data.settings.deadlines ?? [])].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }

  /**
   * Voce della checklist per una scadenza: cambia a ogni data di scadenza, così per quelle
   * annuali, dopo il pagamento, si riparte da zero verso la scadenza dell'anno dopo.
   */
  deadlineLineId(d: Pick<Deadline, 'id' | 'dueDate'>): Id {
    return `dl-${d.id}-${d.dueDate}`;
  }

  /**
   * Accantonamento della scadenza a questo stipendio: quanto manca, tolto quello già spostato
   * con la checklist negli stipendi precedenti, diviso gli stipendi che restano (questo compreso).
   */
  deadlinePlan(d: Pick<Deadline, 'id' | 'amount' | 'dueDate' | 'pocketId'>) {
    const { before: saved } = this.deadlineSaved(d);
    return { ...deadlineInstalment(d, this.period, this.data.settings.salaryDay, saved), saved };
  }

  /**
   * Quanto è già accantonato per la scadenza: con la sua voce della checklist, o dentro lo
   * spostamento verso il pocket (spuntato o fatto a mano). Conta solo quanto è arrivato nel
   * pocket della scadenza. `before` = stipendi precedenti, `now` = in questo periodo.
   */
  deadlineSaved(d: Pick<Deadline, 'id' | 'dueDate' | 'pocketId'>) {
    const id = this.deadlineLineId(d);
    const prefix = `plan:${id}:`;
    let before = 0;
    let now = 0;
    for (const t of this.data.transactions) {
      const into = t.legs.find((l) => l.pocketId === d.pocketId && l.amount > 0)?.amount ?? 0;
      if (!into) continue;
      // Il giroconto della spunta può spostare solo il resto di un giroconto a mano, ma porta le quote di tutta la voce.
      const part = t.autoKey?.startsWith(prefix) ? into : (t.deadlines?.[id] ?? 0);
      if (!part) continue;
      if (t.date < this.period.start) before += part;
      else now += part;
    }
    return { before, now };
  }

  /** Riepilogo delle scadenze per il Piano: accantonato finora, quanto manca, tempo che resta. */
  get deadlineRecap() {
    return this.deadlines.map((d) => {
      const { before, now } = this.deadlineSaved(d);
      const saved = Math.min(d.amount, before + now);
      const plan = deadlineInstalment(d, this.period, this.data.settings.salaryDay, before);
      return { deadline: d, saved, missing: d.amount - saved, paydays: plan.paydays, daysLeft: daysBetween(this.today, d.dueDate) };
    });
  }

  /**
   * Spostamento verso un pocket con delle scadenze fatto a mano (dai Movimenti o importato)
   * invece che spuntando il Piano: quando copre tutta la voce, le quote delle scadenze si segnano
   * sull'ultimo di quei giroconti, come con la spunta. Se è solo una parte non si segna nulla:
   * la voce resta da completare. Si ricalcola a ogni caricamento, solo per il periodo in corso.
   */
  private async syncManualDeadlines(): Promise<void> {
    const salary = this.salaryTx;
    if (!salary || !this.data.settings.deadlines?.length) return;
    const plan = this.planFor(0);
    const updates = new Map<Id, Transaction>();
    for (const l of [...plan.auto, ...plan.revolut, ...plan.others]) {
      const covers = coveredDeadlines(l);
      if (!covers) continue;
      const { planTx, manual, manualAmount, found } = this.planMoved(l);
      const holder = !planTx && manual.length && manualAmount >= l.amount ? manual.filter((t) => t.date >= salary.date).at(-1) : undefined;
      // Anche i giroconti di una voce con la spunta tolta: lì le quote vanno ripulite.
      for (const t of found) {
        const cur = updates.get(t.id) ?? t;
        const next = { ...(cur.deadlines ?? {}) };
        for (const k of Object.keys(covers)) delete next[k];
        if (t === holder) Object.assign(next, covers);
        const same = JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(cur.deadlines ?? {}).sort());
        if (!same) updates.set(t.id, { ...($state.snapshot(cur) as Transaction), deadlines: Object.keys(next).length ? next : undefined });
      }
    }
    if (!updates.size) return;
    await putTransactions(this.db!, [...updates.values()]);
    const [data, info] = await Promise.all([loadAll(this.db!), getBackupInfo(this.db!)]);
    this.data = data;
    this.backupInfo = info;
  }

  /** Righe "Scadenze" della checklist del Piano: fino all'ultimo stipendio prima del pagamento. */
  deadlineLines(): PlanLine[] {
    const main = this.mainPocket;
    if (!main) return [];
    return this.deadlines
      .filter((d) => d.pocketId !== (d.fromPocketId ?? main.id))
      .map((d) => {
        const p = this.deadlinePlan(d);
        return {
          recurringId: this.deadlineLineId(d), name: d.name, fromPocketId: d.fromPocketId ?? main.id, toPocketId: d.pocketId,
          amount: p.amount, target: p.amount, mode: 'full' as const, dueDate: d.dueDate, paydays: p.paydays,
        };
      });
  }

  /**
   * Pagamento finale delle scadenze, in "Da confermare" dai 7 giorni prima.
   * (L'accantonamento invece sta nella checklist del Piano.)
   */
  get dueDeadlines(): Deadline[] {
    const from = addDays(this.today, 7);
    return this.deadlines.filter((d) => d.remind && d.dueDate <= from && !this.txByKey(`deadline:${d.id}:${d.dueDate}`));
  }

  async saveDeadline(d: Deadline): Promise<void> {
    const list = (this.data.settings.deadlines ?? []).filter((x) => x.id !== d.id);
    await this.updateSettings({ deadlines: [...list, d] });
  }

  async deleteDeadline(id: Id): Promise<void> {
    await this.updateSettings({ deadlines: (this.data.settings.deadlines ?? []).filter((x) => x.id !== id) });
  }

  /**
   * Le prime scadenze si aggiungevano ai costi fissi come spostamento mensile: ora
   * l'accantonamento sta nella voce Scadenze, quindi quello spostamento si toglie.
   */
  private async migrateDeadlines(): Promise<void> {
    const old = (this.data.settings.deadlines ?? []).filter((d) => d.recurringId);
    if (!old.length) return;
    for (const d of old) await deleteItem(this.db!, 'recurring', d.recurringId!);
    await this.updateSettings({ deadlines: (this.data.settings.deadlines ?? []).map(({ recurringId: _r, ...d }) => d) });
  }

  /** Pagamento della scadenza: spesa dal pocket di accantonamento; se annuale passa all'anno dopo. */
  async confirmDeadline(d: Deadline): Promise<void> {
    const db = this.db!;
    const beforeSettings = $state.snapshot(this.data.settings) as Settings;
    const tx = buildEntry({ kind: 'expense', date: this.today, amount: d.amount, fromPocketId: d.pocketId, description: d.name, categoryId: this.data.categories.find((c) => c.id === 'altro')?.id, source: 'recurring', autoKey: `deadline:${d.id}:${d.dueDate}` }, this.ctx());
    await putTransactions(db, [tx]);
    const list = (beforeSettings.deadlines ?? []).filter((x) => x.id !== d.id);
    // Annuale: si passa alla stessa data dell'anno dopo e l'accantonamento riparte da zero.
    const next = d.annual ? [...list, { ...d, dueDate: nextYear(d.dueDate) }] : list;
    await saveSettings(db, { ...beforeSettings, deadlines: next });
    await this.reload();
    showToast(`${d.name} pagato: ${formatCents(d.amount)}`, {
      tone: 'success',
      undo: async () => {
        await deleteTransaction(db, tx.id);
        await saveSettings(db, beforeSettings);
        await this.reload();
      },
    });
  }

  /** Pocket di "Oggi puoi spendere": quello scelto, oppure quello chiamato "Personale". */
  get dailyPocket() {
    const choice = this.data.settings.dailyPocketId;
    if (choice === 'none') return undefined;
    const active = this.activePockets;
    return (choice && active.find((p) => p.id === choice)) || active.find((p) => p.name.trim().toLowerCase() === 'personale');
  }

  /** "Non ancora" sul banner delle bollette: nascosto fino a questa data (esclusa). */
  billSnoozeUntil = $state('');

  /**
   * Banner delle bollette: dal mese stimato (o dal periodo a cui sono state rimandate),
   * finché non vengono registrate. "Non ancora" lo nasconde per 5 giorni, tranne l'ultimo
   * giorno del periodo di stipendio, quando si chiede sempre conferma (`lastDay`).
   */
  get billDue(): { month: string; estimate: number; lastDay: boolean } | null {
    const nb = this.data.settings.nextBill;
    const bills = this.data.pockets.find((p) => p.role === 'bills' && !p.archived);
    if (!nb || !bills || this.txByKey(`bill:${nb.month}`)) return null;
    const reached = nb.period ? this.period.key >= nb.period : this.today.slice(0, 7) >= nb.month;
    if (!reached) return null;
    const lastDay = this.today === this.period.end;
    if (!lastDay && this.today < this.billSnoozeUntil) return null;
    return { month: nb.month, estimate: nb.amount, lastDay };
  }

  /**
   * Soldi del fondo che spettano alla prossima bolletta: quanto c'era a fine del suo periodo
   * di riferimento. Gli accantonamenti dei periodi dopo sono per le bollette successive.
   */
  get billFund(): { available: number; now: number; late: boolean } | null {
    const nb = this.data.settings.nextBill;
    const bills = this.data.pockets.find((p) => p.role === 'bills' && !p.archived);
    if (!nb || !bills) return null;
    const ref = billReferencePeriod(nb.month, this.data.settings.salaryDay);
    const now = this.balances.get(bills.id) ?? 0;
    const atRefEnd = balances([bills], this.data.transactions, ref.end).get(bills.id) ?? 0;
    return { available: billAvailable(now, atRefEnd), now, late: this.period.key > ref.key };
  }

  /** Bollette attese nel periodo in corso (per il Piano), anche se il banner è nascosto. */
  get billThisPeriod(): { estimate: number; available: number; late: boolean } | null {
    const nb = this.data.settings.nextBill;
    const fund = this.billFund;
    if (!nb || !fund || this.txByKey(`bill:${nb.month}`) || !billExpectedIn(nb, this.period)) return null;
    return { estimate: nb.amount, available: fund.available, late: fund.late };
  }

  async snoozeBill(): Promise<void> {
    this.billSnoozeUntil = addDays(this.today, 5);
    await setMeta(this.db!, 'billSnoozeUntil', this.billSnoozeUntil);
  }

  /** Ultimo giorno del periodo, bollette non ancora uscite: passano al periodo successivo. */
  async deferBill(): Promise<void> {
    const nb = this.data.settings.nextBill;
    if (!nb) return;
    const before = $state.snapshot(this.data.settings) as Settings;
    const next = shiftPeriod(this.period, 1, this.data.settings.salaryDay);
    await saveSettings(this.db!, { ...before, nextBill: { ...nb, period: next.key } });
    this.billSnoozeUntil = '';
    await setMeta(this.db!, 'billSnoozeUntil', '');
    await this.reload();
    showToast(`Bollette spostate al periodo dal ${Number(next.start.slice(8))} ${monthName(Number(next.start.slice(5, 7)))}`, {
      undo: async () => {
        await saveSettings(this.db!, before);
        await this.reload();
      },
    });
  }

  /**
   * Bolletta pagata dal Fondo bollette, con i soldi messi da parte per lei (vedi billFund):
   * se costa meno il resto va sui risparmi, se costa di più la differenza arriva dai risparmi.
   * Poi la stima passa a due mesi dopo il mese previsto.
   */
  async registerBill(amount: number, date: string): Promise<{ rest: number; shortfall: number }> {
    const due = this.billDue;
    const bills = this.data.pockets.find((p) => p.role === 'bills' && !p.archived);
    if (!due || !bills || amount <= 0) return { rest: 0, shortfall: 0 };
    const reserve = this.savingsTarget;
    // Solo i soldi messi da parte per queste bollette: l'accantonamento dei periodi dopo resta nel fondo.
    const { rest, shortfall } = splitBill(this.billFund?.available ?? 0, amount);
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
    if (await notify('MO KASH', REMINDER_TEXT)) await setMeta(this.db, 'lastReminder', this.today);
  }

  async init(): Promise<void> {
    try {
      this.db = await openAppDb();
      await this.reload();
      await this.migrateDeadlines();
      this.onboarded = await getMeta(this.db, 'onboarded', false);
      this.billSnoozeUntil = await getMeta(this.db, 'billSnoozeUntil', '');
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
    await this.syncManualDeadlines();
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
   * Cosa è già stato spostato nel periodo per una voce del piano: il suo giroconto (spunta) e i
   * giroconti fatti a mano o importati dallo stesso pocket verso quello di destinazione.
   */
  planMoved(line: Pick<PlanLine, 'recurringId' | 'fromPocketId' | 'toPocketId'>) {
    const planTx = this.txByKey(`plan:${line.recurringId}:${this.period.key}`);
    const manual = this.data.transactions
      .filter(
        (t) =>
          t.kind === 'transfer' &&
          !t.autoKey?.startsWith('plan:') &&
          t.date >= this.period.start &&
          t.date <= this.period.end &&
          t.legs.some((l) => l.pocketId === line.fromPocketId && l.amount < 0) &&
          t.legs.some((l) => l.pocketId === line.toPocketId && l.amount > 0),
      )
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
    // Spunta tolta a mano: i giroconti dai Movimenti non contano per questa voce.
    if (this.planIgnored(line)) return { planTx, manual: [], manualAmount: 0, ignored: manual.length > 0, found: manual };
    const manualAmount = manual.reduce((a, t) => a + (t.legs.find((l) => l.pocketId === line.toPocketId && l.amount > 0)?.amount ?? 0), 0);
    return { planTx, manual, manualAmount, ignored: false, found: manual };
  }

  /** Saldi dei pocket subito prima dello stipendio del periodo (o adesso, se non è ancora arrivato). */
  get balancesBeforeSalary() {
    const salaryTx = this.salaryTx;
    return salaryTx ? this.balancesBeforeTx(salaryTx) : this.balances;
  }

  /** La scadenza a cui si riferisce una voce del Piano ("dl-…"). */
  deadlineOfLine(recurringId: Id): Deadline | undefined {
    return this.deadlines.find((d) => this.deadlineLineId(d) === recurringId);
  }

  private planIgnoreKey(line: Pick<PlanLine, 'recurringId'>) {
    return `${line.recurringId}:${this.period.key}`;
  }

  planIgnored(line: Pick<PlanLine, 'recurringId'>): boolean {
    return this.data.settings.planIgnored?.includes(this.planIgnoreKey(line)) ?? false;
  }

  /** Toglie o rimette la spunta a una voce fatta con un giroconto dai Movimenti, senza toccare il giroconto. */
  private async setPlanIgnored(line: Pick<PlanLine, 'recurringId'>, ignored: boolean): Promise<void> {
    const key = this.planIgnoreKey(line);
    const current = (this.data.settings.planIgnored ?? []).filter((k) => k.endsWith(`:${this.period.key}`) && k !== key);
    await this.updateSettings({ planIgnored: ignored ? [...current, key] : current });
  }

  /**
   * Stato di una voce del piano:
   * - auto: spuntata (c'è il suo giroconto);
   * - manual: fatta con un giroconto dai Movimenti o importato;
   * - partial: con dentro delle scadenze, il giroconto a mano non basta: la spunta sposta il resto;
   * - ignored: c'è un giroconto dai Movimenti ma la spunta è stata tolta.
   */
  planStatus(line: Pick<PlanLine, 'recurringId' | 'fromPocketId' | 'toPocketId' | 'amount' | 'covers'>): 'auto' | 'manual' | 'partial' | 'ignored' | null {
    // Scadenze da sole: il pocket di accantonamento riceve anche altro (es. i risparmi), un giroconto qualsiasi non basta.
    const { planTx, manual, manualAmount, ignored } = this.planMoved(line);
    if (planTx) return 'auto';
    if (ignored) return 'ignored';
    if (line.recurringId.startsWith('dl-') || !manual.length) return null;
    return line.covers?.length && manualAmount < line.amount ? 'partial' : 'manual';
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
      // Il pagamento di una scadenza era già accantonato: non va reintegrato dalle riserve.
      if (t.kind === 'adjustment' || t.autoKey?.startsWith('deadline:') || t.date < prev.start || t.date > prev.end) continue;
      for (const l of t.legs) if (l.amount < 0) takenPrev.set(l.pocketId, (takenPrev.get(l.pocketId) ?? 0) - l.amount);
    }
    return buildPlan({
      salary, recurring: this.data.recurring, pockets: this.data.pockets, mainPocketId: main?.id ?? '',
      safetyMargin: this.data.settings.safetyMargin, leftover, balancesBefore: before, takenPrev, deadlines: this.deadlineLines(),
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
      txs.push(buildEntry({ kind: 'transfer', date, amount: l.amount, fromPocketId: l.fromPocketId, splits: [{ pocketId: l.toPocketId, amount: l.amount }], description: l.name, categoryId: 'sys-transfer', source: 'plan', autoKey: `plan:${l.recurringId}:${key}`, deadlines: coveredDeadlines(l) }, ctx));
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
  async togglePlanTransfer(line: PlanLine, date: string): Promise<void> {
    const key = `plan:${line.recurringId}:${this.period.key}`;
    const status = this.planStatus(line);
    // Fatto con un giroconto dai Movimenti: togliere o rimettere la spunta non crea né cancella giroconti.
    if (status === 'manual') return this.setPlanIgnored(line, true);
    if (status === 'ignored') return this.setPlanIgnored(line, false);
    const existing = this.txByKey(key);
    if (existing) return this.deleteTx(existing.id, `${line.name}: spostamento annullato`);
    // Già spostata una parte a mano: si sposta solo il resto (le quote delle scadenze vanno tutte su questo giroconto).
    const amount = line.amount - (status === 'partial' ? this.planMoved(line).manualAmount : 0);
    if (!line.toPocketId || amount <= 0) return;
    await this.saveEntry({ kind: 'transfer', date, amount, fromPocketId: line.fromPocketId, splits: [{ pocketId: line.toPocketId, amount }], description: line.name, categoryId: 'sys-transfer', source: 'plan', autoKey: key, deadlines: coveredDeadlines(line) });
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
    // Copia semplice anche della modifica: può contenere dati reattivi (es. le scadenze già salvate),
    // che IndexedDB non sa copiare.
    await saveSettings(this.db!, $state.snapshot({ ...this.data.settings, ...patch }) as Settings);
    await this.reload();
  }

  async replaceData(data: AppData): Promise<void> {
    // IndexedDB non può copiare i proxy reattivi di Svelte: si salva una copia semplice.
    await replaceAll(this.db!, $state.snapshot(data) as AppData);
    await this.reload();
    await this.migrateDeadlines();
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
