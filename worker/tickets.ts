import {
  audit,
  hasPermission,
  json,
  requireIdentity,
  requirePermission,
  type Identity,
} from "./auth";

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
  assignedTeamId?: unknown;
  assignedUserId?: unknown;
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
      `SELECT t.id,
              t.ticket_number AS ticketNumber,
              t.requester_name AS requesterName,
              t.requester_email AS requesterEmail,
              t.department,
              t.title,
              t.description,
              t.category,
              t.priority,
              t.source,
              t.location,
              t.asset_tag AS assetTag,
              t.assigned_team AS assignedTeam,
              t.assigned_team_id AS assignedTeamId,
              t.assigned_user_id AS assignedUserId,
              assigned_user.display_name AS assignedUserName,
              assigned_user.email AS assignedUserEmail,
              t.ai_suggested_team_id AS aiSuggestedTeamId,
              suggested_team.team_name AS aiSuggestedTeamName,
              t.assignment_source AS assignmentSource,
              t.assigned_at AS assignedAt,
              t.status,
              EXISTS(
                SELECT 1
                FROM survey_responses sr
                WHERE sr.survey_type = 'it_service'
                  AND sr.ticket_reference = t.ticket_number
              ) AS surveySubmitted,
              t.created_at AS createdAt,
              t.updated_at AS updatedAt
       FROM tickets t
       LEFT JOIN app_users assigned_user
         ON assigned_user.id = t.assigned_user_id
        AND assigned_user.status = 'active'
       LEFT JOIN support_teams suggested_team
         ON suggested_team.id = t.ai_suggested_team_id
       WHERE (? = 1 OR t.requester_hash = ?)
       ORDER BY t.created_at DESC
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
        `SELECT t.id,
                t.ticket_number AS ticketNumber,
                t.requester_name AS requesterName,
                t.requester_email AS requesterEmail,
                t.department,
                t.title,
                t.description,
                t.category,
                t.priority,
                t.source,
                t.location,
                t.asset_tag AS assetTag,
                t.assigned_team AS assignedTeam,
                t.assigned_team_id AS assignedTeamId,
                t.assigned_user_id AS assignedUserId,
                assigned_user.display_name AS assignedUserName,
                assigned_user.email AS assignedUserEmail,
                t.ai_suggested_team_id AS aiSuggestedTeamId,
                suggested_team.team_name AS aiSuggestedTeamName,
                t.assignment_source AS assignmentSource,
                t.assigned_at AS assignedAt,
                t.status,
                EXISTS(
                  SELECT 1
                  FROM survey_responses sr
                  WHERE sr.survey_type = 'it_service'
                    AND sr.ticket_reference = t.ticket_number
                ) AS surveySubmitted,
                t.created_at AS createdAt,
                t.updated_at AS updatedAt
         FROM tickets t
         LEFT JOIN app_users assigned_user
           ON assigned_user.id = t.assigned_user_id
          AND assigned_user.status = 'active'
         LEFT JOIN support_teams suggested_team
           ON suggested_team.id = t.ai_suggested_team_id
         WHERE t.id = ?
           AND (? = 1 OR t.requester_hash = ?)`,
      )
      .bind(id, all ? 1 : 0, requesterHash),
    db
      .prepare(
        `SELECT event_type AS eventType,
                from_status AS fromStatus,
                to_status AS toStatus,
                actor_name AS actorName,
                note,
                created_at AS createdAt
         FROM ticket_events
         WHERE ticket_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(id),
  ]);

  const row = ticket.results[0];
  if (!row) {
    return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  }

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
  const allowedStatuses = ["待處理", "處理中", "已解決", "已結案"];

  if (!allowedStatuses.includes(nextStatus)) {
    return json(
      { error: "INVALID_UPDATE", message: "工單更新資料不完整。" },
      400,
    );
  }

  const current = await db
    .prepare(
      `SELECT status,
              assigned_team AS assignedTeam,
              assigned_team_id AS assignedTeamId,
              assigned_user_id AS assignedUserId,
              assignment_source AS assignmentSource,
              assigned_at AS assignedAt
       FROM tickets
       WHERE id = ?`,
    )
    .bind(id)
    .first<{
      status: string;
      assignedTeam: string | null;
      assignedTeamId: string | null;
      assignedUserId: string | null;
      assignmentSource: string | null;
      assignedAt: string | null;
    }>();

  if (!current) {
    return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  }

  const hasAssignedTeamField = Object.prototype.hasOwnProperty.call(
    payload,
    "assignedTeamId",
  );
  const hasAssignedUserField = Object.prototype.hasOwnProperty.call(
    payload,
    "assignedUserId",
  );
  const assignmentRequested = hasAssignedTeamField || hasAssignedUserField;

  if (assignmentRequested && !hasPermission(identity, "tickets.assign")) {
    return json(
      {
        error: "FORBIDDEN",
        message: "您沒有指派維運團隊或處理人員的權限。",
      },
      403,
    );
  }

  let nextAssignedTeamId = current.assignedTeamId;
  let nextAssignedUserId = current.assignedUserId;
  let nextAssignedTeam = current.assignedTeam;
  let nextAssignmentSource = current.assignmentSource;
  let nextAssignedAt = current.assignedAt;

  if (hasAssignedTeamField) {
    nextAssignedTeamId = textValue(payload.assignedTeamId, 80) || null;
  }

  if (hasAssignedUserField) {
    nextAssignedUserId = textValue(payload.assignedUserId, 80) || null;
  }

  const autoAssignStatuses = ["處理中", "已解決", "已結案"];
  const shouldAutoAssign =
    !assignmentRequested &&
    !current.assignedUserId &&
    identity.isAssignable &&
    autoAssignStatuses.includes(nextStatus);

  if (shouldAutoAssign) {
    nextAssignedUserId = identity.id;
    nextAssignedTeamId = current.assignedTeamId || identity.teamId;
    nextAssignmentSource = "self_claim";
    nextAssignedAt = new Date().toISOString();
  } else if (assignmentRequested) {
    nextAssignmentSource = "manual";
    nextAssignedAt = nextAssignedUserId ? new Date().toISOString() : null;
  }

  let assignedUser:
    | {
        id: string;
        displayName: string;
        email: string;
        teamId: string | null;
      }
    | null = null;

  if (nextAssignedUserId) {
    assignedUser = await db
      .prepare(
        `SELECT id,
                display_name AS displayName,
                email,
                team_id AS teamId
         FROM app_users
         WHERE id = ?
           AND status = 'active'
           AND is_assignable = 1
         LIMIT 1`,
      )
      .bind(nextAssignedUserId)
      .first<{
        id: string;
        displayName: string;
        email: string;
        teamId: string | null;
      }>();

    if (!assignedUser) {
      return json(
        {
          error: "INVALID_ASSIGNEE",
          message: "指定的處理人員不存在、未啟用，或不是可指派的維運人員。",
        },
        400,
      );
    }

    if (!nextAssignedTeamId) {
      nextAssignedTeamId = assignedUser.teamId;
    }

    if (
      nextAssignedTeamId &&
      assignedUser.teamId &&
      nextAssignedTeamId !== assignedUser.teamId
    ) {
      return json(
        {
          error: "ASSIGNEE_TEAM_MISMATCH",
          message: "指定的處理人員不屬於所選維運團隊。",
        },
        400,
      );
    }
  }

  if (nextAssignedTeamId) {
    const team = await db
      .prepare(
        `SELECT id, team_name AS teamName
         FROM support_teams
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(nextAssignedTeamId)
      .first<{ id: string; teamName: string }>();

    if (!team) {
      return json(
        {
          error: "INVALID_SUPPORT_TEAM",
          message: "指定的維運團隊不存在。",
        },
        400,
      );
    }

    nextAssignedTeam = team.teamName;
  }

  const assignmentChanged =
    nextAssignedTeamId !== current.assignedTeamId ||
    nextAssignedUserId !== current.assignedUserId;

  const statusChanged = nextStatus !== current.status;
  const now = new Date().toISOString();

  if (assignmentChanged && nextAssignedUserId && !nextAssignedAt) {
    nextAssignedAt = now;
  }

  const eventType =
    assignmentChanged && !statusChanged ? "assignment_changed" : "status_changed";

  const assignmentDescription = assignmentChanged
    ? nextAssignedUserId
      ? `；處理人員指派為${assignedUser?.displayName || nextAssignedUserId}`
      : "；已取消實際處理人員指派"
    : "";

  const eventNote =
    note ||
    `狀態由${current.status}更新為${nextStatus}${assignmentDescription}。`;

  try {
    await db.batch([
      db
        .prepare(
          `UPDATE tickets
           SET status = ?,
               assigned_team = ?,
               assigned_team_id = ?,
               assigned_user_id = ?,
               assignment_source = ?,
               assigned_at = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          nextStatus,
          nextAssignedTeam,
          nextAssignedTeamId,
          nextAssignedUserId,
          nextAssignmentSource,
          nextAssignedAt,
          now,
          id,
        ),
      db
        .prepare(
          `INSERT INTO ticket_events
            (id, ticket_id, event_type, from_status, to_status,
             actor_name, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          eventType,
          current.status,
          nextStatus,
          actorName,
          eventNote,
          now,
        ),
    ]);

    await audit(db, identity, "update_status", "ticket", id, {
      from: current.status,
      to: nextStatus,
      assignmentChanged,
      assignedTeamId: nextAssignedTeamId,
      assignedUserId: nextAssignedUserId,
      assignmentSource: nextAssignmentSource,
      autoAssigned: shouldAutoAssign,
    });
  } catch (error) {
    console.error("ticket update failed", error);
    return json(
      {
        error: "DATABASE_ERROR",
        message: "工單更新失敗，請稍後再試。",
      },
      500,
    );
  }

  return json({
    ok: true,
    status: nextStatus,
    assignedTeam: nextAssignedTeam,
    assignedTeamId: nextAssignedTeamId,
    assignedUserId: nextAssignedUserId,
    assignedUserName: assignedUser?.displayName || null,
    assignedUserEmail: assignedUser?.email || null,
    assignmentSource: nextAssignmentSource,
    assignedAt: nextAssignedAt,
    updatedAt: now,
    message: shouldAutoAssign
      ? `工單狀態已更新，並由${identity.displayName}自動接單。`
      : "工單狀態、指派資訊與處理紀錄已更新。",
  });
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
