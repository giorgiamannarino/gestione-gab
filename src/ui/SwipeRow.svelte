<!-- Riga con swipe a sinistra per eliminare. Tocco = apri. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Trash2 } from '@lucide/svelte';

  interface Props {
    onopen?: () => void;
    ondelete: () => void;
    children: Snippet;
  }

  let { onopen, ondelete, children }: Props = $props();
  let x = $state(0);
  let dragging = $state(false);
  let startX = 0;
  let startY = 0;
  let axis: 'x' | 'y' | null = null;
  const REVEAL = 88;

  function down(e: PointerEvent) {
    startX = e.clientX - x;
    startY = e.clientY;
    axis = null;
    dragging = true;
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!axis && Math.abs(dx - x) + Math.abs(dy) > 8) axis = Math.abs(dx - x) > Math.abs(dy) ? 'x' : 'y';
    if (axis === 'x') {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      x = Math.min(0, Math.max(-220, dx));
    }
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (axis !== 'x') return;
    if (x < -180) {
      x = 0;
      ondelete();
    } else x = x < -REVEAL / 2 ? -REVEAL : 0;
  }
  function click() {
    if (axis === 'x') return;
    if (x !== 0) x = 0;
    else onopen?.();
  }
</script>

<div class="wrap">
  <button class="delete" tabindex={x < 0 ? 0 : -1} aria-hidden={x === 0} onclick={() => { x = 0; ondelete(); }}>
    <Trash2 size={20} strokeWidth={1.75} /><span>Elimina</span>
  </button>
  <div
    class="content"
    class:dragging
    style:transform="translateX({x}px)"
    role="button"
    tabindex="0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclick={click}
    onkeydown={(e) => {
      if (e.key === 'Enter') onopen?.();
      if (e.key === 'Delete' || e.key === 'Backspace') ondelete();
    }}
  >
    {@render children()}
  </div>
</div>

<style>
  .wrap {
    position: relative;
    overflow: hidden;
  }
  .delete {
    position: absolute;
    inset: 0 0 0 auto;
    width: 88px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: var(--negative-fill);
    color: #1b0a10; /* testo scuro sul rosa, in entrambi i temi */
    font-size: var(--fs-caption);
    font-weight: var(--fw-bold);
  }
  .content {
    position: relative;
    background: var(--surface);
    touch-action: pan-y;
    transition: transform var(--dur-base) var(--ease-out);
    cursor: pointer;
  }
  .content.dragging {
    transition: none;
  }
</style>
