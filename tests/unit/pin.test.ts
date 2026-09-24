import { describe, expect, it } from 'vitest';
import { checkPin, createPinRecord, isValidPin, lockoutDelay } from '../../src/lib/security/pin';

const IT = 1000; // iterazioni ridotte per velocità nei test

describe('PIN', () => {
  it('non salva il PIN in chiaro e usa un salt diverso ogni volta', async () => {
    const a = await createPinRecord('123456', IT);
    const b = await createPinRecord('123456', IT);
    expect(JSON.stringify(a)).not.toContain('123456');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('accetta solo 6 cifre', async () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
    await expect(createPinRecord('1234')).rejects.toThrow();
  });

  it('verifica il PIN giusto e azzera gli errori', async () => {
    const r = await createPinRecord('246810', IT);
    const res = await checkPin('246810', { ...r, failures: 3 }, 0);
    expect(res.ok).toBe(true);
    expect(res.record.failures).toBe(0);
  });

  it('attese crescenti dopo 5 errori', async () => {
    expect([4, 5, 6, 7, 20].map(lockoutDelay)).toEqual([0, 30_000, 60_000, 120_000, 900_000]);
    let rec = await createPinRecord('246810', IT);
    for (let i = 0; i < 4; i++) rec = (await checkPin('000000', rec, 0)).record;
    const fifth = await checkPin('000000', rec, 1000);
    expect(fifth.ok).toBe(false);
    expect(fifth.ok === false && fifth.waitMs).toBe(30_000);

    // Durante l'attesa anche il PIN giusto viene rifiutato.
    const blocked = await checkPin('246810', fifth.record, 2000);
    expect(blocked.ok === false && blocked.reason).toBe('locked');
    // Dopo l'attesa funziona.
    expect((await checkPin('246810', fifth.record, 31_001)).ok).toBe(true);
  });
});
