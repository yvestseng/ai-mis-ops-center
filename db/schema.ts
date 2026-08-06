import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const roles = sqliteTable(
  "roles",
  {
    id: text().primaryKey().notNull(),
    code: text().notNull(),
    name: text().notNull(),
    permissions: text().default("[]").notNull(),
    isSystem: integer("is_system").default(0).notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("roles_code_uq").on(table.code),
  ],
);



export const supportTeams = sqliteTable(
  "support_teams",
  {
    id: text().primaryKey().notNull(),
    teamCode: text("team_code").notNull(),
    teamName: text("team_name").notNull(),
    description: text(),
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    createdBy: text("created_by"),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    uniqueIndex("support_teams_code_uq").on(table.teamCode),
    index("support_teams_active_order_idx").on(table.isActive, table.displayOrder),
  ],
);

export const appUsers = sqliteTable(
  "app_users",
  {
    id: text().primaryKey().notNull(),
    username: text(),
    email: text().notNull(),
    displayName: text("display_name").notNull(),
    department: text(),
    teamId: text("team_id").references(() => supportTeams.id),
    isAssignable: integer("is_assignable", { mode: "boolean" }).default(false).notNull(),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
    passwordChangedAt: text("password_changed_at"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).default(false).notNull(),
    status: text().default("active").notNull(),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("app_users_role_status_idx").on(
      table.roleId,
      table.status,
    ),
    uniqueIndex("app_users_email_uq").on(table.email),
    uniqueIndex("app_users_username_uq").on(table.username),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text().primaryKey().notNull(),
    actorEmail: text("actor_email").notNull(),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: text(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("audit_logs_entity_created_idx").on(
      table.entityType,
      table.createdAt,
    ),
    index("audit_logs_actor_created_idx").on(
      table.actorEmail,
      table.createdAt,
    ),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, {
        onDelete: "cascade",
      }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastSeenAt: text("last_seen_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("auth_sessions_user_expires_idx").on(
      table.userId,
      table.expiresAt,
    ),
    uniqueIndex("auth_sessions_token_hash_uq").on(
      table.tokenHash,
    ),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text().primaryKey().notNull(),
    loginKey: text("login_key").notNull(),
    ipHash: text("ip_hash").notNull(),
    succeeded: integer("succeeded", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("login_attempts_lookup_idx").on(
      table.loginKey,
      table.ipHash,
      table.createdAt,
    ),
  ],
);

export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: text().primaryKey().notNull(),
    submissionKey: text("submission_key").notNull(),
    surveyType: text("survey_type").notNull(),
    respondentHash: text("respondent_hash").notNull(),
    submissionDate: text("submission_date").notNull(),
    ticketReference: text("ticket_reference"),
    engineerName: text("engineer_name"),
    resolvedStatus: text("resolved_status"),
    overallScore: real("overall_score").notNull(),
    npsScore: integer("nps_score"),
    comment: text(),
    needsFollowup: integer("needs_followup", {
      mode: "boolean",
    })
      .default(false)
      .notNull(),
    submittedAt: text("submitted_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("survey_responses_type_date_idx").on(
      table.surveyType,
      table.submittedAt,
    ),
    uniqueIndex(
      "survey_responses_ticket_reference_uq",
    ).on(table.ticketReference),
    uniqueIndex(
      "survey_responses_system_user_uq",
    )
      .on(table.surveyType, table.respondentHash)
      .where(sql`${table.surveyType} = 'system_usage'`),
    uniqueIndex("survey_responses_submission_key_uq").on(
      table.submissionKey,
    ),
  ],
);

export const surveyAnswers = sqliteTable(
  "survey_answers",
  {
    id: text().primaryKey().notNull(),
    responseId: text("response_id")
      .notNull()
      .references(() => surveyResponses.id, {
        onDelete: "cascade",
      }),
    questionCode: text("question_code").notNull(),
    answerValue: text("answer_value").notNull(),
    numericScore: real("numeric_score"),
  },
  (table) => [
    index("survey_answers_response_idx").on(
      table.responseId,
    ),
    uniqueIndex(
      "survey_answers_response_question_uq",
    ).on(table.responseId, table.questionCode),
  ],
);

