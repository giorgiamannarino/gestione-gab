<!-- Chip selezionabile (pocket, categorie, filtri). -->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    label: string;
    selected?: boolean;
    /** Colore identitario: pallino o icona colorata. */
    color?: string;
    icon?: Component<{ size?: number; strokeWidth?: number }>;
    onclick?: () => void;
  }

  let { label, selected = false, color, icon: Icon, onclick }: Props = $props();
</script>

<button class="chip" class:selected aria-pressed={selected} style:--c={color ?? 'var(--text-3)'} {onclick}>
  {#if Icon}
    <Icon size={16} strokeWidth={1.75} />
  {:else if color}
    <span class="dot" aria-hidden="true"></span>
  {/if}
  <span>{label}</span>
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: var(--r-full);
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--hairline);
    color: var(--text-2);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    white-space: nowrap;
    transition:
      background-color var(--dur-base) var(--ease-out),
      box-shadow var(--dur-base) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
    /* Area di tocco di almeno 44px anche se il chip è alto 40. */
    position: relative;
  }
  .chip::after {
    content: '';
    position: absolute;
    inset: -2px 0;
  }
  .chip :global(svg) {
    color: var(--c);
  }
  .chip:active {
    transform: scale(0.96);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c);
  }
  .selected {
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
    box-shadow: inset 0 0 0 1.5px var(--c);
    color: var(--text);
  }
</style>
