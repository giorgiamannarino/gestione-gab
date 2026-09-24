<!--
  Classifica a barre orizzontali (spese per categoria o per pocket).
  Ogni voce ha etichetta e valore in testo, quindi il colore non è mai l'unica informazione.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import Amount from '../Amount.svelte';

  interface Item {
    id: string;
    label: string;
    value: number;
    color: string;
    icon?: Component<{ size?: number; strokeWidth?: number }>;
    /** Testo secondario, es. "12 movimenti". */
    detail?: string;
  }

  interface Props {
    items: Item[];
    /** Totale per le percentuali (default: somma delle voci). */
    total?: number;
  }

  let { items, total }: Props = $props();
  const max = $derived(Math.max(1, ...items.map((i) => i.value)));
  const sum = $derived(total ?? items.reduce((s, i) => s + i.value, 0));
</script>

<ul class="list">
  {#each items as item (item.id)}
    <li class="item" style:--c={item.color}>
      <div class="head">
        {#if item.icon}
          <span class="icon" aria-hidden="true"><item.icon size={16} strokeWidth={1.75} /></span>
        {:else}
          <span class="dot" aria-hidden="true"></span>
        {/if}
        <span class="label">{item.label}</span>
        <span class="pct">{sum > 0 ? Math.round((item.value / sum) * 100) : 0}%</span>
        <Amount cents={item.value} size="sm" />
      </div>
      <div class="track" aria-hidden="true">
        <span class="fill" style:width="{(item.value / max) * 100}%"></span>
      </div>
      {#if item.detail}<p class="detail">{item.detail}</p>{/if}
    </li>
  {/each}
</ul>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: 6px;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--r-xs);
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }
  .label {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pct {
    font-size: var(--fs-caption);
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .track {
    height: 8px;
  }
  .fill {
    display: block;
    height: 100%;
    min-width: 4px;
    border-radius: 0 4px 4px 0;
    background: var(--c);
    transition: width var(--dur-slow) var(--ease-out);
  }
  .detail {
    margin-top: 4px;
    font-size: var(--fs-caption);
    color: var(--text-3);
  }
</style>
