import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { updater } from './lib/app/pwa.svelte';
import { applyTheme } from './lib/ui/theme';

applyTheme();
updater.start();

/*
 * iPhone: aprendo la tastiera Safari sposta tutta la pagina per mostrare il campo e a volte,
 * alla chiusura, non la rimette a posto (barra in basso a metà schermo). La pagina dell'app
 * non scorre mai (scorre solo il contenuto), quindi la si riporta sempre in cima.
 */
function resetPageScroll() {
  const el = document.activeElement;
  const typing = el instanceof HTMLElement && el.matches('input:not([type=checkbox]):not([type=radio]), textarea, select');
  if (!typing && (window.scrollY !== 0 || document.documentElement.scrollTop !== 0)) window.scrollTo(0, 0);
}
document.addEventListener('focusout', () => setTimeout(resetPageScroll, 60));
window.visualViewport?.addEventListener('resize', () => setTimeout(resetPageScroll, 60));

const app = mount(App, { target: document.getElementById('app')! });

export default app;
