/**
 * Configurazione iniziale (config-iniziale.json, mai nel repository):
 * gruppi, pocket, categorie, voci → categoria, spese fisse, impostazioni.
 * Chiavi in italiano perché il file si può modificare a mano. Importi in euro.
 */
import type { Category, Group, PaletteColor, Pocket, PocketRole, Recurring, RecurringKind, Settings } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';

export const CONFIG_FORMAT = 'conti-config';

export class ConfigError extends Error {}

export interface AppConfig {
  groups: Group[];
  /** Pocket senza saldo: lo decide l'import o l'allineamento. */
  pockets: Omit<Pocket, 'openingBalance' | 'openingDate'>[];
  categories: Category[];
  /** Voce del file Excel (maiuscolo, senza spazi ai lati) → id categoria. */
  voci: Record<string, string>;
  recurring: Recurring[];
  settings: Settings;
}

const COLORS: PaletteColor[] = ['indaco', 'arancio', 'acqua', 'ocra', 'cielo', 'verde', 'viola', 'magenta', 'ardesia'];
const ROLES: PocketRole[] = ['main', 'savings', 'bills', 'reserve', 'investment'];
const KINDS: Record<string, RecurringKind> = { addebito: 'debit', spostamento: 'allocation', budget: 'budget' };

/** Categorie di sistema, sempre presenti. */
export const SYSTEM_CATEGORIES: Category[] = [
  { id: 'sys-transfer', name: 'Giroconto', icon: 'arrow-right-left', color: 'ardesia', system: 'transfer', excludedFromStats: true, archived: false, order: 900 },
  { id: 'sys-adjustment', name: 'Rettifica', icon: 'scale', color: 'ardesia', system: 'adjustment', excludedFromStats: true, archived: false, order: 901 },
  { id: 'sys-roundup', name: 'Arrotondamento', icon: 'coins', color: 'ocra', system: 'roundup', excludedFromStats: true, archived: false, order: 902 },
];

/** Categorie generiche per chi parte da zero. */
export const DEFAULT_CATEGORIES: Category[] = [
  ['spesa', 'Spesa', 'shopping-cart', 'verde'],
  ['bar', 'Bar e ristoranti', 'utensils', 'arancio'],
  ['carburante', 'Carburante', 'fuel', 'indaco'],
  ['casa', 'Casa', 'sofa', 'acqua'],
  ['bollette', 'Bollette', 'zap', 'ocra'],
  ['abbonamenti', 'Abbonamenti', 'repeat', 'cielo'],
  ['regali', 'Regali', 'gift', 'magenta'],
  ['svago', 'Svago', 'sparkles', 'viola'],
  ['salute', 'Salute', 'heart-pulse', 'magenta'],
  ['trasporti', 'Trasporti', 'car', 'ardesia'],
  ['stipendio', 'Stipendio', 'landmark', 'verde'],
  ['altro', 'Altro', 'circle-dashed', 'ardesia'],
].map(([id, name, icon, color], order) => ({ id: id!, name: name!, icon: icon!, color: color as PaletteColor, archived: false, order }));

const euro = (x: unknown, where: string): number => {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new ConfigError(`Importo non valido in ${where}.`);
  return Math.round(x * 100);
};
const str = (x: unknown, where: string): string => {
  if (typeof x !== 'string' || !x.trim()) throw new ConfigError(`Testo mancante in ${where}.`);
  return x.trim();
};
const arr = (x: unknown, where: string): Record<string, unknown>[] => {
  if (x === undefined) return [];
  if (!Array.isArray(x)) throw new ConfigError(`"${where}" deve essere un elenco.`);
  return x as Record<string, unknown>[];
};

