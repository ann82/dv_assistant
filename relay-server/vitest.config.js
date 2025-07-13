import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js', 'tests/**/*.test.mjs'],
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000
  }
}); 