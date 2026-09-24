<!--
  Home di prova per il confronto delle direzioni visive.
  Tutti gli importi sono INVENTATI.
-->
<script lang="ts">
  import {
    ArrowRightLeft,
    CalendarCheck,
    Car,
    ChartPie,
    Check,
    ChevronRight,
    CloudUpload,
    Coins,
    Eye,
    Fuel,
    Heart,
    House,
    Landmark,
    PiggyBank,
    Plus,
    Repeat,
    Settings,
    Sofa,
    Sparkles,
    TrendingUp,
    Wallet,
    Zap,
  } from '@lucide/svelte';
  import { amountParts, formatCents } from '../lib/domain/money';

  const intesa = 120430;
  const benzina = { used: 5200, budget: 9000 };
  const generali = { risparmi: 611000, bollette: 20000, prossima: 19000 };
  const investimenti = [
    { name: 'Fondo Pensione', color: '--c-invest', value: 320000, trend: [0.5, 0.56, 0.61, 0.66, 0.74, 0.8, 0.86, 0.93, 1] },
    { name: 'Piano Accumulo', color: '--c-generali', value: 380000, trend: [0.44, 0.52, 0.5, 0.63, 0.7, 0.69, 0.81, 0.9, 1] },
  ];
  const revolut = [
    { name: 'Personale', icon: Sparkles, color: '--c-pers', value: 28650 },
    { name: 'Casetta', icon: Sofa, color: '--c-casa', value: 21480 },
    { name: 'Amoretti', icon: Heart, color: '--c-amo', value: 9500 },
    { name: 'Auto', icon: Car, color: '--c-auto', value: 45000 },
    { name: 'Abbonamenti', icon: Repeat, color: '--c-abb', value: 4120 },
  ];
  const savings = { value: 2460, period: 340 };

  const totGenerali = generali.risparmi + generali.bollette;
  const totInvest = investimenti.reduce((s, p) => s + p.value, 0);
  const totRevolut = revolut.reduce((s, p) => s + p.value, 0) + savings.value;
  const patrimonio = intesa + totGenerali + totInvest + totRevolut;
  const hero = amountParts(patrimonio);

  const benzinaLeft = benzina.budget - benzina.used;
  const benzinaPct = Math.round((benzina.used / benzina.budget) * 100);

  function sparkPath(values: number[], w = 88, h = 28): string {
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - 2 - ((v - min) / span) * (h - 4);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  const eur = (c: number) => formatCents(c);
</script>

<div class="screen">
  <div class="statusbar" aria-hidden="true"><span>9:41</span></div>

  <div class="scroll">
    <header class="topbar">
      <div>
        <p class="eyebrow">Mercoledì 24 settembre</p>
        <h1 class="greeting">Ciao</h1>
      </div>
      <div class="actions">
        <button class="icon-btn" aria-label="Nascondi importi"><Eye size={20} strokeWidth={1.75} /></button>
        <button class="icon-btn" aria-label="Impostazioni"><Settings size={20} strokeWidth={1.75} /></button>
      </div>
    </header>

    <section class="hero" aria-label="Patrimonio totale">
      <p class="label">Patrimonio totale</p>
      <p class="hero-amount">
        <span class="int">{hero.int}</span><span class="dec">,{hero.dec}{hero.symbol}</span>
      </p>
      <p class="hero-meta">
        <span class="delta"><TrendingUp size={14} strokeWidth={2} /> {formatCents(84215, { signed: true })}</span>
        <span class="since">dal 23 settembre</span>
      </p>
    </section>

    <button class="backup-hint">
      <CloudUpload size={16} strokeWidth={1.75} />
      <span>Backup di 3 giorni fa · 4 movimenti da salvare</span>
      <ChevronRight size={16} strokeWidth={1.75} />
    </button>

    <!-- Intesa -->
    <section class="card">
      <div class="row">
        <span class="tile" style="--c: var(--c-intesa)"><Landmark size={18} strokeWidth={1.75} /></span>
        <div class="row-text">
          <p class="row-title">Intesa</p>
          <p class="row-sub">Conto principale</p>
        </div>
        <p class="row-amount">{eur(intesa)}</p>
      </div>
      <div class="budget">
        <div class="budget-head">
          <span class="budget-label"><Fuel size={14} strokeWidth={1.75} /> Benzina</span>
          <span class="budget-value"><strong>{eur(benzinaLeft)}</strong> rimasti di {eur(benzina.budget)}</span>
        </div>
        <div class="bar" role="progressbar" aria-valuenow={benzinaPct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget benzina usato">
          <span style="width: {benzinaPct}%; --c: var(--c-intesa)"></span>
        </div>
      </div>
    </section>

    <!-- Generali -->
    <section class="card">
      <div class="card-head">
        <p class="card-title">Generali</p>
        <p class="card-total">{eur(totGenerali)}</p>
      </div>
      <div class="row">
        <span class="tile" style="--c: var(--c-generali)"><PiggyBank size={18} strokeWidth={1.75} /></span>
        <div class="row-text"><p class="row-title">Risparmi</p></div>
        <p class="row-amount">{eur(generali.risparmi)}</p>
      </div>
      <div class="row">
        <span class="tile" style="--c: var(--c-generali)"><Zap size={18} strokeWidth={1.75} /></span>
        <div class="row-text">
          <p class="row-title">Fondo bollette</p>
          <p class="row-sub ok"><Check size={13} strokeWidth={2.25} /> Copre la bolletta di ottobre</p>
        </div>
        <p class="row-amount">{eur(generali.bollette)}</p>
      </div>
    </section>

    <!-- Investimenti -->
    <section class="card">
      <div class="card-head">
        <p class="card-title">Investimenti</p>
        <p class="card-total">{eur(totInvest)}</p>
      </div>
      <div class="invest-grid">
        {#each investimenti as inv (inv.name)}
          <div class="invest" style="--c: var({inv.color})">
            <p class="invest-name">{inv.name}</p>
            <p class="invest-amount">{eur(inv.value)}</p>
            <svg viewBox="0 0 88 28" class="spark" aria-hidden="true">
              <path d={sparkPath(inv.trend)} />
            </svg>
            <p class="invest-sub">versato</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Revolut -->
    <section class="card">
      <div class="card-head">
        <p class="card-title"><Wallet size={16} strokeWidth={1.75} /> Revolut</p>
        <p class="card-total">{eur(totRevolut)}</p>
      </div>
      <div class="savings" style="--c: var(--c-savings)">
        <span class="tile"><Coins size={18} strokeWidth={1.75} /></span>
        <div class="row-text">
          <p class="row-title">Savings</p>
          <p class="row-sub">{formatCents(savings.period, { signed: true })} in questo periodo</p>
        </div>
        <p class="row-amount">{eur(savings.value)}</p>
      </div>
      <div class="pocket-grid">
        {#each revolut as p (p.name)}
          <div class="pocket" style="--c: var({p.color})">
            <span class="tile small"><p.icon size={16} strokeWidth={1.75} /></span>
            <p class="pocket-name">{p.name}</p>
            <p class="pocket-amount">{eur(p.value)}</p>
          </div>
        {/each}
      </div>
    </section>

    <div class="spacer"></div>
  </div>

  <nav class="tabbar" aria-label="Navigazione principale">
    <a class="tab active" href="#top" aria-current="page"><House size={22} strokeWidth={1.75} /><span>Home</span></a>
    <a class="tab" href="#top"><ArrowRightLeft size={22} strokeWidth={1.75} /><span>Movimenti</span></a>
    <button class="fab" aria-label="Nuovo movimento"><Plus size={26} strokeWidth={2} /></button>
    <a class="tab" href="#top"><CalendarCheck size={22} strokeWidth={1.75} /><span>Piano</span></a>
    <a class="tab" href="#top"><ChartPie size={22} strokeWidth={1.75} /><span>Statistiche</span></a>
  </nav>
</div>

<style>
  .screen {
    position: relative;
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  p,
  h1 {
    margin: 0;
  }
  button {
    font: inherit;
    color: inherit;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .statusbar {
    height: 48px;
    padding: 18px 32px 0;
    font-size: 15px;
    font-weight: 600;
    font-family: system-ui, sans-serif;
  }
  .scroll {
    height: calc(100% - 48px);
    overflow-y: auto;
    padding: 0 16px;
    scrollbar-width: none;
  }
  .spacer {
    height: 112px;
  }

  /* Intestazione */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px 16px;
  }
  .eyebrow {
    font-size: 13px;
    color: var(--text-3);
  }
  .greeting {
    font-size: 22px;
    font-weight: var(--title-weight);
    letter-spacing: -0.02em;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .icon-btn {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text-2);
  }

  /* Patrimonio */
  .hero {
    padding: 16px 4px 24px;
  }
  .label {
    font-size: 13px;
    color: var(--text-3);
    font-weight: 500;
  }
  .hero-amount {
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
    font-weight: var(--hero-weight);
    letter-spacing: var(--hero-tracking);
    line-height: 1.05;
  }
  .hero-amount .int {
    font-size: 44px;
  }
  .hero-amount .dec {
    font-size: 24px;
    color: var(--text-3);
    letter-spacing: -0.02em;
  }
  .hero-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
  }
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    color: var(--positive);
    background: color-mix(in srgb, var(--positive) 12%, transparent);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .since {
    color: var(--text-3);
  }

  .backup-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    margin-bottom: 16px;
    padding: 0 12px;
    font-size: 13px;
    color: var(--text-3);
    border-radius: var(--radius-tile);
    text-align: left;
  }
  .backup-hint span {
    flex: 1;
  }

  /* Card */
  .card {
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow);
    padding: 16px;
    margin-bottom: 12px;
  }
  :global(.dark) .card {
    box-shadow: inset 0 0 0 1px var(--hairline);
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 0 8px;
  }
  .card-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    letter-spacing: 0.01em;
  }
  .card-total {
    font-size: 15px;
    font-weight: var(--amount-weight);
    font-variant-numeric: tabular-nums;
  }

  .row,
  .savings {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
  }
  .row + .row {
    border-top: 1px solid var(--hairline);
  }
  .row-text {
    flex: 1;
    min-width: 0;
  }
  .row-title {
    font-weight: 550;
  }
  .row-sub {
    font-size: 13px;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .row-sub.ok {
    color: var(--positive);
  }
  .row-amount {
    font-weight: var(--amount-weight);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tile {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
  }
  .tile.small {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  /* Budget benzina */
  .budget {
    margin-top: 8px;
    padding: 12px;
    border-radius: var(--radius-tile);
    background: var(--surface-2);
  }
  .budget-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .budget-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
    font-weight: 500;
  }
  .budget-value {
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .budget-value strong {
    color: var(--text);
    font-weight: 600;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
  }

  /* Investimenti */
  .invest-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .invest {
    padding: 12px;
    border-radius: var(--radius-tile);
    background: var(--surface-2);
  }
  .invest-name {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 500;
  }
  .invest-amount {
    margin-top: 2px;
    font-weight: var(--amount-weight);
    font-variant-numeric: tabular-nums;
  }
  .spark {
    display: block;
    width: 100%;
    height: 28px;
    margin-top: 8px;
  }
  .spark path {
    fill: none;
    stroke: var(--c);
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .invest-sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-3);
  }

  /* Revolut */
  .savings {
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: var(--radius-tile);
    background: color-mix(in srgb, var(--c) 10%, var(--surface));
  }
  .savings .tile {
    background: color-mix(in srgb, var(--c) 22%, var(--surface));
  }
  .pocket-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pocket {
    padding: 12px;
    border-radius: var(--radius-tile);
    background: var(--surface-2);
  }
  /* Numero dispari di pocket: l'ultimo occupa tutta la riga, in orizzontale. */
  .pocket:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: 12px;
  }
  .pocket:last-child:nth-child(odd) .pocket-name {
    margin-top: 0;
  }
  .pocket-name {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-2);
    font-weight: 500;
  }
  .pocket-amount {
    font-weight: var(--amount-weight);
    font-variant-numeric: tabular-nums;
  }

  /* Tab bar */
  .tabbar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    padding: 8px 8px 30px;
    background: var(--tabbar);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-top: 1px solid var(--hairline);
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 48px;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    text-decoration: none;
  }
  .tab.active {
    color: var(--accent);
  }
  .fab {
    justify-self: center;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  /* ── Differenze strutturali tra direzioni ── */

  /* A: righe separate da filetti, tile più squadrate */
  :global(.dir-a) .tile {
    border-radius: 10px;
  }

  /* B: patrimonio più arioso, fab circolare */
  :global(.dir-b) .hero {
    padding: 24px 4px 32px;
  }
  :global(.dir-b) .hero-amount .int {
    font-size: 48px;
  }
  :global(.dir-b) .fab {
    border-radius: 50%;
  }
  :global(.dir-b) .tile {
    border-radius: 50%;
  }

  /* C: patrimonio dentro una card con alone d'accento */
  :global(.dir-c) .hero {
    padding: 20px;
    margin-bottom: 8px;
    border-radius: var(--radius-card);
    background: var(--hero-bg);
    box-shadow: var(--shadow);
  }
  :global(.dir-c.dark) .hero {
    box-shadow: inset 0 0 0 1px var(--hairline);
  }
  :global(.dir-c) .greeting {
    font-size: 24px;
    letter-spacing: -0.03em;
  }
</style>