export const surveyFollowups = sqliteTable(
  "survey_followups",
  {
    id: text().primaryKey().notNull(),
    responseId: text("response_id")
      .notNull()
      .references(() => surveyResponses.id, {
        onDelete: "cascade",
      }),
    reason: text().notNull(),
    status: text().default("pending").notNull(),
    assignedTo: text("assigned_to"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("survey_followups_status_idx").on(
      table.status,
    ),
    uniqueIndex("survey_followups_response_uq").on(table.responseId),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text().primaryKey().notNull(),
    ticketNumber: text("ticket_number").notNull(),
    requesterHash: text("requester_hash").notNull(),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    department: text().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    priority: text().notNull(),
    prioritySuggestion: text("priority_suggestion"),
    priorityReviewRequired: integer("priority_review_required", { mode: "boolean" }).default(false).notNull(),
    priorityConfirmedBy: text("priority_confirmed_by"),
    priorityConfirmedAt: text("priority_confirmed_at"),
    serviceInterruption: text("service_interruption"),
    impactScope: text("impact_scope"),
    source: text().notNull(),
    location: text(),
    assetTag: text("asset_tag"),
    assignedTeam: text("assigned_team").notNull(),
    assignedTeamId: text("assigned_team_id").references(() => supportTeams.id),
    assignedUserId: text("assigned_user_id").references(() => appUsers.id),
    aiSuggestedTeamId: text("ai_suggested_team_id").references(() => supportTeams.id),
    assignmentSource: text("assignment_source"),
    assignedAt: text("assigned_at"),
    status: text().default("待處理").notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("tickets_status_priority_idx").on(
      table.status,
      table.priority,
    ),
    index("tickets_requester_created_idx").on(
      table.requesterHash,
      table.createdAt,
    ),
    uniqueIndex("tickets_ticket_number_uq").on(
      table.ticketNumber,
    ),
  ],
);

export const ticketPriorityRules = sqliteTable(
  "ticket_priority_rules",
  {
    id: text().primaryKey().notNull(),
    ruleName: text("rule_name").notNull(),
    description: text(),
    matchAllTerms: text("match_all_terms").default("[]").notNull(),
    matchAnyTerms: text("match_any_terms").default("[]").notNull(),
    priority: text().notNull(),
    category: text().notNull(),
    assignedTeam: text("assigned_team").notNull(),
    priorityReviewRequired: integer("priority_review_required", { mode: "boolean" }).default(false).notNull(),
    requireImpactDetails: integer("require_impact_details", { mode: "boolean" }).default(false).notNull(),
    displayOrder: integer("display_order").default(100).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    createdBy: text("created_by"),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    index("ticket_priority_rules_active_order_idx").on(table.isActive, table.displayOrder),
  ],
);

export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: text().primaryKey().notNull(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, {
        onDelete: "cascade",
      }),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorName: text("actor_name").notNull(),
    note: text(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("ticket_events_ticket_created_idx").on(
      table.ticketId,
      table.createdAt,
    ),
  ],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text().primaryKey().notNull(),
    assetTag: text("asset_tag").notNull(),
    name: text().notNull(),
    assetType: text("asset_type").notNull(),
    ownerName: text("owner_name"),
    department: text(),
    location: text(),
    status: text().default("使用中").notNull(),
    warrantyEnd: text("warranty_end"),
    notes: text(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("assets_type_status_idx").on(
      table.assetType,
      table.status,
    ),
    uniqueIndex("assets_asset_tag_uq").on(table.assetTag),
  ],
);

export const managedServices = sqliteTable(
  "managed_services",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    serviceType: text("service_type").notNull(),
    ownerTeam: text("owner_team").notNull(),
    status: text().default("正常").notNull(),
    availability: real().default(100).notNull(),
    endpoint: text(),
    description: text(),
    lastCheckedAt: text("last_checked_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("managed_services_status_idx").on(
      table.status,
    ),
    uniqueIndex("managed_services_name_uq").on(table.name),
  ],
);
