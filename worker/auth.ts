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
};

type PasswordRecord = {
  passwordHash: string;
  passwordSalt: string;
};

const SESSION_COOKIE = "mis_session";
const SESSION_SECONDS = 8 * 60 * 60;
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

async function ensureAuthSchema(db: D1Database) {
  // A fresh local D1 database does not contain the application tables yet.
  // Create authentication dependencies first. Each statement is idempotent,
  // making this safe for both local and existing hosted databases.
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS roles (
        id text PRIMARY KEY NOT NULL,
        code text NOT NULL,
        name text NOT NULL,
        permissions text DEFAULT '[]' NOT NULL,
        is_system integer DEFAULT 0 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS app_users (
        id text PRIMARY KEY NOT NULL,
        username text,
        email text NOT NULL,
        display_name text NOT NULL,
        department text,
        team_id text,
        is_assignable integer DEFAULT 0 NOT NULL,
        role_id text NOT NULL,
        password_hash text,
        password_salt text,
        password_changed_at text,
        status text DEFAULT 'active' NOT NULL,
        last_login_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id text PRIMARY KEY NOT NULL,
        actor_email text NOT NULL,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text,
        details text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
    ),
  ]);

  // Older deployments may already have app_users without local-login fields.
  // Add only columns that are missing so existing data is preserved.
  const tableInfo = await db
    .prepare("PRAGMA table_info('app_users')")
    .all<{ name: string }>();
  const columns = new Set(
    (tableInfo.results || []).map((column) => String(column.name)),
  );
  if (!columns.size) {
    throw new Error("app_users table could not be created");
  }

  const missingColumns = [
    ["username", "ALTER TABLE app_users ADD username text"],
    ["password_hash", "ALTER TABLE app_users ADD password_hash text"],
    ["password_salt", "ALTER TABLE app_users ADD password_salt text"],
    ["team_id", "ALTER TABLE app_users ADD team_id text"],
    ["is_assignable", "ALTER TABLE app_users ADD is_assignable integer DEFAULT 0 NOT NULL"],
    [
      "password_changed_at",
      "ALTER TABLE app_users ADD password_changed_at text",
    ],
  ] as const;
  for (const [name, sql] of missingColumns) {
    if (!columns.has(name)) {
      await db.prepare(sql).run();
    }
  }

  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        token_hash text NOT NULL,
        expires_at text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_seen_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        revoked_at text,
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
      )`,
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_uq ON auth_sessions(token_hash)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_user_expires_idx ON auth_sessions(user_id, expires_at)",
    ),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_uq ON app_users(username)",
    ),
  ]);
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
              u.department, u.team_id AS teamId, u.is_assignable AS isAssignable, u.role_id AS roleId,
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
  return (
    identity.roleCode === "admin" ||
    identity.permissions.includes(permission)
  );
}

export async function requireIdentity(request: Request, db: D1Database) {
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

async function handleLoginCore(request: Request, db: D1Database) {
  if (request.method !== "POST") {
    return json({ message: "不支援此操作。" }, 405);
  }
  try {
    await ensureAuthSchema(db);
  } catch (error) {
    console.error("Auth schema initialization failed", error);
    throw new Error("AUTH_SCHEMA", { cause: error });
  }
  try {
    await ensureDemoAccounts(db);
  } catch (error) {
    console.error("Demo account initialization failed", error);
    throw new Error("AUTH_SEED", { cause: error });
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
  let row: Record<string, string | null> | null;
  try {
    row = await db
      .prepare(
        `SELECT u.id, u.username, u.email, u.display_name AS displayName,
                u.department, u.team_id AS teamId, u.is_assignable AS isAssignable, u.role_id AS roleId, u.password_hash AS passwordHash,
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
    return json({ message: "帳號或密碼錯誤，請重新輸入。" }, 401);
  }

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

export async function handleLoginRequest(request: Request, db: D1Database) {
  try {
    return await handleLoginCore(request, db);
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
