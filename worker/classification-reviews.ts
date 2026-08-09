import { audit, json, requirePermission, type Identity } from "./auth";
import { analyzeImpact, classifyService, classifyWorkType, priorityCode } from "./ticket-classification";

const priorityCodes = new Set(["P1", "P2", "P3", "P4"]);
const workTypes = new Set(["incident", "request", "unknown"]);
const impactLevels = new Set([
  "company_wide",
  "site_wide",
  "department",
  "multiple_users",
  "single_user",
  "unknown",
]);

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number) {
  const text = textValue(value, maxLength);
  return text || null;
}

type ReviewPayload = {
  finalWorkType?: unknown;
  finalServiceKey?: unknown;
  finalTeamId?: unknown;
  finalPriority?: unknown;
  finalImpactLevel?: unknown;
  reviewReason?: unknown;
};

type CapturedTicket = {
  id: string;
  title: string;
  description: string;
  priority: string;
  assignedTeamId: string | null;
  classificationService: string | null;
  impactLevel: string | null;
  classificationConfidence: number | null;
  priorityReviewRequired: number;
};

function priorityCodeFromStored(value: string) {
  return priorityCodes.has(value) ? value : priorityCode(value);
}

async function captureReviewSnapshot(
  db: D1Database,
  ticketId: string,
  identity: Identity,
) {
  const existing = await db
    .prepare(`SELECT id FROM ticket_classification_reviews WHERE ticket_id = ? LIMIT 1`)
    .bind(ticketId)
    .first<{ id: string }>();
  if (existing) {
    return json({ error: "REVIEW_ALREADY_CAPTURED", message: "此工單已保存原始分類建議，不可覆寫。" }, 409);
  }

  const ticket = await db
    .prepare(
      `SELECT id, title, description, priority,
              assigned_team_id AS assignedTeamId,
              classification_service AS classificationService,
              impact_level AS impactLevel,
              classification_confidence AS classificationConfidence,
              priority_review_required AS priorityReviewRequired
       FROM tickets WHERE id = ? LIMIT 1`,
    )
    .bind(ticketId)
    .first<CapturedTicket>();

  if (!ticket) {
    return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  }

  const content = `${ticket.title} ${ticket.description}`;
  const workType = classifyWorkType(content);
  const service = classifyService(content);
  const impact = analyzeImpact(content);
  const now = new Date().toISOString();
  const reviewId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO ticket_classification_reviews
        (id, ticket_id,
         suggested_work_type, suggested_service_key, suggested_team_id,
         suggested_priority, suggested_impact_level, suggested_service_state,
         suggested_confidence, suggested_review_required,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      reviewId,
      ticket.id,
      workType.kind,
      ticket.classificationService || service.serviceKey,
      ticket.assignedTeamId || service.assignedTeamId || null,
      priorityCodeFromStored(ticket.priority),
      ticket.impactLevel || impact.level,
      impact.serviceState,
      ticket.classificationConfidence ?? Math.min(service.confidence, impact.confidence),
      ticket.priorityReviewRequired ? 1 : 0,
      now,
      now,
    )
    .run();

  await audit(db, identity, "capture", "ticket_classification_review", reviewId, {
    ticketId,
    immutableSuggestion: true,
  });

  return getReview(db, ticketId);
}

async function getReview(db: D1Database, ticketId: string) {
  const row = await db
    .prepare(
      `SELECT r.id,
              r.ticket_id AS ticketId,
              t.ticket_number AS ticketNumber,
              t.title,
              r.suggested_work_type AS suggestedWorkType,
              r.suggested_service_key AS suggestedServiceKey,
              r.suggested_team_id AS suggestedTeamId,
              r.suggested_priority AS suggestedPriority,
              r.suggested_impact_level AS suggestedImpactLevel,
              r.suggested_service_state AS suggestedServiceState,
              r.suggested_confidence AS suggestedConfidence,
              r.suggested_review_required AS suggestedReviewRequired,
              r.final_work_type AS finalWorkType,
              r.final_service_key AS finalServiceKey,
              r.final_team_id AS finalTeamId,
              r.final_priority AS finalPriority,
              r.final_impact_level AS finalImpactLevel,
              r.review_result AS reviewResult,
              r.work_type_correct AS workTypeCorrect,
              r.priority_correct AS priorityCorrect,
              r.service_correct AS serviceCorrect,
              r.team_correct AS teamCorrect,
              r.impact_correct AS impactCorrect,
              r.overall_correct AS overallCorrect,
              r.review_reason AS reviewReason,
              r.reviewed_by AS reviewedBy,
              r.reviewed_at AS reviewedAt,
              r.created_at AS createdAt,
              r.updated_at AS updatedAt
       FROM ticket_classification_reviews r
       JOIN tickets t ON t.id = r.ticket_id
       WHERE r.ticket_id = ? LIMIT 1`,
    )
    .bind(ticketId)
    .first();

  return row
    ? json({ review: row })
    : json({ error: "NOT_FOUND", message: "找不到此工單的分類覆核資料。" }, 404);
}

