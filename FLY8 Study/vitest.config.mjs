import { configDefaults, defineConfig } from 'vitest/config';

// tests-e2e/*.spec.mjs are plain node scripts run by `npm run e2e`, not vitest suites.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'tests-e2e/**', 'scripts/**'] },
});
