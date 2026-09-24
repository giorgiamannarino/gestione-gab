import { describe, expect, it } from 'vitest';
import { roundupFor } from '../../src/lib/domain/roundup';

describe('arrotondamento Revolut', () => {
  it("con centesimi arrotonda all'euro successivo", () => {
    expect(roundupFor(1230)).toBe(70);
    expect(roundupFor(999)).toBe(1);
    expect(roundupFor(1)).toBe(99);
  });

  it('un importo tondo vale 1,00 €', () => {
    expect(roundupFor(1800)).toBe(100);
    expect(roundupFor(100)).toBe(100);
  });

  it('ignora il segno', () => {
    expect(roundupFor(-1230)).toBe(70);
  });

  it('zero non genera arrotondamento', () => {
    expect(roundupFor(0)).toBe(0);
  });

  it('abbonamenti: 9,95 + 20,99 + 5,99 → 0,07 di arrotondamenti', () => {
    expect([995, 2099, 599].map(roundupFor).reduce((a, b) => a + b)).toBe(7);
  });
});
