/** Aspetto dell'app: automatico (segue l'iPhone), chiaro o scuro. Preferenza salvata sul dispositivo. */
export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'conti-aspetto';
const COLORS = { light: '#f4f4f8', dark: '#09090f' };

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(choice: ThemeChoice = getTheme()): void {
  const root = document.documentElement;
  if (choice === 'auto') delete root.dataset.theme;
  else root.dataset.theme = choice;
  // Colore della barra di sistema: con una scelta fissa vale per entrambe le preferenze del telefono.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media') ?? '';
    meta.content = choice === 'auto' ? (media.includes('dark') ? COLORS.dark : COLORS.light) : COLORS[choice];
  }
}

export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* memoria del browser non disponibile: vale solo per questa sessione */
  }
  applyTheme(choice);
}
