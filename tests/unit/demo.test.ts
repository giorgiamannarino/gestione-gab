import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../src/lib/backup/format';
import { balances } from '../../src/lib/domain/balances';
import { periodOf } from '../../src/lib/domain/dates';
import { dueDebits } from '../../src/lib/domain/stats';
import { demoData } from '../../src/lib/demo/demo-data';

describe("dati di esempio dell'anteprima", () => {
  for (const today of ['2030-10-23', '2030-11-05', '2031-02-21']) {
    it(`sono validi e coerenti (oggi ${today})`, () => {
      const d = demoData(today);
      expect(() => parseBackup({ format: 'conti-backup', version: 1, createdAt: '', data: d })).not.toThrow();
      expect(d.transactions.every((t) => t.date <= today)).toBe(true);
      for (const [id, v] of balances(d.pockets, d.transactions)) expect(v, id).toBeGreaterThanOrEqual(0);
      const p = periodOf(today, 23);
      expect(d.transactions.some((t) => t.autoKey === `salary:${p.key}`)).toBe(false); // stipendio da inserire
      expect(dueDebits(d.recurring, d.transactions, p, today).length).toBeGreaterThan(0); // addebiti da confermare
    });
  }
});
