import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', '__tests__/**/*.tsx'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        '__tests__/',
        'src/test/',
        '**/*.d.ts',
        '*.config.*',
        'App.tsx',
        'index.ts',
        'src/components/',
        'src/screens/',
      ],
    },
  },
});