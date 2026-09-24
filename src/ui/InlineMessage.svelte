<!-- Messaggio in linea: informazioni, conferme, avvisi, errori. Sempre icona + testo. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CircleAlert, CircleCheck, Info, TriangleAlert } from '@lucide/svelte';

  interface Props {
    tone?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    children: Snippet;
    action?: Snippet;
  }

  let { tone = 'info', title, children, action }: Props = $props();
  const Icon = $derived({ info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }[tone]);
</script>

<div class="msg {tone}" role={tone === 'error' ? 'alert' : 'status'}>
  <span class="icon"><Icon size={18} strokeWidth={2} /></span>
  <div class="body">
    {#if title}<p class="title">{title}</p>{/if}
    <div class="text">{@render children()}</div>
    {#if action}<div class="action">{@render action()}</div>{/if}
  </div>
</div>

<style>
  .msg {
    display: flex;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--c) 10%, var(--surface));
    --c: var(--accent);
  }
  .success {
    --c: var(--positive);
  }
  .warning {
    --c: var(--warning);
  }
  .error {
    --c: var(--negative);
  }
  .icon {
    flex: none;
    color: var(--c);
    padding-top: 1px;
  }
  .body {
    flex: 1;
    font-size: var(--fs-callout);
    color: var(--text-2);
  }
  .title {
    font-weight: var(--fw-bold);
    color: var(--text);
    margin-bottom: 2px;
  }
  .action {
    margin-top: var(--sp-2);
  }
</style>
