import { audit, json, requirePermission, type Identity } from "./auth";

type NotificationPayload = { note?: unknown };

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function listKnowledgeArticles(db: D1Database) {
  const result = await db.prepare(
    `SELECT a.id, a.title, a.summary, a.category, a.status,
            a.review_due_at AS reviewDueAt, a.published_at AS publishedAt,
            a.updated_at AS updatedAt,
            COUNT(l.ticket_id) AS usageCount,
            COALESCE(ROUND(100.0 * SUM(CASE WHEN l.resolution_outcome = 'resolved' THEN 1 ELSE 0 END) /
              NULLIF(COUNT(l.ticket_id), 0)), 0) AS resolutionRate
     FROM knowledge_articles a
     LEFT JOIN knowledge_article_ticket_links l ON l.article_id = a.id
     GROUP BY a.id
     ORDER BY CASE a.status WHEN '已發布' THEN 1 WHEN '審核中' THEN 2 ELSE 3 END,
              a.updated_at DESC
     LIMIT 100`,
  ).all();
  return json({ articles: result.results ?? [] });
}

async function listMajorIncidents(db: D1Database) {
  const result = await db.prepare(
    `SELECT i.id, i.title, i.severity, i.status,
            i.impact_scope AS impactScope, i.incident_commander AS incidentCommander,
            i.opened_at AS openedAt, i.resolved_at AS resolvedAt, i.updated_at AS updatedAt,
            COUNT(l.ticket_id) AS linkedTicketCount,
            MAX(n.notified_at) AS lastNotifiedAt
     FROM major_incidents i
     LEFT JOIN major_incident_ticket_links l ON l.incident_id = i.id
     LEFT JOIN major_incident_notifications n ON n.incident_id = i.id
     GROUP BY i.id
     ORDER BY CASE i.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
              i.opened_at DESC
     LIMIT 100`,
  ).all();
  return json({ incidents: result.results ?? [] });
}

async function notifyMajorIncident(
  request: Request,
  db: D1Database,
  incidentId: string,
  identity: Identity,
) {
  let payload: NotificationPayload = {};
  try {
    payload = (await request.json()) as NotificationPayload;
  } catch {
    return json({ error: "INVALID_JSON", message: "通知資料格式不正確。" }, 400);
  }
  const existing = await db.prepare("SELECT id, title FROM major_incidents WHERE id = ?")
    .bind(incidentId).first<{ id: string; title: string }>();
  if (!existing) return json({ error: "NOT_FOUND", message: "找不到重大事件。" }, 404);
  const now = new Date().toISOString();
  const note = textValue(payload.note, 500) || "已通知主管進行事件確認。";
  await db.batch([
    db.prepare(
      `INSERT INTO major_incident_notifications (id, incident_id, notified_by, note, notified_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), incidentId, identity.email, note, now),
    db.prepare("UPDATE major_incidents SET updated_at = ?, updated_by = ? WHERE id = ?")
      .bind(now, identity.email, incidentId),
  ]);
  await audit(db, identity, "notify", "major_incident", incidentId, { title: existing.title, note });
  return json({ ok: true, message: "已記錄主管通知。", notifiedAt: now });
}

export function handleGovernanceRequest(
  request: Request,
  db: D1Database,
  resource: "knowledge-articles" | "major-incidents",
  incidentId?: string,
) {
  const task = (async () => {
    const permission = resource === "knowledge-articles"
      ? "knowledge.read"
      : request.method === "PATCH" ? "incidents.manage" : "incidents.read";
    const auth = await requirePermission(request, db, permission);
    if (!auth.identity) return auth.response!;
    if (auth.response) return auth.response;
    if (resource === "knowledge-articles" && request.method === "GET") return listKnowledgeArticles(db);
    if (resource === "major-incidents" && request.method === "GET" && !incidentId) return listMajorIncidents(db);
    if (resource === "major-incidents" && request.method === "PATCH" && incidentId) {
      return notifyMajorIncident(request, db, incidentId, auth.identity);
    }
    return json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
  })();
  return Promise.resolve(task).catch((error) => {
    console.error("governance request failed", error);
    return json({ error: "GOVERNANCE_REQUEST_FAILED", message: "服務治理資料暫時無法讀取。" }, 500);
  });
}
