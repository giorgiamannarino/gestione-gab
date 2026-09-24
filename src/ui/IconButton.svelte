<script lang="ts">
  import type { Component } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    icon: Component<{ size?: number; strokeWidth?: number }>;
    /** Obbligatoria: il pulsante non ha testo visibile. */
    label: string;
    variant?: 'surface' | 'plain';
  }

  let { icon: Icon, label, variant = 'surface', ...rest }: Props = $props();
</script>

<button class="icon-btn {variant}" aria-label={label} title={label} {...rest}>
  <Icon size={20} strokeWidth={1.75} />
</button>

<style>
  .icon-btn {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-2);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .icon-btn:active {
    transform: scale(0.92);
  }
  .surface {
    background: var(--surface);
    box-shadow: var(--shadow-1), var(--card-ring);
  }
</style>
