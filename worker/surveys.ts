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

async function createSurvey(request: Request, db: D1Database) {
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

  const submissionKey = textValue(payload.submissionKey, 80);
  const respondentToken = textValue(payload.respondentToken, 120);
  const comment = textValue(payload.comment, 2000);
  const answers =
    payload.answers && typeof payload.answers === "object"
      ? (payload.answers as Record<string, unknown>)
      : {};

  if (!submissionKey || !respondentToken) {
    return json(
      {
        error: "MISSING_IDENTITY",
        message: "缺少問卷識別資料，請重新整理後再試。",
      },
      400,
    );
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
    engineerName = textValue(payload.engineer, 80);
    resolvedStatus = textValue(payload.resolved, 20);

    if (
      response === null ||
      expertise === null ||
      communication === null ||
      !ticketReference ||
      !engineerName ||
      !["是", "部分解決", "否"].includes(resolvedStatus)
    ) {
      return json(
        {
          error: "INVALID_ANSWER",
          message: "請填寫工單編號並完成所有服務評分。",
        },
        400,
      );
    }

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

  const respondentHash = await sha256(
    payload.surveyType === "it_service" && ticketReference
      ? `${respondentToken}:${ticketReference}`
      : respondentToken,
  );

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
              ? "今天已完成系統使用問卷，感謝您的回饋。"
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

async function getSurveyStats(db: D1Database) {
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

  return json({
    summaries,
    pendingFollowups: Number(
      followupResult?.pending_count ?? 0,
    ),
  });
}

export function handleSurveyRequest(
  request: Request,
  db: D1Database,
) {
  if (request.method === "POST") {
    return createSurvey(request, db).catch((error) => {
      console.error("survey request failed", error);

      return json(
        {
          error: "SURVEY_REQUEST_FAILED",
          message: "問卷暫時無法儲存，請稍後再試。",
        },
        500,
      );
    });
  }

  if (request.method === "GET") {
    return getSurveyStats(db).catch((error) => {
      console.error("survey stats failed", error);

      return json(
        {
          error: "SURVEY_STATS_FAILED",
          message: "問卷統計暫時無法讀取。",
        },
        500,
      );
    });
  }

  return json(
    {
      error: "METHOD_NOT_ALLOWED",
      message: "不支援此操作。",
    },
    405,
  );
}
