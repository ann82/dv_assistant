import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['esm-tests/**/*.mjs'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'esm-tests/']
    }
  }
}); 