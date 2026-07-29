import {
  audit,
  createPasswordRecord,
  json,
  requireIdentity,
  requirePermission,
  type Identity,
  type Permission,
} from "./auth";

type Entity = "users" | "roles" | "teams" | "assets" | "services" | "audit";

function clean(value: unknown, length = 200) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

async function body(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const entityPermission: Record<
  Entity,
  { read: Permission; write?: Permission }
> = {
  users: { read: "rbac.manage", write: "rbac.manage" },
  roles: { read: "rbac.manage", write: "rbac.manage" },
  teams: { read: "rbac.manage", write: "rbac.manage" },
  assets: { read: "assets.read", write: "assets.write" },
  services: { read: "services.read", write: "services.write" },
  audit: { read: "audit.read" },
};

async function list(entity: Entity, db: D1Database) {
  const sql: Record<Entity, string> = {
    users: `SELECT u.id, u.username, u.email, u.display_name AS displayName,
                   u.department, u.team_id AS teamId,
                   COALESCE(st.team_name, '') AS teamName,
                   u.is_assignable AS isAssignable,
                   u.status, u.last_login_at AS lastLoginAt,
                   CASE WHEN u.password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword,
                   u.role_id AS roleId, r.name AS roleName, r.code AS roleCode
            FROM app_users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN support_teams st ON st.id = u.team_id
            ORDER BY u.status, u.display_name`,
    roles: `SELECT id, code, name, permissions, is_system AS isSystem,
                   created_at AS createdAt, updated_at AS updatedAt
            FROM roles ORDER BY is_system DESC, name`,
    teams: `SELECT st.id, st.team_code AS teamCode, st.team_name AS teamName,
                   st.description, st.display_order AS displayOrder,
                   st.is_active AS isActive,
                   COUNT(u.id) AS memberCount,
                   SUM(CASE WHEN u.is_assignable = 1 AND u.status = 'active' THEN 1 ELSE 0 END) AS assignableCount,
                   st.created_at AS createdAt, st.updated_at AS updatedAt
            FROM support_teams st
            LEFT JOIN app_users u ON u.team_id = st.id
            GROUP BY st.id
            ORDER BY st.display_order, st.team_name`,
    assets: `SELECT id, asset_tag AS assetTag, name, asset_type AS assetType,
                    owner_name AS ownerName, department, location, status,
                    warranty_end AS warrantyEnd, notes,
                    created_at AS createdAt, updated_at AS updatedAt
             FROM assets ORDER BY updated_at DESC`,
    services: `SELECT id, name, service_type AS serviceType,
                      owner_team AS ownerTeam, status, availability, endpoint,
                      description, last_checked_at AS lastCheckedAt,
                      created_at AS createdAt, updated_at AS updatedAt
               FROM managed_services ORDER BY name`,
    audit: `SELECT id, actor_email AS actorEmail, action,
                   entity_type AS entityType, entity_id AS entityId,
                   details, created_at AS createdAt
            FROM audit_logs ORDER BY created_at DESC LIMIT 200`,
  };
  const result = await db.prepare(sql[entity]).all();
  return json({ items: result.results });
}

async function createTeam(
  data: Record<string, unknown>,
  db: D1Database,
  identity: Identity,
) {
  const teamCode = clean(data.teamCode, 40).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const teamName = clean(data.teamName, 100);
  const description = clean(data.description, 500) || null;
  const displayOrder = Math.max(0, Math.min(9999, Number(data.displayOrder) || 0));
  if (!teamCode || !teamName) {
    return json({ message: "團隊代碼與團隊名稱為必填。" }, 400);
  }
  const id = `team-${teamCode.toLowerCase().replace(/_/g, "-")}`;
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO support_teams
       (id, team_code, team_name, description, display_order, is_active,
        created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    ).bind(id, teamCode, teamName, description, displayOrder, now, identity.email, now, identity.email).run();
    await audit(db, identity, "create", "team", id, { teamCode, teamName });
    return json({ ok: true, id, message: "維運團隊已建立。" }, 201);
  } catch {
    return json({ message: "團隊代碼或名稱已存在。" }, 409);
  }
}

