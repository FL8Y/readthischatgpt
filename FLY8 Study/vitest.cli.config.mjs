import { defineConfig } from 'vitest/config';

// Used only by the Gemini question runner (scripts/gemini/applyQuestions.cli.test.ts).
export default defineConfig({ test: { include: ['scripts/gemini/*.cli.test.ts'] } });
