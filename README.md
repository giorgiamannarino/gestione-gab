# Conti

Un'app per gestire le finanze personali dal telefono: pocket, spese, piano di inizio mese, statistiche e backup.

**Tutti i dati restano sul telefono.** Non ci sono account, server o database online. Il codice di questo repository è pubblico, ma non contiene nessun dato personale: saldi, importi e movimenti arrivano sul telefono solo tramite l'import al primo avvio.

---

## 1. Pubblicare l'app su GitHub Pages

Si fa una volta sola.

1. Crea un repository **pubblico** su GitHub, per esempio `gestione-gab`. GitHub Pages gratuito richiede che sia pubblico.
2. Carica il codice. Da questa cartella, con il terminale:
   ```
   git remote add origin https://github.com/TUO-NOME-UTENTE/gestione-gab.git
   git push -u origin main
   ```
   In alternativa puoi usare GitHub Desktop: *Add existing repository* e poi *Publish*.
3. Su GitHub apri **Settings → Pages** e, alla voce **Source**, scegli **GitHub Actions**.
4. Apri la scheda **Actions**: dopo 1–2 minuti la pubblicazione diventa verde.
5. L'app è online all'indirizzo `https://TUO-NOME-UTENTE.github.io/gestione-gab/`.

> ⚠️ Il foglio Excel, `config-iniziale.json` e i file di backup **non vanno mai caricati su GitHub**. Sono già esclusi automaticamente (file `.gitignore`), ma non trascinarli a mano nel sito di GitHub.

## 2. Installare l'app sul telefono

**iPhone** (con Safari):
1. Apri l'indirizzo dell'app.
2. Tocca **Condividi** (il quadrato con la freccia in su).
3. Scegli **Aggiungi alla schermata Home**, poi **Aggiungi**.
4. Da ora in poi apri **Conti** dalla sua icona.

**Android** (con Chrome): apri l'indirizzo, tocca il menu **⋮** e scegli **Installa app**.

Installarla è importante: su iPhone i dati di un sito non installato possono essere cancellati dopo alcuni giorni in cui non lo usi.

## 3. Primo avvio e import

Prima porta sul telefono i due file, per esempio con AirDrop o salvandoli in iCloud Drive:
- il foglio Excel;
- `config-iniziale.json`, che contiene pocket, categorie e spese fisse. Lo trovi nella cartella `local/`, che resta fuori da GitHub.

Poi apri l'app e segui i passaggi:
1. **Importa il foglio Excel** e scegli i due file. L'app legge il foglio direttamente sul telefono e non lo invia da nessuna parte.
2. Tocca **Controlla il file**. L'app mostra quanti movimenti ha trovato ed elenca le eventuali incongruenze del foglio. Le importa così come sono.
3. **Allinea i saldi**: apri le app di Intesa, Generali e Revolut e scrivi il saldo reale di ogni pocket. Per ogni differenza l'app crea una rettifica, esclusa dalle statistiche.
4. Aggiungi l'app alla schermata Home, fai il primo backup e, se vuoi, attiva il blocco con PIN.

Non hai il foglio? Scegli **Parti da zero**, con o senza il file di configurazione.

## 4. Backup e ripristino

Il backup è **un solo file con tutto**: saldi iniziali, movimenti, pocket, categorie, spese fisse, valori degli investimenti e impostazioni. Basta sempre l'ultimo.

- **Fare un backup**: *Impostazioni → Backup e dati → Salva il backup*. Si apre il menu di condivisione: scegli **Salva su File → iCloud Drive**, oppure Google Drive.
- **Con password**: attiva *Proteggi con password* prima di salvare. Senza quella password il file non si apre in nessun modo. È diversa dal PIN di blocco.
- **Promemoria**: il piano di inizio mese propone il backup, in Home compare un avviso se l'ultimo ha più di 30 giorni, e puoi attivare anche il promemoria settimanale.
- **Ripristinare**: *Impostazioni → Backup e dati → Ripristina → Scegli il file di backup*. L'app mostra un riepilogo, per esempio "Stai per ripristinare 124 movimenti, backup del 23/10/2026". Toccando **Ripristina** l'app torna esattamente a quel momento.
- **Telefono nuovo**: installa l'app, scegli **Ho già un backup** e seleziona il file.
- **Excel**: *Esporta i movimenti in CSV* crea un file che si apre con Excel o Numbers.

## 5. Blocco con PIN

*Impostazioni → Blocco → Attiva il blocco con PIN*, poi scegli 6 cifre e ripetile.

- L'app chiede il PIN all'apertura e dopo un periodo in background, che imposti tu (1 minuto di default).
- Dove il telefono lo permette, puoi attivare anche **Face ID o impronta**. Il PIN resta sempre disponibile.
- Dopo 5 tentativi sbagliati bisogna aspettare, e l'attesa cresce a ogni errore.
- **Se dimentichi il PIN non c'è modo di recuperarlo.** L'unica strada è *Hai dimenticato il PIN? → Cancella i dati*, e poi ripristinare l'ultimo backup. Per questo conviene tenere sempre un backup recente.

## 6. Aggiornare l'app

Quando il codice cambia su GitHub (`git push` sul ramo `main`), GitHub ripubblica l'app da solo in 1–2 minuti. Alla prossima apertura l'app mostra **"Nuova versione disponibile"**: tocca **Aggiorna ora**. I dati sul telefono non vengono toccati.

## Uso quotidiano, in breve

- **+** in basso: nuova spesa. Scrivi l'importo, scegli il pocket e la categoria, e tocca **Salva**. Per le spese da un pocket Revolut vedi in anteprima l'arrotondamento che va ai Savings; puoi toccarlo per disattivarlo su quel movimento.
- **Piano**: quando arriva lo stipendio scrivi l'importo. Il piano registra da solo Fondo Pensione e Piano Accumulo, ti mostra la checklist di cosa spostare dove e quanto puoi mettere da parte.
- **Movimenti**: tocca un movimento per modificarlo, scorri a sinistra per eliminarlo. Subito dopo compare **Annulla**.
- **L'occhio** in Home nasconde tutti gli importi.

---

## Per chi sviluppa

Stack: Vite, Svelte 5 e TypeScript; IndexedDB tramite `idb`; SheetJS per l'Excel, incluso nel bundle; vite-plugin-pwa (Workbox). Nessuna chiamata esterna e Content Security Policy restrittiva.

```
npm install
npm run dev        # sviluppo (http://localhost:5173)
npm test           # test unitari
npm run e2e        # test end-to-end (Playwright)
npm run check      # controllo dei tipi
npm run build      # build di produzione in dist/
```

Pagine di sviluppo, escluse dalla build: `/design-system.html` e `/confronto.html`.

La verifica dell'importer sul file reale si trova in `local/` (esclusa da git): `npx vitest run --config local/vitest.config.ts`.

Regole per non perdere mai dati:
- lo schema del database cambia solo aggiungendo una migrazione in fondo a `src/lib/db/schema.ts`;
- il formato del backup cambia solo aggiungendo una migrazione in `src/lib/backup/format.ts`;
- le migrazioni già pubblicate non si modificano.
