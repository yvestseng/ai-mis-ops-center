import { audit, json, requirePermission, type Identity } from "./auth";

type JsonObject = Record<string, unknown>;
type GovernanceResource = "knowledge-articles" | "major-incidents";
const articleStatuses = new Set(["草稿", "審核中", "已發布", "已停用"]);
const incidentStatuses = new Set(["待確認重大事件", "進行中", "監控中", "已結案"]);
const severities = new Set(["P1", "P2", "P3"]);

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function stringList(value: unknown, maxItems = 30) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, maxItems))]
    : [];
}
async function body(request: Request): Promise<JsonObject | Response> {
  try { return (await request.json()) as JsonObject; }
  catch { return json({ error: "INVALID_JSON", message: "資料格式不正確。" }, 400); }
}
function isResponse(value: JsonObject | Response): value is Response { return value instanceof Response; }

async function replaceLinks(
  db: D1Database, table: "knowledge_article_ticket_links" | "major_incident_ticket_links",
  ownerColumn: "article_id" | "incident_id", ownerId: string, ticketIds: string[], outcomes?: Record<string, string>,
) {
  const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`).bind(ownerId)];
  for (const ticketId of ticketIds) {
    if (table === "knowledge_article_ticket_links") {
      statements.push(db.prepare(`INSERT INTO knowledge_article_ticket_links (article_id, ticket_id, resolution_outcome, linked_at) VALUES (?, ?, ?, ?)`)
        .bind(ownerId, ticketId, textValue(outcomes?.[ticketId], 24) || "used", new Date().toISOString()));
    } else {
      statements.push(db.prepare(`INSERT INTO major_incident_ticket_links (incident_id, ticket_id, linked_at) VALUES (?, ?, ?)`)
        .bind(ownerId, ticketId, new Date().toISOString()));
    }
  }
  await db.batch(statements);
}

async function listKnowledgeArticles(db: D1Database) {
  const result = await db.prepare(
    `SELECT a.id, a.title, a.summary, a.content, a.category, a.status, a.review_due_at AS reviewDueAt,
            a.published_at AS publishedAt, a.updated_at AS updatedAt, a.created_by AS createdBy,
            COUNT(l.ticket_id) AS usageCount,
            COALESCE(ROUND(100.0 * SUM(CASE WHEN l.resolution_outcome = 'resolved' THEN 1 ELSE 0 END) / NULLIF(COUNT(l.ticket_id), 0)), 0) AS resolutionRate,
            COALESCE(json_group_array(json_object('id', t.id, 'ticketNumber', t.ticket_number, 'title', t.title, 'outcome', l.resolution_outcome)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tickets
     FROM knowledge_articles a LEFT JOIN knowledge_article_ticket_links l ON l.article_id = a.id
     LEFT JOIN tickets t ON t.id = l.ticket_id GROUP BY a.id
     ORDER BY CASE a.status WHEN '已發布' THEN 1 WHEN '審核中' THEN 2 WHEN '草稿' THEN 3 ELSE 4 END, a.updated_at DESC LIMIT 100`,
  ).all();
  return json({ articles: (result.results ?? []).map((row) => ({ ...row, tickets: JSON.parse(String(row.tickets || "[]")) })) });
}

async function listMajorIncidents(db: D1Database) {
  const result = await db.prepare(
    `SELECT i.id, i.title, i.severity, i.status, i.impact_scope AS impactScope, i.incident_commander AS incidentCommander,
            i.supervisor_name AS supervisorName, i.supervisor_email AS supervisorEmail, i.closure_summary AS closureSummary,
            i.opened_at AS openedAt, i.resolved_at AS resolvedAt, i.updated_at AS updatedAt, COUNT(l.ticket_id) AS linkedTicketCount,
            MAX(n.notified_at) AS lastNotifiedAt,
            COALESCE(json_group_array(json_object('id', t.id, 'ticketNumber', t.ticket_number, 'title', t.title)) FILTER (WHERE t.id IS NOT NULL), '[]') AS tickets
     FROM major_incidents i LEFT JOIN major_incident_ticket_links l ON l.incident_id = i.id
     LEFT JOIN tickets t ON t.id = l.ticket_id LEFT JOIN major_incident_notifications n ON n.incident_id = i.id
     GROUP BY i.id ORDER BY CASE i.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, i.opened_at DESC LIMIT 100`,
  ).all();
  return json({ incidents: (result.results ?? []).map((row) => ({ ...row, tickets: JSON.parse(String(row.tickets || "[]")) })) });
}

async function candidates(db: D1Database) {
  const result = await db.prepare(
    `SELECT t.id, t.ticket_number AS ticketNumber, t.title, t.priority, t.status, t.category, t.updated_at AS updatedAt,
            CASE WHEN t.status = '已結案' THEN 1 ELSE 0 END AS knowledgeEligible,
            CASE WHEN t.priority IN ('緊急','高') OR COALESCE(t.service_interruption,'') <> '' THEN 1 ELSE 0 END AS incidentEligible
     FROM tickets t
     ORDER BY t.updated_at DESC LIMIT 100`,
  ).all();
  return json({ tickets: result.results ?? [] });
}

async function saveArticle(request: Request, db: D1Database, identity: Identity, articleId?: string) {
  const payload = await body(request); if (isResponse(payload)) return payload;
  const title = textValue(payload.title, 160), summary = textValue(payload.summary, 600), content = textValue(payload.content, 12000);
  const status = textValue(payload.status, 20) || "草稿";
  if (title.length < 4 || summary.length < 8 || !articleStatuses.has(status)) return json({ error: "INVALID_ARTICLE", message: "請填寫標題、摘要並選擇有效狀態。" }, 400);
  const now = new Date().toISOString(), id = articleId || crypto.randomUUID();
  const reviewDueAt = textValue(payload.reviewDueAt, 40) || null;
  const ticketIds = stringList(payload.ticketIds); const outcomes = (payload.resolutionOutcomes && typeof payload.resolutionOutcomes === "object" ? payload.resolutionOutcomes : {}) as Record<string, string>;
  const existing = articleId ? await db.prepare("SELECT id FROM knowledge_articles WHERE id = ?").bind(id).first() : null;
  if (articleId && !existing) return json({ error: "NOT_FOUND", message: "找不到知識文章。" }, 404);
  if (articleId) await db.prepare(`UPDATE knowledge_articles SET title=?, summary=?, content=?, category=?, status=?, review_due_at=?, published_at=CASE WHEN ?='已發布' AND published_at IS NULL THEN ? ELSE published_at END, updated_by=?, updated_at=? WHERE id=?`)
    .bind(title, summary, content || null, textValue(payload.category, 60) || "其他", status, reviewDueAt, status, now, identity.email, now, id).run();
  else await db.prepare(`INSERT INTO knowledge_articles (id,title,summary,content,category,status,review_due_at,published_at,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, title, summary, content || null, textValue(payload.category, 60) || "其他", status, reviewDueAt, status === "已發布" ? now : null, identity.email, identity.email, now, now).run();
  await replaceLinks(db, "knowledge_article_ticket_links", "article_id", id, ticketIds, outcomes);
  await audit(db, identity, articleId ? "update" : "create", "knowledge_article", id, { title, status, ticketCount: ticketIds.length });
  return json({ ok: true, id, message: status === "已發布" ? "知識文章已發布。" : "知識文章已儲存。" }, articleId ? 200 : 201);
}

async function saveIncident(request: Request, db: D1Database, identity: Identity, incidentId?: string) {
  const payload = await body(request); if (isResponse(payload)) return payload;
  const title = textValue(payload.title, 160), status = textValue(payload.status, 24) || "待確認重大事件", severity = textValue(payload.severity, 4) || "P2";
  const closureSummary = textValue(payload.closureSummary, 3000);
  if (title.length < 4 || !incidentStatuses.has(status) || !severities.has(severity) || (status === "已結案" && closureSummary.length < 8)) return json({ error: "INVALID_INCIDENT", message: "請填寫事件資訊；結案時必須填寫至少 8 字的結案摘要。" }, 400);
  const now = new Date().toISOString(), id = incidentId || crypto.randomUUID(), ticketIds = stringList(payload.ticketIds);
  const existing = incidentId ? await db.prepare("SELECT id FROM major_incidents WHERE id=?").bind(id).first() : null;
  if (incidentId && !existing) return json({ error: "NOT_FOUND", message: "找不到重大事件。" }, 404);
  const values = [title, severity, status, textValue(payload.impactScope, 1000) || null, textValue(payload.incidentCommander, 120) || null, textValue(payload.supervisorName, 120) || null, textValue(payload.supervisorEmail, 200) || null, closureSummary || null, status === "已結案" ? now : null, identity.email, now];
  if (incidentId) await db.prepare(`UPDATE major_incidents SET title=?,severity=?,status=?,impact_scope=?,incident_commander=?,supervisor_name=?,supervisor_email=?,closure_summary=?,resolved_at=COALESCE(?,resolved_at),updated_by=?,updated_at=? WHERE id=?`).bind(...values, id).run();
  else await db.prepare(`INSERT INTO major_incidents (id,title,severity,status,impact_scope,incident_commander,supervisor_name,supervisor_email,closure_summary,opened_at,resolved_at,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, ...values.slice(0, 8), now, values[8], identity.email, identity.email, now, now).run();
  await replaceLinks(db, "major_incident_ticket_links", "incident_id", id, ticketIds);
  await audit(db, identity, incidentId ? "update" : "create", "major_incident", id, { title, status, ticketCount: ticketIds.length });
  return json({ ok: true, id, message: status === "已結案" ? "重大事件已結案。" : "重大事件已儲存。" }, incidentId ? 200 : 201);
}

async function notifyMajorIncident(request: Request, db: D1Database, incidentId: string, identity: Identity) {
  const payload = await body(request); if (isResponse(payload)) return payload;
  const existing = await db.prepare("SELECT id,title,supervisor_name AS supervisorName,supervisor_email AS supervisorEmail FROM major_incidents WHERE id=?").bind(incidentId).first<{ id:string; title:string; supervisorName:string|null; supervisorEmail:string|null }>();
  if (!existing) return json({ error: "NOT_FOUND", message: "找不到重大事件。" }, 404);
  const recipientName = textValue(payload.recipientName, 120) || existing.supervisorName || "主管";
  const recipientEmail = textValue(payload.recipientEmail, 200) || existing.supervisorEmail || null;
  const now = new Date().toISOString(), note = textValue(payload.note, 500) || `請覆核重大事件：${existing.title}`;
  await db.batch([
    db.prepare(`INSERT INTO major_incident_notifications (id,incident_id,notified_by,recipient_name,recipient_email,note,notification_status,notified_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), incidentId, identity.email, recipientName, recipientEmail, note, "recorded", now),
    db.prepare("UPDATE major_incidents SET supervisor_name=?, supervisor_email=COALESCE(?,supervisor_email), updated_at=?, updated_by=? WHERE id=?").bind(recipientName, recipientEmail, now, identity.email, incidentId),
  ]);
  await audit(db, identity, "notify", "major_incident", incidentId, { title: existing.title, recipientName, recipientEmail, note });
  return json({ ok: true, message: "已記錄主管通知。", notifiedAt: now });
}

