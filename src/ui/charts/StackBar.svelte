<!-- Barra di composizione (es. patrimonio per gruppo), con legenda e valori. -->
<script lang="ts">
  import Amount from '../Amount.svelte';

  interface Segment {
    id: string;
    label: string;
    value: number;
    color: string;
  }

  interface Props {
    segments: Segment[];
    title: string;
  }

  let { segments, title }: Props = $props();
  const positive = $derived(segments.filter((s) => s.value > 0));
  const total = $derived(positive.reduce((s, x) => s + x.value, 0));
</script>

<figure class="stack" aria-label={title}>
  <div class="bar" aria-hidden="true">
    {#each positive as s (s.id)}
      <span class="seg" style:flex-grow={s.value} style:background={s.color}></span>
    {/each}
  </div>
  <ul class="legend">
    {#each positive as s (s.id)}
      <li>
        <span class="dot" style:background={s.color}></span>
        <span class="label">{s.label}</span>
        <span class="pct">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
        <Amount cents={s.value} size="sm" />
      </li>
    {/each}
  </ul>
</figure>

<style>
  .bar {
    display: flex;
    gap: 2px; /* spazio nel colore della superficie tra i segmenti */
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
  }
  .seg {
    flex-basis: 0;
    min-width: 4px;
    transition: flex-grow var(--dur-slow) var(--ease-out);
  }
  .legend {
    list-style: none;
    margin: var(--sp-4) 0 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-callout);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .label {
    flex: 1;
    color: var(--text-2);
    font-weight: var(--fw-medium);
  }
  .pct {
    color: var(--text-3);
    font-size: var(--fs-caption);
    font-variant-numeric: tabular-nums;
    min-width: 3ch;
    text-align: right;
  }
</style>
