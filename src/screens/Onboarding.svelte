<script lang="ts">
  import { Check, CloudUpload, FileSpreadsheet, FileJson, HardDrive, Lock, Share, SquarePlus, Wallet } from '@lucide/svelte';
  import { app } from '../lib/app/store.svelte';
  import { saveBackup } from '../lib/app/backup-actions';
  import { formatCents } from '../lib/domain/money';
  import type { AppData } from '../lib/domain/types';
  import { DEFAULT_SETTINGS } from '../lib/domain/types';
  import { ConfigError, DEFAULT_CATEGORIES, SYSTEM_CATEGORIES, parseConfig, type AppConfig } from '../lib/import/config';
  import { buildImport, describeAnomaly, parseSheet, type ImportResult } from '../lib/import/excel';
  import { lock } from '../lib/security/lock.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import AlignBalances from './parts/AlignBalances.svelte';
  import PinPad from './parts/PinPad.svelte';
  import RestorePanel from './parts/RestorePanel.svelte';

  type Step = 'welcome' | 'import' | 'restore' | 'align' | 'install' | 'backup' | 'lock';
  const ORDER: Step[] = ['welcome', 'import', 'align', 'install', 'backup', 'lock'];
  let step = $state<Step>('welcome');
  let mode = $state<'excel' | 'zero'>('excel');
  const index = $derived(Math.max(0, ORDER.indexOf(step)));

  // ── Import ──
  let excelName = $state('');
  let workbook = $state.raw<import('xlsx').WorkBook | null>(null);
  let sheets = $state<string[]>([]);
  let sheet = $state('');
  let config = $state<AppConfig | null>(null);
  let configName = $state('');
  let error = $state('');
  let result = $state<ImportResult | null>(null);
  let busy = $state(false);

  async function onExcel(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    error = '';
    result = null;
    busy = true;
    try {
      const XLSX = await import('xlsx'); // incluso nel bundle, caricato solo qui
      workbook = XLSX.read(await file.arrayBuffer(), { cellFormula: true });
      excelName = file.name;
      sheets = workbook.SheetNames;
      // Proposta: il foglio con più movimenti leggibili.
      let best = { name: sheets[0] ?? '', rows: -1 };
      for (const n of sheets) {
        try {
          const rows = parseSheet(workbook.Sheets[n]!).rows.length;
          if (rows > best.rows) best = { name: n, rows };
        } catch {
          /* foglio non compatibile */
        }
      }
      sheet = best.name;
    } catch {
      error = 'Non riesco a leggere il file Excel. Controlla che sia un .xlsx.';
    } finally {
      busy = false;
    }
  }

  async function onConfig(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    error = '';
    try {
      config = parseConfig(JSON.parse(await file.text()));
      configName = file.name;
    } catch (err) {
      config = null;
      error = err instanceof ConfigError ? err.message : 'Il file di configurazione non è leggibile.';
    }
  }

  function preview() {
    if (!workbook || !config) return;
    try {
      result = buildImport(parseSheet(workbook.Sheets[sheet]!), config, { newId: () => crypto.randomUUID(), now: Date.now() });
      error = '';
    } catch (err) {
      result = null;
      error = (err as Error).message;
    }
  }

  async function confirmImport() {
    if (!result) return;
    busy = true;
    await app.replaceData(result.data);
    busy = false;
    step = 'align';
  }

  async function startFromZero() {
    busy = true;
    const data: AppData = config
      ? {
          groups: config.groups,
          pockets: config.pockets.map((p) => ({ ...p, openingBalance: 0, openingDate: app.today })),
          categories: config.categories,
          transactions: [],
          recurring: config.recurring,
          valuations: [],
          settings: config.settings,
        }
      : {
          groups: [{ id: 'conti', name: 'Conti', order: 0 }],
          pockets: [{ id: 'principale', name: 'Conto principale', groupId: 'conti', color: 'indaco', icon: 'landmark', isRevolut: false, role: 'main', openingBalance: 0, openingDate: app.today, archived: false, order: 0 }],
          categories: [...DEFAULT_CATEGORIES, ...SYSTEM_CATEGORIES],
          transactions: [],
          recurring: [],
          valuations: [],
          settings: { ...DEFAULT_SETTINGS, salaryCategoryId: 'stipendio' },
        };
    await app.replaceData(data);
    busy = false;
    step = 'align';
  }

  const pocketName = (id: string) => result?.data.pockets.find((p) => p.id === id)?.name ?? id;
  const installed = typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

  // ── Blocco ──
  let pinStep = $state<'ask' | 'first' | 'confirm'>('ask');
  let firstPin = '';
  let pinMsg = $state('');
  async function onPin(p: string) {
    if (pinStep === 'first') {
      firstPin = p;
      pinStep = 'confirm';
      pinMsg = '';
    } else if (p === firstPin) {
      await lock.enable(p);
      await finish();
    } else {
      pinStep = 'first';
      pinMsg = 'I due PIN non coincidono. Riprova.';
    }
  }

  async function finish() {
    await app.finishOnboarding();
  }
