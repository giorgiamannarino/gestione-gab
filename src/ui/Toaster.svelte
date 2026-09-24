<!-- Area dei toast, sopra la tab bar. -->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { CircleAlert, CircleCheck } from '@lucide/svelte';
  import { dismissToast, toasts, undoToast } from '../lib/ui/toast.svelte';

  interface Props {
    /** Distanza dal fondo (per stare sopra la tab bar). */
    offset?: string;
  }

  let { offset = '96px' }: Props = $props();
</script>

<div class="region" style:--offset={offset} aria-live="polite" aria-atomic="true">
  {#if toasts.current}
    {@const t = toasts.current}
    {#key t.id}
      <div class="toast {t.tone}" transition:fly={{ y: 24, duration: 240, easing: cubicOut }}>
        {#if t.tone === 'success'}
          <CircleCheck size={18} strokeWidth={2} />
        {:else if t.tone === 'error'}
          <CircleAlert size={18} strokeWidth={2} />
        {/if}
        <span class="message">{t.message}</span>
        {#if t.undo}
          <button class="undo" onclick={undoToast}>Annulla</button>
        {:else}
          <button class="close visually-hidden" onclick={() => dismissToast(t.id)}>Chiudi</button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .region {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--offset) + env(safe-area-inset-bottom));
    display: flex;
    justify-content: center;
    padding: 0 var(--gutter);
    pointer-events: none;
    z-index: 50;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    max-width: 420px;
    min-height: 52px;
    padding: 0 var(--sp-2) 0 var(--sp-4);
    border-radius: var(--r-md);
    /* Toast scuro in chiaro, chiaro in scuro: sempre in evidenza. */
    background: var(--text);
    color: var(--bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .message {
    flex: 1;
    padding: var(--sp-3) 0;
  }
  .toast:not(:has(.undo)) {
    padding-right: var(--sp-4);
  }
  .undo {
    min-height: var(--tap);
    padding: 0 var(--sp-3);
    border-radius: var(--r-sm);
    font-weight: var(--fw-heavy);
    color: var(--toast-action);
  }
</style>
