#!/usr/bin/env node
/**
 * Minimal static file server for the Identa web component test fixture.
 *
 * Serves:
 *   /                       → examples/html/web-component-test.html
 *   /dist/fixture.bundle.js → the bundled ESM module
 *   /<other paths>          → relative to the workspace root, but only
 *                             inside examples/html/, packages/, and the
 *                             workspace root itself.
 *
 * Used by Playwright as the `webServer` so the fixture page is reachable
 * at a stable local URL. No external dependencies; runs on Node http.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tests/browser/fixture-server.mjs → workspace root is two levels up.
const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE_HTML = path.join(ROOT, "examples/html/web-component-test.html");
const PORT = Number(process.env.IDENTA_FIXTURE_PORT ?? 4321);

const ALLOWED_ROOTS = [
  path.join(ROOT, "examples/html"),
  path.join(ROOT, "packages"),
  ROOT,
];

const TYPES = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function isAllowed(filePath) {
  const resolved = path.resolve(filePath);
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(root + path.sep));
}

function resolveFilePath(pathName) {
  if (pathName === "/" || pathName === "") {
    return FIXTURE_HTML;
  }
  // Strip leading slash; treat as workspace-relative.
  const candidate = path.join(ROOT, pathName.replace(/^\/+/, ""));
  return candidate;
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  const pathName = url.split("?")[0];
  let filePath;
  try {
    filePath = resolveFilePath(decodeURIComponent(pathName));
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (!isAllowed(filePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      const body = await readFile(indexPath);
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
      return;
    }
    const body = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(`Not found: ${pathName}`);
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[identa-fixture] http://localhost:${PORT}/`);
});
