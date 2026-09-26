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

test('oggi puoi spendere, scadenze annuali ed etichette', async ({ page }) => {
  await restoreExample(page);
  // Oggi puoi spendere (pocket Svago), 26 giorni al 22 novembre compreso.
  const daily = page.getByRole('button', { name: /Oggi puoi spendere/ });
  await expect(daily).toContainText('su Svago');
  await expect(daily).toContainText('26 giorni al 23');
  // Backup appena ripristinato: niente promemoria, il quadrato occupa tutta la riga.
  await expect(page.locator('.backup-tile')).toHaveCount(0);
  await expect(daily).toContainText('In linea');

  // Una spesa grossa su Svago: si va oltre il programma e compare l'avviso.
  await page.getByRole('button', { name: 'Nuovo movimento' }).click();
  await page.getByLabel('Descrizione').fill('Concerto');
  await page.getByRole('dialog').getByRole('button', { name: 'Svago', exact: true }).first().click();
  for (const k of ['2', '5', '0']) await page.getByRole('group', { name: 'Tastierino numerico' }).getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(daily).toContainText('Attenzione, stai spendendo più di quanto programmato in questi giorni');
  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(daily).toContainText('In linea');

  // Scadenza in Spese fisse: bollo da 180 € il 10 marzo → 5 stipendi (23 ott, nov, dic, gen, feb) → 36 € a stipendio.
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Spese fisse/ }).click();
  await expect(page.getByRole('heading', { name: 'Scadenze' })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi una scadenza' }).click();
  const sheet = page.locator('dialog[open]');
  await sheet.getByLabel('Nome').fill('Bollo auto');
  await sheet.getByLabel('Importo').fill('180');
  await sheet.getByLabel('Data della scadenza').fill('2031-03-10');
  await expect(sheet.getByText(/36,00\s€ a ogni stipendio \(5 stipendi/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('button', { name: /Bollo auto/ })).toContainText(/36,00\s€ a stipendio \(ancora 5\)/);

  // L'accantonamento è nella checklist del Piano, sotto Scadenze, non in Da confermare.
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: 'Torna alla Home' }).click();
  await expect(page.getByRole('group').filter({ hasText: 'Bollo auto' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await page.getByLabel('Stipendio').fill('2.345');
  await page.getByRole('button', { name: 'Registra stipendio' }).click();
  const bollo = page.getByRole('checkbox', { name: /Bollo auto/ });
  await expect(bollo).toContainText('ancora 5 stipendi');
  await expect(bollo).toContainText(/36,00\s€/);
  await bollo.click();
  await expect(bollo).toHaveAttribute('aria-checked', 'true');

  // Il pagamento compare in Da confermare solo dai 7 giorni prima.
  const setDue = async (date: string) => {
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Impostazioni' }).click();
    await page.getByRole('button', { name: /Spese fisse/ }).click();
    await page.getByRole('button', { name: /Bollo auto/ }).first().click();
    await page.locator('dialog[open]').getByLabel('Data della scadenza').fill(date);
    await page.locator('dialog[open]').getByRole('button', { name: 'Salva', exact: true }).click();
    await page.getByRole('button', { name: 'Indietro' }).click();
    await page.getByRole('button', { name: 'Torna alla Home' }).click();
  };
  const row = page.getByRole('group').filter({ hasText: 'Bollo auto' });
  await setDue('2030-11-05'); // 8 giorni
  await expect(row).toHaveCount(0);
  await setDue('2030-11-04'); // 7 giorni
  await expect(row).toContainText('scade il 4 novembre');
  await row.getByRole('button').click();
  await expect(page.getByText(/Bollo auto pagato: 180,00/)).toBeVisible();

  // Etichetta su una nuova spesa → Statistiche → movimenti dell'evento.
  await page.getByRole('button', { name: 'Nuovo movimento' }).click();
  await page.getByLabel('Descrizione').fill('Museo');
  for (const k of ['1', '5']) await page.getByRole('group', { name: 'Tastierino numerico' }).getByRole('button', { name: k, exact: true }).click();
  await page.getByRole('button', { name: 'Data e nota' }).click();
  await page.getByLabel(/Etichetta evento o viaggio/).fill('Weekend Roma');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await page.getByRole('button', { name: 'Statistiche' }).click();
  await page.getByRole('button', { name: /Weekend Roma/ }).click();
  await expect(page.getByText(/Evento “Weekend Roma”: speso 15,00\s€ in 1 movimento/)).toBeVisible();
});

test('home: in basso i quadrati e poi settimana, spese fuori dal solito, giorni senza spese', async ({ page }) => {
  await restoreExample(page);
  const daily = page.getByRole('button', { name: /Oggi puoi spendere/ });
  const revolut = page.getByRole('heading', { name: 'Revolut' });
  const weekCard = page.getByRole('heading', { name: /Settimana scorsa/ });
  const streakCard = page.getByRole('heading', { name: 'Giorni senza spese' });
  // Ordine: conti → quadrati → nuove schede.
  const y = async (l: typeof daily) => (await l.boundingBox())!.y;
  expect(await y(daily)).toBeGreaterThan(await y(revolut));
  expect(await y(weekCard)).toBeGreaterThan(await y(daily));
  expect(await y(streakCard)).toBeGreaterThan(await y(weekCard));
  // Settimana 21–27 ottobre: Supermercato 18 € + Carburante 48 €.
  await expect(page.getByText(/Hai speso 66,00\s€ in 2 spese/)).toBeVisible();
  await expect(page.getByText(/La spesa più grande: Carburante/)).toBeVisible();
  await expect(page.getByText(/giorni senza spese su Svago/)).toBeVisible();
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

test('importi con i decimali: scadenze, spese fisse, errori chiari', async ({ page }) => {
  await restoreExample(page);
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Spese fisse/ }).click();

  // Scadenza con i centesimi, scritta con il simbolo dell'euro.
  await page.getByRole('button', { name: 'Aggiungi una scadenza' }).click();
  const sheet = page.locator('dialog[open]');
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(sheet.getByText('Scrivi il nome.')).toBeVisible();
  await expect(sheet.getByText(/Scrivi l'importo/)).toBeVisible();
  await sheet.getByLabel('Nome').fill('Bollo auto');
  await sheet.getByLabel('Importo').pressSequentially('180,555');
  await expect(sheet.getByText(/Al massimo due decimali/)).toBeVisible();
  await sheet.getByLabel('Importo').fill('180,50 €');
  await sheet.getByLabel('Data della scadenza').fill('2031-03-10');
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('button', { name: /Bollo auto/ })).toContainText(/180,50\s€/);

  // Seconda scadenza, modifica della prima ed eliminazione: con altre scadenze già salvate.
  await page.getByRole('button', { name: 'Aggiungi una scadenza' }).click();
  await sheet.getByLabel('Nome').fill('Assicurazione');
  await sheet.getByLabel('Importo').fill('420,30');
  await sheet.getByLabel('Data della scadenza').fill('2031-06-15');
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Assicurazione.*2031/ })).toContainText(/420,30\s€/);
  await expect(page.getByRole('button', { name: /Bollo auto/ })).toBeVisible();
  await page.getByRole('button', { name: /Bollo auto/ }).click();
  await sheet.getByLabel('Importo').fill('190');
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('button', { name: /Bollo auto/ })).toContainText(/190,00\s€/);
  await page.getByRole('button', { name: /Bollo auto/ }).click();
  await sheet.getByRole('button', { name: 'Elimina la scadenza' }).click();
  await expect(page.getByRole('button', { name: /Bollo auto/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Assicurazione.*2031/ })).toBeVisible();

  // Scadenza accantonata prelevando da Risparmi invece che dal conto principale.
  await page.getByRole('button', { name: 'Aggiungi una scadenza' }).click();
  await sheet.getByLabel('Nome').fill('Università');
  await sheet.getByLabel('Importo').fill('600');
  await sheet.getByLabel('Data della scadenza').fill('2031-01-10');
  await sheet.getByRole('button', { name: 'Risparmi', exact: true }).nth(1).click(); // "Da dove prelevare"
  await sheet.getByRole('button', { name: 'Fondo bollette', exact: true }).first().click(); // "Dove accantonare"
  await expect(sheet.getByText(/non si toglie da quanto puoi mettere da parte/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('button', { name: /Università/ })).toContainText('Risparmi → Fondo bollette');

  // Spesa fissa con il punto come separatore decimale.
  await page.getByRole('button', { name: 'Aggiungi una voce' }).click();
  await sheet.getByLabel('Nome').fill('Palestra');
  await sheet.getByLabel('Importo').fill('34.90');
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByRole('button', { name: /Palestra/ })).toContainText(/34,90\s€/);
});

