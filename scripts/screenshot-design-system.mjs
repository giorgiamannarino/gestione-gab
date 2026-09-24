// Screenshot del design system a dimensione telefono, in chiaro e scuro (solo dati inventati).
// Uso: con il dev server su 5199, `node scripts/screenshot-design-system.mjs`.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.URL ?? 'http://localhost:5199/design-system.html';
const out = 'screenshots/design-system';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);

  // Pagina intera a sezioni.
  const sections = await page.locator('section.block').all();
  await page.locator('header.top').screenshot({ path: `${out}/${scheme}-00-intestazione.png` });
  for (const [i, s] of sections.entries()) {
    await s.screenshot({ path: `${out}/${scheme}-${String(i + 1).padStart(2, '0')}-${await s.getAttribute('aria-labelledby')}.png` });
  }

  // Inserimento rapido aperto.
  await page.getByRole('button', { name: "Prova l'inserimento rapido" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${scheme}-20-inserimento.png` });

  // Salva → toast.
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${scheme}-21-toast.png` });

  // Grafico a linee con mirino.
  const line = page.locator('section[aria-labelledby="s-grafici"] svg[role="img"]').last();
  await line.scrollIntoViewIfNeeded();
  const box = await line.boundingBox();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await page.locator('section[aria-labelledby="s-grafici"] .card').nth(3).screenshot({ path: `${out}/${scheme}-22-linee-tooltip.png` });

  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(`${scheme}: scroll orizzontale=${hScroll}, errori=${errors.length ? errors.join(' | ') : 'nessuno'}`);
  await page.close();
}
await browser.close();