</script>

<div class="ob">
  {#if step !== 'welcome' && step !== 'restore'}
    <div class="progress" aria-label="Passaggio {index} di {ORDER.length - 1}">
      {#each ORDER.slice(1) as s, i (s)}<span class:on={i < index}></span>{/each}
    </div>
  {/if}

  {#if step === 'welcome'}
    <div class="hero">
      <span class="logo" aria-hidden="true"><Wallet size={36} strokeWidth={1.75} /></span>
      <h1 class="t-title-1">Benvenuto in Conti</h1>
      <p class="c-2">I tuoi soldi, pocket per pocket. Tutto resta su questo telefono: niente account, niente server.</p>
    </div>
    <div class="actions">
      <Button size="lg" block onclick={() => { mode = 'excel'; step = 'import'; }}><FileSpreadsheet size={20} /> Importa il foglio Excel</Button>
      <Button size="lg" variant="secondary" block onclick={() => { mode = 'zero'; step = 'import'; }}>Parti da zero</Button>
      <Button variant="ghost" onclick={() => (step = 'restore')}>Ho già un backup</Button>
    </div>

  {:else if step === 'restore'}
    <h1 class="t-title-2">Ripristina un backup</h1>
    <p class="c-2">Scegli il file salvato su iCloud Drive o nei File.</p>
    <RestorePanel ondone={() => (step = 'install')} />
    <Button variant="ghost" onclick={() => (step = 'welcome')}>Indietro</Button>

  {:else if step === 'import'}
    <h1 class="t-title-2">{mode === 'excel' ? 'Importa i tuoi dati' : 'Parti da zero'}</h1>
    <p class="c-2">
      {mode === 'excel'
        ? 'Il foglio Excel viene letto qui, sul telefono: non viene inviato da nessuna parte.'
        : 'Se hai il file di configurazione, i pocket e le spese fisse sono già pronti. Altrimenti creo un conto principale e il resto lo aggiungi dopo.'}
    </p>
    <div class="files">
      {#if mode === 'excel'}
        <label class="file" class:done={!!excelName}>
          <FileSpreadsheet size={22} strokeWidth={1.75} />
          <span class="grow"><strong>Foglio Excel</strong><span class="c-3 small">{excelName || 'Scegli il file .xlsx'}</span></span>
          {#if excelName}<Check size={18} />{/if}
          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="visually-hidden" onchange={onExcel} />
        </label>
      {/if}
      <label class="file" class:done={!!configName}>
        <FileJson size={22} strokeWidth={1.75} />
        <span class="grow"><strong>Configurazione</strong><span class="c-3 small">{configName || `config-iniziale.json${mode === 'zero' ? ' (facoltativa)' : ''}`}</span></span>
        {#if configName}<Check size={18} />{/if}
        <input type="file" accept=".json,application/json" class="visually-hidden" onchange={onConfig} />
      </label>
    </div>

    {#if mode === 'excel' && sheets.length > 1}
      <label class="select">
        <span class="small c-2">Foglio da importare</span>
        <select bind:value={sheet} onchange={() => (result = null)}>
          {#each sheets as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </label>
    {/if}

    {#if error}<InlineMessage tone="error" title="C'è un problema">{error}</InlineMessage>{/if}

    {#if result}
      <Card>
        <p class="strong">{result.data.transactions.filter((t) => t.kind !== 'roundup').length} movimenti e {result.data.pockets.length} pocket pronti</p>
        {#if result.anomalies.length}
          <p class="c-2 small top">Ho trovato queste incongruenze. Le importo così come sono: al prossimo passo allinei i saldi con quelli reali.</p>
          <ul class="anomalies">
            {#each result.anomalies as a, i (i)}<li>{describeAnomaly(a, pocketName, (c) => formatCents(c))}</li>{/each}
          </ul>
        {/if}
      </Card>
      <Button size="lg" block loading={busy} onclick={confirmImport}>Importa</Button>
    {:else if mode === 'excel'}
      <Button size="lg" block disabled={!workbook || !config || busy} loading={busy} onclick={preview}>Controlla il file</Button>
    {:else}
      <Button size="lg" block loading={busy} onclick={startFromZero}>Continua</Button>
    {/if}
    <Button variant="ghost" onclick={() => (step = 'welcome')}>Indietro</Button>

  {:else if step === 'align'}
    <h1 class="t-title-2">Allinea i saldi</h1>
    <p class="c-2">Apri le app di Intesa, Generali e Revolut e scrivi il saldo reale di ogni pocket. Per ogni differenza creo una rettifica: la storia resta fedele, i saldi di partenza sono quelli veri.</p>
    <Card><AlignBalances cta="Allinea e continua" ondone={() => (step = 'install')} /></Card>
    <Button variant="ghost" onclick={() => (step = 'install')}>Salta per ora</Button>

  {:else if step === 'install'}
    <h1 class="t-title-2">Mettila nella schermata Home</h1>
    {#if installed}
      <InlineMessage tone="success" title="Già installata">Perfetto: l'app si apre a tutto schermo e i dati sono al sicuro.</InlineMessage>
    {:else}
      <p class="c-2">Così si apre come un'app e l'iPhone non cancella i dati quando non la usi per un po'.</p>
      <ol class="steps">
        <li><Share size={20} /> In Safari tocca <strong>Condividi</strong></li>
        <li><SquarePlus size={20} /> Scegli <strong>Aggiungi alla schermata Home</strong></li>
        <li><Check size={20} /> Apri <strong>Conti</strong> dalla nuova icona</li>
      </ol>
    {/if}
    <Button size="lg" block onclick={() => (step = 'backup')}>Continua</Button>

  {:else if step === 'backup'}
    <h1 class="t-title-2">Metti al sicuro i dati</h1>
    <Card>
      <div class="stack">
        <div class="line">
          <HardDrive size={20} strokeWidth={1.75} />
          <span class="grow"><strong>Memoria persistente</strong><span class="c-3 small">{app.persisted ? 'Attiva' : 'Chiedi al telefono di non cancellare i dati'}</span></span>
          {#if app.persisted}<Check size={18} />{:else}<Button variant="secondary" onclick={() => app.requestPersistence()}>Attiva</Button>{/if}
        </div>
        <Toggle label="Promemoria settimanale del backup" checked={app.data.settings.weeklyBackupReminder} onchange={(v) => app.updateSettings({ weeklyBackupReminder: v })} />
      </div>
    </Card>
    <p class="c-2 small">Il backup è un file con tutti i tuoi dati. Salvalo su iCloud Drive: se cambi telefono o qualcosa va storto, lo ripristini in un tocco.</p>
    <Button size="lg" block onclick={async () => { if (await saveBackup()) step = 'lock'; }}><CloudUpload size={18} /> Fai il primo backup</Button>
    <Button variant="ghost" onclick={() => (step = 'lock')}>Più tardi</Button>

  {:else if step === 'lock'}
    {#if pinStep === 'ask'}
      <h1 class="t-title-2">Vuoi un blocco con PIN?</h1>
      <p class="c-2">Protegge da occhi indiscreti quando qualcuno prende il telefono. Puoi attivarlo anche dopo, dalle Impostazioni.</p>
      <InlineMessage tone="warning">Se dimentichi il PIN non si recupera: dovrai cancellare i dati e ripristinare un backup.</InlineMessage>
      <Button size="lg" block onclick={() => (pinStep = 'first')}><Lock size={18} /> Attiva il blocco</Button>
      <Button variant="ghost" onclick={finish}>No, grazie</Button>
    {:else}
      <PinPad title={pinStep === 'first' ? 'Scegli un PIN di 6 cifre' : 'Ripeti il PIN'} message={pinMsg} error={!!pinMsg} oncomplete={onPin} />
      <Button variant="ghost" onclick={finish}>Salta</Button>
    {/if}
  {/if}
</div>

<style>
  .ob {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    max-width: 560px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(var(--sp-6) + env(safe-area-inset-top)) var(--gutter) calc(var(--sp-6) + env(safe-area-inset-bottom));
  }
  .progress {
    display: flex;
    gap: var(--sp-1);
  }
  .progress span {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--surface-3);
  }
  .progress span.on {
    background: var(--accent);
  }
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--sp-3);
  }
  .logo {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 22px;
    background: linear-gradient(160deg, #7a6cf0, #4b3dc0);
    color: #fff;
    margin-bottom: var(--sp-3);
  }
  .actions {
    display: grid;
    gap: var(--sp-3);
  }
  .files {
    display: grid;
    gap: var(--sp-2);
  }
  .file {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 64px;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
    cursor: pointer;
  }
  .file:focus-within {
    outline: 2px solid var(--focus);
  }
  .file.done {
    color: var(--positive);
  }
  .grow {
    flex: 1;
    display: flex;
    flex-direction: column;
    color: var(--text);
  }
  .small {
    font-size: var(--fs-callout);
  }
  .strong {
    font-weight: var(--fw-bold);
  }
  .top {
    margin-top: var(--sp-2);
  }
  .select {
    display: grid;
    gap: 6px;
  }
  .select select {
    min-height: 48px;
    padding: 0 var(--sp-3);
    border: 0;
    border-radius: var(--r-md);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
  }
  .anomalies {
    margin: var(--sp-3) 0 0;
    padding-left: var(--sp-5);
    display: grid;
    gap: var(--sp-2);
    font-size: var(--fs-callout);
    color: var(--text-2);
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--sp-3);
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .steps :global(svg) {
    color: var(--accent-ink);
    flex: none;
  }
  .stack {
    display: grid;
    gap: var(--sp-3);
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
</style>
