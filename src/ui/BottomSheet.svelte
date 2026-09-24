<!--
  Bottom sheet modale basato su <dialog>: focus intrappolato, sfondo inerte
  ed Esc gestiti dal browser. Si chiude trascinando la maniglia verso il basso.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';

  interface Props {
    open: boolean;
    title: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open = $bindable(), title, onclose, children, footer }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let dragY = $state(0);
  let dragging = $state(false);
  let closing = $state(false);
  let startY = 0;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      closing = false;
      dragY = 0;
      dialog.showModal();
    } else if (!open && dialog.open) {
      animateClose();
    }
  });

  function reducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function animateClose() {
    if (!dialog || closing) return;
    closing = true;
    const finish = () => {
      dialog?.close();
      closing = false;
      dragY = 0;
    };
    if (reducedMotion()) finish();
    else setTimeout(finish, 220);
  }

  function requestClose() {
    open = false;
    onclose?.();
  }

  function onCancel(e: Event) {
    e.preventDefault();
    requestClose();
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === dialog) requestClose();
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 120) requestClose();
    else dragY = 0;
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  class:closing
  aria-labelledby="sheet-title"
  oncancel={onCancel}
  onclick={onBackdrop}
  style:--drag="{dragY}px"
  class:dragging
>
  <div class="panel">
    <div
      class="grab"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      aria-hidden="true"
    >
      <span class="handle"></span>
    </div>
    <header class="head">
      <h2 id="sheet-title" class="title">{title}</h2>
      <button class="close" aria-label="Chiudi" onclick={requestClose}><X size={20} strokeWidth={2} /></button>
    </header>
    <div class="content">{@render children()}</div>
    {#if footer}<footer class="footer">{@render footer()}</footer>{/if}
  </div>
</dialog>

<style>
  .sheet {
    width: 100%;
    max-width: 560px;
    max-height: 100dvh;
    margin: auto auto 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    overflow: visible;
  }
  .sheet::backdrop {
    background: var(--overlay);
    animation: fade-in var(--dur-slow) var(--ease-out);
  }
  .sheet.closing::backdrop {
    opacity: 0;
    transition: opacity 200ms;
  }
  .panel {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 24px - env(safe-area-inset-top));
    background: var(--surface);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    box-shadow: var(--shadow-2), var(--card-ring);
    padding-bottom: env(safe-area-inset-bottom);
    transform: translateY(var(--drag));
    animation: slide-up var(--dur-slow) var(--ease-out);
    transition: transform 220ms var(--ease-out);
  }
  .dragging .panel {
    transition: none;
  }
  .closing .panel {
    transform: translateY(100%);
  }
  .grab {
    display: flex;
    justify-content: center;
    padding: var(--sp-2) 0 var(--sp-1);
    touch-action: none;
    cursor: grab;
  }
  .handle {
    width: 36px;
    height: 5px;
    border-radius: var(--r-full);
    background: var(--hairline-strong);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--sp-2) 0 var(--sp-5);
  }
  .title {
    font-size: var(--fs-title-3);
    font-weight: var(--fw-bold);
  }
  .close {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-3);
  }
  .content {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--sp-2) var(--sp-5) var(--sp-4);
  }
  .footer {
    padding: var(--sp-3) var(--sp-5) var(--sp-4);
    border-top: 1px solid var(--hairline);
  }
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel,
    .sheet::backdrop {
      animation: none;
      transition: none;
    }
  }
</style>
