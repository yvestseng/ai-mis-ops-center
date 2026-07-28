type TicketPayload = {
  requesterToken?: unknown;
  requesterName?: unknown;
  requesterEmail?: unknown;
  department?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  priority?: unknown;
  source?: unknown;
  location?: unknown;
  assetTag?: unknown;
  assignedTeam?: unknown;
  status?: unknown;
  note?: unknown;
  actorName?: unknown;
};

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function ticketNumber(now: Date) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `INC-${date}-${suffix}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createTicket(
  request: Request,
  db: D1Database,
  identity: Identity,
) {
  let payload: TicketPayload;
  try {
    payload = (await request.json()) as TicketPayload;
  } catch {
    return json({ error: "INVALID_JSON", message: "報修資料格式不正確。" }, 400);
  }

  const requesterToken = identity.email;
  const requesterName = identity.displayName;
  const requesterEmail = identity.email;
  const department =
    identity.department || textValue(payload.department, 80) || "未設定";
  const title = textValue(payload.title, 120);
  const description = textValue(payload.description, 3000);
  const category = textValue(payload.category, 40) || "其他";
  const priority = textValue(payload.priority, 10);
  const source = textValue(payload.source, 30) || "AI 報修";
  const location = textValue(payload.location, 120) || null;
  const assetTag = textValue(payload.assetTag, 80) || null;
  const assignedTeam = textValue(payload.assignedTeam, 80) || "MIS 服務台";

  if (
    !requesterToken ||
    !requesterName ||
    !validEmail(requesterEmail) ||
    title.length < 4 ||
    description.length < 10 ||
    !["緊急", "高", "中", "低"].includes(priority)
  ) {
    return json(
      {
        error: "INVALID_TICKET",
        message: "請完整填寫申請人、信箱、部門、標題及至少 10 字的問題描述。",
      },
      400,
    );
  }

  const id = crypto.randomUUID();
  const number = ticketNumber(new Date());
  const now = new Date().toISOString();
  const requesterHash = await sha256(requesterToken);
  const initialNote = `工單已由${source}建立，指派至${assignedTeam}。`;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO tickets
            (id, ticket_number, requester_hash, requester_name, requester_email,
             department, title, description, category, priority, source,
             location, asset_tag, assigned_team, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待處理', ?, ?)`,
        )
        .bind(
          id,
          number,
          requesterHash,
          requesterName,
          requesterEmail,
          department,
          title,
          description,
          category,
          priority,
          source,
          location,
          assetTag,
          assignedTeam,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO ticket_events
            (id, ticket_id, event_type, actor_name, note, created_at)
           VALUES (?, ?, 'created', ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, requesterName, initialNote, now),
    ]);
    await audit(db, identity, "create", "ticket", id, {
      ticketNumber: number,
      priority,
    });
  } catch (error) {
    console.error("ticket insert failed", error);
    return json(
      { error: "DATABASE_ERROR", message: "工單暫時無法建立，請稍後再試。" },
      500,
    );
  }

  return json(
    {
      ok: true,
      ticket: {
        id,
        ticketNumber: number,
        requesterName,
        requesterEmail,
        department,
        title,
        description,
        category,
        priority,
        source,
        location,
        assetTag,
        assignedTeam,
        status: "待處理",
        surveySubmitted: false,
        createdAt: now,
        updatedAt: now,
      },
      message: `工單 ${number} 已建立並指派給 ${assignedTeam}。`,
    },
    201,
  );
}

