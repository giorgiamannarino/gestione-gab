/**
 * Salvataggio di un file dal telefono: menu di condivisione (iCloud Drive, Google Drive…)
 * con il download diretto come alternativa.
 */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareOrDownload(name: string, text: string, type = 'application/json'): Promise<ShareOutcome> {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Condivisione non riuscita: si ripiega sul download.
    }
  }
  downloadText(name, text, type);
  return 'downloaded';
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
