<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  interface Props {
    icon: Component<{ size?: number; strokeWidth?: number }>;
    title: string;
    text: string;
    action?: Snippet;
  }

  let { icon: Icon, title, text, action }: Props = $props();
</script>

<div class="empty">
  <span class="halo" aria-hidden="true"><Icon size={28} strokeWidth={1.5} /></span>
  <p class="title">{title}</p>
  <p class="text">{text}</p>
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--sp-7) var(--sp-5);
  }
  .halo {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--accent);
    background: var(--accent-soft);
    margin-bottom: var(--sp-4);
  }
  .title {
    font-size: var(--fs-title-3);
    font-weight: var(--fw-bold);
  }
  .text {
    margin-top: var(--sp-1);
    max-width: 30ch;
    color: var(--text-3);
    font-size: var(--fs-callout);
  }
  .action {
    margin-top: var(--sp-5);
  }
</style>
