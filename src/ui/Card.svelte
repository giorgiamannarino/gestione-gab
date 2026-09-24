<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    /** Contenuto a destra del titolo (tipicamente un totale). */
    aside?: Snippet;
    padded?: boolean;
    children: Snippet;
  }

  let { title, aside, padded = true, children }: Props = $props();
</script>

<section class="card" class:padded>
  {#if title || aside}
    <header class="head">
      {#if title}<h2 class="title">{title}</h2>{/if}
      {#if aside}<div class="aside">{@render aside()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--surface);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
  .padded {
    padding: var(--sp-4);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-3);
    padding-bottom: var(--sp-2);
  }
  .title {
    font-size: var(--fs-callout);
    font-weight: var(--fw-bold);
    color: var(--text-2);
  }
</style>
