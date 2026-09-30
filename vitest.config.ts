import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/tests/**/*.test.ts",
      "engines/*/tests/**/*.test.ts",
      "tools/*/tests/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Playwright browser tests live in tests/browser/ and run via
      // `pnpm exec playwright test`, not vitest.
      "tests/browser/**",
    ],
    // Default environment. Browser-component tests override per-file with
    // `// @vitest-environment happy-dom`.
    environment: "node",
  },
});
