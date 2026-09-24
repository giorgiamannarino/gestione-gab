import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Content Security Policy. GitHub Pages non permette header HTTP personalizzati,
 * quindi la policy viaggia in un <meta>. Viene iniettata solo nella build:
 * il dev server di Vite ha bisogno di script e stili inline.
 * Nota: `frame-ancestors` non è supportata nei <meta> e quindi non è presente.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Su GitHub Pages l'app vive in /<nome-repository>/: il workflow passa BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [svelte(), contentSecurityPolicy()],
  build: {
    target: 'es2022',
    // Nessun asset inline come data: URI, così la CSP resta stretta.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
