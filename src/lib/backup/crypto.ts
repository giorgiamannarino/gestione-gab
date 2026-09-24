/**
 * Backup cifrato con password (separata dal PIN): PBKDF2-SHA256 → AES-GCM 256.
 * Senza la password il backup non si può aprire in alcun modo.
 */
import { BACKUP_FORMAT } from './format';

export const KDF_ITERATIONS = 600_000;

export interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  encrypted: true;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  payload: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncrypted(raw: unknown): raw is EncryptedBackup {
  return typeof raw === 'object' && raw !== null && (raw as { encrypted?: unknown }).encrypted === true;
}

export async function encryptJson(json: string, password: string, iterations = KDF_ITERATIONS): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json)));
  return {
    format: BACKUP_FORMAT,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    payload: toB64(ct),
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Password errata, oppure il file è danneggiato.');
  }
}

export async function decryptJson(env: EncryptedBackup, password: string): Promise<string> {
  const key = await deriveKey(password, fromB64(env.kdf.salt), env.kdf.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.cipher.iv) }, key, fromB64(env.payload));
    return dec.decode(pt);
  } catch {
    throw new WrongPasswordError();
  }
}
