<!-- Barra di avanzamento (budget). Oltre il 100% diventa "warning". -->
<script lang="ts">
  interface Props {
    value: number;
    max: number;
    color?: string;
    label: string;
  }

  let { value, max, color = 'var(--accent)', label }: Props = $props();
  const pct = $derived(max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);
  const over = $derived(value > max);
</script>

<div
  class="bar"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(pct)}
  style:--c={over ? 'var(--warning-fill)' : color}
>
  <span style:width="{pct}%"></span>
</div>

<style>
  .bar {
    height: 6px;
    border-radius: var(--r-full);
    background: color-mix(in srgb, var(--c) 16%, var(--surface-2));
    overflow: hidden;
  }
  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--c);
    transition: width var(--dur-slow) var(--ease-out);
  }
</style>
