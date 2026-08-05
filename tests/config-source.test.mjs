import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test(
  "Cloudflare compatibility config is single-sourced and locally supported",
  async () => {
    const [vite, wrangler] = await Promise.all([
      read("vite.config.ts"),
      read("wrangler.jsonc"),
    ]);

    // Compatibility settings must only be declared in wrangler.jsonc.
    assert.doesNotMatch(vite, /compatibility_flags\s*:/);

    assert.match(
      wrangler,
      /"compatibility_date"\s*:\s*"2026-05-22"/,
    );

    // Allow either single-line or multi-line JSON formatting.
    assert.match(
      wrangler,
      /"compatibility_flags"\s*:\s*\[\s*"nodejs_compat"\s*\]/,
    );
  },
);

test("API routes invoke the Worker before static assets", async () => {
  const wrangler = await read("wrangler.jsonc");

  assert.match(
    wrangler,
    /"run_worker_first"\s*:\s*\[\s*"\/api\/\*"\s*\]/,
  );
});

test("local CSP does not force HTTP assets to HTTPS", async () => {
  const security = await read("worker/security.ts");

  assert.doesNotMatch(
    security,
    /csp\.push\(["']upgrade-insecure-requests/,
  );

  assert.match(
    security,
    /connect-src 'self' ws: wss:/,
  );
});

test("production does not enable demo accounts", async () => {
  const wrangler = await read("wrangler.jsonc");

  assert.match(
    wrangler,
    /"AUTH_ALLOW_DEMO"\s*:\s*"false"/,
  );
});

test(
  "API validation is awaited and unknown API routes return JSON 404",
  async () => {
    const worker = await read("worker/index.ts");

    assert.match(
      worker,
      /await validateApiRequest\(request\)/,
    );

    assert.match(
      worker,
      /url\.pathname\.startsWith\(["']\/api\/["']\)/,
    );

    assert.match(
      worker,
      /Response\.json\(/,
    );

    assert.match(
      worker,
      /API_NOT_FOUND/,
    );

    assert.match(
      worker,
      /找不到指定的 API。/,
    );

    assert.match(
      worker,
      /\{\s*status:\s*404\s*\}/,
    );

    assert.match(
      worker,
      /INTERNAL_ERROR/,
    );
  },
);

test("App Router build dependency is declared", async () => {
  const packageJsonText = await read("package.json");
  const packageJson = JSON.parse(packageJsonText);

  assert.equal(
    packageJson.devDependencies["@vitejs/plugin-rsc"],
    "0.5.26",
  );

  assert.ok(
    packageJson.devDependencies.vinext,
    "vinext must be declared in devDependencies",
  );

  assert.ok(
    packageJson.devDependencies["@cloudflare/vite-plugin"],
    "@cloudflare/vite-plugin must be declared in devDependencies",
  );
});

test("Cloudflare Vite plugin is configured for RSC and SSR", async () => {
  const vite = await read("vite.config.ts");

  assert.match(
    vite,
    /from\s+["']@cloudflare\/vite-plugin["']/,
  );

  assert.match(
    vite,
    /cloudflare\s*\(\s*\{/,
  );

  assert.match(
    vite,
    /name\s*:\s*["']rsc["']/,
  );

  assert.match(
    vite,
    /childEnvironments\s*:\s*\[\s*["']ssr["']\s*\]/,
  );
});

test("root page redirects to the user login portal without a login form", async () => {
  const [page, postcss] = await Promise.all([
    read("app/page.tsx"),
    read("postcss.config.mjs"),
  ]);

  assert.match(
    page,
    /window\.location\.replace\(["']\/user\/login["']\)/,
  );

  assert.doesNotMatch(
    page,
    /<form\b/,
  );

  assert.match(
    postcss,
    /const postcssConfig/,
  );

  assert.match(
    postcss,
    /export default postcssConfig/,
  );
});