async function createUser(
  data: Record<string, unknown>,
  db: D1Database,
  identity: Identity,
) {
  const username = clean(data.username, 80).toLowerCase();
  const password = clean(data.password, 200);
  const email = clean(data.email, 160).toLowerCase();
  const displayName = clean(data.displayName, 80);
  const department = clean(data.department, 80) || null;
  const roleId = clean(data.roleId, 80) || "role-user";
  const teamId = clean(data.teamId, 80) || null;
  const isAssignable =
    roleId === "role-user" ? 0 : data.isAssignable === true || data.isAssignable === 1 ? 1 : 0;
  if (
    !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username) ||
    !email.includes("@") ||
    !displayName ||
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return json(
      { message: "請填寫有效帳號、姓名、信箱，以及至少 8 碼且包含英文字母與數字的初始密碼。" },
      400,
    );
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordRecord = await createPasswordRecord(password);
  try {
    await db
      .prepare(
        `INSERT INTO app_users
          (id, username, email, display_name, department, team_id, is_assignable, role_id,
           password_hash, password_salt, password_changed_at,
           status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(
        id,
        username,
        email,
        displayName,
        department,
        teamId,
        isAssignable,
        roleId,
        passwordRecord.passwordHash,
        passwordRecord.passwordSalt,
        now,
        now,
        now,
      )
      .run();
    await audit(db, identity, "create", "user", id, {
      username,
      email,
      roleId,
    });
    return json(
      {
        ok: true,
        id,
        message: `測試帳號 ${username} 已建立，可立即使用初始密碼登入。`,
      },
      201,
    );
  } catch {
    return json({ message: "帳號已存在，或指定角色無效。" }, 409);
  }
}

async function createAsset(
  data: Record<string, unknown>,
  db: D1Database,
  identity: Identity,
) {
  const assetTag = clean(data.assetTag, 80).toUpperCase();
  const name = clean(data.name, 120);
  const assetType = clean(data.assetType, 50);
  if (!assetTag || !name || !assetType) {
    return json({ message: "設備編號、名稱與類型為必填。" }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO assets
          (id, asset_tag, name, asset_type, owner_name, department, location,
           status, warranty_end, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        assetTag,
        name,
        assetType,
        clean(data.ownerName, 80) || null,
        clean(data.department, 80) || null,
        clean(data.location, 120) || null,
        clean(data.status, 30) || "使用中",
        clean(data.warrantyEnd, 20) || null,
        clean(data.notes, 1000) || null,
        now,
        now,
      )
      .run();
    await audit(db, identity, "create", "asset", id, { assetTag });
    return json({ ok: true, id, message: "設備資料已建立。" }, 201);
  } catch {
    return json({ message: "設備編號已存在。" }, 409);
  }
}

async function createService(
  data: Record<string, unknown>,
  db: D1Database,
  identity: Identity,
) {
  const name = clean(data.name, 120);
  const serviceType = clean(data.serviceType, 50);
  const ownerTeam = clean(data.ownerTeam, 80);
  if (!name || !serviceType || !ownerTeam) {
    return json({ message: "服務名稱、類型與負責團隊為必填。" }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO managed_services
          (id, name, service_type, owner_team, status, availability,
           endpoint, description, last_checked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        name,
        serviceType,
        ownerTeam,
        clean(data.status, 30) || "正常",
        Math.max(0, Math.min(100, Number(data.availability) || 100)),
        clean(data.endpoint, 300) || null,
        clean(data.description, 1000) || null,
        now,
        now,
        now,
      )
      .run();
    await audit(db, identity, "create", "service", id, { name });
    return json({ ok: true, id, message: "服務資料已建立。" }, 201);
  } catch {
    return json({ message: "服務名稱已存在。" }, 409);
  }
}

async function update(
  entity: Entity,
  id: string,
  data: Record<string, unknown>,
  db: D1Database,
  identity: Identity,
) {
  const now = new Date().toISOString();
  if (entity === "users") {
    if (id === "user-owner" && clean(data.status) === "disabled") {
      return json({ message: "主要系統管理員不可停用。" }, 400);
    }
    const newPassword = clean(data.newPassword, 200);
    const newUsername = clean(data.username, 80).toLowerCase();
    const requestedRoleId = clean(data.roleId, 80);
    const requestedTeamId = data.teamId === undefined ? "__KEEP__" : clean(data.teamId, 80);
    const requestedAssignable =
      data.isAssignable === undefined
        ? -1
        : data.isAssignable === true || data.isAssignable === 1
          ? 1
          : 0;
    if (
      newPassword &&
      (newPassword.length < 8 ||
        !/[A-Za-z]/.test(newPassword) ||
        !/\d/.test(newPassword))
    ) {
      return json({ message: "新密碼至少 8 碼，且必須包含英文字母與數字。" }, 400);
    }
    if (
      newUsername &&
      !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(newUsername)
    ) {
      return json({ message: "登入帳號格式不正確。" }, 400);
    }
    if (newPassword) {
      const passwordRecord = await createPasswordRecord(newPassword);
      await db.batch([
        db
          .prepare(
            `UPDATE app_users
             SET username = COALESCE(NULLIF(?, ''), username),
                 display_name = COALESCE(NULLIF(?, ''), display_name),
                 department = ?,
                 team_id = CASE WHEN ? = '__KEEP__' THEN team_id ELSE NULLIF(?, '') END,
                 is_assignable = CASE
                   WHEN COALESCE(NULLIF(?, ''), role_id) = 'role-user' THEN 0
                   WHEN ? = -1 THEN is_assignable ELSE ? END,
                 role_id = COALESCE(NULLIF(?, ''), role_id),
                 status = COALESCE(NULLIF(?, ''), status),
                 password_hash = ?, password_salt = ?,
                 password_changed_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            newUsername,
            clean(data.displayName, 80),
            clean(data.department, 80) || null,
            requestedTeamId,
            requestedTeamId,
            requestedRoleId,
            requestedAssignable,
            requestedAssignable,
            requestedRoleId,
            clean(data.status, 20),
            passwordRecord.passwordHash,
            passwordRecord.passwordSalt,
            now,
            now,
            id,
          ),
        db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(id),
      ]);
    } else {
      await db
        .prepare(
          `UPDATE app_users
           SET display_name = COALESCE(NULLIF(?, ''), display_name),
               department = ?,
               team_id = CASE WHEN ? = '__KEEP__' THEN team_id ELSE NULLIF(?, '') END,
               is_assignable = CASE
                 WHEN COALESCE(NULLIF(?, ''), role_id) = 'role-user' THEN 0
                 WHEN ? = -1 THEN is_assignable ELSE ? END,
               role_id = COALESCE(NULLIF(?, ''), role_id),
               status = COALESCE(NULLIF(?, ''), status), updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          clean(data.displayName, 80),
          clean(data.department, 80) || null,
          requestedTeamId,
          requestedTeamId,
          requestedRoleId,
          requestedAssignable,
          requestedAssignable,
          requestedRoleId,
          clean(data.status, 20),
          now,
          id,
        )
        .run();
    }
  } else if (entity === "teams") {
    const teamCode = clean(data.teamCode, 40).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const teamName = clean(data.teamName, 100);
    const displayOrder = Math.max(0, Math.min(9999, Number(data.displayOrder) || 0));
    const isActive = data.isActive === true || data.isActive === 1 ? 1 : 0;
    if (!teamCode || !teamName) {
      return json({ message: "團隊代碼與團隊名稱為必填。" }, 400);
    }
    await db.prepare(
      `UPDATE support_teams
       SET team_code=?, team_name=?, description=?, display_order=?,
           is_active=?, updated_at=?, updated_by=?
       WHERE id=?`,
    ).bind(
      teamCode,
      teamName,
      clean(data.description, 500) || null,
      displayOrder,
      isActive,
      now,
      identity.email,
      id,
    ).run();
  } else if (entity === "roles") {
    const permissions = Array.isArray(data.permissions)
      ? JSON.stringify(data.permissions.map((x) => clean(x, 80)).filter(Boolean))
      : "[]";
    await db
      .prepare(
        "UPDATE roles SET permissions = ?, updated_at = ? WHERE id = ?",
      )
      .bind(permissions, now, id)
      .run();
  } else if (entity === "assets") {
    await db
      .prepare(
        `UPDATE assets SET name=?, asset_type=?, owner_name=?, department=?,
         location=?, status=?, warranty_end=?, notes=?, updated_at=? WHERE id=?`,
      )
      .bind(
        clean(data.name, 120),
        clean(data.assetType, 50),
        clean(data.ownerName, 80) || null,
        clean(data.department, 80) || null,
        clean(data.location, 120) || null,
        clean(data.status, 30),
        clean(data.warrantyEnd, 20) || null,
        clean(data.notes, 1000) || null,
        now,
        id,
      )
      .run();
  } else if (entity === "services") {
    await db
      .prepare(
        `UPDATE managed_services SET name=?, service_type=?, owner_team=?,
         status=?, availability=?, endpoint=?, description=?,
         last_checked_at=?, updated_at=? WHERE id=?`,
      )
      .bind(
        clean(data.name, 120),
        clean(data.serviceType, 50),
        clean(data.ownerTeam, 80),
        clean(data.status, 30),
        Math.max(0, Math.min(100, Number(data.availability) || 0)),
        clean(data.endpoint, 300) || null,
        clean(data.description, 1000) || null,
        now,
        now,
        id,
      )
      .run();
  } else {
    return json({ message: "此資料不可修改。" }, 405);
  }
  await audit(db, identity, "update", entity, id, data);
  return json({ ok: true, message: "資料已更新。" });
}

async function remove(
  entity: Entity,
  id: string,
  db: D1Database,
  identity: Identity,
) {
  if (entity === "users" && id === "user-owner") {
    return json({ message: "主要系統管理員不可刪除。" }, 400);
  }
  if (entity === "teams") {
    const usage = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM app_users WHERE team_id = ?) AS userCount,
         (SELECT COUNT(*) FROM tickets WHERE assigned_team_id = ? OR ai_suggested_team_id = ?) AS ticketCount`,
    ).bind(id, id, id).first<{ userCount: number; ticketCount: number }>();
    if (Number(usage?.userCount || 0) > 0 || Number(usage?.ticketCount || 0) > 0) {
      await db.prepare(
        "UPDATE support_teams SET is_active=0, updated_at=?, updated_by=? WHERE id=?",
      ).bind(new Date().toISOString(), identity.email, id).run();
      await audit(db, identity, "deactivate", "team", id, usage);
      return json({ ok: true, message: "此團隊已有關聯資料，已改為停用而非刪除。" });
    }
    await db.prepare("DELETE FROM support_teams WHERE id = ?").bind(id).run();
    await audit(db, identity, "delete", "team", id);
    return json({ ok: true, message: "維運團隊已刪除。" });
  }
  const table =
    entity === "users"
      ? "app_users"
      : entity === "assets"
        ? "assets"
        : entity === "services"
          ? "managed_services"
          : null;
  if (!table) return json({ message: "此資料不可刪除。" }, 405);
  await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  await audit(db, identity, "delete", entity, id);
  return json({ ok: true, message: "資料已刪除。" });
}

