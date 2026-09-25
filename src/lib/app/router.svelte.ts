/** Navigazione con hash (#/movimenti), adatta a GitHub Pages. */
class Router {
  path = $state(this.read());

  constructor() {
    window.addEventListener('hashchange', () => {
      this.path = this.read();
      // Scorre il contenitore dell'app (non la pagina, che è ferma) e, per sicurezza, la finestra.
      document.querySelector('main')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    });
  }

  private read(): string {
    return location.hash.replace(/^#/, '') || '/';
  }

  go(path: string): void {
    if (path !== this.path) location.hash = path;
  }

  back(fallback = '/'): void {
    if (history.length > 1) history.back();
    else this.go(fallback);
  }

  get segments(): string[] {
    return this.path.split('/').filter(Boolean);
  }
}

export const router = new Router();
