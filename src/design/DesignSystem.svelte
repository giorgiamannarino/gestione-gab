<!--
  Design system — direzione "Notte". Tutti i dati sono INVENTATI.
-->
<script lang="ts">
  import {
    Car,
    CloudUpload,
    Coins,
    Eye,
    EyeOff,
    Heart,
    Landmark,
    PiggyBank,
    ReceiptEuro,
    Repeat,
    Settings,
    ShoppingCart,
    Sofa,
    Sparkles,
    Utensils,
    Fuel,
    Gift,
  } from '@lucide/svelte';
  import Amount from '../ui/Amount.svelte';
  import BottomSheet from '../ui/BottomSheet.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Chip from '../ui/Chip.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import IconTile from '../ui/IconTile.svelte';
  import InlineMessage from '../ui/InlineMessage.svelte';
  import Keypad from '../ui/Keypad.svelte';
  import ListRow from '../ui/ListRow.svelte';
  import ProgressBar from '../ui/ProgressBar.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import TabBar, { type Tab } from '../ui/TabBar.svelte';
  import TextField from '../ui/TextField.svelte';
  import Toaster from '../ui/Toaster.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import BarList from '../ui/charts/BarList.svelte';
  import ColumnChart from '../ui/charts/ColumnChart.svelte';
  import LineChart from '../ui/charts/LineChart.svelte';
  import StackBar from '../ui/charts/StackBar.svelte';
  import { keypadToCents } from '../lib/domain/keypad';
  import { formatCents } from '../lib/domain/money';
  import { roundupFor } from '../lib/domain/roundup';
  import { privacy, togglePrivacy } from '../lib/ui/privacy.svelte';
  import { showToast } from '../lib/ui/toast.svelte';

  // ── Tema ──
  type Theme = 'auto' | 'light' | 'dark';
  let theme = $state<Theme>('auto');
  $effect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    // Rilegge i token dopo il cambio tema.
    requestAnimationFrame(() => (tokenTick += 1));
  });

  // ── Lettura token e contrasto ──
  let tokenTick = $state(0);
  function readToken(name: string): string {
    void tokenTick;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function lum(hex: string): number | null {
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return null;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255).map((v) =>
      v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  }
  function ratio(a: string, b: string): string {
    const [x, y] = [lum(a), lum(b)];
    if (x === null || y === null) return '';
    const [hi, lo] = x > y ? [x, y] : [y, x];
    return `${((hi + 0.05) / (lo + 0.05)).toFixed(1)}:1`;
  }

  const surfaces = ['--bg', '--surface', '--surface-2', '--surface-3'];
  const texts = [
    { token: '--text', use: 'Testo principale' },
    { token: '--text-2', use: 'Testo secondario' },
    { token: '--text-3', use: 'Didascalie, etichette' },
  ];
  const semantic = [
    { token: '--accent', use: 'Accento, azioni' },
    { token: '--positive', use: 'Entrate, conferme' },
    { token: '--negative', use: 'Uscite in rosso, errori' },
    { token: '--warning', use: 'Avvisi, budget superato' },
  ];
  const pockets = [
    { token: '--pk-indaco', name: 'Indaco' },
    { token: '--pk-arancio', name: 'Arancio' },
    { token: '--pk-acqua', name: 'Acqua' },
    { token: '--pk-ocra', name: 'Ocra' },
    { token: '--pk-cielo', name: 'Cielo' },
    { token: '--pk-verde', name: 'Verde' },
    { token: '--pk-viola', name: 'Viola' },
    { token: '--pk-magenta', name: 'Magenta' },
    { token: '--pk-ardesia', name: 'Ardesia (neutro)' },
  ];
  const typeScale = [
    { cls: 't-display', name: 'Display', spec: '44 · Bold', sample: 'Totale' },
    { cls: 't-title-1', name: 'Titolo 1', spec: '28 · Bold', sample: 'Piano di ottobre' },
    { cls: 't-title-2', name: 'Titolo 2', spec: '22 · Bold', sample: 'Movimenti' },
    { cls: 't-title-3', name: 'Titolo 3', spec: '17 · Bold', sample: 'Nuovo movimento' },
    { cls: 't-body', name: 'Corpo', spec: '15 · Medium', sample: 'Spesa al supermercato con la carta Revolut.' },
    { cls: 't-callout', name: 'Nota', spec: '13 · Medium', sample: 'Copre la bolletta di ottobre' },
    { cls: 't-caption', name: 'Didascalia', spec: '12 · Medium', sample: 'Ultimo backup 3 giorni fa' },
    { cls: 't-overline', name: 'Sovratitolo', spec: '11 · Bold · maiuscolo', sample: 'Oggi' },
  ];
  const spacing = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const radii = [
    { token: '--r-xs', px: 8 },
    { token: '--r-sm', px: 10 },
    { token: '--r-md', px: 14 },
    { token: '--r-lg', px: 22 },
    { token: '--r-xl', px: 28 },
  ];

  // ── Stato demo ──
  let wealth = $state(1562640);
  let tab = $state<Tab>('home');
  let seg = $state<'uscita' | 'entrata' | 'giroconto'>('uscita');
  let pocket = $state('pers');
  let category = $state('spesa');
  let desc = $state('');
  let notifications = $state(true);
  let sheetOpen = $state(false);
  let keypadValue = $state('12,3');
  let roundupOn = $state(true);
  let loading = $state(false);

  const pocketChips = [
    { id: 'intesa', label: 'Intesa', color: 'var(--pk-indaco)', revolut: false },
    { id: 'pers', label: 'Personale', color: 'var(--pk-arancio)', revolut: true },
    { id: 'casa', label: 'Casetta', color: 'var(--pk-verde)', revolut: true },
    { id: 'amo', label: 'Amoretti', color: 'var(--pk-magenta)', revolut: true },
    { id: 'auto', label: 'Auto', color: 'var(--pk-ardesia)', revolut: true },
  ];
  const categoryChips = [
    { id: 'spesa', label: 'Spesa', icon: ShoppingCart },
    { id: 'bar', label: 'Bar e ristoranti', icon: Utensils },
    { id: 'carburante', label: 'Carburante', icon: Fuel },
    { id: 'regali', label: 'Regali', icon: Gift },
  ];

  const amountCents = $derived(keypadToCents(keypadValue));
  const isRevolut = $derived(pocketChips.find((p) => p.id === pocket)?.revolut ?? false);
  const roundup = $derived(seg === 'uscita' && isRevolut && roundupOn ? roundupFor(amountCents) : 0);

  function saveDemo() {
    sheetOpen = false;
    showToast(`Uscita di ${formatCents(amountCents)} salvata`, {
      tone: 'success',
      undo: () => {
        showToast('Movimento annullato');
      },
    });
  }

  function fakeLoad() {
    loading = true;
    setTimeout(() => (loading = false), 1400);
  }

  const periodLabels = ['mag', 'giu', 'lug', 'ago', 'set', 'ott'];
</script>

<div class="page">
  <header class="top">
    <p class="t-overline c-3">Proposta di design · 2 di 2</p>
    <h1 class="t-title-1">Design system “Notte”</h1>
    <p class="lead c-2">
      Le fondamenta di tutta l'app: colori, tipografia, spaziature e componenti. Tutto quello che vedi è
      interattivo e usa solo dati inventati.
    </p>
    <div class="theme-switch">
      <Segmented
        label="Tema"
        bind:value={theme}
        options={[
          { value: 'auto', label: 'Automatico' },
          { value: 'light', label: 'Chiaro' },
          { value: 'dark', label: 'Scuro' },
        ]}
      />
    </div>
  </header>

  <!-- ───────── COLORI ───────── -->
  <section class="block" aria-labelledby="s-colori">
    <h2 id="s-colori" class="t-title-2">Colori</h2>
    <p class="intro c-2">
      Palette neutra con un solo accento viola. Accanto a ogni colore c'è il contrasto misurato sul fondo in cui
      viene usato: il minimo è 4,5:1 per il testo e 3:1 per le icone.
    </p>

    <h3 class="t-title-3 sub">Superfici</h3>
    <div class="swatch-grid">
      {#each surfaces as s (s)}
        <div class="swatch">
          <span class="chip-color" style:background="var({s})"></span>
          <p class="sw-name">{s}</p>
          <p class="sw-hex c-3">{readToken(s)}</p>
        </div>
      {/each}
    </div>

    <h3 class="t-title-3 sub">Testo</h3>
    <Card>
      {#each texts as t (t.token)}
        <div class="text-row">
          <span class="text-sample" style:color="var({t.token})">Aa</span>
          <div class="grow">
            <p style:color="var({t.token})" class="t-body">{t.use}</p>
            <p class="t-caption c-3">{t.token} · {readToken(t.token)}</p>
          </div>
          <p class="t-caption c-3 ratio">
            {ratio(readToken(t.token), readToken('--surface'))} card<br />{ratio(readToken(t.token), readToken('--bg'))} fondo
          </p>
        </div>
      {/each}
    </Card>

    <h3 class="t-title-3 sub">Accento e stati</h3>
    <div class="swatch-grid">
      {#each semantic as s (s.token)}
        <div class="swatch">
          <span class="chip-color" style:background="var({s.token})"></span>
          <p class="sw-name">{s.use}</p>
          <p class="sw-hex c-3">{readToken(s.token)} · {ratio(readToken(s.token), readToken('--surface'))}</p>
        </div>
      {/each}
    </div>

    <h3 class="t-title-3 sub">Colori dei pocket</h3>
    <p class="intro c-2">
      Otto tinte tenui in un ordine fisso, verificate perché due colori vicini restino distinguibili anche con
      daltonismo. Sono gli stessi colori di card, chip e grafici. Ardesia è il neutro per i pocket archiviati e la
      voce "Altro".
    </p>
    <div class="pocket-grid">
      {#each pockets as p (p.token)}
        <div class="pocket-sw" style:--c="var({p.token})">
          <span class="pk-tile"><PiggyBank size={18} strokeWidth={1.75} /></span>
          <div>
            <p class="sw-name">{p.name}</p>
            <p class="sw-hex c-3">{readToken(p.token)}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ───────── TIPOGRAFIA ───────── -->
  <section class="block" aria-labelledby="s-tipo">
    <h2 id="s-tipo" class="t-title-2">Tipografia</h2>
    <p class="intro c-2">
      Manrope, un solo font per tutto. Le dimensioni seguono il “Testo più grande” dell'iPhone: se lo aumenti
      nelle Impostazioni, l'app cresce di conseguenza.
    </p>
    <Card>
      {#each typeScale as t (t.cls)}
        <div class="type-row">
          <p class="type-meta t-caption c-3">{t.name}<br />{t.spec}</p>
          <p class={t.cls}>{t.sample}</p>
        </div>
      {/each}
    </Card>

    <h3 class="t-title-3 sub">Importi</h3>
    <Card>
      <p class="t-caption c-3">Il patrimonio usa cifre proporzionali e decimali attenuati. Tocca per animarlo.</p>
      <button class="hero-demo" onclick={() => (wealth += Math.round((Math.random() - 0.3) * 50000))}>
        <Amount cents={wealth} size="display" splitDecimals />
      </button>
      <div class="amount-rows">
        <p class="t-caption c-3">Nelle liste le cifre sono tabulari, così i decimali restano in colonna:</p>
        {#each [123456, 98700, 1230, -4590] as v (v)}
          <div class="amount-row"><span class="c-2">Voce</span><Amount cents={v} tone="auto" /></div>
        {/each}
        <div class="amount-row"><span class="c-2">Entrata</span><Amount cents={234500} signed tone="auto" /></div>
        <div class="amount-row"><span class="c-2">Arrotondamento</span><Amount cents={70} signed size="sm" tone="muted" /></div>
      </div>
    </Card>
  </section>

  <!-- ───────── SPAZI E FORME ───────── -->
  <section class="block" aria-labelledby="s-spazi">
    <h2 id="s-spazi" class="t-title-2">Spaziature e forme</h2>
    <p class="intro c-2">
      Griglia di 8 px, con un mezzo passo da 4 px per i dettagli. Margini laterali di 16 px, aree toccabili di almeno
      44 px, ombre quasi invisibili e nessun bordo pesante.
    </p>
    <Card>
      {#each spacing as s (s)}
        <div class="space-row">
          <span class="t-caption c-3 space-name">--sp-{s}</span>
          <span class="space-bar" style:width="var(--sp-{s})"></span>
          <span class="t-caption c-3">{readToken(`--sp-${s}`)}</span>
        </div>
      {/each}
    </Card>
    <div class="radius-row">
      {#each radii as r (r.token)}
        <div class="radius-item">
          <span class="radius-box" style:border-radius="var({r.token})"></span>
          <p class="t-caption c-3">{r.px}px</p>
        </div>
      {/each}
    </div>
  </section>

  <!-- ───────── COMPONENTI ───────── -->
  <section class="block" aria-labelledby="s-comp">
    <h2 id="s-comp" class="t-title-2">Componenti</h2>

    <h3 class="t-title-3 sub">Pulsanti</h3>
    <div class="stack">
      <Button size="lg" block onclick={fakeLoad} {loading}>Salva movimento</Button>
      <div class="row-wrap">
        <Button>Primario</Button>
        <Button variant="secondary">Secondario</Button>
        <Button variant="ghost">Testo</Button>
        <Button variant="danger">Elimina</Button>
        <Button disabled>Disattivato</Button>
      </div>
      <div class="row-wrap">
        <IconButton icon={privacy.hidden ? EyeOff : Eye} label={privacy.hidden ? 'Mostra importi' : 'Nascondi importi'} onclick={togglePrivacy} />
        <IconButton icon={Settings} label="Impostazioni" />
        <IconButton icon={CloudUpload} label="Backup" variant="plain" />
        <span class="t-caption c-3">← l'occhio attiva la modalità privacy su tutta la pagina</span>
      </div>
    </div>

    <h3 class="t-title-3 sub">Chip</h3>
    <div class="chips">
      {#each pocketChips as p (p.id)}
        <Chip label={p.label} color={p.color} selected={pocket === p.id} onclick={() => (pocket = p.id)} />
      {/each}
    </div>
    <div class="chips">
      {#each categoryChips as c (c.id)}
        <Chip label={c.label} icon={c.icon} color="var(--accent)" selected={category === c.id} onclick={() => (category = c.id)} />
      {/each}
    </div>

    <h3 class="t-title-3 sub">Card e righe</h3>
    <Card title="Revolut">
      {#snippet aside()}<Amount cents={111210} />{/snippet}
      <ListRow title="Savings" subtitle="+3,40 € in questo periodo">
        {#snippet leading()}<IconTile icon={Coins} color="var(--pk-ocra)" />{/snippet}
        {#snippet trailing()}<Amount cents={2460} />{/snippet}
      </ListRow>
      <ListRow title="Personale" subtitle="Spese di piacere" onclick={() => {}}>
        {#snippet leading()}<IconTile icon={Sparkles} color="var(--pk-arancio)" />{/snippet}
        {#snippet trailing()}<Amount cents={28650} />{/snippet}
      </ListRow>
      <ListRow title="Casetta" subtitle="Spesa e casa">
        {#snippet leading()}<IconTile icon={Sofa} color="var(--pk-verde)" />{/snippet}
        {#snippet trailing()}<Amount cents={21480} />{/snippet}
      </ListRow>
    </Card>

    <h3 class="t-title-3 sub">Movimenti</h3>
    <Card padded={false}>
      <div class="day-head"><p class="t-overline c-3">Oggi</p><Amount cents={-4260} size="sm" tone="muted" /></div>
      <div class="tx-list">
        <ListRow title="Supermercato" subtitle="Casetta · Spesa">
          {#snippet leading()}<IconTile icon={ShoppingCart} color="var(--pk-verde)" />{/snippet}
          {#snippet trailing()}
            <Amount cents={-1800} tone="auto" />
            <p class="t-caption c-3">+1,00 € Savings</p>
          {/snippet}
        </ListRow>
        <ListRow title="Bar lavoro" subtitle="Personale · Bar e ristoranti">
          {#snippet leading()}<IconTile icon={Utensils} color="var(--pk-arancio)" />{/snippet}
          {#snippet trailing()}<Amount cents={-460} tone="auto" />{/snippet}
        </ListRow>
        <ListRow title="Stipendio" subtitle="Intesa · Entrata">
          {#snippet leading()}<IconTile icon={Landmark} color="var(--pk-indaco)" />{/snippet}
          {#snippet trailing()}<Amount cents={234500} signed tone="auto" />{/snippet}
        </ListRow>
        <ListRow title="Giro Revolut" subtitle="Intesa → 5 pocket">
          {#snippet leading()}<IconTile icon={Repeat} color="var(--pk-ardesia)" />{/snippet}
          {#snippet trailing()}<Amount cents={93700} tone="muted" />{/snippet}
        </ListRow>
      </div>
    </Card>

    <h3 class="t-title-3 sub">Avanzamento</h3>
    <Card>
      <div class="progress-demo">
        <div class="progress-head"><span class="c-2">Benzina</span><span class="t-callout c-3"><strong class="strong">38,00 €</strong> rimasti di 90,00 €</span></div>
        <ProgressBar value={5200} max={9000} color="var(--pk-indaco)" label="Budget benzina" />
      </div>
      <div class="progress-demo">
        <div class="progress-head"><span class="c-2">Benzina</span><span class="t-callout warn">Superato di 6,00 €</span></div>
        <ProgressBar value={9600} max={9000} label="Budget benzina superato" />
      </div>
    </Card>

    <h3 class="t-title-3 sub">Campi e interruttori</h3>
    <Card>
      <div class="stack">
        <Segmented
          label="Tipo di movimento"
          bind:value={seg}
          options={[
            { value: 'uscita', label: 'Uscita' },
            { value: 'entrata', label: 'Entrata' },
            { value: 'giroconto', label: 'Giroconto' },
          ]}
        />
        <TextField label="Descrizione" placeholder="Es. Supermercato" bind:value={desc} hint="Scrivendo una voce già usata, pocket e categoria si compilano da soli." />
        <TextField label="Saldo reale" value="1.204,3O" error="Controlla l'importo: sembra esserci una lettera." />
        <Toggle label="Promemoria settimanale" description="Ogni domenica ti ricordo di fare il backup." bind:checked={notifications} />
      </div>
    </Card>

    <h3 class="t-title-3 sub">Messaggi</h3>
    <div class="stack">
      <InlineMessage tone="info" title="Nuova versione disponibile">
        I tuoi dati restano dove sono.
        {#snippet action()}<Button variant="secondary">Aggiorna ora</Button>{/snippet}
      </InlineMessage>
      <InlineMessage tone="success">Backup salvato su iCloud Drive.</InlineMessage>
      <InlineMessage tone="warning" title="Backup vecchio di 34 giorni">Salvane uno nuovo: basta un tocco.</InlineMessage>
      <InlineMessage tone="error" title="Il file non è un backup valido">
        Sembra un file diverso da quelli creati dall'app. Nessun dato è stato modificato.
      </InlineMessage>
    </div>

    <h3 class="t-title-3 sub">Lista vuota</h3>
    <Card>
      <EmptyState icon={ReceiptEuro} title="Nessun movimento qui" text="Prova a cambiare i filtri, oppure aggiungi una spesa con il pulsante +.">
        {#snippet action()}<Button variant="secondary">Rimuovi i filtri</Button>{/snippet}
      </EmptyState>
    </Card>

    <h3 class="t-title-3 sub">Inserimento rapido e toast</h3>
    <p class="intro c-2">
      Apri il pannello, componi l'importo col tastierino e salva: compare il toast con “Annulla” al posto di un popup
      di conferma.
    </p>
    <Button size="lg" block onclick={() => (sheetOpen = true)}>Prova l'inserimento rapido</Button>
  </section>

  <!-- ───────── GRAFICI ───────── -->
  <section class="block" aria-labelledby="s-grafici">
    <h2 id="s-grafici" class="t-title-2">Grafici</h2>
    <p class="intro c-2">
      Segni sottili e griglie leggere. I colori sono quelli dei pocket e c'è sempre un'etichetta di testo accanto,
      così nessuna informazione dipende solo dal colore. Tocca o trascina per leggere i valori.
    </p>
    <div class="stack">
      <Card title="Patrimonio per gruppo">
        <StackBar
          title="Composizione del patrimonio"
          segments={[
            { id: 'inv', label: 'Investimenti', value: 700000, color: 'var(--pk-viola)' },
            { id: 'gen', label: 'Generali', value: 631000, color: 'var(--pk-acqua)' },
            { id: 'rev', label: 'Revolut', value: 111210, color: 'var(--pk-arancio)' },
            { id: 'isp', label: 'Intesa', value: 120430, color: 'var(--pk-indaco)' },
          ]}
        />
      </Card>
      <Card title="Spese per categoria · settembre">
        <BarList
          items={[
            { id: 'spesa', label: 'Spesa', value: 31240, color: 'var(--pk-verde)', icon: ShoppingCart, detail: '9 movimenti' },
            { id: 'bar', label: 'Bar e ristoranti', value: 18620, color: 'var(--pk-arancio)', icon: Utensils },
            { id: 'carb', label: 'Carburante', value: 8800, color: 'var(--pk-indaco)', icon: Fuel },
            { id: 'abb', label: 'Abbonamenti', value: 3700, color: 'var(--pk-cielo)', icon: Repeat },
            { id: 'amo', label: 'Regali', value: 2600, color: 'var(--pk-magenta)', icon: Heart },
          ]}
        />
      </Card>
      <Card title="Spese totali per periodo">
        <ColumnChart
          title="Spese totali negli ultimi sei periodi"
          data={[
            { label: 'mag', value: 84210 },
            { label: 'giu', value: 102340 },
            { label: 'lug', value: 91820 },
            { label: 'ago', value: 121560 },
            { label: 'set', value: 88400 },
            { label: 'ott', value: 64960, fullLabel: 'Periodo corrente' },
          ]}
        />
      </Card>
      <Card title="Fondo Pensione">
        <LineChart
          title="Fondo Pensione: versato e valore reale"
          labels={periodLabels}
          series={[
            { id: 'versato', name: 'Versato', color: 'var(--pk-viola)', values: [270000, 280000, 290000, 300000, 310000, 320000], area: true },
            { id: 'valore', name: 'Valore reale', color: 'var(--pk-cielo)', values: [268500, 283100, null, 305200, 318900, 331400] },
          ]}
        />
      </Card>
      <Card>
        <p class="t-caption c-3">Esempio di stato vuoto in un grafico:</p>
        <EmptyState icon={Car} title="Ancora nessuna valutazione" text="Inserisci il valore dall'app di Generali per vederlo accanto al versato." />
      </Card>
    </div>
  </section>

  <!-- ───────── NAVIGAZIONE ───────── -->
  <section class="block" aria-labelledby="s-nav">
    <h2 id="s-nav" class="t-title-2">Navigazione</h2>
    <p class="intro c-2">Quattro tab e il pulsante + al centro, sempre raggiungibile col pollice.</p>
    <div class="tabbar-demo">
      <TabBar active={tab} onnavigate={(t) => (tab = t)} onadd={() => (sheetOpen = true)} />
    </div>
  </section>

  <!-- ───────── MOVIMENTO ───────── -->
  <section class="block" aria-labelledby="s-mov">
    <h2 id="s-mov" class="t-title-2">Movimento</h2>
    <Card>
      <ul class="motion-list c-2">
        <li><strong class="strong">120 ms</strong> pressione dei tasti, feedback immediato</li>
        <li><strong class="strong">200 ms</strong> cambi di stato (chip, interruttori)</li>
        <li><strong class="strong">320 ms</strong> pannelli, schermate, barre</li>
        <li><strong class="strong">600 ms</strong> saldi che si aggiornano</li>
        <li>Con “Riduci movimento” attivo sull'iPhone le animazioni si spengono.</li>
      </ul>
    </Card>
  </section>
</div>

<BottomSheet bind:open={sheetOpen} title="Nuovo movimento">
  <div class="qa">
    <Segmented
      label="Tipo di movimento"
      bind:value={seg}
      options={[
        { value: 'uscita', label: 'Uscita' },
        { value: 'entrata', label: 'Entrata' },
        { value: 'giroconto', label: 'Giroconto' },
      ]}
    />
    <div class="qa-amount" aria-live="polite">
      <Amount cents={amountCents} size="display" animate={false} />
      {#if roundup > 0}
        <button class="roundup" onclick={() => (roundupOn = false)} aria-label="Disattiva arrotondamento">
          <Coins size={14} strokeWidth={2} /> +{formatCents(roundup)} ai Savings <span class="x">×</span>
        </button>
      {:else if seg === 'uscita' && isRevolut && !roundupOn}
        <button class="roundup off" onclick={() => (roundupOn = true)}>Arrotondamento disattivato · riattiva</button>
      {/if}
    </div>
    <div class="chips scroll">
      {#each pocketChips as p (p.id)}
        <Chip label={p.label} color={p.color} selected={pocket === p.id} onclick={() => (pocket = p.id)} />
      {/each}
    </div>
    <div class="chips scroll">
      {#each categoryChips as c (c.id)}
        <Chip label={c.label} icon={c.icon} color="var(--accent)" selected={category === c.id} onclick={() => (category = c.id)} />
      {/each}
    </div>
    <Keypad bind:value={keypadValue} />
    <Button size="lg" block disabled={amountCents === 0} onclick={saveDemo}>Salva</Button>
  </div>
</BottomSheet>

<Toaster offset="24px" />

<style>
  .page {
    /* I nomi dei token ("--text") non devono diventare trattini lunghi. */
    font-variant-ligatures: none;
    max-width: 640px;
    margin: 0 auto;
    padding: calc(var(--sp-7) + env(safe-area-inset-top)) var(--gutter) var(--sp-9);
  }
  .top {
    margin-bottom: var(--sp-7);
  }
  .top h1 {
    margin: var(--sp-2) 0 var(--sp-3);
  }
  .lead {
    margin-bottom: var(--sp-5);
  }
  .block {
    padding: var(--sp-7) 0;
    border-top: 1px solid var(--hairline);
  }
  .intro {
    margin: var(--sp-2) 0 var(--sp-4);
    font-size: var(--fs-callout);
  }
  .sub {
    margin: var(--sp-6) 0 var(--sp-3);
  }
  .block > h2 + .sub {
    margin-top: var(--sp-4);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .row-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }
  .grow {
    flex: 1;
  }
  .strong {
    color: var(--text);
    font-weight: var(--fw-bold);
  }
  .warn {
    color: var(--warning);
    font-weight: var(--fw-bold);
  }

  /* Colori */
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--sp-3);
  }
  .swatch {
    padding: var(--sp-3);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .chip-color {
    display: block;
    height: 48px;
    border-radius: var(--r-sm);
    box-shadow: inset 0 0 0 1px var(--hairline-strong);
    margin-bottom: var(--sp-2);
  }
  .sw-name {
    font-size: var(--fs-callout);
    font-weight: var(--fw-bold);
  }
  .sw-hex,
  .sw-name {
    font-variant-ligatures: none;
  }
  .sw-hex {
    font-size: var(--fs-caption);
    font-variant-numeric: tabular-nums;
  }
  .text-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-height: 56px;
  }
  .text-row + .text-row {
    border-top: 1px solid var(--hairline);
  }
  .text-sample {
    width: 40px;
    font-size: var(--fs-title-2);
    font-weight: var(--fw-bold);
  }
  .ratio {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .pocket-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--sp-2);
  }
  .pocket-sw {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .pk-tile {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
    position: relative;
  }
  .pk-tile::after {
    content: '';
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid var(--surface);
  }

  /* Tipografia */
  .type-row {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: baseline;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
  }
  .type-row + .type-row {
    border-top: 1px solid var(--hairline);
  }
  .type-meta {
    line-height: 1.3;
  }
  .hero-demo {
    display: block;
    margin: var(--sp-3) 0 var(--sp-4);
    text-align: left;
  }
  .amount-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding-top: var(--sp-3);
    border-top: 1px solid var(--hairline);
  }
  .amount-row {
    display: flex;
    justify-content: space-between;
    min-height: 32px;
    align-items: center;
  }

  /* Spazi */
  .space-row {
    display: grid;
    grid-template-columns: 56px 1fr 40px;
    align-items: center;
    gap: var(--sp-3);
    min-height: 28px;
  }
  .space-bar {
    height: 12px;
    border-radius: 3px;
    background: var(--accent);
    opacity: 0.8;
  }
  .radius-row {
    display: flex;
    gap: var(--sp-3);
    margin-top: var(--sp-4);
    flex-wrap: wrap;
  }
  .radius-item {
    text-align: center;
  }
  .radius-box {
    display: block;
    width: 64px;
    height: 64px;
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring), inset 0 0 0 1px var(--hairline-strong);
    margin-bottom: var(--sp-1);
  }

  /* Componenti */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-bottom: var(--sp-2);
  }
  .chips.scroll {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 calc(-1 * var(--sp-5));
    padding: 2px var(--sp-5);
    scrollbar-width: none;
  }
  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-3) var(--sp-4) 0;
  }
  .tx-list {
    padding: 0 var(--sp-4) var(--sp-2);
  }
  .progress-demo + .progress-demo {
    margin-top: var(--sp-4);
  }
  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--sp-2);
    font-size: var(--fs-callout);
  }
  .tabbar-demo {
    border-radius: var(--r-lg);
    overflow: hidden;
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .motion-list {
    margin: 0;
    padding-left: var(--sp-5);
    display: grid;
    gap: var(--sp-2);
    font-size: var(--fs-callout);
  }

  /* Inserimento rapido */
  .qa {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .qa-amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3) 0 var(--sp-1);
    min-height: 104px;
  }
  .roundup {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 var(--sp-3);
    border-radius: var(--r-full);
    font-size: var(--fs-callout);
    font-weight: var(--fw-bold);
    color: var(--pk-ocra);
    background: color-mix(in srgb, var(--pk-ocra) 12%, var(--surface));
    position: relative;
  }
  .roundup::after {
    content: '';
    position: absolute;
    inset: -6px 0;
  }
  .roundup .x {
    font-weight: var(--fw-regular);
    opacity: 0.7;
  }
  .roundup.off {
    color: var(--text-3);
    background: var(--surface-2);
    font-weight: var(--fw-medium);
  }
</style>
