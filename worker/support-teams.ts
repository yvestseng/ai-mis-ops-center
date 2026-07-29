import { json, requireIdentity } from "./auth";

export async function handleSupportTeamRequest(
  request: Request,
  db: D1Database,
  teamId?: string,
) {
  if (request.method !== "GET") {
    return json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
  }
  const auth = await requireIdentity(request, db);
  if (!auth.identity) return auth.response!;

  if (!teamId) {
    const result = await db.prepare(
      `SELECT id, team_code AS teamCode, team_name AS teamName,
              description, display_order AS displayOrder
       FROM support_teams WHERE is_active = 1
       ORDER BY display_order, team_name`,
    ).all();
    return json({ teams: result.results });
  }

  const team = await db.prepare(
    `SELECT id, team_name AS teamName
     FROM support_teams WHERE id = ? AND is_active = 1`,
  ).bind(teamId).first<{ id: string; teamName: string }>();
  if (!team) {
    return json({ error: "NOT_FOUND", message: "找不到指定的維運團隊。" }, 404);
  }

  const result = await db.prepare(
    `SELECT u.id, u.display_name AS displayName, u.email,
            r.code AS roleCode, u.team_id AS teamId
     FROM app_users u JOIN roles r ON r.id = u.role_id
     WHERE u.team_id = ? AND u.is_assignable = 1
       AND u.status = 'active' AND r.code IN ('admin','operator')
     ORDER BY u.display_name`,
  ).bind(teamId).all();

  return json({ team, members: result.results });
}
