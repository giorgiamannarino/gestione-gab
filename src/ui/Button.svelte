<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'md' | 'lg';
    block?: boolean;
    loading?: boolean;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled,
    children,
    ...rest
  }: Props = $props();
</script>

<button class="btn {variant} {size}" class:block disabled={disabled || loading} aria-busy={loading} {...rest}>
  {#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
  <span class="label" class:hidden={loading}>{@render children()}</span>
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--tap);
    padding: 0 var(--sp-5);
    border-radius: var(--r-md);
    font-weight: var(--fw-bold);
    font-size: var(--fs-body);
    transition:
      transform var(--dur-fast) var(--ease-out),
      background-color var(--dur-base) var(--ease-out),
      opacity var(--dur-base);
  }
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  /* Disattivato: grigio neutro, non una versione sbiadita dell'accento pastello. */
  .btn:disabled {
    background: var(--surface-3);
    color: var(--text-3);
    cursor: default;
  }
  .btn:disabled[aria-busy='true'] {
    background: var(--accent);
    color: var(--on-accent);
    opacity: 0.8;
  }
  .lg {
    min-height: 56px;
    border-radius: 18px;
    font-size: var(--fs-title-3);
  }
  .block {
    width: 100%;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .label.hidden {
    visibility: hidden;
  }

  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .secondary {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .ghost {
    color: var(--accent-ink);
    padding: 0 var(--sp-3);
  }
  .danger {
    background: color-mix(in srgb, var(--negative-fill) var(--tint), var(--surface));
    color: var(--negative);
  }

  .spinner {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2s;
    }
  }
</style>
