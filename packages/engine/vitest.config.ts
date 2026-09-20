import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/ast.ts', 'src/engine.ts', 'src/validate.ts', 'src/index.ts'],
      // web-engine.ts / wasm-core.ts are browser+node-WASM loaders exercised
      // by the WASM round-trip gate in CI, not by the Node unit suite.
      thresholds: { lines: 75, branches: 70, functions: 75, statements: 75 },
    },
  },
});
