import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloudflare compatibility config is single-sourced and locally supported", async () => {
  const [vite, wrangler] = await Promise.all([
    read("vite.config.ts"),
    read("wrangler.jsonc"),
  ]);
  assert.doesNotMatch(vite, /compatibility_flags\s*:/);
  assert.match(wrangler, /"compatibility_date"\s*:\s*"2026-05-22"/);
  assert.match(wrangler, /"compatibility_flags"\s*:\s*\["nodejs_compat"\]/);
});

test("local CSP does not force HTTP assets to HTTPS", async () => {
  const security = await read("worker/security.ts");
  assert.doesNotMatch(security, /csp\.push\(["']upgrade-insecure-requests/);
  assert.match(security, /connect-src 'self' ws: wss:/);
});

test("production does not enable demo accounts", async () => {
  const wrangler = await read("wrangler.jsonc");
  assert.match(wrangler, /"AUTH_ALLOW_DEMO"\s*:\s*"false"/);
});

test("API validation is awaited and unknown API routes return JSON 404", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /await validateApiRequest\(request\)/);
  assert.match(worker, /API_NOT_FOUND/);
  assert.match(worker, /INTERNAL_ERROR/);
});


test("App Router build dependency is declared", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.devDependencies["@vitejs/plugin-rsc"], "0.5.26");
});

test("image and PostCSS lint warnings are eliminated", async () => {
  const page = await read("app/page.tsx");
  const postcss = await read("postcss.config.mjs");
  assert.match(page, /from ["']next\/image["']/);
  assert.doesNotMatch(page, /<img\b/);
  assert.match(postcss, /const postcssConfig/);
  assert.match(postcss, /export default postcssConfig/);
});
