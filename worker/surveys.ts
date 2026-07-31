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

export function handleSurveyRequest(
  request: Request,
  db: D1Database,
) {
  const task = (async () => {
    if (request.method === "POST") {
      const auth = await requireIdentity(request, db);
      if (!auth.identity) return auth.response!;
      if (auth.response) return auth.response;
      return createSurvey(request, db, auth.identity);
    }

    if (request.method === "GET") {
      const auth = await requireIdentity(request, db);
      if (!auth.identity) return auth.response!;
      if (auth.response) return auth.response;
      const ticketReference = new URL(request.url).searchParams.get("ticketReference");
      return ticketReference
        ? getServiceSurveyTicket(request, db, auth.identity)
        : getSurveyStats(db, auth.identity);
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
