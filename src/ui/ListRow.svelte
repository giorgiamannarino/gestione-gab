<!-- Riga di lista: elemento iniziale, titolo/sottotitolo, contenuto finale. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    subtitle?: string;
    leading?: Snippet;
    trailing?: Snippet;
    /** Sottotitolo personalizzato (icone, colori). */
    sub?: Snippet;
    onclick?: () => void;
  }

  let { title, subtitle, leading, trailing, sub, onclick }: Props = $props();
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  class="row"
  class:interactive={!!onclick}
  role={onclick ? undefined : 'group'}
  {onclick}
>
  {#if leading}{@render leading()}{/if}
  <span class="text">
    <span class="title">{title}</span>
    {#if sub}
      <span class="subtitle">{@render sub()}</span>
    {:else if subtitle}
      <span class="subtitle">{subtitle}</span>
    {/if}
  </span>
  {#if trailing}<span class="trailing">{@render trailing()}</span>{/if}
</svelte:element>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 56px;
    padding: var(--sp-2) 0;
    text-align: left;
  }
  .row + :global(.row) {
    border-top: 1px solid var(--hairline);
  }
  .interactive {
    border-radius: var(--r-sm);
    transition: background-color var(--dur-base);
  }
  .interactive:active {
    background: var(--surface-2);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .title {
    font-weight: var(--fw-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .subtitle {
    font-size: var(--fs-callout);
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }
  .trailing {
    flex: none;
    text-align: right;
  }
</style>
