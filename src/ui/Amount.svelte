<!--
  Importo formattato "1.234,56 €".
  - Si anima quando cambia (rispetta prefers-reduced-motion).
  - Rispetta la modalità privacy.
  - Cifre tabulari, tranne nel formato "display" (numero protagonista),
    dove le cifre proporzionali risultano più compatte.
-->
<script lang="ts">
  import { Tween, prefersReducedMotion } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { amountParts } from '../lib/domain/money';
  import { privacy } from '../lib/ui/privacy.svelte';

  interface Props {
    cents: number;
    size?: 'display' | 'lg' | 'md' | 'sm';
    /** "+" davanti ai positivi. */
    signed?: boolean;
    /** auto: verde se positivo e signed, rosso se negativo. */
    tone?: 'default' | 'muted' | 'auto';
    animate?: boolean;
    /** Decimali più piccoli e attenuati (usato per il patrimonio). */
    splitDecimals?: boolean;
  }

  let {
    cents,
    size = 'md',
    signed = false,
    tone = 'default',
    animate = true,
    splitDecimals = false,
  }: Props = $props();

  const tween = new Tween(0, { duration: 600, easing: cubicOut });
  let first = true;

  $effect(() => {
    const target = cents;
    const instant = first || !animate || prefersReducedMotion.current;
    first = false;
    tween.set(target, instant ? { duration: 0 } : undefined);
  });

  const shown = $derived(Math.round(tween.current));
  const parts = $derived(amountParts(shown, { signed }));
  const toneClass = $derived(
    tone === 'auto' ? (cents < 0 ? 'neg' : signed && cents > 0 ? 'pos' : '') : tone === 'muted' ? 'muted' : '',
  );
  const full = $derived(amountParts(cents, { signed }));
  const label = $derived(`${full.sign === '−' ? 'meno ' : ''}${full.int},${full.dec} euro`);
</script>

{#if privacy.hidden}
  <span class="amount {size} {toneClass}" aria-label="Importo nascosto">
    <span aria-hidden="true">••••<span class="sym">{parts.symbol}</span></span>
  </span>
{:else}
  <span class="amount {size} {toneClass}" class:tnum={size !== 'display'} aria-label={label}>
    <span aria-hidden="true"
      >{parts.sign}{parts.int}{#if splitDecimals}<span class="dec">,{parts.dec}{parts.symbol}</span
        >{:else},{parts.dec}{parts.symbol}{/if}</span
    >
  </span>
{/if}

<style>
  .amount {
    white-space: nowrap;
    font-weight: var(--fw-bold);
  }
  .tnum {
    font-variant-numeric: tabular-nums;
  }
  .display {
    font-size: var(--fs-display);
    letter-spacing: -0.04em;
    line-height: 1.05;
  }
  .display .dec {
    font-size: 0.55em;
    color: var(--text-3);
    letter-spacing: -0.02em;
  }
  .lg {
    font-size: var(--fs-title-2);
    letter-spacing: -0.02em;
  }
  .md {
    font-size: var(--fs-body);
  }
  .sm {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .pos {
    color: var(--positive);
  }
  .neg {
    color: var(--negative);
  }
  .muted {
    color: var(--text-3);
  }
</style>
