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
  await expect(page.getByText('Stipendio 2.345,00 € → fissi e pocket 1.353,04 € → puoi mettere da parte 991,96 €')).toBeVisible();
  await page.getByRole('checkbox', { name: /Svago/ }).click();
  await expect(page.getByRole('checkbox', { name: /Svago/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Statistiche' }).click();
  await expect(page.getByRole('heading', { name: 'Spese per categoria' })).toBeVisible();
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