async function listReviews(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT r.id,
              r.ticket_id AS ticketId,
              t.ticket_number AS ticketNumber,
              t.title,
              r.suggested_priority AS suggestedPriority,
              r.final_priority AS finalPriority,
              r.suggested_service_key AS suggestedServiceKey,
              r.final_service_key AS finalServiceKey,
              r.suggested_impact_level AS suggestedImpactLevel,
              r.final_impact_level AS finalImpactLevel,
              r.suggested_confidence AS suggestedConfidence,
              r.suggested_review_required AS suggestedReviewRequired,
              r.review_result AS reviewResult,
              r.overall_correct AS overallCorrect,
              r.reviewed_by AS reviewedBy,
              r.reviewed_at AS reviewedAt,
              r.created_at AS createdAt,
              r.updated_at AS updatedAt
       FROM ticket_classification_reviews r
       JOIN tickets t ON t.id = r.ticket_id
       ORDER BY r.created_at DESC
       LIMIT 200`,
    )
    .all();
  return json({ reviews: result.results ?? [] });
}

async function updateReview(
  request: Request,
  db: D1Database,
  ticketId: string,
  identity: Identity,
) {
  let payload: ReviewPayload;
  try {
    payload = (await request.json()) as ReviewPayload;
  } catch {
    return json({ error: "INVALID_JSON", message: "覆核資料格式不正確。" }, 400);
  }

  const finalWorkType = textValue(payload.finalWorkType, 30);
  const finalServiceKey = textValue(payload.finalServiceKey, 80);
  const finalTeamId = nullableText(payload.finalTeamId, 80);
  const finalPriority = textValue(payload.finalPriority, 10);
  const finalImpactLevel = textValue(payload.finalImpactLevel, 40);
  const reviewReason = nullableText(payload.reviewReason, 1000);

  if (
    !workTypes.has(finalWorkType) ||
    !finalServiceKey ||
    !priorityCodes.has(finalPriority) ||
    !impactLevels.has(finalImpactLevel)
  ) {
    return json({ error: "INVALID_REVIEW", message: "請完整填寫 MIS 最終分類結果。" }, 400);
  }

  if (finalTeamId) {
    const team = await db
      .prepare(`SELECT id FROM support_teams WHERE id = ? AND is_active = 1 LIMIT 1`)
      .bind(finalTeamId)
      .first<{ id: string }>();
    if (!team) {
      return json({ error: "INVALID_SUPPORT_TEAM", message: "指定的最終維運團隊不存在或未啟用。" }, 400);
    }
  }

  const current = await db
    .prepare(
      `SELECT id,
              suggested_work_type AS suggestedWorkType,
              suggested_service_key AS suggestedServiceKey,
              suggested_team_id AS suggestedTeamId,
              suggested_priority AS suggestedPriority,
              suggested_impact_level AS suggestedImpactLevel
       FROM ticket_classification_reviews
       WHERE ticket_id = ? LIMIT 1`,
    )
    .bind(ticketId)
    .first<{
      id: string;
      suggestedWorkType: string;
      suggestedServiceKey: string;
      suggestedTeamId: string | null;
      suggestedPriority: string;
      suggestedImpactLevel: string;
    }>();

  if (!current) {
    return json({ error: "NOT_FOUND", message: "請先保存此工單的原始分類建議。" }, 404);
  }

  const workTypeCorrect = current.suggestedWorkType === finalWorkType;
  const serviceCorrect = current.suggestedServiceKey === finalServiceKey;
  const teamCorrect = current.suggestedTeamId === finalTeamId;
  const priorityCorrect = current.suggestedPriority === finalPriority;
  const impactCorrect = current.suggestedImpactLevel === finalImpactLevel;
  const overallCorrect = workTypeCorrect && serviceCorrect && teamCorrect && priorityCorrect && impactCorrect;
  const reviewResult = overallCorrect ? "accepted" : "modified";
  const now = new Date().toISOString();

  if (reviewResult === "modified" && !reviewReason) {
    return json({ error: "REVIEW_REASON_REQUIRED", message: "修改 AI 建議時必須填寫覆核原因。" }, 400);
  }

  await db
    .prepare(
      `UPDATE ticket_classification_reviews
       SET final_work_type = ?,
           final_service_key = ?,
           final_team_id = ?,
           final_priority = ?,
           final_impact_level = ?,
           review_result = ?,
           work_type_correct = ?,
           priority_correct = ?,
           service_correct = ?,
           team_correct = ?,
           impact_correct = ?,
           overall_correct = ?,
           review_reason = ?,
           reviewed_by = ?,
           reviewed_at = ?,
           updated_at = ?
       WHERE ticket_id = ?`,
    )
    .bind(
      finalWorkType,
      finalServiceKey,
      finalTeamId,
      finalPriority,
      finalImpactLevel,
      reviewResult,
      workTypeCorrect ? 1 : 0,
      priorityCorrect ? 1 : 0,
      serviceCorrect ? 1 : 0,
      teamCorrect ? 1 : 0,
      impactCorrect ? 1 : 0,
      overallCorrect ? 1 : 0,
      reviewReason,
      identity.email,
      now,
      now,
      ticketId,
    )
    .run();

  await audit(db, identity, "review", "ticket_classification_review", current.id, {
    ticketId,
    reviewResult,
    priorityCorrect,
    serviceCorrect,
    teamCorrect,
    impactCorrect,
    overallCorrect,
  });

  return getReview(db, ticketId);
}

async function getKpiDatasource(db: D1Database) {
  const [totals, reviewed, priorities, services] = await db.batch([
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN suggested_review_required = 1 THEN 1 ELSE 0 END) AS manualReviewRequired,
              SUM(CASE WHEN reviewed_at IS NOT NULL THEN 1 ELSE 0 END) AS reviewed
       FROM ticket_classification_reviews`,
    ),
    db.prepare(
      `SELECT COUNT(*) AS reviewed,
              SUM(CASE WHEN overall_correct = 1 THEN 1 ELSE 0 END) AS overallCorrect,
              SUM(CASE WHEN service_correct = 1 AND team_correct = 1 THEN 1 ELSE 0 END) AS serviceCorrect,
              SUM(CASE WHEN priority_correct = 1 THEN 1 ELSE 0 END) AS priorityCorrect,
              SUM(CASE WHEN review_result = 'accepted' THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN suggested_priority = 'P1' THEN 1 ELSE 0 END) AS predictedP1,
              SUM(CASE WHEN final_priority = 'P1' THEN 1 ELSE 0 END) AS actualP1,
              SUM(CASE WHEN suggested_priority = 'P1' AND final_priority = 'P1' THEN 1 ELSE 0 END) AS truePositiveP1
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL`,
    ),
    db.prepare(
      `SELECT final_priority AS dimension,
              COUNT(*) AS reviewed,
              SUM(CASE WHEN priority_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL
       GROUP BY final_priority
       ORDER BY final_priority`,
    ),
    db.prepare(
      `SELECT final_service_key AS dimension,
              COUNT(*) AS reviewed,
              SUM(CASE WHEN service_correct = 1 AND team_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL
       GROUP BY final_service_key
       ORDER BY final_service_key`,
    ),
  ]);

  const total = Number((totals.results[0] as { total?: number } | undefined)?.total ?? 0);
  const manualReviewRequired = Number((totals.results[0] as { manualReviewRequired?: number } | undefined)?.manualReviewRequired ?? 0);
  const reviewedCount = Number((reviewed.results[0] as { reviewed?: number } | undefined)?.reviewed ?? 0);
  const overallCorrect = Number((reviewed.results[0] as { overallCorrect?: number } | undefined)?.overallCorrect ?? 0);
  const serviceCorrect = Number((reviewed.results[0] as { serviceCorrect?: number } | undefined)?.serviceCorrect ?? 0);
  const priorityCorrect = Number((reviewed.results[0] as { priorityCorrect?: number } | undefined)?.priorityCorrect ?? 0);
  const accepted = Number((reviewed.results[0] as { accepted?: number } | undefined)?.accepted ?? 0);
  const predictedP1 = Number((reviewed.results[0] as { predictedP1?: number } | undefined)?.predictedP1 ?? 0);
  const actualP1 = Number((reviewed.results[0] as { actualP1?: number } | undefined)?.actualP1 ?? 0);
  const truePositiveP1 = Number((reviewed.results[0] as { truePositiveP1?: number } | undefined)?.truePositiveP1 ?? 0);
  const ratio = (numerator: number, denominator: number) => denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;

  return json({
    baseline: {
      totalCaptured: total,
      totalReviewed: reviewedCount,
      overallClassificationAccuracy: ratio(overallCorrect, reviewedCount),
      serviceAccuracy: ratio(serviceCorrect, reviewedCount),
      priorityAccuracy: ratio(priorityCorrect, reviewedCount),
      p1Precision: ratio(truePositiveP1, predictedP1),
      p1Recall: ratio(truePositiveP1, actualP1),
      manualReviewRate: ratio(manualReviewRequired, total),
      aiRecommendationAcceptanceRate: ratio(accepted, reviewedCount),
    },
    priorityBreakdown: priorities.results ?? [],
    serviceBreakdown: services.results ?? [],
  });
}

export function handleClassificationReviewRequest(
  request: Request,
  db: D1Database,
  ticketId?: string,
  resource?: "kpi",
) {
  const task = (async () => {
    const auth = await requirePermission(request, db, "tickets.update");
    if (!auth.identity) return auth.response!;
    if (auth.response) return auth.response;

    if (resource === "kpi") {
      return request.method === "GET"
        ? getKpiDatasource(db)
        : json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
    }

    if (!ticketId) {
      return request.method === "GET"
        ? listReviews(db)
        : json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
    }

    if (request.method === "POST") return captureReviewSnapshot(db, ticketId, auth.identity);
    if (request.method === "GET") return getReview(db, ticketId);
    if (request.method === "PATCH") return updateReview(request, db, ticketId, auth.identity);
    return json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
  })();

  return Promise.resolve(task).catch((error) => {
    console.error("classification review request failed", error);
    return json({ error: "CLASSIFICATION_REVIEW_FAILED", message: "分類治理服務暫時無法使用。" }, 500);
  });
}
