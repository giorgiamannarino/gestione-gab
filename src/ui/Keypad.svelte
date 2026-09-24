<!-- Tastierino numerico grande, per inserire un importo con il pollice. -->
<script lang="ts">
  import { Delete } from '@lucide/svelte';
  import { pressKey, type KeypadKey } from '../lib/domain/keypad';

  interface Props {
    value: string;
    onchange?: (value: string) => void;
  }

  let { value = $bindable(''), onchange }: Props = $props();

  const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

  function press(k: KeypadKey) {
    const next = pressKey(value, k);
    if (next === value) {
      navigator.vibrate?.(8);
      return;
    }
    value = next;
    onchange?.(next);
  }
</script>

<div class="keypad" role="group" aria-label="Tastierino numerico">
  {#each keys as k (k)}
    <button
      class="key"
      class:fn={k === 'back' || k === ','}
      aria-label={k === 'back' ? 'Cancella' : k === ',' ? 'Virgola' : k}
      onclick={() => press(k)}
    >
      {#if k === 'back'}<Delete size={24} strokeWidth={1.75} />{:else}{k}{/if}
    </button>
  {/each}
</div>

<style>
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-2);
  }
  .key {
    min-height: 56px;
    border-radius: var(--r-md);
    font-size: 1.5rem;
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
    display: grid;
    place-items: center;
    color: var(--text);
    transition:
      background-color var(--dur-fast),
      transform var(--dur-fast) var(--ease-out);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .key:active {
    background: var(--surface-3);
    transform: scale(0.96);
  }
  .fn {
    color: var(--text-2);
  }
  /* La virgola è piccola per natura: la ingrandiamo per renderla leggibile. */
  .key[aria-label='Virgola'] {
    font-size: 2rem;
    font-weight: var(--fw-heavy);
    line-height: 1;
    padding-bottom: 12px;
  }
</style>
