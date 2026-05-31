import {defineConfig} from 'vitest/config';

/**
 * Unit tests run with Vitest. We point it at *.spec.ts beside the code under
 * test. These are fast, dependency-free tests of the deterministic logic
 * (parsing, URL normalization, hashing, the pre-filter); no database or network.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
