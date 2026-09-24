/**
 * Esportazione CSV dei movimenti, pensata per Excel/Numbers in italiano:
 * separatore ";", decimali con la virgola, BOM UTF-8. Una riga per ogni pocket coinvolto.
 */
import { formatDate } from '../domain/dates';
import type { AppData } from '../domain/types';

const KIND: Record<string, string> = {
  expense: 'Uscita',
  income: 'Entrata',
  transfer: 'Giroconto',
  adjustment: 'Rettifica',
  roundup: 'Arrotondamento',
};

function cell(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function amount(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function transactionsToCsv(data: AppData): string {
  const pocket = new Map(data.pockets.map((p) => [p.id, p.name]));
  const category = new Map(data.categories.map((c) => [c.id, c.name]));
  const rows = [['Data', 'Tipo', 'Descrizione', 'Categoria', 'Pocket', 'Importo', 'Nota']];
  const sorted = [...data.transactions].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  for (const t of sorted) {
    for (const l of t.legs) {
      rows.push([
        formatDate(t.date),
        KIND[t.kind] ?? t.kind,
        t.description,
        t.categoryId ? (category.get(t.categoryId) ?? '') : '',
        pocket.get(l.pocketId) ?? '',
        amount(l.amount),
        t.note ?? '',
      ]);
    }
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
