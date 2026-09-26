import { confirmBackupSaved, makeBackup } from '../backup/service';
import { shareOrDownload, downloadText } from '../backup/share';
import { transactionsToCsv } from '../backup/csv';
import { toISODate } from '../domain/dates';
import { showToast } from '../ui/toast.svelte';
import { app } from './store.svelte';

export const APP_VERSION = __APP_VERSION__;

/** Crea il backup e lo passa al menu di condivisione (o al download). */
export async function saveBackup(password?: string): Promise<boolean> {
  const blob = await makeBackup(app.db!, APP_VERSION, { password });
  const outcome = await shareOrDownload(blob.name, blob.json);
  if (outcome === 'cancelled') {
    showToast('Backup non salvato');
    return false;
  }
  await confirmBackupSaved(app.db!);
  await app.reload();
  showToast(outcome === 'shared' ? 'Backup pronto: controlla di averlo salvato' : 'Backup scaricato', { tone: 'success' });
  return true;
}

export function exportCsv(): void {
  downloadText(`mokash-movimenti-${toISODate(new Date())}.csv`, transactionsToCsv(app.data), 'text/csv');
  showToast('CSV esportato', { tone: 'success' });
}
