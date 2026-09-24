/**
 * PIN di blocco (6 cifre). Mai salvato in chiaro: solo PBKDF2-SHA256 con salt.
 * Dopo alcuni tentativi sbagliati, attese crescenti. Non esiste un recupero:
 * se il PIN viene dimenticato si cancellano i dati e si ripristina un backup.
 */
export const PIN_LENGTH = 6;
export const PIN_ITERATIONS = 310_000;
const FREE_ATTEMPTS = 5;
const MAX_DELAY_MS = 15 * 60_000;

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
  failures: number;
  /** Timestamp fino al quale non si può riprovare. */
  lockedUntil: number;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function createPinRecord(pin: string, iterations = PIN_ITERATIONS): Promise<PinRecord> {
  if (!isValidPin(pin)) throw new Error(`Il PIN deve avere ${PIN_LENGTH} cifre.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(pin, salt, iterations)), iterations, failures: 0, lockedUntil: 0 };
}

/** Attesa dopo `failures` errori consecutivi: nessuna per i primi 5, poi 30 s, 1, 2, 4, 8 min… fino a 15 min. */
export function lockoutDelay(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_DELAY_MS, 30_000 * 2 ** (failures - FREE_ATTEMPTS));
}

export type PinCheck =
  | { ok: true; record: PinRecord }
  | { ok: false; record: PinRecord; waitMs: number; reason: 'wrong' | 'locked' };

/** Verifica il PIN. Restituisce sempre il record aggiornato da salvare. */
export async function checkPin(pin: string, record: PinRecord, now: number): Promise<PinCheck> {
  if (now < record.lockedUntil) return { ok: false, record, waitMs: record.lockedUntil - now, reason: 'locked' };
  const got = await derive(pin, unb64(record.salt), record.iterations);
  const want = unb64(record.hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < want.length; i++) diff |= (got[i] ?? 0) ^ want[i]!;
  if (diff === 0) return { ok: true, record: { ...record, failures: 0, lockedUntil: 0 } };
  const failures = record.failures + 1;
  const waitMs = lockoutDelay(failures);
  return { ok: false, record: { ...record, failures, lockedUntil: now + waitMs }, waitMs, reason: 'wrong' };
}
