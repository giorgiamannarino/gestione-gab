import { expect, test, type Page } from '@playwright/test';
import { exampleBackup } from './fixture';

const NOW = new Date('2030-10-28T10:00:00+01:00');

async function restoreExample(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/');
  await page.getByRole('button', { name: 'Ho già un backup' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exampleBackup())) });
  await expect(page.getByText(/Stai per ripristinare \d+ movimenti, backup del 20\/10\/2030/)).toBeVisible();
  await page.getByRole('button', { name: 'Ripristina', exact: true }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('button', { name: 'Più tardi' }).click();
  await page.getByRole('button', { name: 'No, grazie' }).click();
  await expect(page.getByText('Patrimonio totale')).toBeVisible();
}

test('onboarding da zero, allineamento del saldo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Benvenuto in Conti' })).toBeVisible();
  await page.getByRole('button', { name: 'Parti da zero' }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByLabel('Saldo reale di Conto principale').fill('1.250,40');
  await expect(page.getByText('rettifica +1.250,40')).toBeVisible();
  await page.getByRole('button', { name: /Allinea e continua/ }).click();
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('button', { name: 'Più tardi' }).click();
  await page.getByRole('button', { name: 'No, grazie' }).click();
  await expect(page.getByLabel('1.250,40 euro').first()).toBeVisible();
});

test('parti da zero con il file di configurazione, poi prosegui senza rettifiche', async ({ page }) => {
  const config = {
    formato: 'conti-config', versione: 1,
    gruppi: [{ id: 'banca', nome: 'Banca' }, { id: 'app', nome: 'App' }],
    pocket: [
      { id: 'conto', nome: 'Conto', gruppo: 'banca', ruolo: 'main' },
      { id: 'svago', nome: 'Svago', gruppo: 'app', revolut: true },
      { id: 'monete', nome: 'Monete', gruppo: 'app', revolut: true, ruolo: 'savings' },
    ],
  };
  await page.goto('/');
  await page.getByRole('button', { name: 'Parti da zero' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'config-iniziale.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(config)) });
  await expect(page.getByText('config-iniziale.json', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click();
  await expect(page.getByLabel('Saldo reale di Svago')).toBeVisible();
  await page.getByRole('button', { name: 'Continua: i saldi sono giusti' }).click();
  await expect(page.getByRole('heading', { name: 'Mettila nella schermata Home' })).toBeVisible();
});

test('uscita Revolut con arrotondamento, annulla, piano, statistiche', async ({ page }) => {
  await restoreExample(page);

  // Nuova uscita da Svago (Revolut): anteprima +0,70 € ai Savings.
  await page.getByRole('button', { name: 'Nuovo movimento' }).click();
  await page.getByLabel('Descrizione').fill('Gelato');
  await page.getByRole('dialog').getByRole('button', { name: 'Svago', exact: true }).first().click();
  for (const k of ['1', '2', 'Virgola', '3']) await page.getByRole('group', { name: 'Tastierino numerico' }).getByRole('button', { name: k, exact: true }).click();
  await expect(page.getByText('+0,70 € ai Savings')).toBeVisible();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('Uscita di 12,30 € salvata')).toBeVisible();

  await page.getByRole('button', { name: 'Movimenti' }).click();
  await expect(page.getByRole('main').getByText('Gelato', { exact: true })).toBeVisible();
  await expect(page.getByText('+0,70 € Savings')).toBeVisible();

  // Annulla dal toast: sparisce anche l'arrotondamento.
  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.getByRole('main').getByText('Gelato', { exact: true })).toHaveCount(0);

  // Piano: stipendio → riepilogo.
  await page.getByRole('button', { name: 'Piano' }).click();
  await page.getByLabel('Stipendio').fill('2.345');
  await page.getByRole('button', { name: 'Registra stipendio' }).click();
  await expect(page.getByText(/Stipendio 2\.345,00\s€ → fissi e pocket [\d.,]+\s€ → puoi mettere da parte [\d.,]+\s€/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Svago/ })).toBeDisabled(); // già a posto: niente da ricaricare
  await page.getByRole('checkbox', { name: /Fondo bollette/ }).click();
  await expect(page.getByRole('checkbox', { name: /Fondo bollette/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Statistiche' }).click();
  await expect(page.getByRole('heading', { name: 'Spese per categoria' })).toBeVisible();
});

test('piano con ricarica dei pocket Revolut e prova delle notifiche', async ({ page, context }) => {
  // In Chrome con emulazione iPhone il permesso risulta sempre bloccato: lo si simula concesso.
  await page.addInitScript(() => {
    const w = window as unknown as { __notifiche: string[] };
    w.__notifiche = [];
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    ServiceWorkerRegistration.prototype.showNotification = async (_t: string, o?: NotificationOptions) => { w.__notifiche.push(o?.body ?? ''); };
  });
  await restoreExample(page);
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await page.getByLabel('Stipendio').fill('2.345');
  await page.getByRole('button', { name: 'Registra stipendio' }).click();
  // Con quanto è rimasto sui pocket Revolut si sposta meno: il risparmio sale sopra 991,96 €.
  await expect(page.getByText(/rimasti/).first()).toBeVisible();
  const text = await page.getByText(/Stipendio 2\.345,00\s€ →/).innerText();
  const saved = Number(text.match(/da parte ([\d.,]+)/)![1]!.replace(/\./g, '').replace(',', '.'));
  expect(saved).toBeGreaterThan(991.96);

  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Promemoria/ }).click();
  await page.getByRole('switch', { name: /Promemoria delle 20/ }).click();
  await page.getByRole('button', { name: 'Prova le notifiche' }).click();
  await expect(page.getByText('Notifica inviata')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __notifiche: string[] }).__notifiche)).toContain('Hai inserito le spese di oggi? Non ti scordare!');
});

test('blocco con PIN', async ({ page }) => {
  await restoreExample(page);
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Blocco/ }).click();
  await page.getByRole('button', { name: 'Attiva il blocco con PIN' }).click();
  for (const d of '246810') await page.keyboard.press(d);
  await expect(page.getByText('Ripeti il PIN')).toBeVisible();
  for (const d of '246810') await page.keyboard.press(d);
  await expect(page.getByText('Blocco attivo')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('dialog', { name: 'App bloccata' })).toBeVisible();
  await expect(page.getByText('Blocco attivo')).toHaveCount(0);
  for (const d of '111111') await page.keyboard.press(d);
  await expect(page.getByText('PIN errato')).toBeVisible();
  for (const d of '246810') await page.keyboard.press(d);
  await expect(page.getByText('Blocco attivo')).toBeVisible();
});
