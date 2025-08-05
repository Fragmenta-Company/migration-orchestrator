/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set to 'node' for backend projects
    environment: 'node',

    // Path to your test files (default: ['**/*.test.ts', '**/*.spec.ts'])
    include: ['src/**/*.test.ts'],

    // Enable coverage reporting (optional)
    coverage: {
      reporter: ['text', 'html'],
    },

    // Global test APIs like describe, it, expect
    globals: true,
  },
});
