export type Permission =
  | "dashboard.read"
  | "tickets.create"
  | "tickets.read.own"
  | "tickets.read.all"
  | "tickets.update"
  | "tickets.assign"
  | "assets.read"
  | "assets.write"
  | "services.read"
  | "services.write"
  | "surveys.read"
  | "surveys.submit.own"
  | "surveys.read.own"
  | "surveys.read.all"
  | "surveys.followup.manage"
  | "rbac.manage"
  | "audit.read";

export type Identity = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  department: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: Permission[];
  teamId: string | null;
  isAssignable: boolean;
  mustChangePassword: boolean;
};

type PasswordRecord = {
  passwordHash: string;
  passwordSalt: string;
};

const SESSION_COOKIE = "mis_session";
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 15;
// Cloudflare's hosted runtime rejects the previous 150,000-iteration request.
// This test environment uses a bounded PBKDF2 cost so authentication remains
// inside the Worker CPU budget. Production identity will move to Entra ID.
const PBKDF2_ITERATIONS = 10_000;
const encoder = new TextEncoder();

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const demoAccounts = [
  {
    id: "user-demo-admin",
    username: "admin01",
    email: "admin01@demo.local",
    displayName: "測試系統管理員",
    department: "資訊部",
    roleId: "role-admin",
    passwordSalt: "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1",
    passwordHash:
      "440280f5beb88d9edcfd52929675478a1b66cdf6cc2a955913b1c4a72da51f81",
  },
  {
    id: "user-demo-operator",
    username: "mis01",
    email: "mis01@demo.local",
    displayName: "測試 MIS 維運人員",
    department: "資訊部",
    roleId: "role-operator",
    passwordSalt: "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2",
    passwordHash:
      "0adca02edd147836118a82118a10d1d4f3347d47a3c7a4af66f80e0a81f447ce",
  },
  {
    id: "user-demo-user",
    username: "user01",
    email: "user01@demo.local",
    displayName: "測試一般使用者",
    department: "業務部",
    roleId: "role-user",
    passwordSalt: "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3",
    passwordHash:
      "8bae6c76adca214d3aa08a5cffceb4252e6b9f4820d4044be128f7d9acc1b990",
  },
] as const;

const systemRoles = [
  {
    id: "role-admin",
    code: "admin",
    name: "系統管理人員",
    permissions:
      '["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","tickets.assign","assets.read","assets.write","services.read","services.write","surveys.read","surveys.read.all","surveys.followup.manage","rbac.manage","audit.read"]',
  },
  {
    id: "role-operator",
    code: "operator",
    name: "MIS 維運人員",
    permissions:
      '["dashboard.read","tickets.create","tickets.read.own","tickets.read.all","tickets.update","tickets.assign","assets.read","assets.write","services.read","services.write","surveys.read","surveys.read.all"]',
  },
  {
    id: "role-user",
    code: "user",
    name: "一般使用者",
    permissions:
      '["dashboard.read","tickets.create","tickets.read.own","assets.read","services.read","surveys.submit.own","surveys.read.own"]',
  },
] as const;

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...headers },
  });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function derivePasswordHash(password: string, saltHex: string) {
  const salt =
    saltHex.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) || [];
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function createPasswordRecord(
  password: string,
): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordSalt = bytesToHex(salt);
  return {
    passwordSalt,
    passwordHash: await derivePasswordHash(password, passwordSalt),
  };
}

