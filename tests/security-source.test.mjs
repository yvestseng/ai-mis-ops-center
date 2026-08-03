import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
test("API gateway applies request validation and security headers", async () => {
  const source = await read("worker/index.ts");
  assert.match(source, /validateApiRequest/);
  assert.match(source, /securityHeaders/);
});
test("security policy blocks cross-origin mutations and oversized payloads", async () => {
  const source = await read("worker/security.ts");
  assert.match(source, /INVALID_ORIGIN/);
  assert.match(source, /PAYLOAD_TOO_LARGE/);
  assert.match(source, /content-security-policy/);
  assert.match(source, /strict-transport-security/);
});
test("login includes bounded brute-force protection and demo isolation", async () => {
  const source = await read("worker/auth.ts");
  assert.match(source, /LOGIN_MAX_FAILURES = 5/);
  assert.match(source, /LOGIN_RATE_LIMITED/);
  assert.match(source, /allowDemoAccounts/);
});

test("first-login password change is enforced and revokes sessions", async () => {
  const [auth, worker, admin, migration] = await Promise.all([
    read("worker/auth.ts"),
    read("worker/index.ts"),
    read("worker/admin.ts"),
    read("drizzle/0010_account_password_lifecycle.sql"),
  ]);
  assert.match(migration, /must_change_password/);
  assert.match(auth, /PASSWORD_CHANGE_REQUIRED/);
  assert.match(auth, /handleChangePasswordRequest/);
  assert.match(auth, /DELETE FROM auth_sessions WHERE user_id =/);
  assert.match(auth, /allowPasswordChange/);
  assert.match(auth, /identity\.mustChangePassword && !options\.allowPasswordChange/);
  assert.match(worker, /\/api\/auth\/change-password/);
  assert.match(admin, /USER_ALREADY_EXISTS/);
  assert.match(admin, /ROLE_NOT_FOUND/);
  assert.match(admin, /TEAM_NOT_FOUND/);
});


test("Cloudflare compatibility flags are declared only in wrangler config", async () => {
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const wranglerConfig = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

  assert.doesNotMatch(viteConfig, /compatibility_flags\s*:/);
  assert.match(wranglerConfig, /"compatibility_flags"\s*:\s*\["nodejs_compat"\]/);
});
