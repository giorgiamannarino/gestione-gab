<!-- Guida all'app: logiche, regole, cosa si può modificare e cosa no. -->
<script lang="ts">
  import { ChevronLeft } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { router } from '../lib/app/router.svelte';
  import { formatCents } from '../lib/domain/money';
  import { recurringAmount } from '../lib/domain/plan';

  const st = $derived(app.data.settings);
  const main = $derived(app.mainPocket?.name ?? 'il conto principale');
  const savings = $derived(app.data.pockets.find((p) => p.role === 'savings')?.name ?? 'Savings');
  const reserve = $derived(app.savingsTarget?.name ?? 'Risparmi');
  const pName = (id?: string) => app.data.pockets.find((p) => p.id === id)?.name ?? '—';
  const eur = (c: number) => formatCents(c);
  const allocations = $derived(app.data.recurring.filter((r) => r.active && r.kind === 'allocation').sort((a, b) => a.order - b.order));
  const debits = $derived(app.data.recurring.filter((r) => r.active && r.kind === 'debit').sort((a, b) => a.order - b.order));
  const modeText = (m?: string) => (m === 'topUp' ? 'ricarica' : m === 'reserve' ? 'riserva' : 'pieno');
</script>

<div class="page">
  <header class="head">
    <button class="back" onclick={() => router.back('/riepilogo')} aria-label="Indietro"><ChevronLeft size={22} /></button>
    <h1 class="t-title-1">Come funziona</h1>
  </header>
  <p class="c-2">Tocca una sezione per aprirla. Dove serve trovi i tuoi valori attuali.</p>

  <details open>
    <summary>L'idea di base</summary>
    <p>L'app tiene una sola storia continua: i saldi di partenza e tutti i movimenti dal primo giorno. Non c'è nessun azzeramento a fine mese.</p>
    <p>I <strong>saldi non vengono mai salvati</strong>: ogni volta si calcolano come saldo iniziale più tutti i movimenti. Per questo non si modificano a mano: se un saldo non torna si usa la <strong>rettifica</strong>.</p>
    <p>Il <strong>periodo</strong> va dal giorno {st.salaryDay} al giorno {st.salaryDay - 1 || 'prima'} del mese dopo: è solo un modo di guardare i dati (statistiche, piano, riepilogo), non chiude nulla.</p>
    <p>Tutto resta su questo telefono. Niente account, niente server: per questo il <strong>backup</strong> è importante.</p>
  </details>

  <details>
    <summary>Pocket e gruppi</summary>
    <p>Ogni conto o salvadanaio è un <strong>pocket</strong>, raccolto in un <strong>gruppo</strong> (es. Intesa, Generali, Investimenti, Revolut). La Home mostra il totale di ogni gruppo e il patrimonio complessivo.</p>
    <p>Ruoli speciali: <strong>{main}</strong> è il conto dove arriva lo stipendio; <strong>{savings}</strong> riceve gli arrotondamenti; <strong>{reserve}</strong> riceve il risparmio proposto dal Piano; i pocket investimento mostrano il "versato".</p>
    <p>Un pocket archiviato sparisce da Home e inserimento, ma la sua storia resta.</p>
  </details>

  <details>
    <summary>Inserire un movimento</summary>
    <p>Il pulsante <strong>+</strong> apre l'inserimento rapido: importo col tastierino, pocket, categoria, e salva. Tre tipi: <strong>uscita</strong>, <strong>entrata</strong> e <strong>giroconto</strong> (anche verso più pocket insieme).</p>
    <p>Scrivendo una descrizione già usata, pocket e categoria si compilano da soli. Data e nota sono in "Data e nota" (oggi è già impostato).</p>
    <p>Dopo ogni salvataggio compare <strong>Annulla</strong> per qualche secondo. In Movimenti: tocca per modificare, scorri a sinistra per eliminare.</p>
  </details>

  <details>
    <summary>Arrotondamento Revolut</summary>
    <p>Per ogni <strong>uscita da un pocket Revolut</strong> l'app aggiunge un arrotondamento verso {savings}, tolto dal pocket che ha pagato:</p>
    <ul>
      <li>12,30 € → 0,70 € (fino all'euro successivo)</li>
      <li>18,00 € → 1,00 € (importo tondo: sempre 1 €)</li>
    </ul>
    <p>Non si applica a entrate, giroconti, rettifiche e pocket non Revolut. Prima di salvare vedi l'anteprima ("+0,70 € ai {savings}") e puoi toccarla per <strong>disattivarla su quel movimento</strong> (es. un rimborso). Se modifichi o elimini l'uscita, l'arrotondamento si aggiorna o sparisce da solo.</p>
  </details>

  <details>
    <summary>Il Piano di inizio mese</summary>
    <p>Quando arriva lo stipendio lo scrivi nel Piano. L'app registra l'entrata su {main} e, da soli, gli spostamenti <strong>automatici</strong>. Poi ti mostra una checklist: spuntando una voce registri il giroconto.</p>
    <p>Ogni spostamento ha una <strong>modalità</strong>:</p>
    <ul>
      <li><strong>Pieno</strong>: sposta sempre l'importo intero.</li>
      <li><strong>Ricarica</strong>: sposta solo quanto manca rispetto a quello che è rimasto sul pocket prima dello stipendio. Se basta già: "già a posto".</li>
      <li><strong>Riserva</strong>: se nel periodo prima non è stato preso nulla sposta metà; se è stato preso meno dell'importo reintegra quanto preso più un extra; altrimenti reintegra quanto preso.</li>
    </ul>
    {#if allocations.length}
      <p>Le tue voci:</p>
      <ul class="values">
        {#each allocations as r (r.id)}
          <li>{r.name}: {eur(recurringAmount(r, app.data.recurring, app.data.pockets))} → {pName(r.toPocketId)} · {modeText(r.mode)}{r.mode === 'reserve' ? ` (extra ${eur(r.reserveExtra ?? 10000)})` : ''}{r.auto ? ' · automatico' : ''}</li>
        {/each}
      </ul>
    {/if}
    <p><strong>Puoi mettere da parte</strong> = stipendio − fissi e pocket − la parte di margine di sicurezza{st.safetyMargin ? ` (${eur(st.safetyMargin)})` : ''} non già coperta. Viene proposto come giroconto verso {reserve}.</p>
    <p>Quello che era rimasto su {main} prima dello stipendio conta per il margine: con margine 50 € e 20 € rimasti, dallo stipendio se ne tengono solo 30. Se ne erano rimasti 60, 50 restano come margine e i 10 in più li puoi aggiungere al risparmio.</p>
    <p>Abbonamenti: l'importo si calcola da solo sommando gli addebiti del pocket più i loro arrotondamenti, così non va mai in rosso.</p>
  </details>

  <details>
    <summary>Addebiti da confermare</summary>
    <p>Le voci fisse con un giorno (abbonamenti, DAS, versamenti di FP e PAC) compaiono in Home in <strong>Da confermare</strong> dal loro giorno in poi, finché non le confermi con un tocco. Se hanno un pocket di destinazione diventano un giroconto (es. Generali → Fondo Pensione), altrimenti una spesa.</p>
    {#if debits.length}
      <ul class="values">
        {#each debits as r (r.id)}
          <li>{r.name}: {eur(r.amount)} · giorno {r.day} · {pName(r.fromPocketId)}{r.toPocketId ? ` → ${pName(r.toPocketId)}` : ''}</li>
        {/each}
      </ul>
    {/if}
  </details>

  <details>
    <summary>Budget, bollette, investimenti</summary>
    <p><strong>Budget</strong> (es. benzina): è una somma che resta su {main}. Le spese le inserisci a mano con la sua categoria; in Home vedi quanto resta.</p>
    <p><strong>Fondo bollette</strong>: in Home vedi se copre la prossima bolletta stimata{st.nextBill ? ` (${eur(st.nextBill.amount)})` : ''}.</p>
    <p><strong>Investimenti</strong>: il saldo è il "versato". In Statistiche puoi aggiungere il <strong>valore reale</strong> preso dall'app di Generali e confrontarlo col versato mese per mese.</p>
  </details>

  <details>
    <summary>Oggi puoi spendere, scadenze, etichette</summary>
    <p><strong>Oggi puoi spendere</strong> (pocket scelto in Impostazioni → Stipendio e piano): il budget del periodo è diviso in una quota al giorno. Quello che non hai speso nei giorni prima si somma a oggi, quello che hai speso in più si toglie. Verde: oggi hai almeno la quota piena. Arancio: un po' meno, perché nei giorni prima sei andato oltre. Se sei sotto il programma compare "Attenzione, stai spendendo più di quanto programmato in questi giorni", finché non torni in pari. Il 23 riparte da capo; dopo la ricarica del pocket nel Piano la quota si aggiorna.</p>
    <p><strong>Scadenze</strong> (Impostazioni → Spese fisse → Scadenze): per bollo, assicurazione, università… l'importo si divide tra gli stipendi che arrivano prima della scadenza. A ogni stipendio, fino all'ultimo prima del pagamento, la quota compare nella checklist del Piano sotto Scadenze; se uno stipendio salti la spunta, la parte mancante si spalma sugli stipendi successivi. Il pagamento compare in Da confermare dai 7 giorni prima e scala l'importo dal pocket dove hai accantonato; se è annuale passa all'anno dopo e l'accantonamento riparte.</p>
    <p><strong>Etichette</strong>: in "Data e nota" puoi dare un'etichetta a un movimento (es. "Weekend Roma"). In Statistiche vedi ogni evento con il totale speso e i suoi movimenti.</p>
  </details>

  <details>
    <summary>Statistiche e riepilogo</summary>
    <p>Le statistiche contano solo le <strong>uscite</strong>. Giroconti, arrotondamenti e rettifiche non sono spese e sono esclusi. Il Riepilogo (tocca "Patrimonio totale" in Home) racconta il periodo a parole.</p>
  </details>

  <details>
    <summary>Rettifiche e allinea i saldi</summary>
    <p>Se un saldo nell'app non coincide con quello della banca, in <strong>Impostazioni → Allinea i saldi</strong> scrivi il saldo reale: l'app crea un movimento di rettifica per la differenza. La rettifica è esclusa dalle statistiche e si può eliminare come ogni movimento.</p>
  </details>

  <details>
    <summary>Backup, blocco, promemoria</summary>
    <p><strong>Backup</strong>: un file con tutto, basta sempre l'ultimo. Salvalo su iCloud Drive dal menu di condivisione, anche con password. Il ripristino riporta l'app esattamente a quel momento. In Home vedi da quanto non lo fai e quanti movimenti mancano.</p>
    <p><strong>Blocco</strong>: PIN di 6 cifre ed eventualmente Face ID. Il PIN non si recupera: se lo dimentichi l'unica strada è cancellare i dati e ripristinare un backup.</p>
    <p><strong>Promemoria</strong>: dopo le 20, se oggi non hai inserito movimenti, l'app te lo ricorda. Per la notifica con l'app chiusa usa l'automazione di Comandi Rapidi (Impostazioni → Promemoria).</p>
    <p>L'<strong>occhio</strong> in Home nasconde tutti gli importi.</p>
  </details>

  <details>
    <summary>Cosa si può modificare e cosa no</summary>
    <table>
      <thead><tr><th>Si può modificare</th><th>Non si modifica direttamente</th></tr></thead>
      <tbody>
        <tr><td>Movimenti: importo, pocket, categoria, data, nota, arrotondamento sì/no</td><td>Saldi: si calcolano sempre (si correggono con una rettifica)</td></tr>
        <tr><td>Pocket: nome, gruppo, colore, icona, Revolut, Savings, archivio</td><td>Saldi iniziali: arrivano dall'import (si correggono con Allinea i saldi)</td></tr>
        <tr><td>Categorie: nome, icona, colore, archivio</td><td>Regola dell'arrotondamento (solo disattivabile per singola uscita)</td></tr>
        <tr><td>Spese fisse: importi, giorni, modalità, automatico, attiva</td><td>Arrotondamenti: seguono la loro uscita, non si modificano da soli</td></tr>
        <tr><td>Giorno dello stipendio, margine di sicurezza, prossima bolletta</td><td>Categorie di sistema: Giroconto, Rettifica, Arrotondamento</td></tr>
        <tr><td>Aspetto, promemoria, blocco e tempo di blocco</td><td>Il PIN dimenticato: non si recupera</td></tr>
      </tbody>
    </table>
  </details>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: calc(var(--sp-2) + env(safe-area-inset-top)) var(--gutter) var(--sp-7);
    line-height: 1.55;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin-top: var(--sp-2);
  }
  .back {
    width: var(--tap);
    height: var(--tap);
    margin-left: calc(-1 * var(--sp-2));
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  details {
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
    padding: 0 var(--sp-4);
  }
  summary {
    min-height: 56px;
    display: flex;
    align-items: center;
    font-weight: var(--fw-bold);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '+';
    margin-left: auto;
    font-size: 1.25rem;
    color: var(--text-3);
  }
  details[open] summary::after {
    content: '−';
  }
  details > :not(summary) {
    margin: 0 0 var(--sp-3);
    color: var(--text-2);
  }
  details > :last-child {
    padding-bottom: var(--sp-2);
  }
  strong {
    color: var(--text);
  }
  ul {
    padding-left: var(--sp-5);
  }
  .values {
    font-size: var(--fs-callout);
    font-variant-numeric: tabular-nums;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-callout);
  }
  th {
    text-align: left;
    color: var(--text);
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
    vertical-align: bottom;
  }
  td {
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
    border-top: 1px solid var(--hairline);
    vertical-align: top;
  }
</style>