async function importCandidates(request: Request, db: D1Database, identity: Identity) {
  const payload = await body(request); if (isResponse(payload)) return payload;
  const mode = textValue(payload.mode, 16), requestedIds = stringList(payload.ticketIds, 100);
  if (mode !== "knowledge" && mode !== "incidents") return json({ error: "INVALID_IMPORT", message: "請指定知識庫或重大事件匯入模式。" }, 400);
  const selected = requestedIds.length ? `AND t.id IN (${requestedIds.map(() => "?").join(",")})` : "";
  const where = mode === "knowledge" ? "t.status = '已結案'" : "(t.priority IN ('緊急','高') OR COALESCE(t.service_interruption,'') <> '') AND t.status <> '已結案'";
  const result = await db.prepare(`SELECT t.id,t.ticket_number AS ticketNumber,t.title,t.description,t.category,t.priority,t.impact_scope AS impactScope FROM tickets t WHERE ${where} ${selected} ORDER BY t.updated_at DESC LIMIT 100`).bind(...requestedIds).all<{id:string;ticketNumber:string;title:string;description:string;category:string;priority:string;impactScope:string|null}>();
  let created = 0; const now = new Date().toISOString();
  for (const ticket of result.results ?? []) {
    if (mode === "knowledge") {
      const exists = await db.prepare("SELECT 1 FROM knowledge_article_ticket_links WHERE ticket_id=? LIMIT 1").bind(ticket.id).first(); if (exists) continue;
      const id = crypto.randomUUID();
      await db.batch([db.prepare(`INSERT INTO knowledge_articles (id,title,summary,content,category,status,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,'草稿',?,?,?,?)`).bind(id, `【待覆核】${ticket.ticketNumber}｜${ticket.title}`, ticket.description.slice(0,600), ticket.description, ticket.category, identity.email, identity.email, now, now), db.prepare(`INSERT INTO knowledge_article_ticket_links (article_id,ticket_id,resolution_outcome,linked_at) VALUES (?,?,'resolved',?)`).bind(id,ticket.id,now)]); created++;
    } else {
      const exists = await db.prepare("SELECT 1 FROM major_incident_ticket_links WHERE ticket_id=? LIMIT 1").bind(ticket.id).first(); if (exists) continue;
      const id = crypto.randomUUID(), severity = ticket.priority === "緊急" ? "P1" : "P2";
      await db.batch([db.prepare(`INSERT INTO major_incidents (id,title,severity,status,impact_scope,opened_at,created_by,updated_by,created_at,updated_at) VALUES (?,?,'${severity}','待確認重大事件',?,?,?,?,?,?)`).bind(id, `【待確認】${ticket.ticketNumber}｜${ticket.title}`, ticket.impactScope || ticket.description.slice(0,500), now, identity.email, identity.email, now, now), db.prepare(`INSERT INTO major_incident_ticket_links (incident_id,ticket_id,linked_at) VALUES (?,?,?)`).bind(id,ticket.id,now)]); created++;
    }
  }
  await audit(db, identity, "import_candidates", mode === "knowledge" ? "knowledge_article" : "major_incident", mode, { created, requested: requestedIds.length });
  return json({ ok:true, created, message: `已建立 ${created} 筆${mode === "knowledge" ? "知識庫草稿" : "待確認重大事件"}。` });
}

