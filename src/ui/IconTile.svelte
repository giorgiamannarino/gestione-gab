<!-- Riquadro colorato con icona: identità visiva di pocket e categorie. -->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    icon: Component<{ size?: number; strokeWidth?: number }>;
    /** Colore CSS (es. "var(--pk-indaco)"). */
    color: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { icon: Icon, color, size = 'md' }: Props = $props();
  const px = $derived(size === 'sm' ? 16 : size === 'lg' ? 22 : 18);
</script>

<span class="tile {size}" style:--c={color} aria-hidden="true">
  <Icon size={px} strokeWidth={1.75} />
</span>

<style>
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
  }
  .sm {
    width: 32px;
    height: 32px;
    border-radius: var(--r-sm);
  }
  .md {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .lg {
    width: 48px;
    height: 48px;
    border-radius: var(--r-md);
  }
</style>
