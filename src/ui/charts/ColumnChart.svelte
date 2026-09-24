<!--
  Colonne per il confronto tra periodi (una sola serie, nessuna legenda:
  il titolo della card dice cosa si vede). Il periodo corrente è in accento.
  Tocca una colonna per leggerne il valore.
-->
<script lang="ts">
  import { formatCents } from '../../lib/domain/money';
  import { axisLabel, niceTicks } from '../../lib/ui/chart';
  import { privacy } from '../../lib/ui/privacy.svelte';

  interface Datum {
    label: string;
    value: number;
    /** Etichetta estesa per tooltip e lettori di schermo. */
    fullLabel?: string;
  }

  interface Props {
    data: Datum[];
    /** Indice evidenziato (default: l'ultimo). */
    current?: number;
    height?: number;
    title: string;
  }

  let { data, current, height = 176, title }: Props = $props();

  let width = $state(320);
  let selected = $state<number | null>(null);

  const pad = { top: 28, right: 44, bottom: 24, left: 0 };
  const ticks = $derived(niceTicks(Math.max(0, ...data.map((d) => d.value)), 3));
  const top = $derived(ticks.at(-1) ?? 1);
  const plotW = $derived(Math.max(0, width - pad.left - pad.right));
  const plotH = $derived(height - pad.top - pad.bottom);
  const band = $derived(plotW / Math.max(1, data.length));
  const barW = $derived(Math.min(24, band * 0.56));
  const hi = $derived(current ?? data.length - 1);
  const active = $derived(selected ?? hi);

  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const x = (i: number) => pad.left + band * i + band / 2;

  function colPath(i: number, v: number): string {
    const h = Math.max(0, (v / top) * plotH);
    const r = Math.min(4, barW / 2, h);
    const x0 = x(i) - barW / 2;
    const y0 = pad.top + plotH - h;
    const base = pad.top + plotH;
    return `M${x0} ${base} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + barW - r} Q${x0 + barW} ${y0} ${x0 + barW} ${y0 + r} V${base} Z`;
  }
</script>

<figure class="chart" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label={title}>
    {#each ticks as t (t)}
      <line class="grid" x1={pad.left} x2={pad.left + plotW} y1={y(t)} y2={y(t)} />
      <text class="tick" x={width - 2} y={y(t)} dy="0.32em" text-anchor="end">{privacy.hidden ? '•••' : axisLabel(t)}</text>
    {/each}

    {#each data as d, i (i)}
      <path d={colPath(i, d.value)} class="col" class:hi={i === hi} class:dim={selected !== null && i !== selected} />
      <text class="xlabel" class:on={i === active} x={x(i)} y={height - 6} text-anchor="middle">{d.label}</text>
      <!-- Area di tocco a tutta altezza, più grande della colonna. -->
      <rect
        class="hit"
        x={x(i) - band / 2}
        y={pad.top}
        width={band}
        height={plotH + pad.bottom}
        role="button"
        tabindex="0"
        aria-label="{d.fullLabel ?? d.label}: {privacy.hidden ? 'nascosto' : formatCents(d.value)}"
        onclick={() => (selected = selected === i ? null : i)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selected = selected === i ? null : i)}
      />
    {/each}

    {#if data[active]}
      {@const d = data[active]}
      <text class="value" x={x(active)} y={y(d.value) - 8} text-anchor="middle">
        {privacy.hidden ? '•••' : formatCents(d.value)}
      </text>
    {/if}
  </svg>
</figure>

<style>
  .chart {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--chart-grid);
    stroke-width: 1;
  }
  .tick,
  .xlabel {
    font-size: 11px;
    fill: var(--chart-axis);
    font-variant-numeric: tabular-nums;
  }
  .xlabel.on {
    fill: var(--text);
    font-weight: 700;
  }
  .col {
    fill: var(--chart-muted);
    transition: opacity var(--dur-base);
  }
  .col.hi {
    fill: var(--accent);
  }
  .col.dim {
    opacity: 0.5;
  }
  .value {
    font-size: 12px;
    font-weight: 700;
    fill: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .hit {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }
</style>