export function handleGovernanceRequest(request: Request, db: D1Database, resource: GovernanceResource | "candidate-tickets" | "import-candidates", resourceId?: string) {
  const task = async () => {
    const permission = resource === "knowledge-articles" ? (request.method === "GET" ? "knowledge.read" : "knowledge.manage") : resource === "major-incidents" ? (request.method === "GET" ? "incidents.read" : "incidents.manage") : "governance.import";
    const auth = await requirePermission(request, db, permission); if (!auth.identity) return auth.response!; if (auth.response) return auth.response;
    if (resource === "candidate-tickets" && request.method === "GET") return candidates(db);
    if (resource === "import-candidates" && request.method === "POST") return importCandidates(request, db, auth.identity);
    if (resource === "knowledge-articles") { if (request.method === "GET" && !resourceId) return listKnowledgeArticles(db); if (request.method === "POST" && !resourceId) return saveArticle(request, db, auth.identity); if (request.method === "PATCH" && resourceId) return saveArticle(request, db, auth.identity, resourceId); }
    if (resource === "major-incidents") { if (request.method === "GET" && !resourceId) return listMajorIncidents(db); if (request.method === "POST" && !resourceId) return saveIncident(request, db, auth.identity); if (request.method === "PATCH" && resourceId) return saveIncident(request, db, auth.identity, resourceId); if (request.method === "POST" && resourceId) return notifyMajorIncident(request, db, resourceId, auth.identity); }
    return json({ error:"METHOD_NOT_ALLOWED", message:"不支援此操作。" },405);
  };
  return task().catch((error) => { console.error("governance request failed",error); return json({ error:"GOVERNANCE_REQUEST_FAILED",message:"服務治理資料暫時無法處理。" },500); });
}
