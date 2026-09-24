<!-- Inserimento PIN a 6 cifre: pallini + tastierino. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Delete } from '@lucide/svelte';
  import { PIN_LENGTH } from '../../lib/security/pin';

  interface Props {
    title: string;
    message?: string;
    error?: boolean;
    disabled?: boolean;
    oncomplete: (pin: string) => void;
    extra?: Snippet;
  }
  let { title, message, error = false, disabled = false, oncomplete, extra }: Props = $props();
  let pin = $state('');

  function press(d: string) {
    if (disabled || pin.length >= PIN_LENGTH) return;
    pin += d;
    if (pin.length === PIN_LENGTH) {
      const p = pin;
      setTimeout(() => {
        pin = '';
        oncomplete(p);
      }, 120);
    }
  }
</script>

<svelte:window onkeydown={(e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') pin = pin.slice(0, -1); }} />

<div class="pinpad">
  <p class="title">{title}</p>
  <div class="dots" class:shake={error} aria-label="{pin.length} cifre su {PIN_LENGTH}" role="status">
    {#each Array(PIN_LENGTH) as _, i (i)}<span class="dot" class:on={i < pin.length}></span>{/each}
  </div>
  <p class="message" class:error aria-live="polite">{message ?? ''}</p>
  <div class="keys">
    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
      <button class="key" {disabled} onclick={() => press(d)}>{d}</button>
    {/each}
    <div class="slot">{#if extra}{@render extra()}{/if}</div>
    <button class="key" {disabled} onclick={() => press('0')}>0</button>
    <button class="key fn" aria-label="Cancella" {disabled} onclick={() => (pin = pin.slice(0, -1))}><Delete size={24} strokeWidth={1.75} /></button>
  </div>
</div>

<style>
  .pinpad {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-4);
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }
  .title {
    font-size: var(--fs-title-3);
    font-weight: var(--fw-bold);
    text-align: center;
  }
  .dots {
    display: flex;
    gap: var(--sp-3);
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--text-3);
    transition: background-color var(--dur-fast);
  }
  .dot.on {
    background: var(--text);
    box-shadow: none;
  }
  .shake {
    animation: shake 0.4s;
  }
  @keyframes shake {
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .shake { animation: none; }
  }
  .message {
    min-height: 1.4em;
    font-size: var(--fs-callout);
    color: var(--text-3);
    text-align: center;
  }
  .message.error {
    color: var(--negative);
    font-weight: var(--fw-medium);
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(3, 72px);
    gap: var(--sp-3) var(--sp-5);
  }
  .key {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--surface-3);
    font-size: 1.75rem;
    font-weight: var(--fw-medium);
    display: grid;
    place-items: center;
    touch-action: manipulation;
    transition: transform var(--dur-fast), background-color var(--dur-fast);
  }
  .key:active {
    transform: scale(0.94);
    background: var(--hairline-strong);
  }
  .key.fn {
    background: none;
  }
  .key:disabled {
    opacity: 0.4;
  }
  .slot {
    display: grid;
    place-items: center;
  }
</style>
