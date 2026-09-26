// Genera icone PNG, favicon SVG e splash screen iOS dall'immagine dell'icona (MO KASH).
// Uso: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'scripts/mokash-sorgente.jpg';
// Quadrato dell'icona nell'immagine (1024×1024): il riquadro va da x 297–762 e y 271–752 con
// angoli arrotondati di ~50 px. Si ritaglia un po' all'interno, così gli angoli di carta restano
// fuori: l'arrotondamento lo fa iOS (o il browser) da solo.
const CROP = { x: 313, y: 295, size: 433 };

const src = `data:image/jpeg;base64,${(await readFile(SOURCE)).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();

/** Disegna il ritaglio su un canvas quadrato; `inset` lascia un margine (per le icone maskable). */
async function iconPng(size, inset = 0) {
  const dataUrl = await page.evaluate(
    async ({ src, crop, size, inset }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (inset) {
        // Sfondo: il blu scuro in basso a destra del disegno.
        const probe = document.createElement('canvas');
        probe.width = probe.height = 1;
        probe.getContext('2d').drawImage(img, crop.x + crop.size - 12, crop.y + crop.size - 12, 1, 1, 0, 0, 1, 1);
        const [r, gr, b] = probe.getContext('2d').getImageData(0, 0, 1, 1).data;
        g.fillStyle = `rgb(${r},${gr},${b})`;
        g.fillRect(0, 0, size, size);
      }
      const inner = size - 2 * inset;
      g.drawImage(img, crop.x, crop.y, crop.size, crop.size, inset, inset, inner, inner);
      return c.toDataURL('image/png');
    },
    { src, crop: CROP, size, inset },
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  await writeFile(`public/icons/${name}`, await iconPng(size));
}
// Android ritaglia le maskable a cerchio o forme varie: il disegno sta nell'80% centrale.
await writeFile('public/icons/maskable-512.png', await iconPng(512, Math.round(512 * 0.1)));

// Favicon: SVG con dentro il PNG, angoli arrotondati come le icone di sistema.
const fav = (await iconPng(128)).toString('base64');
await writeFile(
  'public/icons/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128"><clipPath id="r"><rect width="128" height="128" rx="28"/></clipPath><image clip-path="url(#r)" width="128" height="128" xlink:href="data:image/png;base64,${fav}"/></svg>\n`,
);

// Splash iOS (dimensioni in pixel reali, @3x), chiaro e scuro.
const splashIcon = `data:image/png;base64,${(await iconPng(600)).toString('base64')}`;
const devices = [[1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622], [1284, 2778], [1290, 2796], [1320, 2868]];
for (const [w, h] of devices) {
  for (const [scheme, bg] of [['light', '#f4f4f8'], ['dark', '#09090f']]) {
    const icon = 300;
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<html><body style="margin:0"><div style="width:${w}px;height:${h}px;background:${bg};display:grid;place-items:center">
         <img src="${splashIcon}" style="width:${icon}px;height:${icon}px;border-radius:${icon * 0.225}px" />
       </div></body></html>`,
    );
    await page.screenshot({ path: `public/icons/splash-${w}x${h}-${scheme}.png`, clip: { x: 0, y: 0, width: w, height: h } });
  }
}
await browser.close();
console.log('Icone e splash generati');
