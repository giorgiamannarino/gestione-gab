import type { Id, TxKind } from '../domain/types';

/** Apertura del pannello di inserimento rapido, da qualunque schermata. */
export const quickAdd = $state<{ open: boolean; editId: Id | null; kind: TxKind | null; nonce: number }>({
  open: false,
  editId: null,
  kind: null,
  nonce: 0,
});

export function openQuickAdd(opts: { editId?: Id; kind?: 'expense' | 'income' | 'transfer' } = {}): void {
  quickAdd.editId = opts.editId ?? null;
  quickAdd.kind = opts.kind ?? null;
  quickAdd.nonce++;
  quickAdd.open = true;
}