export async function handleSessionRequest(request: Request, db: D1Database) {
  const result = await requireIdentity(request, db);
  if (!result.identity) return result.response!;
  return json({ user: result.identity });
}

export async function handleAdminRequest(
  request: Request,
  db: D1Database,
  entity: Entity,
  id?: string,
) {
  const required = request.method === "GET"
    ? entityPermission[entity].read
    : entityPermission[entity].write;
  if (!required) return json({ message: "此資源不支援寫入。" }, 405);
  const auth = await requirePermission(request, db, required);
  if (!auth.identity) return auth.response!;
  if (auth.response) return auth.response;

  if (request.method === "GET" && !id) return list(entity, db);
  const data = await body(request);
  if (!data && request.method !== "DELETE") {
    return json({ message: "資料格式不正確。" }, 400);
  }
  if (request.method === "POST" && !id) {
    if (entity === "users") return createUser(data!, db, auth.identity);
    if (entity === "teams") return createTeam(data!, db, auth.identity);
    if (entity === "assets") return createAsset(data!, db, auth.identity);
    if (entity === "services") return createService(data!, db, auth.identity);
  }
  if (request.method === "PATCH" && id) {
    return update(entity, id, data!, db, auth.identity);
  }
  if (request.method === "DELETE" && id) {
    return remove(entity, id, db, auth.identity);
  }
  return json({ message: "不支援此操作。" }, 405);
}