export function parseConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null || (raw as { formato?: unknown }).formato !== CONFIG_FORMAT) {
    throw new ConfigError('Il file non è una configurazione di questa app.');
  }
  const c = raw as Record<string, unknown>;

  const groups = arr(c.gruppi, 'gruppi').map((g, i) => ({ id: str(g.id, 'gruppi'), name: str(g.nome, 'gruppi'), order: i }));
  const groupIds = new Set(groups.map((g) => g.id));

  const pockets = arr(c.pocket, 'pocket').map((p, i) => {
    const where = `pocket "${String(p.nome ?? i + 1)}"`;
    const groupId = str(p.gruppo, where);
    if (!groupIds.has(groupId)) throw new ConfigError(`${where}: il gruppo "${groupId}" non esiste.`);
    const color = (p.colore ?? COLORS[i % COLORS.length]) as PaletteColor;
    if (!COLORS.includes(color)) throw new ConfigError(`${where}: colore "${color}" sconosciuto.`);
    const role = p.ruolo as PocketRole | undefined;
    if (role !== undefined && !ROLES.includes(role)) throw new ConfigError(`${where}: ruolo "${role}" sconosciuto.`);
    return {
      id: str(p.id, where),
      name: str(p.nome, where),
      code: typeof p.codice === 'string' ? p.codice.trim() : undefined,
      groupId,
      color,
      icon: typeof p.icona === 'string' ? p.icona : 'wallet',
      isRevolut: p.revolut === true,
      role,
      archived: false,
      order: i,
    };
  });
  const pocketIds = new Set(pockets.map((p) => p.id));
  if (pockets.filter((p) => p.role === 'main').length !== 1) throw new ConfigError('Serve esattamente un pocket con ruolo "main" (dove arriva lo stipendio).');
  if (pockets.filter((p) => p.role === 'savings').length > 1) throw new ConfigError('Può esserci un solo pocket Savings.');

  const custom = arr(c.categorie, 'categorie').map((k, i) => ({
    id: str(k.id, 'categorie'),
    name: str(k.nome, 'categorie'),
    icon: typeof k.icona === 'string' ? k.icona : 'circle-dashed',
    color: ((k.colore as PaletteColor) ?? 'ardesia'),
    archived: false,
    order: i,
  }));
  const categories = [...(custom.length ? custom : DEFAULT_CATEGORIES), ...SYSTEM_CATEGORIES];
  const catIds = new Set(categories.map((k) => k.id));

  const voci: Record<string, string> = {};
  for (const [k, v] of Object.entries((c.voci as Record<string, unknown>) ?? {})) {
    if (typeof v !== 'string' || !catIds.has(v)) throw new ConfigError(`Voce "${k}": categoria "${String(v)}" inesistente.`);
    voci[normalizeVoce(k)] = v;
  }

  const recurring: Recurring[] = arr(c.fissi, 'fissi').map((f, i) => {
    const where = `spesa fissa "${String(f.nome ?? i + 1)}"`;
    const kind = KINDS[String(f.tipo)];
    if (!kind) throw new ConfigError(`${where}: tipo deve essere addebito, spostamento o budget.`);
    const from = str(f.da, where);
    if (!pocketIds.has(from)) throw new ConfigError(`${where}: pocket "${from}" inesistente.`);
    const to = f.a === undefined ? undefined : str(f.a, where);
    if (to !== undefined && !pocketIds.has(to)) throw new ConfigError(`${where}: pocket "${to}" inesistente.`);
    if (kind === 'allocation' && !to) throw new ConfigError(`${where}: uno spostamento ha bisogno di "a".`);
    const fromDebits = f.importo === 'abbonamenti';
    const day = f.giorno === undefined ? undefined : Number(f.giorno);
    if (day !== undefined && !(Number.isInteger(day) && day >= 1 && day <= 31)) throw new ConfigError(`${where}: giorno non valido.`);
    const categoryId = f.categoria === undefined ? undefined : str(f.categoria, where);
    if (categoryId && !catIds.has(categoryId)) throw new ConfigError(`${where}: categoria "${categoryId}" inesistente.`);
    return {
      id: str(f.id, where),
      name: str(f.nome, where),
      kind,
      amount: fromDebits ? 0 : euro(f.importo, where),
      amountFromDebits: fromDebits || undefined,
      fromPocketId: from,
      toPocketId: to,
      day,
      categoryId,
      auto: f.automatico === true || undefined,
      active: f.attivo !== false,
      order: i,
    };
  });

  const s = (c.impostazioni as Record<string, unknown>) ?? {};
  const bill = s.prossimaBolletta as Record<string, unknown> | undefined;
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    salaryDay: s.giornoStipendio === undefined ? DEFAULT_SETTINGS.salaryDay : Number(s.giornoStipendio),
    safetyMargin: s.margineSicurezza === undefined ? 0 : euro(s.margineSicurezza, 'margineSicurezza'),
    salaryCategoryId: typeof s.categoriaStipendio === 'string' ? s.categoriaStipendio : undefined,
    nextBill: bill ? { month: str(bill.mese, 'prossimaBolletta'), amount: euro(bill.importo, 'prossimaBolletta') } : undefined,
  };

  return { groups, pockets, categories, voci, recurring, settings };
}

export function normalizeVoce(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
}
