<script lang="ts">
  import HomeMock from './HomeMock.svelte';

  type Mode = 'entrambi' | 'chiaro' | 'scuro';

  const directions = [
    {
      id: 'a',
      letter: 'A',
      name: 'Nitido',
      font: 'Inter',
      mood: 'Preciso e “svizzero”. Grigi freddi, blu cobalto, cifre compatte. Vicino a N26 e Revolut.',
      accentLight: '#2B59C3',
    },
    {
      id: 'b',
      letter: 'B',
      name: 'Carta',
      font: 'Geist',
      mood: 'Calmo e caldo, da private banking. Neutri color carta, verde bosco, forme morbide e tanto respiro.',
      accentLight: '#1F6F5C',
    },
    {
      id: 'c',
      letter: 'C',
      name: 'Notte',
      font: 'Manrope',
      mood: 'Più deciso e contemporaneo. Grafite profonda, viola, cifre piene. Dà il meglio in modalità scura.',
      accentLight: '#5B4BDB',
    },
  ];

  const swatches = ['--bg', '--surface', '--text', '--accent'];
  const pocketSwatches = ['--c-intesa', '--c-generali', '--c-invest', '--c-pers', '--c-casa', '--c-amo', '--c-auto', '--c-savings'];

  let mode = $state<Mode>('entrambi');
  const themes = $derived(mode === 'entrambi' ? ['light', 'dark'] : mode === 'chiaro' ? ['light'] : ['dark']);
</script>

<div class="page">
  <header class="intro">
    <p class="kicker">Proposta di design · 1 di 2</p>
    <h1>Tre direzioni visive</h1>
    <p class="lead">
      La stessa schermata Home, con gli stessi dati inventati, resa in tre stili. Ogni telefono
      scorre: guarda anche le card in basso. Scegline una (o dimmi cosa prendere da ciascuna) e ne
      faccio il design system completo.
    </p>
    <div class="segmented" role="radiogroup" aria-label="Tema da mostrare">
      {#each ['entrambi', 'chiaro', 'scuro'] as m (m)}
        <button role="radio" aria-checked={mode === m} class:on={mode === m} onclick={() => (mode = m as Mode)}>
          {m[0]!.toUpperCase() + m.slice(1)}
        </button>
      {/each}
    </div>
  </header>

  {#each directions as d (d.id)}
    <section class="direction" aria-labelledby="dir-{d.id}">
      <div class="info">
        <p class="letter" style="color: {d.accentLight}">{d.letter}</p>
        <h2 id="dir-{d.id}">{d.name}</h2>
        <p class="mood">{d.mood}</p>

        <div class="type-sample dir-{d.id} light">
          <p class="type-font">{d.font}</p>
          <p class="type-aa">Aa</p>
          <p class="type-nums">1.234,56 €<br />  987,00 €<br />    12,30 €</p>
          <p class="type-caption">cifre tabulari: i decimali restano in colonna</p>
        </div>

        {#each ['light', 'dark'] as t (t)}
          <div class="swatch-row dir-{d.id} {t}">
            <span class="swatch-label">{t === 'light' ? 'Chiaro' : 'Scuro'}</span>
            <div class="swatches">
              {#each swatches as s (s)}<span class="sw" style="background: var({s})" title={s}></span>{/each}
              <span class="sep"></span>
              {#each pocketSwatches as s (s)}<span class="sw dot" style="background: var({s})" title={s}></span>{/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="phones">
        {#each themes as t (t)}
          <figure>
            <div class="phone dir-{d.id} {t}"><HomeMock /></div>
            <figcaption>{d.letter} · {t === 'light' ? 'chiaro' : 'scuro'}</figcaption>
          </figure>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  :global(html) {
    background: #e9e9ec;
    color: #16161a;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  :global(body) {
    margin: 0;
  }
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }
  .intro {
    max-width: 720px;
    margin-bottom: 48px;
  }
  .kicker {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6a6a75;
  }
  h1 {
    margin: 8px 0 12px;
    font-size: 40px;
    letter-spacing: -0.03em;
  }
  .lead {
    margin: 0 0 24px;
    font-size: 17px;
    line-height: 1.55;
    color: #45454f;
  }
  .segmented {
    display: inline-flex;
    padding: 4px;
    border-radius: 12px;
    background: #dcdce1;
  }
  .segmented button {
    min-height: 40px;
    padding: 0 18px;
    border: 0;
    border-radius: 9px;
    background: none;
    font: inherit;
    font-weight: 500;
    color: #45454f;
    cursor: pointer;
  }
  .segmented button.on {
    background: #fff;
    color: #16161a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .direction {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 48px;
    padding: 48px 0;
    border-top: 1px solid #d4d4da;
  }
  .letter {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }
  h2 {
    margin: 4px 0 8px;
    font-size: 32px;
    letter-spacing: -0.02em;
  }
  .mood {
    margin: 0 0 24px;
    line-height: 1.55;
    color: #45454f;
  }

  .type-sample {
    padding: 20px;
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    font-family: var(--font);
    margin-bottom: 16px;
  }
  .type-sample p {
    margin: 0;
  }
  .type-font {
    font-size: 13px;
    color: var(--text-3);
  }
  .type-aa {
    font-size: 56px;
    font-weight: var(--hero-weight);
    letter-spacing: -0.04em;
    line-height: 1.1;
  }
  .type-nums {
    margin-top: 8px !important;
    font-size: 20px;
    font-weight: var(--amount-weight);
    font-variant-numeric: tabular-nums;
    white-space: pre;
    text-align: right;
    line-height: 1.35;
  }
  .type-caption {
    margin-top: 8px !important;
    font-size: 12px;
    color: var(--text-3);
  }

  .swatch-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bg);
    margin-bottom: 8px;
  }
  .swatch-label {
    width: 40px;
    flex: none;
    font-size: 12px;
    color: var(--text-3);
  }
  .swatches {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .sw {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.25);
  }
  .sw.dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: none;
  }
  .sep {
    width: 1px;
    height: 16px;
    background: var(--hairline);
    margin: 0 3px;
  }

  .phones {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
  }
  figure {
    margin: 0;
  }
  .phone {
    width: 390px;
    height: 844px;
    border-radius: 48px;
    overflow: hidden;
    box-shadow:
      0 0 0 10px #111114,
      0 0 0 11px #2a2a30,
      0 30px 60px rgba(0, 0, 0, 0.18);
  }
  figcaption {
    margin-top: 24px;
    text-align: center;
    font-size: 13px;
    color: #6a6a75;
  }

  @media (max-width: 1100px) {
    .direction {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }
  @media (max-width: 480px) {
    .page {
      padding: 32px 16px 64px;
    }
    h1 {
      font-size: 32px;
    }
    .phones {
      justify-content: center;
    }
    .phone {
      width: min(390px, calc(100vw - 32px));
      height: 780px;
      border-radius: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
    }
  }
</style>
