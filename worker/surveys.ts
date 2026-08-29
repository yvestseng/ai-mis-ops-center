import {
  requireIdentity,
  type Identity,
} from "./auth";

type SurveyType = "system_usage" | "it_service";

type SurveyPayload = {
  submissionKey?: unknown;
  respondentToken?: unknown;
  surveyType?: unknown;
  ticketReference?: unknown;
  engineer?: unknown;
  resolved?: unknown;
  comment?: unknown;
  answers?: unknown;
};

type SurveySummaryRow = {
  survey_type: SurveyType;
  response_count: number;
  average_score: number | null;
  average_nps: number | null;
};

type PendingFollowupRow = {
  pending_count: number;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function isSurveyType(value: unknown): value is SurveyType {
  return value === "system_usage" || value === "it_service";
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function score(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sqliteConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

async function createSurvey(request: Request, db: D1Database, identity: Identity) {
  let payload: SurveyPayload;

  try {
    payload = (await request.json()) as SurveyPayload;
  } catch {
    return json(
      {
        error: "INVALID_JSON",
        message: "問卷資料格式不正確。",
      },
      400,
    );
  }

  if (!isSurveyType(payload.surveyType)) {
    return json(
      {
        error: "INVALID_SURVEY",
        message: "不支援的問卷類型。",
      },
      400,
    );
  }

  if (payload.surveyType === "it_service") {
    if (identity.roleCode !== "user") {
      return json(
        {
          error: "SURVEY_ROLE_NOT_ALLOWED",
          message: "只有一般使用者可以評價資訊服務。",
        },
        403,
      );
    }
  }

  const submissionKey = textValue(payload.submissionKey, 80);
  const respondentToken = textValue(payload.respondentToken, 120);
  const comment = textValue(payload.comment, 2000);
  const answers =
    payload.answers && typeof payload.answers === "object"
      ? (payload.answers as Record<string, unknown>)
      : {};

  if (!submissionKey) {
    return json(
      {
        error: "MISSING_IDENTITY",
        message: "缺少問卷識別資料，請重新整理後再試。",
      },
      400,
    );
  }

  const effectiveRespondentToken =
    respondentToken || identity.email;

  const respondentHash = await sha256(
    payload.surveyType === "system_usage"
      ? `system_usage:${identity.email.toLowerCase()}`
      : `${identity.email.toLowerCase()}:${textValue(payload.ticketReference, 40).toUpperCase() || effectiveRespondentToken}`,
  );

  if (payload.surveyType === "system_usage") {
    const existing = await db
      .prepare(
        `SELECT id, submitted_at AS submittedAt
         FROM survey_responses
         WHERE survey_type = 'system_usage'
           AND respondent_hash = ?
         LIMIT 1`,
      )
      .bind(respondentHash)
      .first<{ id: string; submittedAt: string }>();

    if (existing) {
      return json(
        {
          error: "DUPLICATE_SUBMISSION",
          message: "您已完成系統使用問卷，送出後不可修改或重複填寫。",
          submittedAt: existing.submittedAt,
        },
        409,
      );
    }
  }

  const answerRows: Array<[string, string, number | null]> = [];
  let overallScore = 0;
  let npsScore: number | null = null;
  let ticketReference: string | null = null;
  let engineerName: string | null = null;
  let resolvedStatus: string | null = null;
  let needsFollowup = false;
  let followupReason = "";

  if (payload.surveyType === "system_usage") {
    const ease = score(answers.ease, 1, 5);
    const speed = score(answers.speed, 1, 5);
    const usefulness = score(answers.usefulness, 1, 5);
    npsScore = score(answers.recommend, 0, 10);

    if (
      ease === null ||
      speed === null ||
      usefulness === null ||
      npsScore === null
    ) {
      return json(
        {
          error: "INVALID_ANSWER",
          message: "請完成所有系統使用評分。",
        },
        400,
      );
    }

    overallScore = Number(
      ((ease + speed + usefulness) / 3).toFixed(2),
    );
    needsFollowup = overallScore < 3;
    followupReason = `系統使用整體評分 ${overallScore} 分`;

    answerRows.push(
      ["ease", String(ease), ease],
      ["speed", String(speed), speed],
      ["usefulness", String(usefulness), usefulness],
      ["recommend", String(npsScore), npsScore],
    );
  } else {
    const response = score(answers.response, 1, 5);
    const expertise = score(answers.expertise, 1, 5);
    const communication = score(answers.communication, 1, 5);

    ticketReference = textValue(
      payload.ticketReference,
      40,
    ).toUpperCase();
    resolvedStatus = textValue(payload.resolved, 20);

    if (
      response === null ||
      expertise === null ||
      communication === null ||
      !ticketReference ||
      !["是", "部分解決", "否"].includes(resolvedStatus)
    ) {
      return json(
        {
          error: "INVALID_ANSWER",
          message: "請完成所有服務評分。",
        },
        400,
      );
    }

    const ticket = await db
      .prepare(
        `SELECT ticket_number AS ticketNumber,
                requester_email AS requesterEmail,
                assigned_team AS assignedTeam,
                status
         FROM tickets
         WHERE ticket_number = ?
           AND lower(requester_email) = lower(?)
         LIMIT 1`,
      )
      .bind(ticketReference, identity.email)
      .first<{
        ticketNumber: string;
        requesterEmail: string;
        assignedTeam: string | null;
        status: string;
      }>();

    if (!ticket) {
      return json(
        {
          error: "TICKET_NOT_FOUND",
          message: "找不到此工單，或您沒有此工單的評分權限。",
        },
        404,
      );
    }

    if (!["已解決", "已結案", "已關閉"].includes(ticket.status)) {
      return json(
        {
          error: "TICKET_NOT_RESOLVED",
          message: "工單必須先完成處理，才能提交服務評分。",
        },
        409,
      );
    }

    const existing = await db
      .prepare(
        `SELECT id
         FROM survey_responses
         WHERE survey_type = 'it_service'
           AND ticket_reference = ?
         LIMIT 1`,
      )
      .bind(ticketReference)
      .first<{ id: string }>();

    if (existing) {
      return json(
        {
          error: "DUPLICATE_SUBMISSION",
          message: "此工單已完成服務調查，請勿重複送出。",
        },
        409,
      );
    }

    const assignedEngineer = await db
      .prepare(
        `SELECT u.display_name AS displayName
         FROM tickets t
         JOIN app_users u ON u.id = t.assigned_user_id
         WHERE t.ticket_number = ?
           AND lower(t.requester_email) = lower(?)
           AND u.status = 'active'
         LIMIT 1`,
      )
      .bind(ticketReference, identity.email)
      .first<{ displayName: string }>();

    if (!assignedEngineer?.displayName) {
      return json(
        {
          error: "ENGINEER_NOT_ASSIGNED",
          message: "此工單尚未指派實際服務人員，無法提交服務評分。",
        },
        409,
      );
    }

    engineerName = assignedEngineer.displayName;

    overallScore = Number(
      ((response + expertise + communication) / 3).toFixed(2),
    );

    needsFollowup =
      Math.min(response, expertise, communication) < 3 ||
      resolvedStatus !== "是";

    followupReason =
      resolvedStatus !== "是"
        ? `問題狀態：${resolvedStatus}`
        : `IT 服務最低評分 ${Math.min(
            response,
            expertise,
            communication,
          )} 分`;

    answerRows.push(
      ["response", String(response), response],
      ["expertise", String(expertise), expertise],
      ["communication", String(communication), communication],
      ["resolved", resolvedStatus, null],
      ["engineer", engineerName, null],
    );
  }

  const responseId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const submissionDate = submittedAt.slice(0, 10);

  const statements = [
    db
      .prepare(
        `INSERT INTO survey_responses
          (id, submission_key, survey_type, respondent_hash, submission_date,
           ticket_reference, engineer_name, resolved_status, overall_score,
           nps_score, comment, needs_followup, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        responseId,
        submissionKey,
        payload.surveyType,
        respondentHash,
        submissionDate,
        ticketReference,
        engineerName,
        resolvedStatus,
        overallScore,
        npsScore,
        comment || null,
        needsFollowup ? 1 : 0,
        submittedAt,
      ),
    ...answerRows.map(
      ([questionCode, answerValue, numericScore]) =>
        db
          .prepare(
            `INSERT INTO survey_answers
              (id, response_id, question_code, answer_value, numeric_score)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            responseId,
            questionCode,
            answerValue,
            numericScore,
          ),
    ),
  ];

  if (needsFollowup) {
    statements.push(
      db
        .prepare(
          `INSERT INTO survey_followups
            (id, response_id, reason, status, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          responseId,
          followupReason,
          submittedAt,
          submittedAt,
        ),
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    if (sqliteConflict(error)) {
      return json(
        {
          error: "DUPLICATE_SUBMISSION",
          message:
            payload.surveyType === "system_usage"
              ? "您已完成系統使用問卷，送出後不可修改或重複填寫。"
              : "此工單已完成服務調查，請勿重複送出。",
        },
        409,
      );
    }

    console.error("survey insert failed", error);

    return json(
      {
        error: "DATABASE_ERROR",
        message: "問卷暫時無法儲存，請稍後再試。",
      },
      500,
    );
  }

  return json(
    {
      ok: true,
      responseId,
      needsFollowup,
      message: needsFollowup
        ? "問卷已送出，改善事項已自動建立。"
        : "問卷已成功儲存，感謝您的回饋。",
    },
    201,
  );
}

async function getServiceSurveyTicket(request: Request, db: D1Database, identity: Identity) {
  const ticketReference = textValue(
    new URL(request.url).searchParams.get("ticketReference"),
    40,
  ).toUpperCase();

  if (!ticketReference) {
    return json({ error: "MISSING_TICKET", message: "請輸入工單編號。" }, 400);
  }

  const ticket = await db.prepare(
    `SELECT t.ticket_number AS ticketNumber,
            t.status,
            u.display_name AS engineerName,
            u.email AS engineerEmail
     FROM tickets t
     LEFT JOIN app_users u
       ON u.id = t.assigned_user_id
      AND u.status = 'active'
     WHERE t.ticket_number = ?
       AND lower(t.requester_email) = lower(?)
     LIMIT 1`,
  ).bind(ticketReference, identity.email).first<{
    ticketNumber: string;
    status: string;
    engineerName: string | null;
    engineerEmail: string | null;
  }>();

  if (!ticket) {
    return json({ error: "TICKET_NOT_FOUND", message: "找不到此工單，或您沒有此工單的評分權限。" }, 404);
  }

  if (!["已解決", "已結案", "已關閉"].includes(ticket.status)) {
    return json({ error: "TICKET_NOT_RESOLVED", message: "工單必須先完成處理，才能提交服務評分。" }, 409);
  }

  if (!ticket.engineerName) {
    return json({ error: "ENGINEER_NOT_ASSIGNED", message: "此工單尚未指派實際服務人員，請先由 MIS 完成指派。" }, 409);
  }

  return json({
    ticketNumber: ticket.ticketNumber,
    engineerName: ticket.engineerName,
    engineerEmail: ticket.engineerEmail,
  });
}

async function getSurveyStats(db: D1Database, identity: Identity) {
  const [summaryResult, followupResult] = await Promise.all([
    db
      .prepare(
        `SELECT survey_type,
                COUNT(*) AS response_count,
                ROUND(AVG(overall_score), 1) AS average_score,
                ROUND(
                  AVG(
                    CASE
                      WHEN nps_score IS NOT NULL
                      THEN nps_score
                    END
                  ),
                  1
                ) AS average_nps
         FROM survey_responses
         GROUP BY survey_type`,
      )
      .all<SurveySummaryRow>(),

    db
      .prepare(
        `SELECT COUNT(*) AS pending_count
         FROM survey_followups
         WHERE status = 'pending'`,
      )
      .first<PendingFollowupRow>(),
  ]);

  const summaries = summaryResult.results.map((row) => ({
    survey_type: row.survey_type,
    response_count: Number(row.response_count ?? 0),
    average_score:
      row.average_score === null
        ? 0
        : Number(row.average_score),
    average_nps:
      row.average_nps === null
        ? 0
        : Number(row.average_nps),
  }));

  const respondentHash = await sha256(
    `system_usage:${identity.email.toLowerCase()}`,
  );
  const ownSystemUsage = await db
    .prepare(
      `SELECT submitted_at AS submittedAt
       FROM survey_responses
       WHERE survey_type = 'system_usage'
         AND respondent_hash = ?
       LIMIT 1`,
    )
    .bind(respondentHash)
    .first<{ submittedAt: string }>();

  const canReadAll =
    identity.roleCode === "admin" ||
    identity.permissions.includes("surveys.read");

  return json({
    summaries: canReadAll ? summaries : [],
    pendingFollowups: canReadAll
      ? Number(followupResult?.pending_count ?? 0)
      : 0,
    ownSubmission: {
      system_usage: {
        submitted: Boolean(ownSystemUsage),
        submittedAt: ownSystemUsage?.submittedAt ?? null,
      },
    },
  });
}


function canReadServiceFeedback(identity: Identity) {
  return (
    identity.roleCode === "admin" ||
    identity.permissions.includes("tickets.update") ||
    identity.permissions.includes("surveys.read") ||
    identity.permissions.includes("surveys.read.all")
  );
}

function integerQuery(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function dateQuery(value: string | null) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function prioritySqlFilter(priority: string) {
  if (!priority) return { sql: "", bindings: [] as string[] };
  const aliases: Record<string, string[]> = {
    P1: ["P1", "緊急"],
    P2: ["P2", "高"],
    P3: ["P3", "中"],
    P4: ["P4", "低"],
  };
  const values = aliases[priority] || [priority];
  return {
    sql: ` AND t.priority IN (${values.map(() => "?").join(", ")})`,
    bindings: values,
  };
}

async function getServiceFeedbackRecords(
  request: Request,
  db: D1Database,
  identity: Identity,
) {
  if (!canReadServiceFeedback(identity)) {
    return json({ error: "FORBIDDEN", message: "您沒有查看服務調查紀錄的權限。" }, 403);
  }

  const url = new URL(request.url);
  const page = integerQuery(url.searchParams.get("page"), 1, 1, 100000);
  const pageSize = integerQuery(url.searchParams.get("pageSize"), 20, 1, 100);
  const engineer = textValue(url.searchParams.get("engineer"), 120);
  const resolved = textValue(url.searchParams.get("resolved"), 20);
  const priority = textValue(url.searchParams.get("priority"), 10);
  const scoreFilter = textValue(url.searchParams.get("score"), 20);
  const from = dateQuery(url.searchParams.get("from"));
  const to = dateQuery(url.searchParams.get("to"));

  const conditions: string[] = ["sr.survey_type = 'it_service'"];
  const bindings: Array<string | number> = [];

  if (engineer) {
    conditions.push("sr.engineer_name LIKE ?");
    bindings.push(`%${engineer}%`);
  }
  if (["是", "部分解決", "否"].includes(resolved)) {
    conditions.push("sr.resolved_status = ?");
    bindings.push(resolved);
  }
  if (from) {
    conditions.push("date(sr.submitted_at) >= date(?)");
    bindings.push(from);
  }
  if (to) {
    conditions.push("date(sr.submitted_at) <= date(?)");
    bindings.push(to);
  }
  if (scoreFilter === "low") conditions.push("sr.overall_score < 3");
  if (["1", "2", "3", "4", "5"].includes(scoreFilter)) {
    conditions.push("ROUND(sr.overall_score) = ?");
    bindings.push(Number(scoreFilter));
  }

  const priorityFilter = prioritySqlFilter(priority);
  const where = `${conditions.join(" AND ")}${priorityFilter.sql}`;
  const allBindings = [...bindings, ...priorityFilter.bindings];
  const offset = (page - 1) * pageSize;

  const [countRow, result] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total
       FROM survey_responses sr
       JOIN tickets t ON t.ticket_number = sr.ticket_reference
       WHERE ${where}`,
    ).bind(...allBindings).first<{ total: number }>(),
    db.prepare(
      `SELECT sr.id,
              sr.ticket_reference AS ticketNumber,
              t.title AS ticketTitle,
              t.requester_name AS evaluatorName,
              sr.engineer_name AS engineerName,
              MAX(CASE WHEN sa.question_code = 'response' THEN sa.numeric_score END) AS responseScore,
              MAX(CASE WHEN sa.question_code = 'expertise' THEN sa.numeric_score END) AS expertiseScore,
              MAX(CASE WHEN sa.question_code = 'communication' THEN sa.numeric_score END) AS communicationScore,
              sr.resolved_status AS resolvedStatus,
              sr.overall_score AS overallScore,
              sr.comment,
              sr.needs_followup AS needsFollowup,
              sr.submitted_at AS submittedAt,
              t.status AS ticketStatus,
              t.priority
       FROM survey_responses sr
       JOIN tickets t ON t.ticket_number = sr.ticket_reference
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id
       WHERE ${where}
       GROUP BY sr.id, sr.ticket_reference, t.title, t.requester_name,
                sr.engineer_name, sr.resolved_status, sr.overall_score,
                sr.comment, sr.needs_followup, sr.submitted_at, t.status, t.priority
       ORDER BY sr.submitted_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(...allBindings, pageSize, offset).all(),
  ]);

  const total = Number(countRow?.total ?? 0);
  return json({
    ok: true,
    data: result.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

async function getServiceFeedbackSummary(
  db: D1Database,
  identity: Identity,
) {
  if (!canReadServiceFeedback(identity)) {
    return json({ error: "FORBIDDEN", message: "您沒有查看服務品質統計的權限。" }, 403);
  }

  const baseCte = `WITH service AS (
    SELECT sr.id,
           sr.engineer_name AS engineerName,
           sr.resolved_status AS resolvedStatus,
           sr.overall_score AS overallScore,
           sr.needs_followup AS needsFollowup,
           sr.submitted_at AS submittedAt,
           MAX(CASE WHEN sa.question_code = 'response' THEN sa.numeric_score END) AS responseScore,
           MAX(CASE WHEN sa.question_code = 'expertise' THEN sa.numeric_score END) AS expertiseScore,
           MAX(CASE WHEN sa.question_code = 'communication' THEN sa.numeric_score END) AS communicationScore
    FROM survey_responses sr
    LEFT JOIN survey_answers sa ON sa.response_id = sr.id
    WHERE sr.survey_type = 'it_service'
    GROUP BY sr.id, sr.engineer_name, sr.resolved_status, sr.overall_score,
             sr.needs_followup, sr.submitted_at
  )`;

  const [summary, engineers] = await Promise.all([
    db.prepare(
      `${baseCte}
       SELECT COUNT(*) AS responseCount,
              ROUND(AVG(overallScore), 2) AS averageScore,
              ROUND(AVG(responseScore), 2) AS averageResponseScore,
              ROUND(AVG(expertiseScore), 2) AS averageExpertiseScore,
              ROUND(AVG(communicationScore), 2) AS averageCommunicationScore,
              SUM(CASE WHEN resolvedStatus = '是' THEN 1 ELSE 0 END) AS resolvedCount,
              SUM(CASE WHEN resolvedStatus <> '是' THEN 1 ELSE 0 END) AS unresolvedCount,
              SUM(CASE WHEN needsFollowup = 1 THEN 1 ELSE 0 END) AS lowScoreCount,
              ROUND(AVG(CASE WHEN date(submittedAt) >= date('now', '-6 days') THEN overallScore END), 2) AS weekAverageScore,
              ROUND(AVG(CASE WHEN strftime('%Y-%m', submittedAt) = strftime('%Y-%m', 'now') THEN overallScore END), 2) AS monthAverageScore
       FROM service`,
    ).first(),
    db.prepare(
      `${baseCte}
       SELECT COALESCE(engineerName, '未指派') AS engineerName,
              COUNT(*) AS responseCount,
              ROUND(AVG(overallScore), 2) AS averageScore,
              ROUND(AVG(responseScore), 2) AS averageResponseScore,
              ROUND(AVG(expertiseScore), 2) AS averageExpertiseScore,
              ROUND(AVG(communicationScore), 2) AS averageCommunicationScore,
              SUM(CASE WHEN resolvedStatus <> '是' THEN 1 ELSE 0 END) AS unresolvedCount,
              SUM(CASE WHEN needsFollowup = 1 THEN 1 ELSE 0 END) AS lowScoreCount
       FROM service
       GROUP BY engineerName
       ORDER BY averageScore DESC, responseCount DESC, engineerName ASC`,
    ).all(),
  ]);

  const responseCount = Number((summary as { responseCount?: number } | null)?.responseCount ?? 0);
  const resolvedCount = Number((summary as { resolvedCount?: number } | null)?.resolvedCount ?? 0);
  const unresolvedCount = Number((summary as { unresolvedCount?: number } | null)?.unresolvedCount ?? 0);

  return json({
    ok: true,
    summary: {
      ...(summary || {}),
      responseCount,
      resolvedRate: responseCount ? Number(((resolvedCount / responseCount) * 100).toFixed(1)) : 0,
      unresolvedRate: responseCount ? Number(((unresolvedCount / responseCount) * 100).toFixed(1)) : 0,
    },
    engineers: engineers.results,
  });
}

async function getServiceFeedbackFollowups(
  request: Request,
  db: D1Database,
  identity: Identity,
) {
  if (!canReadServiceFeedback(identity)) {
    return json({ error: "FORBIDDEN", message: "您沒有查看改善追蹤的權限。" }, 403);
  }

  const url = new URL(request.url);
  const page = integerQuery(url.searchParams.get("page"), 1, 1, 100000);
  const pageSize = integerQuery(url.searchParams.get("pageSize"), 20, 1, 100);
  const offset = (page - 1) * pageSize;

  const [countRow, result] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total
       FROM survey_followups sf
       JOIN survey_responses sr ON sr.id = sf.response_id
       WHERE sr.survey_type = 'it_service'
         AND sf.status = 'pending'`,
    ).first<{ total: number }>(),
    db.prepare(
      `SELECT sf.id AS followupId,
              sf.reason,
              sf.status AS followupStatus,
              sf.assigned_to AS assignedTo,
              sf.created_at AS followupCreatedAt,
              sr.ticket_reference AS ticketNumber,
              t.title AS ticketTitle,
              sr.engineer_name AS engineerName,
              MAX(CASE WHEN sa.question_code = 'response' THEN sa.numeric_score END) AS responseScore,
              MAX(CASE WHEN sa.question_code = 'expertise' THEN sa.numeric_score END) AS expertiseScore,
              MAX(CASE WHEN sa.question_code = 'communication' THEN sa.numeric_score END) AS communicationScore,
              sr.overall_score AS overallScore,
              sr.resolved_status AS resolvedStatus,
              sr.comment,
              sr.submitted_at AS submittedAt,
              t.status AS ticketStatus,
              t.priority
       FROM survey_followups sf
       JOIN survey_responses sr ON sr.id = sf.response_id
       JOIN tickets t ON t.ticket_number = sr.ticket_reference
       LEFT JOIN survey_answers sa ON sa.response_id = sr.id
       WHERE sr.survey_type = 'it_service'
         AND sf.status = 'pending'
       GROUP BY sf.id, sf.reason, sf.status, sf.assigned_to, sf.created_at,
                sr.ticket_reference, t.title, sr.engineer_name, sr.overall_score,
                sr.resolved_status, sr.comment, sr.submitted_at, t.status, t.priority
       ORDER BY sr.submitted_at DESC
       LIMIT ? OFFSET ?`,
    ).bind(pageSize, offset).all(),
  ]);

  const total = Number(countRow?.total ?? 0);
  return json({
    ok: true,
    data: result.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export function handleSurveyRequest(
  request: Request,
  db: D1Database,
) {
  const task = (async () => {
    if (request.method === "POST") {
      const auth = await requireIdentity(request, db);
      if (!auth.identity) return auth.response!;
      return createSurvey(request, db, auth.identity);
    }

    if (request.method === "GET") {
      const auth = await requireIdentity(request, db);
      if (!auth.identity) return auth.response!;
      const url = new URL(request.url);
      const ticketReference = url.searchParams.get("ticketReference");
      const view = url.searchParams.get("view");
      if (ticketReference) return getServiceSurveyTicket(request, db, auth.identity);
      if (view === "records") return getServiceFeedbackRecords(request, db, auth.identity);
      if (view === "summary") return getServiceFeedbackSummary(db, auth.identity);
      if (view === "followups") return getServiceFeedbackFollowups(request, db, auth.identity);
      return getSurveyStats(db, auth.identity);
    }

    return json(
      {
        error: "METHOD_NOT_ALLOWED",
        message: "不支援此操作。",
      },
      405,
    );
  })();

  return Promise.resolve(task).catch((error) => {
    console.error("survey request failed", error);
    return json(
      {
        error: "SURVEY_REQUEST_FAILED",
        message: "問卷服務暫時無法使用，請稍後再試。",
      },
      500,
    );
  });
}
