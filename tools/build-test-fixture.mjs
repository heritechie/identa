#!/usr/bin/env node
/**
 * Build a single ESM bundle for the browser test fixture.
 *
 * Uses esbuild to bundle:
 *   - examples/html/src/fixture.ts (the entry)
 *   - @identa/web-component (the component + its dist)
 *   - @identa/core (verify, types)
 *   - @identa/core/testing (MockFaceEngine)
 *   - lit (Lit base)
 *
 * Output: examples/html/dist/fixture.bundle.js — a single self-contained
 * ESM file with all imports inlined. No external dependencies at
 * runtime; the fixture loads from the local static server.
 *
 * Run: node tools/build-test-fixture.mjs
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

await build({
  entryPoints: [path.join(ROOT, "examples/html/src/fixture.ts")],
  bundle: true,
  format: "esm",
  target: ["es2022"],
  platform: "browser",
  outfile: path.join(ROOT, "examples/html/dist/fixture.bundle.js"),
  minify: false,
  sourcemap: false,
  logLevel: "info",
});
