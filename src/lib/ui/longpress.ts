/**
 * Pressione prolungata su un elemento (e tasto destro / menu contestuale sul computer).
 * Dopo la pressione prolungata il click che segue viene ignorato ovunque arrivi: così il tocco
 * breve e quello lungo fanno due cose diverse, e il click non chiude il pannello appena aperto
 * (quando il dito si alza, sotto c'è lo sfondo del pannello). Se il dito si sposta non scatta.
 */
import type { Action } from 'svelte/action';

const DELAY = 450;
const MOVE = 10;

function swallowNextClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', stop, true);
    clearTimeout(t);
  };
  window.addEventListener('click', stop, true);
  // Se il click non arriva (dito spostato, nessun click), non si blocca quello dopo.
  const t = setTimeout(done, 1000);
}

export const longpress: Action<HTMLElement, () => void> = (node, handler) => {
  let run = handler;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let fired = false;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    start = null;
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    fired = false;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      fired = true;
      cancel();
      swallowNextClick();
      run();
    }, DELAY);
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE) cancel();
  };
  const context = (e: Event) => {
    e.preventDefault();
    if (fired) return; // su iOS/Android arriva anche dopo la pressione prolungata
    cancel();
    run();
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('contextmenu', context);
  return {
    update(h) {
      run = h;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('contextmenu', context);
    },
  };
};
