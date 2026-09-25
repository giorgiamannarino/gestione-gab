import type { Cents } from './money';

export type Id = string;
/** Data di calendario "YYYY-MM-DD" (niente orari né fusi). */
export type ISODate = string;

export type PaletteColor =
  | 'indaco' | 'arancio' | 'acqua' | 'ocra' | 'cielo' | 'verde' | 'viola' | 'magenta' | 'ardesia';

export interface Group {
  id: Id;
  name: string;
  order: number;
}

export type PocketRole = 'main' | 'savings' | 'bills' | 'reserve' | 'investment';

export interface Pocket {
  id: Id;
  name: string;
  /** Nome della colonna nel file Excel (es. "ISP"), usato dall'importer. */
  code?: string;
  groupId: Id;
  color: PaletteColor;
  icon: string;
  isRevolut: boolean;
  role?: PocketRole;
  /** Saldo all'inizio di openingDate, prima dei movimenti di quel giorno. */
  openingBalance: Cents;
  openingDate: ISODate;
  archived: boolean;
  order: number;
}

export type TxKind = 'expense' | 'income' | 'transfer' | 'adjustment' | 'roundup';
export type TxSource = 'manual' | 'import' | 'recurring' | 'plan';

export interface Leg {
  pocketId: Id;
  amount: Cents;
}

export interface Transaction {
  id: Id;
  date: ISODate;
  kind: TxKind;
  legs: Leg[];
  description: string;
  categoryId?: Id;
  note?: string;
  /** Etichetta di evento o viaggio (es. "Weekend Roma"). */
  tag?: string;
  /** Solo uscite da pocket Revolut: se false l'arrotondamento è disattivato. */
  roundup?: boolean;
  /** Per gli arrotondamenti: l'uscita che li ha generati. */
  parentId?: Id;
  source: TxSource;
  /** Chiave di deduplica per voci automatiche (es. "rec:das:2026-09"). */
  autoKey?: string;
  createdAt: number;
  updatedAt: number;
}

export type CategorySystem = 'adjustment' | 'transfer' | 'roundup' | 'salary';

export interface Category {
  id: Id;
  name: string;
  icon: string;
  color: PaletteColor;
  system?: CategorySystem;
  /** Esclusa dalle statistiche di spesa (rettifiche, giroconti). */
  excludedFromStats?: boolean;
  archived: boolean;
  order: number;
}

/**
 * Voce fissa mensile.
 * - debit: addebito in un giorno (DAS, abbonamenti), proposto da confermare.
 *   Con `toPocketId` è un giroconto programmato (es. Generali → Fondo Pensione dall'8 del mese).
 * - allocation: spostamento a inizio periodo (Revolut, bollette, FP/PAC).
 * - budget: somma che resta su un pocket (benzina), spese inserite a mano.
 */
export type RecurringKind = 'debit' | 'allocation' | 'budget';

export interface Recurring {
  id: Id;
  name: string;
  kind: RecurringKind;
  /** Per le allocazioni "abbonamenti" l'importo si calcola dagli addebiti del pocket di destinazione. */
  amount: Cents;
  amountFromDebits?: boolean;
  fromPocketId: Id;
  toPocketId?: Id;
  /** Giorno del mese per gli addebiti. */
  day?: number;
  categoryId?: Id;
  /** Allocazioni registrate da sole all'arrivo dello stipendio. */
  auto?: boolean;
  /**
   * Come si calcola lo spostamento a inizio periodo (default: importo pieno).
   * - topUp: solo quanto manca per arrivare all'importo (es. Abbonamenti, Casa, Svago).
   * - reserve: nulla preso nel periodo prima → metà; preso meno dell'importo → preso + extra;
   *   preso almeno l'importo → quanto preso (es. Auto).
   */
  mode?: 'topUp' | 'reserve';
  /** Riserve: extra da aggiungere quando è stato preso meno dell'importo (default 100 €). */
  reserveExtra?: Cents;
  active: boolean;
  order: number;
}

export interface Valuation {
  id: Id;
  pocketId: Id;
  date: ISODate;
  value: Cents;
}

export interface Settings {
  salaryDay: number;
  salaryCategoryId?: Id;
  /** Margine che resta sempre su Intesa. */
  safetyMargin: Cents;
  /**
   * Prossima bolletta stimata. `month` è il mese di calendario atteso; se a fine periodo
   * non è ancora uscita, `period` indica il periodo di stipendio a cui è stata rimandata.
   */
  nextBill?: { month: string; amount: Cents; period?: string };
  weeklyBackupReminder: boolean;
  /** Promemoria serale per inserire i movimenti del giorno. */
  eveningReminder?: boolean;
  /** Pocket per "Oggi puoi spendere" (default: quello chiamato "Personale"). "none" = spento. */
  dailyPocketId?: Id | 'none';
  /** Scadenze annuali o una tantum (bollo, assicurazione, università…). */
  deadlines?: Deadline[];
}

export interface Deadline {
  id: Id;
  name: string;
  amount: Cents;
  /** Prossima scadenza. */
  dueDate: ISODate;
  /** Pocket dove si accantona e da cui si paga. */
  pocketId: Id;
  /** Si ripete ogni anno. */
  annual: boolean;
  /** Dai 7 giorni prima compare in "Da confermare". */
  remind: boolean;
  /** Solo dati vecchi: spostamento mensile nei costi fissi, tolto all'avvio (ora c'è la voce Scadenze). */
  recurringId?: Id;
}

export const DEFAULT_SETTINGS: Settings = {
  salaryDay: 23,
  safetyMargin: 0,
  weeklyBackupReminder: false,
};

/** Tutti i dati dell'app: esattamente ciò che finisce in un backup. */
export interface AppData {
  groups: Group[];
  pockets: Pocket[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  valuations: Valuation[];
  settings: Settings;
}
