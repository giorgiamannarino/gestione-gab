/**
 * Aggiornamenti dell'app installata: il service worker nuovo resta in attesa
 * finché l'utente non tocca "Aggiorna". I dati in IndexedDB non vengono toccati.
 */
import { registerSW } from 'virtual:pwa-register';

class Updater {
  needRefresh = $state(false);
  private updateSW: ((reload?: boolean) => Promise<void>) | null = null;

  start(): void {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    this.updateSW = registerSW({
      onNeedRefresh: () => (this.needRefresh = true),
      onRegisteredSW: (_url, reg) => {
        // Controlla aggiornamenti quando l'app torna in primo piano e ogni ora.
        if (!reg) return;
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update());
        setInterval(() => reg.update(), 60 * 60 * 1000);
      },
    });
  }

  async update(): Promise<void> {
    await this.updateSW?.(true);
  }
}

export const updater = new Updater();
