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
   * Allocazioni verso pocket Revolut: si sposta solo quanto manca per arrivare all'importo
   * (default sì). Con `false` si sposta sempre l'importo pieno (es. per accumulare).
   */
  topUp?: boolean;
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
  nextBill?: { month: string; amount: Cents };
  weeklyBackupReminder: boolean;
  /** Promemoria serale per inserire i movimenti del giorno. */
  eveningReminder?: boolean;
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
