import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotpCode,
} from "../worker/mfa.ts";

const auth = fs.readFileSync(new URL("../worker/auth.ts", import.meta.url), "utf8");
const mfa = fs.readFileSync(new URL("../worker/mfa.ts", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../worker/admin.ts", import.meta.url), "utf8");
const portal = fs.readFileSync(new URL("../app/portal-gate.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0031_totp_mfa_hardening.sql", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of value.toUpperCase()) {
    const position = alphabet.indexOf(character);
    if (position < 0) continue;
    buffer = (buffer << 5) | position;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpFor(secret, timestamp) {
  const step = Math.floor(timestamp / 1000 / 30);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

test("v0.6.1 declares the QR dependency and release version", () => {
  assert.equal(packageJson.version, "0.6.1");
  assert.ok(packageJson.dependencies.qrcode);
  assert.ok(packageJson.devDependencies["@types/qrcode"]);
});

test("TOTP implementation accepts the current RFC6238 step and rejects a wrong code", async () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const now = 1_787_686_200_000;
  const code = totpFor(secret, now);
  assert.equal(await verifyTotpCode(secret, code, now), Math.floor(now / 1000 / 30));
  assert.equal(await verifyTotpCode(secret, code === "000000" ? "999999" : "000000", now), null);
});

test("TOTP secret is AES-GCM encrypted and decrypts only with the configured key", async () => {
  const keyA = crypto.randomBytes(32).toString("base64");
  const keyB = crypto.randomBytes(32).toString("base64");
  const secret = generateTotpSecret();
  const encrypted = await encryptMfaSecret(secret, keyA);
  assert.notEqual(encrypted.ciphertext, secret);
  assert.equal(await decryptMfaSecret(encrypted.ciphertext, encrypted.iv, keyA), secret);
  await assert.rejects(() => decryptMfaSecret(encrypted.ciphertext, encrypted.iv, keyB));
});

test("otpauth URI is compatible with standard authenticator apps", () => {
  const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  const uri = buildOtpAuthUri(secret, { email: "admin@example.test", username: "admin" });
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP/);
  assert.match(uri, /algorithm=SHA1/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});

test("recovery codes are high-entropy display values and only hashes are intended for persistence", async () => {
  const key = crypto.randomBytes(32).toString("base64");
  const result = await generateRecoveryCodes(key);
  assert.equal(result.codes.length, 10);
  assert.equal(result.hashes.length, 10);
  assert.equal(new Set(result.codes).size, 10);
  assert.equal(new Set(result.hashes).size, 10);
  for (let index = 0; index < result.codes.length; index += 1) {
    assert.match(result.codes[index], /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
    assert.match(result.hashes[index], /^[0-9a-f]{64}$/);
    assert.notEqual(result.hashes[index], result.codes[index]);
  }
  assert.match(mfa, /code_hash/);
  assert.doesNotMatch(migration, /recovery_code\s+TEXT/i);
});

test("0031 is additive and adds MFA settings, recovery codes, challenges and session assurance", () => {
  assert.match(migration, /ALTER TABLE auth_sessions ADD COLUMN mfa_verified/);
  assert.match(migration, /CREATE TABLE user_mfa_settings/);
  assert.match(migration, /CREATE TABLE user_mfa_recovery_codes/);
  assert.match(migration, /CREATE TABLE auth_mfa_challenges/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM app_users/i);
  assert.match(schema, /export const userMfaSettings/);
  assert.match(schema, /export const userMfaRecoveryCodes/);
  assert.match(schema, /export const authMfaChallenges/);
});

test("Admin and MIS are MFA-gated server-side while ordinary users keep the existing password flow", () => {
  assert.match(auth, /identity\.roleCode === "admin" \|\| identity\.roleCode === "operator"/);
  assert.match(auth, /error: "MFA_REQUIRED"/);
  assert.match(auth, /if \(!mfaRequired\)[\s\S]*createSessionResponse/);
  assert.match(auth, /Admin\/MIS accounts never receive a full application session before MFA/);
});

test("first-login password rotation remains before MFA and uses only a restricted session", () => {
  assert.match(auth, /mfaRequired && identity\.mustChangePassword/);
  assert.match(auth, /login_password_change_required/);
  assert.match(auth, /allowPasswordChange: true, allowMfaPending: true/);
  assert.match(auth, /DELETE FROM auth_sessions WHERE user_id = \?/);
});

test("MFA verified state is persisted in the session and does not alter RBAC permissions", () => {
  assert.match(auth, /mfa_verified, mfa_verified_at, mfa_method/);
  assert.match(auth, /permissions,/);
  assert.match(auth, /mfaVerified: options\.mfaVerified/);
  assert.match(auth, /hasPermission\(result\.identity, permission\)/);
  assert.doesNotMatch(mfa, /permissions\.push|roleCode\s*=|role_id\s*=/);
});

test("MFA challenge and recovery code are one-time and TOTP replay is blocked", () => {
  assert.match(mfa, /consumed_at IS NULL/);
  assert.match(mfa, /used_at IS NULL/);
  assert.match(mfa, /last_totp_step/);
  assert.match(mfa, /MFA_CODE_REPLAYED/);
  assert.match(mfa, /UPDATE user_mfa_recovery_codes SET used_at = \?/);
});

test("MFA security events are audit logged", () => {
  for (const action of [
    "mfa_enroll_started",
    "mfa_enabled",
    "mfa_verify_success",
    "mfa_verify_failed",
    "mfa_recovery_used",
    "mfa_reset",
  ]) {
    assert.ok(auth.includes(action) || mfa.includes(action), action);
  }
});

test("MFA reset is RBAC protected, revokes sessions, and forces re-enrollment", () => {
  assert.match(index, /requirePermission\(request, env\.DB, "rbac\.manage"\)/);
  assert.match(index, /mfa-reset/);
  assert.match(mfa, /DELETE FROM user_mfa_settings WHERE user_id = \?/);
  assert.match(mfa, /DELETE FROM user_mfa_recovery_codes WHERE user_id = \?/);
  assert.match(mfa, /UPDATE auth_sessions SET revoked_at = \?/);
  assert.match(admin, /mfaEnabled/);
});

test("MFA endpoints retain the common API security gateway", () => {
  const validationIndex = index.indexOf("validateApiRequest(request)");
  const verifyIndex = index.indexOf('/api/auth/mfa/verify');
  assert.ok(validationIndex >= 0 && verifyIndex > validationIndex);
  assert.match(index, /securityHeaders\(request, await value\)/);
});

test("enrollment UI renders a local QR code and only shows recovery codes after verification", () => {
  assert.match(portal, /QRCode\.toDataURL\(otpAuthUri/);
  assert.match(portal, /Microsoft Authenticator/);
  assert.match(portal, /Google Authenticator/);
  assert.match(portal, /recoveryCodesShownOnce/);
  assert.match(portal, /離開此頁後系統不會再次顯示/);
});
