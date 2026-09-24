/**
 * Blocco dell'app: PIN all'apertura e dopo un periodo in background.
 * Quando l'app va in background i contenuti vengono nascosti subito.
 */
import { app } from '../app/store.svelte';
import { checkPin, createPinRecord, type PinRecord } from './pin';
import { registerBiometric, verifyBiometric } from './biometric';

export interface LockConfig {
  pin: PinRecord;
  timeoutMs: number;
  biometricId?: string;
}

class LockStore {
  config = $state<LockConfig | null>(null);
  locked = $state(false);
  /** Contenuti coperti (app in background o bloccata). */
  hidden = $state(false);
  private hiddenAt = 0;

  get enabled() {
    return !!this.config;
  }

  async init(): Promise<void> {
    this.config = await app.getMeta<LockConfig | null>('lock', null);
    this.locked = this.enabled;
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => (this.hidden = true));
    // Al ritorno la copertura va sempre tolta, anche se il browser non segnala `visibilitychange`.
    window.addEventListener('pageshow', () => this.onVisibility());
    window.addEventListener('focus', () => document.visibilityState === 'visible' && (this.hidden = false));
  }

  private onVisibility() {
    if (document.visibilityState === 'hidden') {
      this.hidden = true;
      this.hiddenAt = Date.now();
    } else {
      if (this.enabled && Date.now() - this.hiddenAt >= (this.config?.timeoutMs ?? 60_000)) this.locked = true;
      this.hidden = false;
    }
  }

  async enable(pin: string, timeoutMs = 60_000): Promise<void> {
    const config: LockConfig = { pin: await createPinRecord(pin), timeoutMs };
    await app.setMeta('lock', config);
    this.config = config;
  }

  async disable(): Promise<void> {
    await app.setMeta('lock', null);
    this.config = null;
    this.locked = false;
  }

  async setTimeout(ms: number): Promise<void> {
    if (!this.config) return;
    this.config = { ...this.config, timeoutMs: ms };
    await app.setMeta('lock', this.config);
  }

  async enableBiometric(): Promise<void> {
    if (!this.config) return;
    const id = await registerBiometric();
    this.config = { ...this.config, biometricId: id };
    await app.setMeta('lock', this.config);
  }

  async disableBiometric(): Promise<void> {
    if (!this.config) return;
    this.config = { ...this.config, biometricId: undefined };
    await app.setMeta('lock', this.config);
  }

  /** Esito del tentativo: null se sbloccato, altrimenti millisecondi di attesa (0 = riprova subito). */
  async tryPin(pin: string): Promise<{ ok: boolean; waitMs: number }> {
    if (!this.config) return { ok: true, waitMs: 0 };
    const res = await checkPin(pin, this.config.pin, Date.now());
    this.config = { ...this.config, pin: res.record };
    await app.setMeta('lock', this.config);
    if (res.ok) this.locked = false;
    return { ok: res.ok, waitMs: res.ok ? 0 : res.waitMs };
  }

  async tryBiometric(): Promise<boolean> {
    if (!this.config?.biometricId) return false;
    const ok = await verifyBiometric(this.config.biometricId);
    if (ok) this.locked = false;
    return ok;
  }
}

export const lock = new LockStore();
