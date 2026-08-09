import {
  audit,
  hasPermission,
  json,
  requireIdentity,
  requirePermission,
  type Identity,
} from "./auth";
import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
  normalizeSemanticText,
  priorityCode,
} from "./ticket-classification";

type TicketPayload = {
  requesterToken?: unknown;
  requesterName?: unknown;
  requesterEmail?: unknown;
  department?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  priority?: unknown;
  serviceInterruption?: unknown;
  impactScope?: unknown;
  priorityReviewRequired?: unknown;
  priorityConfirmed?: unknown;
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

type PriorityRuleMatch = {
  id: string;
  ruleName: string;
  priority: string;
  category: string;
  assignedTeam: string;
  priorityReviewRequired: number;
  requireImpactDetails: number;
  matchAllTerms: string;
  matchAnyTerms: string;
};

function parseRuleTerms(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string" && term.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function matchesTerm(content: string, term: string) {
  // A vertical bar represents alternatives within one required criterion.
  // Normalize both sides so common Chinese/English synonyms can match the
  // administrator-maintained rule without hard-coding one exact sentence.
  return term
    .split("|")
    .some((part) => content.includes(normalizeSemanticText(part)));
}

function ruleMatches(content: string, rule: PriorityRuleMatch) {
  const all = parseRuleTerms(rule.matchAllTerms);
  const any = parseRuleTerms(rule.matchAnyTerms);
  if (!all.length && !any.length) return false;
  return all.every((term) => matchesTerm(content, term)) &&
    (!any.length || any.some((term) => matchesTerm(content, term)));
}

async function resolvePriorityRule(db: D1Database, title: string, description: string) {
  try {
    const result = await db.prepare(
      `SELECT id, rule_name AS ruleName, priority, category, assigned_team AS assignedTeam,
              priority_review_required AS priorityReviewRequired,
              require_impact_details AS requireImpactDetails,
              match_all_terms AS matchAllTerms, match_any_terms AS matchAnyTerms
       FROM ticket_priority_rules WHERE is_active=1 ORDER BY display_order, rule_name`,
    ).all<PriorityRuleMatch>();
    const content = normalizeSemanticText(`${title} ${description}`);
    const impact = analyzeImpact(content);
    const workType = classifyWorkType(content);
    const rules = result.results ?? [];

    // First split the ticket into incident vs request. A clear request must
    // enter the P4 request policy before the generic P3 incident fallback.
    if (workType.kind === "request") {
      const requestRule = rules.find((rule) => rule.id === "priority-p4-request");
      if (requestRule) return requestRule;
      return null;
    }

    const explicit = rules.find((rule) => {
      if (!ruleMatches(content, rule)) return false;
      // P4 is reserved for request-type tickets. Wording such as
      // "安裝後失敗" must remain an incident and must not be downgraded.
      if (rule.id === "priority-p4-request") return false;
      // A broad impact phrase such as "全公司" is not enough for P1 by itself;
      // it must also describe an actual outage/failure, not a request or notice.
      if (rule.id === "priority-p1-major-outage" && impact.serviceState !== "outage") return false;
      return true;
    });
    if (explicit) return explicit;
    // Empty P3-style rules are true fallbacks only after every explicit rule.
    return rules.find((rule) => {
      const all = parseRuleTerms(rule.matchAllTerms);
      const any = parseRuleTerms(rule.matchAnyTerms);
      return !all.length && !any.length;
    }) ?? null;
  } catch (error) {
    console.warn("priority rules unavailable; using semantic classification fallback", error);
    return null;
  }
}

type SlaPolicy = {
  policyCode: string;
  priority: string;
  responseTargetLabel: string;
  resolutionTargetLabel: string;
  responseMinutes: number | null;
  resolutionMinutes: number | null;
  usesBusinessHours: number;
  escalationMinutes: number | null;
  escalationAction: string;
  scopeDescription: string;
};

async function resolveSlaPolicy(db: D1Database, priority: string) {
  try {
    return await db.prepare(
      `SELECT policy_code AS policyCode, priority,
              response_target_label AS responseTargetLabel,
              resolution_target_label AS resolutionTargetLabel,
              response_minutes AS responseMinutes, resolution_minutes AS resolutionMinutes,
              uses_business_hours AS usesBusinessHours, escalation_minutes AS escalationMinutes,
              escalation_action AS escalationAction, scope_description AS scopeDescription
       FROM sla_policies WHERE is_active=1 AND priority=? LIMIT 1`,
    ).bind(priority).first<SlaPolicy>();
  } catch (error) {
    console.warn("SLA policy unavailable", error);
    return null;
  }
}


type SlaRuntimeStatus = "pending" | "met" | "breached";

type SlaRuntime = {
  slaStartedAt: string | null;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  escalationDueAt: string | null;
  slaResponseStatus: SlaRuntimeStatus | null;
  slaResolutionStatus: SlaRuntimeStatus | null;
};

function addMinutes(startIso: string, minutes: number | null) {
  if (minutes == null) return null;
  return new Date(Date.parse(startIso) + minutes * 60_000).toISOString();
}

function buildSlaRuntime(startIso: string, policy: SlaPolicy | null): SlaRuntime {
  if (!policy) {
    return {
      slaStartedAt: null,
      responseDueAt: null,
      resolutionDueAt: null,
      escalationDueAt: null,
      slaResponseStatus: null,
      slaResolutionStatus: null,
    };
  }

  // P3/P4 使用工作時段時，必須由後續 business calendar / holiday engine
  // 計算真正截止時間；這裡不把工作日 SLA 錯算成 24x7。
  const usesBusinessHours = policy.usesBusinessHours === 1;

  return {
    slaStartedAt: startIso,
    responseDueAt: usesBusinessHours ? null : addMinutes(startIso, policy.responseMinutes),
    resolutionDueAt: usesBusinessHours ? null : addMinutes(startIso, policy.resolutionMinutes),
    escalationDueAt: usesBusinessHours ? null : addMinutes(startIso, policy.escalationMinutes),
    slaResponseStatus: "pending",
    slaResolutionStatus: "pending",
  };
}

function evaluateSlaStatus(
  completedAt: string | null,
  dueAt: string | null,
  currentStatus: SlaRuntimeStatus | null,
): SlaRuntimeStatus | null {
  if (!completedAt) return currentStatus;
  if (!dueAt) return currentStatus ?? "pending";
  return Date.parse(completedAt) <= Date.parse(dueAt) ? "met" : "breached";
}


function buildClassification(title: string, description: string, matchedRule: PriorityRuleMatch | null) {
  const text = `${title} ${description}`;
  const service = classifyService(text);
  const impact = analyzeImpact(text);
  const workType = classifyWorkType(text);
  const genericImpactRule = matchedRule?.id === "priority-p1-major-outage";
  const fallbackRule = matchedRule?.id === "priority-p3-default-service";
  const genericRequestRule = matchedRule?.id === "priority-p4-request";
  const ruleOwnsRouting = Boolean(
    matchedRule && !genericImpactRule && !fallbackRule && !genericRequestRule,
  );
  const category = ruleOwnsRouting ? matchedRule!.category : service.category;
  const assignedTeam = ruleOwnsRouting ? matchedRule!.assignedTeam : service.assignedTeam;
  const priority = workType.kind === "request" ? "低" : matchedRule?.priority || "中";
  const confidence = Math.round(Math.min(service.confidence, impact.confidence) * 100) / 100;
  const reviewReasons: string[] = [];
  if (matchedRule?.priorityReviewRequired === 1) reviewReasons.push("優先級規則要求 MIS 覆核");
  if (priority === "緊急" || priority === "高") reviewReasons.push(`${priorityCode(priority)} 高影響工單`);
  if (impact.level === "unknown" && impact.serviceState === "outage") reviewReasons.push("已辨識服務中斷，但影響範圍尚未確認");
  if (confidence < 0.7 && workType.kind !== "request") reviewReasons.push("分類信心不足 70%");
  return {
    service,
    impact,
    category,
    assignedTeam,
    assignedTeamId: ruleOwnsRouting ? undefined : service.assignedTeamId,
    priority,
    confidence,
    priorityReviewRequired: reviewReasons.length > 0,
    priorityReviewReason: reviewReasons.join("；"),
    requireImpactDetails:
      workType.kind !== "request" &&
      (matchedRule?.requireImpactDetails === 1 || priority === "緊急" || priority === "高"),
    classificationSource: genericRequestRule
      ? "semantic+request-rule"
      : fallbackRule
        ? "semantic+fallback-rule"
        : matchedRule
          ? "semantic+priority-rule"
          : "semantic-fallback",
  };
}

async function diagnoseTicket(request: Request, db: D1Database) {
  let payload: TicketPayload;
  try {
    payload = (await request.json()) as TicketPayload;
  } catch {
    return json({ error: "INVALID_JSON", message: "診斷資料格式不正確。" }, 400);
  }
  const description = textValue(payload.description, 3000);
  const title = textValue(payload.title, 120) || description.slice(0, 60);
  if (description.length < 1) {
    return json({ error: "INVALID_TICKET", message: "請先輸入問題描述。" }, 400);
  }
  const matchedRule = await resolvePriorityRule(db, title, description);
  const classification = buildClassification(title, description, matchedRule);
  const sla = await resolveSlaPolicy(db, classification.priority);
  return json({
    matched: Boolean(matchedRule && matchedRule.id !== "priority-p3-default-service"),
    service: {
      key: classification.service.serviceKey,
      category: classification.category,
      assignedTeam: classification.assignedTeam,
      assignedTeamId: classification.assignedTeamId || null,
      confidence: classification.service.confidence,
      evidence: classification.service.evidence,
    },
    impact: classification.impact,
    priority: {
      code: priorityCode(classification.priority),
      value: classification.priority,
      confidence: classification.confidence,
      source: classification.classificationSource,
    },
    review: {
      required: classification.priorityReviewRequired,
      reason: classification.priorityReviewReason || null,
      requireImpactDetails: classification.requireImpactDetails,
    },
    rule: matchedRule
      ? {
          ruleName: matchedRule.ruleName,
          priority: classification.priority,
          category: classification.category,
          assignedTeam: classification.assignedTeam,
          priorityReviewRequired: classification.priorityReviewRequired,
          requireImpactDetails: classification.requireImpactDetails,
        }
      : null,
    sla: sla ? { ...sla, usesBusinessHours: sla.usesBusinessHours === 1 } : null,
    message: matchedRule?.id === "priority-p4-request"
      ? "已完成四層診斷，辨識為服務申請，套用 P4 一般申請與建議政策。"
      : matchedRule?.id === "priority-p3-default-service"
        ? "已完成四層診斷，未命中特定規則，套用 P3 預設服務異常政策。"
        : matchedRule
          ? `已完成四層診斷並命中：${matchedRule.ruleName}`
          : "已完成服務分類與影響分析，套用預設 Priority 與覆核政策。",
  });
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
  const submittedCategory = textValue(payload.category, 40);
  const submittedPriority = textValue(payload.priority, 10);
  const serviceInterruption = textValue(payload.serviceInterruption, 30) || null;
  const impactScope = textValue(payload.impactScope, 300) || null;
  const source = textValue(payload.source, 30) || "AI 報修";
  const location = textValue(payload.location, 120) || null;
  const assetTag = textValue(payload.assetTag, 80) || null;
  const submittedAssignedTeam = textValue(payload.assignedTeam, 80);
  const matchedRule = await resolvePriorityRule(db, title, description);
  const classification = buildClassification(title, description, matchedRule);
  const category = matchedRule ? classification.category : (submittedCategory || classification.category);
  const priority = matchedRule ? classification.priority : (submittedPriority || classification.priority);
  const assignedTeam = matchedRule ? classification.assignedTeam : (submittedAssignedTeam || classification.assignedTeam);
  const priorityReviewRequired = classification.priorityReviewRequired;
  const requireImpactDetails = classification.requireImpactDetails;
  const slaPolicy = await resolveSlaPolicy(db, priority);
  if (
    !requesterToken ||
    !requesterName ||
    !validEmail(requesterEmail) ||
    title.length < 4 ||
    description.length < 10 ||
    !["緊急", "高", "中", "低"].includes(priority) ||
    (requireImpactDetails && (!serviceInterruption || !impactScope))
  ) {
    return json(
      {
        error: "INVALID_TICKET",
        message: requireImpactDetails
          ? "命中優先級規則，請填寫服務中斷狀況與影響範圍。"
          : "請完整填寫申請人、信箱、部門、標題及至少 10 字的問題描述。",
      },
      400,
    );
  }

  const id = crypto.randomUUID();
  const nowDate = new Date();
  const number = ticketNumber(nowDate);
  const now = nowDate.toISOString();
  const slaRuntime = buildSlaRuntime(now, slaPolicy);
  const requesterHash = await sha256(requesterToken);
  const initialNote = `工單已由${source}建立，優先級：${priority}，指派至${assignedTeam}${matchedRule ? "（已套用自動判斷規則）" : ""}。`;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO tickets
            (id, ticket_number, requester_hash, requester_name, requester_email,
             department, title, description, category, priority, priority_suggestion,
             priority_review_required, service_interruption, impact_scope, source,
             location, asset_tag, assigned_team, classification_service, impact_level,
             classification_source, classification_confidence, priority_rule_name,
             priority_review_reason, sla_policy_code, sla_started_at, response_due_at,
             resolution_due_at, escalation_due_at, sla_response_status,
             sla_resolution_status, sla_escalation_level, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '待處理', ?, ?)`,
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
          matchedRule ? priority : null,
          priorityReviewRequired ? 1 : 0,
          serviceInterruption,
          impactScope,
          source,
          location,
          assetTag,
          assignedTeam,
          classification.service.serviceKey,
          classification.impact.level,
          classification.classificationSource,
          classification.confidence,
          matchedRule?.ruleName || null,
          classification.priorityReviewReason || null,
          slaPolicy?.policyCode || null,
          slaRuntime.slaStartedAt,
          slaRuntime.responseDueAt,
          slaRuntime.resolutionDueAt,
          slaRuntime.escalationDueAt,
          slaRuntime.slaResponseStatus,
          slaRuntime.slaResolutionStatus,
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
      matchedRule: Boolean(matchedRule),
      priorityReviewRequired,
      classificationSource: classification.classificationSource,
      classificationService: classification.service.serviceKey,
      impactLevel: classification.impact.level,
      priorityRuleName: matchedRule?.ruleName || null,
      slaPolicyCode: slaPolicy?.policyCode || null,
      slaStartedAt: slaRuntime.slaStartedAt,
      responseDueAt: slaRuntime.responseDueAt,
      resolutionDueAt: slaRuntime.resolutionDueAt,
      escalationDueAt: slaRuntime.escalationDueAt,
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
        prioritySuggestion: matchedRule ? priority : null,
        priorityReviewRequired,
        classificationService: classification.service.serviceKey,
        impactLevel: classification.impact.level,
        classificationSource: classification.classificationSource,
        classificationConfidence: classification.confidence,
        priorityRuleName: matchedRule?.ruleName || null,
        priorityReviewReason: classification.priorityReviewReason || null,
        slaPolicyCode: slaPolicy?.policyCode || null,
        slaStartedAt: slaRuntime.slaStartedAt,
        responseDueAt: slaRuntime.responseDueAt,
        resolutionDueAt: slaRuntime.resolutionDueAt,
        escalationDueAt: slaRuntime.escalationDueAt,
        firstResponseAt: null,
        resolvedAt: null,
        slaResponseStatus: slaRuntime.slaResponseStatus,
        slaResolutionStatus: slaRuntime.slaResolutionStatus,
        slaEscalationLevel: 0,
        slaLastEscalatedAt: null,
        serviceInterruption,
        impactScope,
        source,
        location,
        assetTag,
        assignedTeam,
        status: "待處理",
        surveySubmitted: false,
        createdAt: now,
        updatedAt: now,
      },
      message: priorityReviewRequired
        ? `工單 ${number} 已建立：已套用 ${priority} 優先級，待 MIS 覆核。`
        : `工單 ${number} 已建立並套用 ${priority} 優先級，指派給 ${assignedTeam}。`,
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
              t.priority_suggestion AS prioritySuggestion,
              t.priority_review_required AS priorityReviewRequired,
              t.priority_confirmed_by AS priorityConfirmedBy,
              t.priority_confirmed_at AS priorityConfirmedAt,
              t.classification_service AS classificationService,
              t.impact_level AS impactLevel,
              t.classification_source AS classificationSource,
              t.classification_confidence AS classificationConfidence,
              t.priority_rule_name AS priorityRuleName,
              t.priority_review_reason AS priorityReviewReason,
              t.sla_policy_code AS slaPolicyCode,
              t.sla_started_at AS slaStartedAt,
              t.response_due_at AS responseDueAt,
              t.resolution_due_at AS resolutionDueAt,
              t.escalation_due_at AS escalationDueAt,
              t.first_response_at AS firstResponseAt,
              t.resolved_at AS resolvedAt,
              t.sla_response_status AS slaResponseStatus,
              t.sla_resolution_status AS slaResolutionStatus,
              t.sla_escalation_level AS slaEscalationLevel,
              t.sla_last_escalated_at AS slaLastEscalatedAt,
              t.service_interruption AS serviceInterruption,
              t.impact_scope AS impactScope,
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
                t.priority_suggestion AS prioritySuggestion,
                t.priority_review_required AS priorityReviewRequired,
                t.priority_confirmed_by AS priorityConfirmedBy,
                t.priority_confirmed_at AS priorityConfirmedAt,
                t.classification_service AS classificationService,
                t.impact_level AS impactLevel,
                t.classification_source AS classificationSource,
                t.classification_confidence AS classificationConfidence,
                t.priority_rule_name AS priorityRuleName,
                t.priority_review_reason AS priorityReviewReason,
                t.sla_policy_code AS slaPolicyCode,
                t.sla_started_at AS slaStartedAt,
                t.response_due_at AS responseDueAt,
                t.resolution_due_at AS resolutionDueAt,
                t.escalation_due_at AS escalationDueAt,
                t.first_response_at AS firstResponseAt,
                t.resolved_at AS resolvedAt,
                t.sla_response_status AS slaResponseStatus,
                t.sla_resolution_status AS slaResolutionStatus,
                t.sla_escalation_level AS slaEscalationLevel,
                t.sla_last_escalated_at AS slaLastEscalatedAt,
                t.service_interruption AS serviceInterruption,
                t.impact_scope AS impactScope,
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

/** The formal governance queue: pending review tickets plus their latest D1 event. */
async function listPriorityReviewTickets(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT t.id,
              t.ticket_number AS ticketNumber,
              t.title,
              t.description,
              t.category,
              t.priority,
              t.priority_suggestion AS prioritySuggestion,
              t.priority_review_reason AS priorityReviewReason,
              t.classification_service AS classificationService,
              t.impact_level AS impactLevel,
              t.classification_confidence AS classificationConfidence,
              t.priority_rule_name AS priorityRuleName,
              t.sla_policy_code AS slaPolicyCode,
              t.sla_started_at AS slaStartedAt,
              t.response_due_at AS responseDueAt,
              t.resolution_due_at AS resolutionDueAt,
              t.escalation_due_at AS escalationDueAt,
              t.first_response_at AS firstResponseAt,
              t.resolved_at AS resolvedAt,
              t.sla_response_status AS slaResponseStatus,
              t.sla_resolution_status AS slaResolutionStatus,
              t.sla_escalation_level AS slaEscalationLevel,
              t.sla_last_escalated_at AS slaLastEscalatedAt,
              t.assigned_team AS assignedTeam,
              t.status,
              t.service_interruption AS serviceInterruption,
              t.impact_scope AS impactScope,
              t.created_at AS createdAt,
              t.updated_at AS updatedAt,
              latest.event_type AS latestEventType,
              latest.actor_name AS latestEventActorName,
              latest.note AS latestEventNote,
              latest.created_at AS latestEventCreatedAt
       FROM tickets t
       LEFT JOIN ticket_events latest ON latest.id = (
         SELECT e.id FROM ticket_events e
         WHERE e.ticket_id = t.id
         ORDER BY e.created_at DESC, e.id DESC LIMIT 1
       )
       WHERE t.priority_review_required = 1
         AND t.priority_confirmed_at IS NULL
         AND t.status NOT IN ('已結案')
       ORDER BY CASE t.priority
                  WHEN '緊急' THEN 1 WHEN '高' THEN 2 WHEN '中' THEN 3 ELSE 4
                END, t.created_at ASC
       LIMIT 100`,
    )
    .all();

  return json({ reviews: result.results ?? [] });
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
  const confirmedPriority = textValue(payload.priorityConfirmed, 10);
  const note = textValue(payload.note, 1000);
  const actorName = identity.displayName;
  const allowedStatuses = ["待處理", "處理中", "已解決", "已結案"];

  if (!allowedStatuses.includes(nextStatus)) {
    return json(
      { error: "INVALID_UPDATE", message: "工單更新資料不完整。" },
      400,
    );
  }

  if (confirmedPriority && !["緊急", "高", "中", "低"].includes(confirmedPriority)) {
    return json({ error: "INVALID_PRIORITY", message: "優先級確認值不正確。" }, 400);
  }

  const current = await db
    .prepare(
      `SELECT status,
              priority,
              priority_review_required AS priorityReviewRequired,
              priority_confirmed_by AS priorityConfirmedBy,
              priority_confirmed_at AS priorityConfirmedAt,
              assigned_team AS assignedTeam,
              assigned_team_id AS assignedTeamId,
              assigned_user_id AS assignedUserId,
              assignment_source AS assignmentSource,
              assigned_at AS assignedAt,
              sla_policy_code AS slaPolicyCode,
              sla_started_at AS slaStartedAt,
              response_due_at AS responseDueAt,
              resolution_due_at AS resolutionDueAt,
              escalation_due_at AS escalationDueAt,
              first_response_at AS firstResponseAt,
              resolved_at AS resolvedAt,
              sla_response_status AS slaResponseStatus,
              sla_resolution_status AS slaResolutionStatus,
              sla_escalation_level AS slaEscalationLevel,
              sla_last_escalated_at AS slaLastEscalatedAt
       FROM tickets
       WHERE id = ?`,
    )
    .bind(id)
    .first<{
      status: string;
      priority: string;
      priorityReviewRequired: number;
      priorityConfirmedBy: string | null;
      priorityConfirmedAt: string | null;
      assignedTeam: string | null;
      assignedTeamId: string | null;
      assignedUserId: string | null;
      assignmentSource: string | null;
      assignedAt: string | null;
      slaPolicyCode: string | null;
      slaStartedAt: string | null;
      responseDueAt: string | null;
      resolutionDueAt: string | null;
      escalationDueAt: string | null;
      firstResponseAt: string | null;
      resolvedAt: string | null;
      slaResponseStatus: SlaRuntimeStatus | null;
      slaResolutionStatus: SlaRuntimeStatus | null;
      slaEscalationLevel: number;
      slaLastEscalatedAt: string | null;
    }>();

  if (!current) {
    return json({ error: "NOT_FOUND", message: "找不到此工單。" }, 404);
  }

  if (confirmedPriority && !hasPermission(identity, "tickets.update")) {
    return json({ error: "FORBIDDEN", message: "您沒有確認工單優先級的權限。" }, 403);
  }
  if (confirmedPriority && !current.priorityReviewRequired) return json({ error: "PRIORITY_ALREADY_CONFIRMED", message: "此工單的優先級已完成確認。" }, 400);

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

  const effectivePriority = confirmedPriority || current.priority;
  let nextSlaPolicyCode = current.slaPolicyCode;
  let nextSlaStartedAt = current.slaStartedAt;
  let nextResponseDueAt = current.responseDueAt;
  let nextResolutionDueAt = current.resolutionDueAt;
  let nextEscalationDueAt = current.escalationDueAt;
  let nextFirstResponseAt = current.firstResponseAt;
  let nextResolvedAt = current.resolvedAt;
  let nextSlaResponseStatus = current.slaResponseStatus;
  let nextSlaResolutionStatus = current.slaResolutionStatus;
  let nextSlaEscalationLevel = current.slaEscalationLevel;
  let nextSlaLastEscalatedAt = current.slaLastEscalatedAt;

  // MIS 覆核 Priority 後重新套用 SLA policy，但沿用原起算時間。
  if (confirmedPriority) {
    const confirmedPolicy = await resolveSlaPolicy(db, confirmedPriority);
    const runtime = buildSlaRuntime(current.slaStartedAt || now, confirmedPolicy);

    nextSlaPolicyCode = confirmedPolicy?.policyCode || null;
    nextSlaStartedAt = runtime.slaStartedAt;
    nextResponseDueAt = runtime.responseDueAt;
    nextResolutionDueAt = runtime.resolutionDueAt;
    nextEscalationDueAt = runtime.escalationDueAt;
    nextSlaResponseStatus = evaluateSlaStatus(
      nextFirstResponseAt,
      nextResponseDueAt,
      runtime.slaResponseStatus,
    );
    nextSlaResolutionStatus = evaluateSlaStatus(
      nextResolvedAt,
      nextResolutionDueAt,
      runtime.slaResolutionStatus,
    );

    // Priority/SLA policy 改變後，下一階段 escalation scanner 應重新評估。
    nextSlaEscalationLevel = 0;
    nextSlaLastEscalatedAt = null;
  }

  const responseStatuses = ["處理中", "已解決", "已結案"];
  if (!nextFirstResponseAt && responseStatuses.includes(nextStatus)) {
    nextFirstResponseAt = now;
    nextSlaResponseStatus = evaluateSlaStatus(
      nextFirstResponseAt,
      nextResponseDueAt,
      nextSlaResponseStatus,
    );
  }

  const isResolved = nextStatus === "已解決" || nextStatus === "已結案";
  const wasResolved = current.status === "已解決" || current.status === "已結案";

  if (isResolved && !nextResolvedAt) {
    nextResolvedAt = now;
    nextSlaResolutionStatus = evaluateSlaStatus(
      nextResolvedAt,
      nextResolutionDueAt,
      nextSlaResolutionStatus,
    );
  } else if (!isResolved && wasResolved) {
    // Reopen：保留首次回應量測，但恢復 resolution tracking。
    nextResolvedAt = null;
    nextSlaResolutionStatus = nextSlaStartedAt ? "pending" : null;
  }

  const eventType = confirmedPriority ? "priority_confirmed" : assignmentChanged && !statusChanged ? "assignment_changed" : "status_changed";

  const assignmentDescription = assignmentChanged
    ? nextAssignedUserId
      ? `；處理人員指派為${assignedUser?.displayName || nextAssignedUserId}`
      : "；已取消實際處理人員指派"
    : "";

  const eventNote = note || (confirmedPriority ? `MIS 已將優先級確認為${confirmedPriority}。` : `狀態由${current.status}更新為${nextStatus}${assignmentDescription}。`);

  try {
    await db.batch([
      db
        .prepare(
          `UPDATE tickets
           SET status = ?,
               priority = ?,
               priority_review_required = ?,
               priority_confirmed_by = ?,
               priority_confirmed_at = ?,
               assigned_team = ?,
               assigned_team_id = ?,
               assigned_user_id = ?,
               assignment_source = ?,
               assigned_at = ?,
               sla_policy_code = ?,
               sla_started_at = ?,
               response_due_at = ?,
               resolution_due_at = ?,
               escalation_due_at = ?,
               first_response_at = ?,
               resolved_at = ?,
               sla_response_status = ?,
               sla_resolution_status = ?,
               sla_escalation_level = ?,
               sla_last_escalated_at = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          nextStatus,
          confirmedPriority || current.priority,
          confirmedPriority ? 0 : current.priorityReviewRequired,
          confirmedPriority ? identity.email : current.priorityConfirmedBy,
          confirmedPriority ? now : current.priorityConfirmedAt,
          nextAssignedTeam,
          nextAssignedTeamId,
          nextAssignedUserId,
          nextAssignmentSource,
          nextAssignedAt,
          nextSlaPolicyCode,
          nextSlaStartedAt,
          nextResponseDueAt,
          nextResolutionDueAt,
          nextEscalationDueAt,
          nextFirstResponseAt,
          nextResolvedAt,
          nextSlaResponseStatus,
          nextSlaResolutionStatus,
          nextSlaEscalationLevel,
          nextSlaLastEscalatedAt,
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
      confirmedPriority: confirmedPriority || null,
      effectivePriority,
      slaPolicyCode: nextSlaPolicyCode,
      slaResponseStatus: nextSlaResponseStatus,
      slaResolutionStatus: nextSlaResolutionStatus,
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
    slaPolicyCode: nextSlaPolicyCode,
    slaStartedAt: nextSlaStartedAt,
    responseDueAt: nextResponseDueAt,
    resolutionDueAt: nextResolutionDueAt,
    escalationDueAt: nextEscalationDueAt,
    firstResponseAt: nextFirstResponseAt,
    resolvedAt: nextResolvedAt,
    slaResponseStatus: nextSlaResponseStatus,
    slaResolutionStatus: nextSlaResolutionStatus,
    slaEscalationLevel: nextSlaEscalationLevel,
    slaLastEscalatedAt: nextSlaLastEscalatedAt,
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

export function handleTicketDiagnosisRequest(request: Request, db: D1Database) {
  const task = (async () => {
    const auth = await requireIdentity(request, db);
    if (!auth.identity) return auth.response!;
    if (auth.response) return auth.response;
    return request.method === "POST"
      ? diagnoseTicket(request, db)
      : json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
  })();
  return Promise.resolve(task).catch((error) => {
    console.error("ticket diagnosis failed", error);
    return json({ error: "TICKET_DIAGNOSIS_FAILED", message: "工單診斷服務暫時無法使用。" }, 500);
  });
}

export function handleTicketPriorityReviewRequest(
  request: Request,
  db: D1Database,
) {
  const task = (async () => {
    if (request.method !== "GET") {
      return json({ error: "METHOD_NOT_ALLOWED", message: "不支援此操作。" }, 405);
    }
    const auth = await requirePermission(request, db, "tickets.update");
    if (!auth.identity) return auth.response!;
    if (auth.response) return auth.response;
    return listPriorityReviewTickets(db);
  })();
  return Promise.resolve(task).catch((error) => {
    console.error("ticket priority review request failed", error);
    return json({ error: "TICKET_PRIORITY_REVIEW_FAILED", message: "覆核佇列暫時無法讀取。" }, 500);
  });
}
