<!--
  Linee nel tempo (es. Fondo Pensione: versato vs valore reale).
  Legenda sempre presente, etichetta del valore alla fine di ogni linea,
  mirino con tooltip trascinando il dito sul grafico. Serie con valori
  mancanti (null) vengono interrotte, non inventate.
-->
<script lang="ts">
  import { formatCents } from '../../lib/domain/money';
  import { axisLabel, niceDomain } from '../../lib/ui/chart';
  import { privacy } from '../../lib/ui/privacy.svelte';

  interface Series {
    id: string;
    name: string;
    color: string;
    values: (number | null)[];
    /** Velatura sotto la linea (10%). */
    area?: boolean;
  }

  interface Props {
    labels: string[];
    series: Series[];
    height?: number;
    title: string;
  }

  let { labels, series, height = 200, title }: Props = $props();

  let width = $state(320);
  let hover = $state<number | null>(null);

  const pad = { top: 12, right: 8, bottom: 24, left: 48 };
  const all = $derived(series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  // La scala parte vicino al minimo: le linee mostrano posizioni, non lunghezze.
  const ticks = $derived(all.length ? niceDomain(Math.min(...all), Math.max(...all), 3) : [0, 100]);
  const bottom = $derived(ticks[0] ?? 0);
  const top = $derived(ticks.at(-1) ?? 1);
  // La velatura ha senso solo se l'asse parte da zero, altrimenti esagera le differenze.
  const zeroBased = $derived(bottom === 0);
  const plotW = $derived(Math.max(0, width - pad.left - pad.right));
  const plotH = $derived(height - pad.top - pad.bottom);
  const n = $derived(labels.length);

  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - ((v - bottom) / (top - bottom || 1)) * plotH;

  function linePath(values: (number | null)[]): string {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  }

  function areaPath(values: (number | null)[]): string {
    const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
    if (pts.length < 2) return '';
    const base = pad.top + plotH;
    const first = pts[0]!;
    const last = pts.at(-1)!;
    return `M${x(first[0])} ${base} ` + pts.map(([i, v]) => `L${x(i)} ${y(v)}`).join(' ') + ` L${x(last[0])} ${base} Z`;
  }

  function lastIndex(values: (number | null)[]): number {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
    return -1;
  }

  function onPointer(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    hover = Math.max(0, Math.min(n - 1, Math.round((px / plotW) * (n - 1))));
  }

  const money = (v: number) => (privacy.hidden ? '•••' : formatCents(v));
  // Il tooltip sta dentro il grafico, dal lato opposto al dito.
  const tooltipOnLeft = $derived(hover !== null && x(hover) > pad.left + plotW / 2);
</script>

<figure class="chart">
  <ul class="legend">
    {#each series as s (s.id)}
      <li><span class="key" style:background={s.color}></span>{s.name}</li>
    {/each}
  </ul>

  <div class="plot" bind:clientWidth={width}>
    <svg
      {width}
      {height}
      role="img"
      aria-label={title}
      onpointermove={onPointer}
      onpointerdown={onPointer}
      onpointerleave={() => (hover = null)}
    >
      {#each ticks as t (t)}
        <line class="grid" x1={pad.left} x2={pad.left + plotW} y1={y(t)} y2={y(t)} />
        <text class="tick" x={pad.left - 8} y={y(t)} dy="0.32em" text-anchor="end">{privacy.hidden ? '•••' : axisLabel(t)}</text>
      {/each}
      {#each labels as l, i (i)}
        {#if n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1}
          <text class="tick" x={x(i)} y={height - 6} text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{l}</text>
        {/if}
      {/each}

      {#each series as s (s.id)}
        {#if s.area && zeroBased}<path class="area" d={areaPath(s.values)} style:fill={s.color} />{/if}
        <path class="line" d={linePath(s.values)} style:stroke={s.color} />
        {@const li = lastIndex(s.values)}
        {#if li >= 0}
          <circle class="dot" cx={x(li)} cy={y(s.values[li]!)} r="4" style:fill={s.color} />
        {/if}
      {/each}

      {#if hover !== null}
        <line class="cross" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} />
        {#each series as s (s.id)}
          {@const v = s.values[hover]}
          {#if v !== null && v !== undefined}
            <circle class="dot" cx={x(hover)} cy={y(v)} r="5" style:fill={s.color} />
          {/if}
        {/each}
      {/if}
    </svg>

    {#if hover !== null}
      <div
        class="tooltip"
        style:left={tooltipOnLeft ? `${pad.left + 4}px` : 'auto'}
        style:right={tooltipOnLeft ? 'auto' : `${pad.right + 4}px`}
        role="status"
      >
        <p class="tt-title">{labels[hover]}</p>
        {#each series as s (s.id)}
          {@const v = s.values[hover]}
          <p class="tt-row">
            <span class="key" style:background={s.color}></span>
            <span class="tt-name">{s.name}</span>
            <span class="tt-val">{v === null || v === undefined ? '—' : money(v)}</span>
          </p>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Vista tabellare per i lettori di schermo. -->
  <table class="visually-hidden">
    <caption>{title}</caption>
    <thead><tr><th scope="col">Periodo</th>{#each series as s (s.id)}<th scope="col">{s.name}</th>{/each}</tr></thead>
    <tbody>
      {#each labels as l, i (i)}
        <tr><th scope="row">{l}</th>{#each series as s (s.id)}<td>{s.values[i] == null ? '—' : money(s.values[i]!)}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</figure>

<style>
  .chart {
    width: 100%;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-4);
    list-style: none;
    margin: 0 0 var(--sp-3);
    padding: 0;
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    color: var(--text-2);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .key {
    width: 12px;
    height: 3px;
    border-radius: 2px;
    flex: none;
  }
  .plot {
    position: relative;
  }
  svg {
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }
  .grid {
    stroke: var(--chart-grid);
  }
  .tick {
    font-size: 11px;
    fill: var(--chart-axis);
    font-variant-numeric: tabular-nums;
  }
  .line {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .area {
    opacity: 0.1;
  }
  .dot {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .cross {
    stroke: var(--hairline-strong);
    stroke-width: 1;
  }
  .tooltip {
    position: absolute;
    top: 0;
    min-width: 168px;
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-sm);
    background: var(--surface);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), var(--card-ring);
    font-size: var(--fs-caption);
    pointer-events: none;
  }
  .tt-title {
    font-weight: var(--fw-bold);
    margin-bottom: 2px;
  }
  .tt-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tt-name {
    flex: 1;
    color: var(--text-2);
    white-space: nowrap;
    margin-right: var(--sp-3);
  }
  .tt-val {
    font-weight: var(--fw-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
