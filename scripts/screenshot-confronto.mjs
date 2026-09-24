// Screenshot della pagina di confronto delle direzioni visive (solo dati inventati).
// Uso: con `npm run dev -- --port 5199` attivo, `node scripts/screenshot-confronto.mjs`.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.URL ?? 'http://localhost:5199/confronto.html';
const out = 'screenshots/confronto';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto(url);
await desktop.evaluate(() => document.fonts.ready);
await desktop.screenshot({ path: `${out}/pagina-desktop.png`, fullPage: true });

const phones = desktop.locator('.phone');
const count = await phones.count();
for (let i = 0; i < count; i++) {
  const cls = await phones.nth(i).getAttribute('class');
  const [, dir, theme] = cls.match(/dir-(\w) (\w+)/);
  const el = phones.nth(i);
  await el.screenshot({ path: `${out}/${dir}-${theme}-top.png` });
  // Seconda metà: scorre il contenuto interno del telefono.
  await el.locator('.scroll').evaluate((s) => (s.scrollTop = s.scrollHeight));
  await el.screenshot({ path: `${out}/${dir}-${theme}-bottom.png` });
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto(url);
await mobile.evaluate(() => document.fonts.ready);
await mobile.screenshot({ path: `${out}/pagina-mobile.png` });
const hasHScroll = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
console.log('scroll orizzontale su mobile:', hasHScroll);

await browser.close();
console.log(`${count} telefoni fotografati in ${out}`);