async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
) {
  const actualHash = await derivePasswordHash(password, salt);
  if (actualHash.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    mismatch |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return mismatch === 0;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function sessionCookie(
  request: Request,
  token: string,
  maxAge = SESSION_SECONDS,
) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

const requiredAuthColumns: Record<string, string[]> = {
  roles: ["id", "code", "name", "permissions"],
  app_users: [
    "id",
    "username",
    "email",
    "display_name",
    "team_id",
    "is_assignable",
    "role_id",
    "password_hash",
    "password_salt",
    "password_changed_at",
    "must_change_password",
    "status",
  ],
  auth_sessions: ["id", "user_id", "token_hash", "expires_at", "revoked_at"],
  audit_logs: ["id", "actor_email", "action", "entity_type", "created_at"],
  login_attempts: ["id", "login_key", "ip_hash", "succeeded", "created_at"],
};

async function assertAuthSchemaReady(db: D1Database) {
  const missing: string[] = [];

  for (const [tableName, requiredColumns] of Object.entries(requiredAuthColumns)) {
    const tableInfo = await db
      .prepare(`PRAGMA table_info('${tableName}')`)
      .all<{ name: string }>();
    const columns = new Set(
      (tableInfo.results || []).map((column) => String(column.name)),
    );

    if (!columns.size) {
      missing.push(`${tableName}.*`);
      continue;
    }

    for (const columnName of requiredColumns) {
      if (!columns.has(columnName)) {
        missing.push(`${tableName}.${columnName}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`AUTH_SCHEMA_MISSING:${missing.join(",")}`);
  }
}

async function ensureDemoAccounts(db: D1Database) {
  // Always upsert system roles so permission changes are synchronized.
  const now = new Date().toISOString();
  await db.batch([
    ...systemRoles.map((role) =>
      db
        .prepare(
          `INSERT INTO roles
            (id, code, name, permissions, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             code = excluded.code,
             name = excluded.name,
             permissions = excluded.permissions,
             is_system = 1,
             updated_at = excluded.updated_at`,
        )
        .bind(
          role.id,
          role.code,
          role.name,
          role.permissions,
          now,
          now,
        ),
    ),
    ...demoAccounts.map((account) =>
      db
        .prepare(
          `INSERT INTO app_users
            (id, username, email, display_name, department, team_id, is_assignable, role_id,
             password_hash, password_salt, password_changed_at, status,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             username = excluded.username,
             email = excluded.email,
             display_name = excluded.display_name,
             department = excluded.department,
             role_id = excluded.role_id,
             password_hash = excluded.password_hash,
             password_salt = excluded.password_salt,
             password_changed_at = excluded.password_changed_at,
             status = 'active',
             updated_at = excluded.updated_at`,
        )
        .bind(
          account.id,
          account.username,
          account.email,
          account.displayName,
          account.department,
          account.roleId === "role-user" ? null : "team-service-desk",
          account.roleId === "role-user" ? 0 : 1,
          account.roleId,
          account.passwordHash,
          account.passwordSalt,
          now,
          now,
          now,
        ),
    ),
  ]);
}

function toIdentity(row: Record<string, string | null>): Identity {
  let permissions: Permission[] = [];
  try {
    permissions = JSON.parse(row.permissions || "[]") as Permission[];
  } catch {}
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    displayName: String(row.displayName),
    department: row.department ? String(row.department) : null,
    teamId: row.teamId ? String(row.teamId) : null,
    isAssignable: Number(row.isAssignable || 0) === 1,
    mustChangePassword: Number(row.mustChangePassword || 0) === 1,
    roleId: String(row.roleId),
    roleCode: String(row.roleCode),
    roleName: String(row.roleName),
    permissions,
  };
}

export async function getIdentity(
  request: Request,
  db: D1Database,
): Promise<Identity | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.email, u.display_name AS displayName,
              u.department, u.team_id AS teamId, u.is_assignable AS isAssignable, u.must_change_password AS mustChangePassword, u.role_id AS roleId,
              r.code AS roleCode, r.name AS roleName, r.permissions
       FROM auth_sessions s
       JOIN app_users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL
         AND s.expires_at > ? AND u.status = 'active'`,
    )
    .bind(tokenHash, now)
    .first<Record<string, string | null>>();
  if (!row) return null;
  await db
    .prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash)
    .run();
  return toIdentity(row);
}

export function hasPermission(identity: Identity, permission: Permission) {
  return identity.permissions.includes(permission);
}

export async function requireIdentity(
  request: Request,
  db: D1Database,
  options: { allowPasswordChange?: boolean } = {},
) {
  const identity = await getIdentity(request, db);
  if (!identity) {
    return {
      identity: null,
      response: json(
        { error: "UNAUTHORIZED", message: "登入已失效，請重新登入。" },
        401,
      ),
    };
  }
  if (identity.mustChangePassword && !options.allowPasswordChange) {
    return {
      identity,
      response: json(
        { error: "PASSWORD_CHANGE_REQUIRED", message: "首次登入後必須先變更密碼。" },
        403,
      ),
    };
  }
  return { identity, response: null };
}

export async function requirePermission(
  request: Request,
  db: D1Database,
  permission: Permission,
) {
  const result = await requireIdentity(request, db);
  if (!result.identity || result.response) return result;
  if (!hasPermission(result.identity, permission)) {
    return {
      identity: result.identity,
      response: json(
        { error: "FORBIDDEN", message: "您的角色沒有執行此操作的權限。" },
        403,
      ),
    };
  }
  return result;
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function loginRateStatus(request: Request, db: D1Database, loginKey: string) {
  const ipHash = await sha256(clientIp(request));
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS failures, MAX(created_at) AS lastFailure
       FROM login_attempts
       WHERE login_key = ? AND ip_hash = ? AND succeeded = 0 AND created_at >= ?`,
    )
    .bind(loginKey, ipHash, since)
    .first<{ failures: number; lastFailure: string | null }>();
  const failures = Number(row?.failures || 0);
  if (failures < LOGIN_MAX_FAILURES) return { locked: false, ipHash };
  const last = row?.lastFailure ? Date.parse(row.lastFailure) : Date.now();
  const retryAfter = Math.max(1, Math.ceil((last + LOGIN_LOCK_MINUTES * 60_000 - Date.now()) / 1000));
  return { locked: retryAfter > 0, ipHash, retryAfter };
}

async function recordLoginAttempt(
  db: D1Database,
  loginKey: string,
  ipHash: string,
  succeeded: boolean,
) {
  const now = new Date().toISOString();
  const cleanupBefore = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  if (succeeded) {
    await db.batch([
      db.prepare(
        "DELETE FROM login_attempts WHERE login_key = ? AND ip_hash = ? AND succeeded = 0",
      ).bind(loginKey, ipHash),
      db.prepare("DELETE FROM login_attempts WHERE created_at < ?").bind(cleanupBefore),
    ]);
    return;
  }
  await db.batch([
    db.prepare(
      `INSERT INTO login_attempts (id, login_key, ip_hash, succeeded, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    ).bind(crypto.randomUUID(), loginKey, ipHash, now),
    db.prepare("DELETE FROM login_attempts WHERE created_at < ?").bind(cleanupBefore),
  ]);
}

async function handleLoginCore(request: Request, db: D1Database, allowDemoAccounts: boolean) {
  if (request.method !== "POST") {
    return json({ message: "不支援此操作。" }, 405);
  }
  try {
    await assertAuthSchemaReady(db);
  } catch (error) {
    console.error("Auth schema readiness check failed", error);
    throw new Error("AUTH_SCHEMA", { cause: error });
  }
  if (allowDemoAccounts) {
    try {
      await ensureDemoAccounts(db);
    } catch (error) {
      console.error("Demo account initialization failed", error);
      throw new Error("AUTH_SEED", { cause: error });
    }
  }
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ message: "登入資料格式不正確。" }, 400);
  }
  const username = clean(payload.username, 160).toLowerCase();
  const password = clean(payload.password, 200);
  if (!username || !password) {
    return json({ message: "請輸入帳號與密碼。" }, 400);
  }
  const rate = await loginRateStatus(request, db, username);
  if (rate.locked) {
    return json(
      { error: "LOGIN_RATE_LIMITED", message: "登入失敗次數過多，請稍後再試。" },
      429,
      { "retry-after": String(rate.retryAfter || LOGIN_LOCK_MINUTES * 60) },
    );
  }
  let row: Record<string, string | null> | null;
  try {
    row = await db
      .prepare(
        `SELECT u.id, u.username, u.email, u.display_name AS displayName,
                u.department, u.team_id AS teamId, u.is_assignable AS isAssignable, u.must_change_password AS mustChangePassword, u.role_id AS roleId, u.password_hash AS passwordHash,
                u.password_salt AS passwordSalt,
                r.code AS roleCode, r.name AS roleName, r.permissions
         FROM app_users u JOIN roles r ON r.id = u.role_id
         WHERE (lower(u.username) = ? OR lower(u.email) = ?)
           AND u.status = 'active'`,
      )
      .bind(username, username)
      .first<Record<string, string | null>>();
  } catch (error) {
    console.error("Authentication user query failed", error);
    throw new Error("AUTH_USER_QUERY", { cause: error });
  }
  let passwordMatches = false;
  if (row?.passwordHash && row.passwordSalt) {
    try {
      passwordMatches = await verifyPassword(
        password,
        row.passwordHash,
        row.passwordSalt,
      );
    } catch (error) {
      console.error("Password verification failed", error);
      throw new Error("AUTH_PASSWORD_VERIFY", { cause: error });
    }
  }
  if (
    !row ||
    !row.passwordHash ||
    !row.passwordSalt ||
    !passwordMatches
  ) {
    await recordLoginAttempt(db, username, rate.ipHash, false);
    return json({ message: "帳號或密碼錯誤，請重新輸入。" }, 401);
  }

  await recordLoginAttempt(db, username, rate.ipHash, true);
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO auth_sessions
            (id, user_id, token_hash, expires_at, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          row.id,
          tokenHash,
          expiresAt.toISOString(),
          now.toISOString(),
          now.toISOString(),
        ),
      db
        .prepare("UPDATE app_users SET last_login_at = ? WHERE id = ?")
        .bind(now.toISOString(), row.id),
    ]);
  } catch (error) {
    console.error("Authentication session write failed", error);
    throw new Error("AUTH_SESSION_WRITE", { cause: error });
  }
  const identity = toIdentity(row);
  try {
    await audit(db, identity, "login", "session", null, {
      username: identity.username,
      role: identity.roleCode,
    });
  } catch (error) {
    console.error("Login audit failed", error);
  }
  return json(
    { ok: true, user: identity, message: `歡迎登入，${identity.displayName}。` },
    200,
    { "set-cookie": sessionCookie(request, token) },
  );
}

