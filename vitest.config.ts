import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * There is no human QA on this project, so every parity work item in
 * `docs/parity/WORKLIST.md` carries a machine-runnable acceptance check. This is
 * where the unit, string-shape and query-snapshot half of those checks run; the
 * browser half is a separate Playwright project added when the first item needs it.
 */
/*
 * `@vitejs/plugin-react` is deliberately absent. Next 16 pulls in a rolldown-based
 * `vite`, vitest bundles its own, and a plugin typed against one is not assignable
 * to the other — `tsc --noEmit` fails on the plugin array. Nothing here needs it:
 * vite's esbuild transform handles TSX, and component-level assertions belong to
 * the Playwright half of the acceptance checks.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "happy-dom",
    include: ["{lib,components,app}/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Parity checks assert against the real source, never a re-declared copy of it.
    restoreMocks: true,
    clearMocks: true,
  },
});
