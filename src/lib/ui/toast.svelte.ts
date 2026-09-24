/**
 * Toast: conferme brevi con azione "Annulla" al posto dei popup di conferma.
 * Un solo toast alla volta: il nuovo sostituisce il precedente.
 */
export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
  /** Se presente, mostra "Annulla". */
  undo?: () => void | Promise<void>;
}

const DURATION_MS = 5000;

export const toasts = $state<{ current: Toast | null }>({ current: null });

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, opts: { tone?: Toast['tone']; undo?: Toast['undo'] } = {}): number {
  clearTimeout(timer);
  const toast: Toast = { id: nextId++, message, tone: opts.tone ?? 'default', undo: opts.undo };
  toasts.current = toast;
  timer = setTimeout(() => dismissToast(toast.id), opts.undo ? DURATION_MS + 1000 : DURATION_MS);
  return toast.id;
}

export function dismissToast(id?: number): void {
  if (id === undefined || toasts.current?.id === id) {
    clearTimeout(timer);
    toasts.current = null;
  }
}

export async function undoToast(): Promise<void> {
  const t = toasts.current;
  if (!t?.undo) return;
  dismissToast(t.id);
  await t.undo();
}
