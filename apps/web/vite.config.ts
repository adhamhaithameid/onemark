import { defineConfig } from 'vite';

export default defineConfig({
  // Single self-contained bundle; the WASM + worker assets are emitted by Vite.
  build: { target: 'es2022' },
  worker: { format: 'es' },
  // GitHub Pages serves project sites under /<repo>/. The deploy workflow sets
  // ONEMARK_BASE=/onemark/app/ so the app lives at that path while the site
  // root stays free for the marketing site (P8). Local dev keeps '/'.
  base: process.env.ONEMARK_BASE ?? '/',
});
