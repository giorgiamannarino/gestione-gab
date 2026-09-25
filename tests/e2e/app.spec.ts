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

test('piano con ricarica dei pocket Revolut e prova delle notifiche', async ({ page }) => {
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
  await expect(page.getByText(/nessun prelievo: metà del budget/)).toBeVisible(); // Auto: riserva
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

test('giroconto programmato da confermare e aspetto scuro', async ({ page }) => {
  await restoreExample(page);
  // Risparmi → Fondo pensione, proposto dal 25: si conferma con un tocco e diventa un giroconto.
  const row = page.getByRole('group').filter({ hasText: 'Versamento fondo' });
  await expect(row).toContainText('Risparmi → Fondo pensione');
  await row.getByRole('button').click();
  await expect(page.getByText('Giroconto di 100,00 € salvato')).toBeVisible();
  await expect(page.getByRole('group').filter({ hasText: 'Versamento fondo' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('radio', { name: 'Scuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Automatico' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('riepilogo del mese e guida', async ({ page }) => {
  await restoreExample(page);
  await page.getByRole('button', { name: /Patrimonio totale/ }).click();
  await expect(page.getByRole('heading', { name: 'Riepilogo' })).toBeVisible();
  await expect(page.getByText(/Il patrimonio è passato da/)).toBeVisible();
  await expect(page.getByText(/Lo stipendio di questo periodo non è ancora stato registrato/)).toBeVisible();
  // Periodo precedente: stipendio e spese raccontati.
  await page.getByRole('button', { name: 'Periodo precedente' }).click();
  await expect(page.getByText(/Lo stipendio del 23 settembre è stato di/)).toBeVisible();
  await expect(page.getByText(/La categoria più pesante è/)).toBeVisible();
  await expect(page.getByText(/Hai messo da parte/)).toBeVisible();

  await page.getByRole('button', { name: "Come funziona l'app" }).click();
  await expect(page.getByRole('heading', { name: 'Come funziona' })).toBeVisible();
  await page.getByText('Cosa si può modificare e cosa no').click();
  await expect(page.getByRole('cell', { name: /Saldi: si calcolano sempre/ })).toBeVisible();
});

test('la barra in basso resta attaccata al fondo mentre si scorre', async ({ page }) => {
  await restoreExample(page);
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' });
  const vh = page.viewportSize()!.height;
  for (const y of [0, 400, 100000]) {
    await page.locator('main').evaluate((m, top) => m.scrollTo({ top }), y);
    await page.mouse.wheel(0, 300); // tenta anche di far scorrere la pagina intera
    const box = (await nav.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(vh);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0); // la pagina non scorre, solo il contenuto
});

test('i pannelli dal basso restano nello schermo e scorrono', async ({ page }) => {
  await restoreExample(page);
  const vh = page.viewportSize()!.height;
  const check = async () => {
    const panel = page.locator('dialog[open] .panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(400); // fine animazione
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(Math.round(box.y + box.height)).toBe(vh);
  };
  await page.getByRole('button', { name: 'Nuovo movimento' }).click();
  await check();
  await page.locator('dialog[open]').getByRole('button', { name: 'Chiudi' }).click();

  // Scheda lunga: una spesa fissa. Il contenuto scorre dentro il pannello fino al pulsante Salva.
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Spese fisse/ }).click();
  await page.getByRole('button', { name: /^Auto/ }).click();
  await check();
  const save = page.locator('dialog[open]').getByRole('button', { name: 'Salva', exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('calendario delle spese: tocco su un giorno mostra i suoi movimenti', async ({ page }) => {
  await restoreExample(page);
  await page.getByRole('button', { name: 'Statistiche' }).click();
  await page.getByRole('button', { name: /^venerdì 25 ottobre: 48,00/ }).click();
  const detail = page.locator('.day-detail');
  await expect(detail).toContainText('25 ottobre');
  await expect(detail.getByRole('button', { name: /Carburante/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^lunedì 28 ottobre: nessuna spesa/ })).toBeVisible();
});

test('bollette: il resto torna ai risparmi e la stima passa a due mesi dopo', async ({ page }) => {
  await restoreExample(page);
  await page.clock.setFixedTime(new Date('2030-11-05T10:00:00+01:00'));
  await page.reload();
  await expect(page.getByText('Sono arrivate le bollette di novembre?')).toBeVisible();
  await page.getByRole('button', { name: 'Sì, inserisci' }).click();
  // Nel fondo ci sono 360 € (120 + 3 × 100 − 0 − …): con 187,40 € avanzano soldi per i risparmi.
  await page.locator('dialog[open]').getByLabel('Quanto è uscito?').fill('187,40');
  await expect(page.getByText(/Avanzano .* li sposto su Risparmi/)).toBeVisible();
  await page.getByRole('button', { name: 'Registra le bollette' }).click();
  await expect(page.getByText(/Bollette registrate, .* tornati su Risparmi/)).toBeVisible();
  await expect(page.getByText('Sono arrivate le bollette di novembre?')).toHaveCount(0);

  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Stipendio e piano/ }).click();
  await expect(page.getByLabel('Mese della prossima bolletta')).toHaveValue('2031-01');
});

test('bollette: se costano più del fondo, la differenza arriva dai risparmi', async ({ page }) => {
  await restoreExample(page);
  await page.clock.setFixedTime(new Date('2030-11-05T10:00:00+01:00'));
  await page.reload();
  await page.getByRole('button', { name: 'Sì, inserisci' }).click();
  await page.locator('dialog[open]').getByLabel('Quanto è uscito?').fill('2.000');
  await expect(page.getByText(/Tolgo .* da Risparmi/)).toBeVisible();
  await page.getByRole('button', { name: 'Registra le bollette' }).click();
  await expect(page.getByText(/Bollette registrate, .* presi da Risparmi/)).toBeVisible();
  // Il fondo bollette arriva a zero, non in negativo.
  await expect(page.getByRole('button', { name: /^Fondo bollette/ })).toContainText('0,00');
});

test('bollette: "Non ancora" per 5 giorni, ultimo giorno si chiede conferma e si rimanda al periodo dopo', async ({ page }) => {
  const at = async (d: string) => {
    await page.waitForTimeout(300); // lascia finire il salvataggio prima di ricaricare
    await page.clock.setFixedTime(new Date(`${d}T10:00:00+01:00`));
    await page.reload();
  };
  const banner = page.getByText('Sono arrivate le bollette di novembre?');
  await restoreExample(page);

  await at('2030-11-05');
  await page.getByRole('button', { name: 'Non ancora' }).click();
  await expect(banner).toHaveCount(0);
  await at('2030-11-09');
  await expect(banner).toHaveCount(0); // ancora nei 5 giorni
  await at('2030-11-10');
  await expect(banner).toBeVisible(); // dopo 5 giorni torna
  await page.getByRole('button', { name: 'Non ancora' }).click();

  // Ultimo giorno del periodo (22): si chiede comunque, anche se rimandato da poco.
  await at('2030-11-22');
  await expect(page.getByText('Ultimo giorno del periodo: le bollette non sono ancora uscite dal conto?')).toBeVisible();
  await page.getByRole('button', { name: 'Confermo, non ancora' }).click();
  await expect(page.getByText(/Bollette spostate al periodo dal 23 novembre/)).toBeVisible();
  await expect(page.getByText(/Ultimo giorno del periodo/)).toHaveCount(0);

  // Nuovo periodo: il banner torna e il Piano ne tiene conto.
  await at('2030-11-23');
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await page.getByLabel('Stipendio').fill('2.345');
  await page.getByRole('button', { name: 'Registra stipendio' }).click();
  await expect(page.getByRole('heading', { name: 'Bollette attese in questo periodo' })).toBeVisible();
  await expect(page.getByText(/L'accantonamento di questo mese resta per le bollette successive/)).toBeVisible();

  // Accantonamento del mese nuovo (+100 nel fondo): è per le bollette successive.
  await page.getByRole('checkbox', { name: /Fondo bollette/ }).click();
  await expect(page.getByRole('checkbox', { name: /Fondo bollette/ })).toHaveAttribute('aria-checked', 'true');

  // Escono le bollette di novembre (190 €): a loro spettano i 320 € messi da parte fino al 22 novembre.
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Sì, inserisci' }).click();
  await page.locator('dialog[open]').getByLabel('Quanto è uscito?').fill('190');
  await expect(page.getByText(/sono per le bollette successive e restano lì/)).toBeVisible();
  await page.getByRole('button', { name: 'Registra le bollette' }).click();
  await expect(page.getByText(/Bollette registrate, 130,00\s€ tornati su Risparmi/)).toBeVisible();
  // Nel fondo restano i 100 € del mese nuovo.
  await expect(page.getByRole('button', { name: /^Fondo bollette/ })).toContainText('100,00');
});

test('piano: con lo stipendio inserito a parte non propone "Metti da parte" né l\'avanzo', async ({ page }) => {
  await restoreExample(page);
  // Stipendio aggiunto a mano come entrata, fuori dal Piano.
  await page.getByRole('button', { name: 'Nuovo movimento' }).click();
  await page.getByRole('radio', { name: 'Entrata' }).click();
  await page.getByLabel('Descrizione').fill('Stipendio');
  await page.getByLabel('Descrizione').blur(); // voce già usata: pocket e categoria si compilano da soli
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Stipendio', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const k of ['2', '3', '4', '5']) await page.getByRole('group', { name: 'Tastierino numerico' }).getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();

  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await expect(page.getByText(/Stipendio 2\.345,00\s€ →/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Metti da parte' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Avanzo del periodo precedente' })).toHaveCount(0);
});

test('pagina del pocket con previsione e saluto', async ({ page }) => {
  await restoreExample(page);
  await expect(page.getByRole('heading', { name: 'Buongiorno' })).toBeVisible(); // ore 10
  // Auto: riserva, nulla preso nel periodo → previsione metà dell'importo.
  await page.getByRole('button', { name: /^Auto/ }).click();
  await expect(page.getByRole('heading', { name: 'Auto' })).toBeVisible();
  await expect(page.getByText('A inizio periodo')).toBeVisible();
  await expect(page.getByText(/Previsione per il 23 novembre/)).toBeVisible();
  await expect(page.getByText(/sposterai metà dell'importo/)).toBeVisible();
  await expect(page.getByText(/La regola di "Auto" si cambia/)).toBeVisible();
  // Casa: solo i suoi movimenti.
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: /^Casa/ }).click();
  await expect(page.getByText(/Ricarica fino a 300,00/)).toBeVisible();
  const titles = page.locator('main .card .title');
  await expect(titles.filter({ hasText: 'Supermercato' }).first()).toBeVisible();
  await expect(titles.filter({ hasText: 'Carburante' })).toHaveCount(0); // spesa di un altro pocket
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
