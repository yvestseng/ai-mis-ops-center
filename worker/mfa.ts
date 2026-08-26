import type { Identity } from "./auth";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const merged = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (headers) {
    new Headers(headers).forEach((value, key) => merged.set(key, value));
  }
  return new Response(JSON.stringify(data), { status, headers: merged });
}

type AuditFn = (identity: Identity, action: string, entityType: string, entityId: string | null, details?: unknown) => Promise<void>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const MFA_CHALLENGE_SECONDS = 5 * 60;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type MfaPurpose = "enroll" | "verify";

type ChallengeRow = {
  id: string;
  userId: string;
  portal: string;
  purpose: MfaPurpose;
  expiresAt: string;
  consumedAt: string | null;
  actorEmail: string;
  roleCode: string;
  displayName: string;
  username: string;
  department: string | null;
  roleId: string;
  roleName: string;
  permissions: string;
  teamId: string | null;
  isAssignable: string | number | null;
  mustChangePassword: string | number | null;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Invalid hex value");
  }
  return new Uint8Array(
    value.match(/.{1,2}/g)!.map((pair) => Number.parseInt(pair, 16)),
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function normalizeMfaKey(raw: string | undefined) {
  const value = (raw || "").trim();
  if (!value) throw new Error("MFA_ENCRYPTION_KEY_MISSING");
  if (/^[0-9a-f]{64}$/i.test(value)) return hexToBytes(value);
  const decoded = base64ToBytes(value);
  if (decoded.length !== 32) throw new Error("MFA_ENCRYPTION_KEY_INVALID");
  return decoded;
}

async function importAesKey(raw: string | undefined) {
  return crypto.subtle.importKey(
    "raw",
    normalizeMfaKey(raw),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

async function importHmacKey(raw: string | undefined) {
  return crypto.subtle.importKey(
    "raw",
    normalizeMfaKey(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function encryptMfaSecret(secret: string, rawKey: string | undefined) {
  const key = await importAesKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(secret),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    version: 1,
  };
}

export async function decryptMfaSecret(
  ciphertext: string,
  iv: string,
  rawKey: string | undefined,
) {
  const key = await importAesKey(rawKey);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return decoder.decode(clear);
}

function base32Encode(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export function generateTotpSecret() {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export function buildOtpAuthUri(secret: string, identity: Pick<Identity, "email" | "username">) {
  const issuer = "AI MIS OPS Center";
  const account = identity.email || identity.username;
  const label = `${issuer}:${account}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

async function totpAtStep(secret: string, step: number) {
  const counter = new Uint8Array(8);
  let remaining = BigInt(step);
  for (let index = 7; index >= 0; index -= 1) {
    counter[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counter),
  );
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const currentStep = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = currentStep + offset;
    if (constantTimeEqual(await totpAtStep(secret, step), normalized)) return step;
  }
  return null;
}

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let compact = "";
  for (const byte of bytes) compact += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  return compact.match(/.{1,4}/g)!.join("-");
}

async function recoveryCodeHash(code: string, rawKey: string | undefined) {
  const key = await importHmacKey(rawKey);
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`recovery:${normalizeRecoveryCode(code)}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function generateRecoveryCodes(rawKey: string | undefined) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  return {
    codes,
    hashes: await Promise.all(codes.map((code) => recoveryCodeHash(code, rawKey))),
  };
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function createMfaChallenge(
  request: Request,
  db: D1Database,
  identity: Identity,
  portal: string,
  purpose: MfaPurpose,
) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_SECONDS * 1000);
  const ipHash = await sha256(clientIp(request));
  await db.batch([
    db
      .prepare(
        `INSERT INTO auth_mfa_challenges
          (id, user_id, token_hash, portal, purpose, ip_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        identity.id,
        tokenHash,
        portal,
        purpose,
        ipHash,
        expiresAt.toISOString(),
        now.toISOString(),
      ),
    db
      .prepare(
        `DELETE FROM auth_mfa_challenges
         WHERE consumed_at IS NOT NULL OR expires_at < ?`,
      )
      .bind(now.toISOString()),
  ]);
  return { token, expiresAt: expiresAt.toISOString() };
}

async function readChallenge(request: Request, db: D1Database, token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const now = new Date().toISOString();
  const ipHash = await sha256(clientIp(request));
  return db
    .prepare(
      `SELECT c.id, c.user_id AS userId, c.portal, c.purpose,
              c.expires_at AS expiresAt, c.consumed_at AS consumedAt,
              u.email AS actorEmail, u.username, u.display_name AS displayName,
              u.department, u.role_id AS roleId, u.team_id AS teamId,
              u.is_assignable AS isAssignable,
              u.must_change_password AS mustChangePassword,
              r.code AS roleCode, r.name AS roleName, r.permissions
       FROM auth_mfa_challenges c
       JOIN app_users u ON u.id = c.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE c.token_hash = ? AND c.ip_hash = ?
         AND c.consumed_at IS NULL AND c.expires_at > ?
         AND u.status = 'active'`,
    )
    .bind(await sha256(token), ipHash, now)
    .first<ChallengeRow>();
}

function challengeIdentity(row: ChallengeRow): Identity {
  let permissions: Identity["permissions"] = [];
  try {
    permissions = JSON.parse(row.permissions || "[]") as Identity["permissions"];
  } catch {}
  return {
    id: row.userId,
    username: row.username,
    email: row.actorEmail,
    displayName: row.displayName,
    department: row.department,
    roleId: row.roleId,
    roleCode: row.roleCode,
    roleName: row.roleName,
    permissions,
    teamId: row.teamId,
    isAssignable: Number(row.isAssignable || 0) === 1,
    mustChangePassword: Number(row.mustChangePassword || 0) === 1,
    mfaVerified: false,
    mfaVerifiedAt: null,
    mfaMethod: null,
  };
}

export async function prepareMfaEnrollment(
  db: D1Database,
  identity: Identity,
  rawKey: string | undefined,
) {
  const secret = generateTotpSecret();
  const encrypted = await encryptMfaSecret(secret, rawKey);
  const now = new Date().toISOString();
  const existing = await db
    .prepare("SELECT id FROM user_mfa_settings WHERE user_id = ?")
    .bind(identity.id)
    .first<{ id: string }>();
  const settingId = existing?.id || crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO user_mfa_settings
          (id, user_id, method, secret_ciphertext, secret_iv, secret_version,
           is_enabled, verified_at, last_totp_step, created_at, updated_at)
         VALUES (?, ?, 'totp', ?, ?, ?, 0, NULL, NULL, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           method='totp', secret_ciphertext=excluded.secret_ciphertext,
           secret_iv=excluded.secret_iv, secret_version=excluded.secret_version,
           is_enabled=0, verified_at=NULL, last_totp_step=NULL,
           updated_at=excluded.updated_at`,
      )
      .bind(
        settingId,
        identity.id,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.version,
        now,
        now,
      ),
    db.prepare("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?").bind(identity.id),
  ]);
  return { secret, otpAuthUri: buildOtpAuthUri(secret, identity) };
}

export async function handleMfaVerifyRequest(
  request: Request,
  db: D1Database,
  rawKey: string | undefined,
  createSession: (identity: Identity, method: "totp" | "recovery") => Promise<Response>,
  auditEvent: AuditFn,
) {
  if (request.method !== "POST") return json({ message: "不支援此操作。" }, 405);
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ message: "驗證資料格式不正確。" }, 400);
  }
  const challengeToken = typeof payload.challengeToken === "string" ? payload.challengeToken.trim() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  const recoveryCode = typeof payload.recoveryCode === "string" ? payload.recoveryCode.trim() : "";
  if (!challengeToken || (!code && !recoveryCode)) {
    return json({ error: "MFA_INPUT_REQUIRED", message: "請輸入驗證碼或備援碼。" }, 400);
  }
  const challenge = await readChallenge(request, db, challengeToken);
  if (!challenge) {
    return json({ error: "MFA_CHALLENGE_INVALID", message: "MFA 驗證要求已失效，請重新登入。" }, 401);
  }
  const identity = challengeIdentity(challenge);
  if (identity.mustChangePassword) {
    return json({ error: "PASSWORD_CHANGE_REQUIRED", message: "首次登入後必須先變更密碼。" }, 403);
  }

  const setting = await db
    .prepare(
      `SELECT id, secret_ciphertext AS secretCiphertext, secret_iv AS secretIv,
              is_enabled AS isEnabled, last_totp_step AS lastTotpStep
       FROM user_mfa_settings WHERE user_id = ? AND method = 'totp'`,
    )
    .bind(identity.id)
    .first<{
      id: string;
      secretCiphertext: string;
      secretIv: string;
      isEnabled: number;
      lastTotpStep: number | null;
    }>();
  if (!setting) {
    return json({ error: "MFA_ENROLLMENT_REQUIRED", message: "請重新登入並完成 MFA 註冊。" }, 409);
  }

  if (recoveryCode) {
    if (!setting.isEnabled || challenge.purpose !== "verify") {
      return json({ error: "MFA_RECOVERY_NOT_AVAILABLE", message: "目前無法使用備援碼。" }, 400);
    }
    const hash = await recoveryCodeHash(recoveryCode, rawKey);
    const now = new Date().toISOString();
    const candidate = await db
      .prepare(
        `SELECT id FROM user_mfa_recovery_codes
         WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`,
      )
      .bind(identity.id, hash)
      .first<{ id: string }>();
    if (!candidate) {
      await auditEvent(identity, "mfa_verify_failed", "mfa", identity.id, { method: "recovery" });
      return json({ error: "MFA_CODE_INVALID", message: "MFA 驗證失敗。" }, 401);
    }
    const update = await db
      .prepare(
        `UPDATE user_mfa_recovery_codes SET used_at = ?
         WHERE id = ? AND used_at IS NULL`,
      )
      .bind(now, candidate.id)
      .run();
    if (!update.meta.changes) return json({ error: "MFA_CODE_INVALID", message: "MFA 驗證失敗。" }, 401);
    await db.prepare("UPDATE auth_mfa_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, challenge.id).run();
    await auditEvent(identity, "mfa_recovery_used", "mfa", identity.id);
    return createSession(identity, "recovery");
  }

  const secret = await decryptMfaSecret(setting.secretCiphertext, setting.secretIv, rawKey);
  const acceptedStep = await verifyTotpCode(secret, code);
  if (acceptedStep === null || (setting.lastTotpStep !== null && acceptedStep <= Number(setting.lastTotpStep))) {
    await auditEvent(identity, "mfa_verify_failed", "mfa", identity.id, { method: "totp" });
    return json({ error: "MFA_CODE_INVALID", message: "MFA 驗證失敗。" }, 401);
  }
  const now = new Date().toISOString();

  if (challenge.purpose === "enroll") {
    const recovery = await generateRecoveryCodes(rawKey);
    const statements = recovery.hashes.map((hash) =>
      db
        .prepare(
          `INSERT INTO user_mfa_recovery_codes
            (id, user_id, mfa_setting_id, code_hash, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), identity.id, setting.id, hash, now),
    );
    await db.batch([
      db.prepare("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?").bind(identity.id),
      db
        .prepare(
          `UPDATE user_mfa_settings
           SET is_enabled = 1, verified_at = ?, last_totp_step = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, acceptedStep, now, setting.id),
      ...statements,
      db.prepare("UPDATE auth_mfa_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, challenge.id),
    ]);
    await auditEvent(identity, "mfa_enabled", "mfa", identity.id, { method: "totp" });
    const response = await createSession(identity, "totp");
    const body = (await response.clone().json()) as Record<string, unknown>;
    return json(
      { ...body, recoveryCodes: recovery.codes, recoveryCodesShownOnce: true },
      response.status,
      response.headers,
    );
  }

  if (!setting.isEnabled) {
    return json({ error: "MFA_ENROLLMENT_REQUIRED", message: "請重新登入並完成 MFA 註冊。" }, 409);
  }
  const update = await db
    .prepare(
      `UPDATE user_mfa_settings
       SET last_totp_step = ?, updated_at = ?
       WHERE id = ? AND (last_totp_step IS NULL OR last_totp_step < ?)`,
    )
    .bind(acceptedStep, now, setting.id, acceptedStep)
    .run();
  if (!update.meta.changes) {
    await auditEvent(identity, "mfa_verify_failed", "mfa", identity.id, { reason: "replay" });
    return json({ error: "MFA_CODE_REPLAYED", message: "此驗證碼已使用，請等待新的驗證碼。" }, 401);
  }
  await db.prepare("UPDATE auth_mfa_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, challenge.id).run();
  await auditEvent(identity, "mfa_verify_success", "mfa", identity.id, { method: "totp" });
  return createSession(identity, "totp");
}

export async function resetMfaForUser(
  db: D1Database,
  actor: Identity,
  userId: string,
  auditEvent: AuditFn,
) {
  const target = await db
    .prepare(
      `SELECT u.id, u.email, r.code AS roleCode
       FROM app_users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    )
    .bind(userId)
    .first<{ id: string; email: string; roleCode: string }>();
  if (!target) return json({ message: "找不到指定帳號。" }, 404);
  if (target.roleCode !== "admin" && target.roleCode !== "operator") {
    return json({ error: "MFA_NOT_REQUIRED", message: "一般使用者目前未強制使用 MFA。" }, 400);
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM user_mfa_settings WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM auth_mfa_challenges WHERE user_id = ?").bind(userId),
    db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, userId),
  ]);
  await auditEvent(actor, "mfa_reset", "user", userId, { targetEmail: target.email });
  return json({ ok: true, message: "MFA 已重設；該帳號下次登入時必須重新註冊驗證器。" });
}
