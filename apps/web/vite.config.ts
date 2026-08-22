import { defineConfig } from 'vite';

export default defineConfig({
  // Single self-contained bundle; the WASM + worker assets are emitted by Vite.
  build: { target: 'es2022' },
  worker: { format: 'es' },
});
