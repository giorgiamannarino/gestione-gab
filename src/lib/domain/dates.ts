/**
 * Date di calendario e periodi contabili (dal giorno dello stipendio al giorno prima).
 * Il periodo è solo una vista: non chiude e non azzera nulla.
 */
import type { ISODate } from './types';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function make(y: number, m: number, d: number): ISODate {
  // Normalizza mese fuori intervallo (m può essere 0 o 13).
  const date = new Date(y, m - 1, 1);
  const yy = date.getFullYear();
  const mm = date.getMonth() + 1;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(d, daysInMonth(yy, mm))).padStart(2, '0')}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISODate(s);
  return toISODate(new Date(y, m - 1, d + n));
}

export interface Period {
  /** Chiave stabile: anno-mese di inizio, es. "2026-09". */
  key: string;
  start: ISODate;
  /** Ultimo giorno incluso. */
  end: ISODate;
}

/** Periodo che contiene la data, con inizio il giorno `startDay` di ogni mese. */
export function periodOf(date: ISODate, startDay: number): Period {
  const { y, m, d } = parseISODate(date);
  const startThisMonth = Math.min(startDay, daysInMonth(y, m));
  const [sy, sm] = d >= startThisMonth ? [y, m] : [y, m - 1];
  const start = make(sy, sm, startDay);
  const end = addDays(make(sy, sm + 1, startDay), -1);
  return { key: start.slice(0, 7), start, end };
}

export function shiftPeriod(p: Period, n: number, startDay: number): Period {
  const { y, m } = parseISODate(p.start);
  return periodOf(make(y, m + n, startDay), startDay);
}

export function inPeriod(date: ISODate, p: Period): boolean {
  return date >= p.start && date <= p.end;
}

/** "23 set – 22 ott" */
export function periodLabel(p: Period): string {
  const a = parseISODate(p.start);
  const b = parseISODate(p.end);
  return `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]}`;
}

/** Nome breve del periodo: il mese in cui finisce ("ott"). */
export function periodShortName(p: Period): string {
  return MONTHS_SHORT[parseISODate(p.end).m - 1]!;
}

/** "23/10/2026" */
export function formatDate(s: ISODate): string {
  const { y, m, d } = parseISODate(s);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** "mercoledì 24 settembre" */
export function formatLongDate(s: ISODate): string {
  const { y, m, d } = parseISODate(s);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}

export function monthName(month: number): string {
  return MONTHS[month - 1]!;
}