async function listTickets(
  request: Request,
  db: D1Database,
  identity: Identity,
) {
  const requesterHash = await sha256(identity.email);
  const all = hasPermission(identity, "tickets.read.all");
  const result = await db
    .prepare(
      `SELECT id,
              ticket_number AS ticketNumber,
              requester_name AS requesterName,
              requester_email AS requesterEmail,
              department,
              title,
              description,
              category,
              priority,
              source,
              location,
              asset_tag AS assetTag,
              assigned_team AS assignedTeam,
              status,
              EXISTS(
                SELECT 1
                FROM survey_responses sr
                WHERE sr.survey_type = 'it_service'
                  AND sr.ticket_reference = tickets.ticket_number
              ) AS surveySubmitted,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM tickets
       WHERE (? = 1 OR requester_hash = ?)
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .bind(all ? 1 : 0, requesterHash)
    .all();
  return json({ tickets: result.results });
}

async function getTicket(
  request: Request,
  db: D1Database,
  id: string,
  identity: Identity,
) {
  const requesterHash = await sha256(identity.email);
  const all = hasPermission(identity, "tickets.read.all");
  const [ticket, events] = await db.batch([
    db
      .prepare(
        `SELECT id, ticket_number AS ticketNumber, requester_name AS requesterName,
                requester_email AS requesterEmail, department, title, description,
                category, priority, source, location, asset_tag AS assetTag,
                assigned_team AS assignedTeam, status,
                EXISTS(
                  SELECT 1
                  FROM survey_responses sr
                  WHERE sr.survey_type = 'it_service'
                    AND sr.ticket_reference = tickets.ticket_number
                ) AS surveySubmitted,
                created_at AS createdAt, updated_at AS updatedAt
         FROM tickets WHERE id = ? AND (? = 1 OR requester_hash = ?)`,
      )
      .bind(id, all ? 1 : 0, requesterHash),
    db
      .prepare(
        `SELECT event_type AS eventType, from_status AS fromStatus,
                to_status AS toStatus, actor_name AS actorName, note,
                created_at AS createdAt
         FROM ticket_events WHERE ticket_id = ? ORDER BY created_at DESC`,
      )
      .bind(id),
  ]);
  const row = ticket.results[0];
  if (!row) return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  return json({ ticket: row, events: events.results });
}

async function updateTicket(
  request: Request,
  db: D1Database,
  id: string,
  identity: Identity,
) {
  let payload: TicketPayload;
  try {
    payload = (await request.json()) as TicketPayload;
  } catch {
    return json({ error: "INVALID_JSON", message: "更新資料格式不正確。" }, 400);
  }
  const nextStatus = textValue(payload.status, 20);
  const note = textValue(payload.note, 1000);
  const actorName = identity.displayName;
  if (!["待處理", "處理中", "已解決", "已結案"].includes(nextStatus)) {
    return json({ error: "INVALID_UPDATE", message: "工單更新資料不完整。" }, 400);
  }
  const current = await db
    .prepare(`SELECT status FROM tickets WHERE id = ?`)
    .bind(id)
    .first<{ status: string }>();
  if (!current) return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(`UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(nextStatus, now, id),
    db
      .prepare(
        `INSERT INTO ticket_events
          (id, ticket_id, event_type, from_status, to_status, actor_name, note, created_at)
         VALUES (?, ?, 'status_changed', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        current.status,
        nextStatus,
        actorName,
        note || `狀態由${current.status}更新為${nextStatus}。`,
        now,
      ),
  ]);
  await audit(db, identity, "update_status", "ticket", id, {
    from: current.status,
    to: nextStatus,
  });
  return json({ ok: true, status: nextStatus, updatedAt: now, message: "工單狀態與處理紀錄已更新。" });
}

export function handleTicketRequest(
  request: Request,
  db: D1Database,
  ticketId?: string,
) {
  const task = (async () => {
    const permission =
      request.method === "PATCH" ? "tickets.update" : request.method === "POST"
        ? "tickets.create"
        : "tickets.read.own";
    const auth =
      request.method === "PATCH"
        ? await requirePermission(request, db, permission)
        : await requireIdentity(request, db);
    if (!auth.identity) return auth.response!;
    if (auth.response) return auth.response;
    return request.method === "POST" && !ticketId
      ? createTicket(request, db, auth.identity)
      : request.method === "GET" && ticketId
        ? getTicket(request, db, ticketId, auth.identity)
        : request.method === "GET"
          ? listTickets(request, db, auth.identity)
          : request.method === "PATCH" && ticketId
            ? updateTicket(request, db, ticketId, auth.identity)
            : json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
  })();
  return Promise.resolve(task).catch((error) => {
    console.error("ticket request failed", error);
    return json({ error: "TICKET_REQUEST_FAILED", message: "工單服務暫時無法使用。" }, 500);
  });
}
import {
  audit,
  hasPermission,
  json,
  requireIdentity,
  requirePermission,
  type Identity,
} from "./auth";
