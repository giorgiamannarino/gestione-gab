// Genera icone PNG e splash screen iOS dall'icona SVG. Uso: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(html, width, height, path) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path, clip: { x: 0, y: 0, width, height } });
}

for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png'], [512, 'maskable-512.png']]) {
  await render(`<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`, size, size, `public/icons/${name}`);
}

// Splash iOS (dimensioni in pixel reali, @3x), chiaro e scuro.
const devices = [[1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1284, 2778], [1290, 2796], [1320, 2868]];
for (const [w, h] of devices) {
  for (const [scheme, bg] of [['light', '#f4f4f8'], ['dark', '#09090f']]) {
    const icon = 300;
    await render(
      `<div style="width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center">
         <div style="width:${icon}px;height:${icon}px;border-radius:${icon * 0.225}px;overflow:hidden">${svg.replace('<svg ', `<svg width="${icon}" height="${icon}" `)}</div>
       </div>`,
      w, h, `public/icons/splash-${w}x${h}-${scheme}.png`,
    );
  }
}
await browser.close();
console.log('Icone e splash generati');