test('scadenze su Auto: lo spostamento verso Auto diventa la loro somma, non budget + scadenze', async ({ page }) => {
  await restoreExample(page);
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: /Spese fisse/ }).click();
  const sheet = page.locator('dialog[open]');
  // 600 € al 10 gennaio → 3 stipendi → 200 €; 450 € al 10 marzo → 5 stipendi → 90 €. Totale 290 € > budget.
  for (const [name, amount, date] of [['Gomme', '600', '2031-01-10'], ['Assicurazione auto', '450', '2031-03-10']] as const) {
    await page.getByRole('button', { name: 'Aggiungi una scadenza' }).click();
    await sheet.getByLabel('Nome').fill(name);
    await sheet.getByLabel('Importo').fill(amount);
    await sheet.getByLabel('Data della scadenza').fill(date);
    await sheet.getByRole('button', { name: 'Auto', exact: true }).first().click();
    await sheet.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: 'Torna alla Home' }).click();
  await page.getByRole('button', { name: 'Piano', exact: true }).click();
  await page.getByLabel('Stipendio').fill('2.345');
  await page.getByRole('button', { name: 'Registra stipendio' }).click();

  await expect(page.getByText(/La stima di risparmio è un consiglio: puoi accettarla in fondo alla pagina/)).toBeVisible();
  await expect(page.getByText(/Spuntando una voce non paghi nulla: registri solo la ripartizione/)).toBeVisible();

  // Una sola riga verso Auto, niente righe separate in Scadenze.
  const auto = page.getByRole('checkbox', { name: /^Auto/ });
  await expect(auto).toContainText(/scadenze 290,00\s€ al posto del budget di/);
  await expect(auto).toContainText(/Gomme 200,00\s€, Assicurazione auto 90,00\s€/);
  await expect(page.getByRole('heading', { name: 'Scadenze', exact: true })).toHaveCount(0);
  // Riepilogo in fondo: nulla ancora messo da parte.
  const recap = page.locator('.dl').filter({ hasText: 'Gomme' });
  await expect(recap).toContainText(/10 gennaio 2031 · tra 74 giorni · 3 stipendi/);
  await expect(recap).toContainText(/Messi da parte 0,00\s€/);
  await expect(recap).toContainText(/Mancano 600,00\s€/);

  const assic = page.locator('.dl').filter({ hasText: 'Assicurazione auto' });
  const giroconto = async (digits: string[]) => {
    await page.getByRole('button', { name: 'Nuovo movimento' }).click();
    const qa = page.getByRole('dialog');
    await qa.getByRole('radio', { name: 'Giroconto' }).click();
    await qa.getByRole('button', { name: 'Conto', exact: true }).first().click();
    await qa.getByRole('button', { name: 'Auto', exact: true }).last().click();
    for (const k of digits) await qa.getByRole('group', { name: 'Tastierino numerico' }).getByRole('button', { name: k, exact: true }).click();
    await qa.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(qa).toHaveCount(0);
  };

  // Giroconto a mano di soli 150 €: non basta, la voce resta da completare e nulla va alle scadenze.
  await giroconto(['1', '5', '0']);
  await expect(auto).toHaveAttribute('aria-checked', 'false');
  await expect(auto).toContainText(/già spostati 150,00\s€ con un giroconto: spunta per spostare i 140,00\s€ che mancano/);
  await expect(recap).toContainText(/Messi da parte 0,00\s€/);

  // La spunta sposta solo i 140 € che mancano; le quote vanno alle scadenze.
  await auto.click();
  await expect(auto).toHaveAttribute('aria-checked', 'true');
  await expect(auto).toContainText(/150,00\s€ con un giroconto \+ 140,00\s€ con la spunta/);
  await expect(recap).toContainText(/Messi da parte 200,00\s€/);
  await expect(recap).toContainText(/Mancano 400,00\s€/);
  await expect(assic).toContainText(/Messi da parte 90,00\s€/);

  // Togliendo la spunta si annulla solo il giroconto della spunta.
  await auto.click();
  await expect(auto).toHaveAttribute('aria-checked', 'false');
  await expect(recap).toContainText(/Messi da parte 0,00\s€/);

  // Altri 140 € a mano: ora il giroconto copre tutto, la voce è fatta e le quote si contano.
  await giroconto(['1', '4', '0']);
  await expect(auto).toHaveAttribute('aria-checked', 'true');
  await expect(auto).toContainText('fatto con un giroconto dai Movimenti');
  await expect(recap).toContainText(/Messi da parte 200,00\s€/);

  // Anche una voce fatta con un giroconto si può togliere: il giroconto resta, ma non conta.
  await auto.click();
  await expect(auto).toHaveAttribute('aria-checked', 'false');
  await expect(auto).toContainText('il giroconto dai Movimenti non conta per questa voce');
  await expect(recap).toContainText(/Messi da parte 0,00\s€/);
  await auto.click();
  await expect(auto).toHaveAttribute('aria-checked', 'true');
  await expect(recap).toContainText(/Messi da parte 200,00\s€/);
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