export async function handleLoginRequest(
  request: Request,
  db: D1Database,
  allowDemoAccounts = false,
) {
  try {
    return await handleLoginCore(request, db, allowDemoAccounts);
  } catch (error) {
    console.error("Login initialization failed", error);
    const diagnosticCode =
      error instanceof Error && /^AUTH_[A-Z_]+$/.test(error.message)
        ? error.message
        : "AUTH_UNKNOWN";
    return json(
      {
        error: diagnosticCode,
        message: "登入服務初始化失敗，請稍後再試或聯絡系統管理員。",
      },
      503,
    );
  }
}

export async function handleLogoutRequest(request: Request, db: D1Database) {
  if (request.method !== "POST") {
    return json({ message: "不支援此操作。" }, 405);
  }
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    await db
      .prepare(
        "UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
      )
      .bind(new Date().toISOString(), await sha256(token))
      .run();
  }
  return json(
    { ok: true, message: "已安全登出。" },
    200,
    { "set-cookie": sessionCookie(request, "", 0) },
  );
}

export async function handleChangePasswordRequest(request: Request, db: D1Database) {
  if (request.method !== "POST") return json({ message: "不支援此操作。" }, 405);
  const identityResult = await requireIdentity(request, db, { allowPasswordChange: true });
  if (!identityResult.identity) return identityResult.response!;
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ message: "資料格式不正確。" }, 400);
  }
  const currentPassword = clean(payload.currentPassword, 200);
  const newPassword = clean(payload.newPassword, 200);
  if (!currentPassword || newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return json({ error: "PASSWORD_POLICY", message: "新密碼至少 8 碼，且必須包含英文大小寫字母、數字與特殊符號。" }, 400);
  }
  if (currentPassword === newPassword) return json({ error: "PASSWORD_REUSED", message: "新密碼不可與目前密碼相同。" }, 400);
  const account = await db.prepare("SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM app_users WHERE id = ? AND status = 'active'").bind(identityResult.identity.id).first<{ passwordHash: string | null; passwordSalt: string | null }>();
  if (!account?.passwordHash || !account.passwordSalt || !(await verifyPassword(currentPassword, account.passwordHash, account.passwordSalt))) {
    return json({ error: "CURRENT_PASSWORD_INVALID", message: "目前密碼不正確。" }, 400);
  }
  const record = await createPasswordRecord(newPassword);
  await db.batch([
    db.prepare("UPDATE app_users SET password_hash=?, password_salt=?, password_changed_at=?, must_change_password=0, updated_at=? WHERE id=?").bind(record.passwordHash, record.passwordSalt, new Date().toISOString(), new Date().toISOString(), identityResult.identity.id),
    db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(identityResult.identity.id),
  ]);
  await audit(db, identityResult.identity, "change_password", "user", identityResult.identity.id);
  return json({ ok: true, message: "密碼已變更，請使用新密碼重新登入。" }, 200, { "set-cookie": sessionCookie(request, "", 0) });
}

export async function audit(
  db: D1Database,
  identity: Identity,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: unknown,
) {
  await db
    .prepare(
      `INSERT INTO audit_logs
        (id, actor_email, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      identity.email,
      action,
      entityType,
      entityId,
      details === undefined ? null : JSON.stringify(details),
      new Date().toISOString(),
    )
    .run();
}
