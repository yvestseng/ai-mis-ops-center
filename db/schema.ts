import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const surveyResponses = sqliteTable(
  "survey_responses",
  {
    id: text("id").primaryKey(),
    submissionKey: text("submission_key").notNull(),
    surveyType: text("survey_type").notNull(),
    respondentHash: text("respondent_hash").notNull(),
    submissionDate: text("submission_date").notNull(),
    ticketReference: text("ticket_reference"),
    engineerName: text("engineer_name"),
    resolvedStatus: text("resolved_status"),
    overallScore: real("overall_score").notNull(),
    npsScore: integer("nps_score"),
    comment: text("comment"),
    needsFollowup: integer("needs_followup", { mode: "boolean" })
      .notNull()
      .default(false),
    submittedAt: text("submitted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("survey_responses_submission_key_uq").on(table.submissionKey),
    uniqueIndex("survey_responses_type_device_date_uq").on(
      table.surveyType,
      table.respondentHash,
      table.submissionDate,
    ),
    uniqueIndex("survey_responses_ticket_reference_uq").on(
      table.ticketReference,
    ),
    index("survey_responses_type_date_idx").on(
      table.surveyType,
      table.submittedAt,
    ),
  ],
);

export const surveyAnswers = sqliteTable(
  "survey_answers",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    questionCode: text("question_code").notNull(),
    answerValue: text("answer_value").notNull(),
    numericScore: real("numeric_score"),
  },
  (table) => [
    uniqueIndex("survey_answers_response_question_uq").on(
      table.responseId,
      table.questionCode,
    ),
    index("survey_answers_response_idx").on(table.responseId),
  ],
);

export const surveyFollowups = sqliteTable(
  "survey_followups",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    assignedTo: text("assigned_to"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("survey_followups_response_uq").on(table.responseId),
    index("survey_followups_status_idx").on(table.status),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    ticketNumber: text("ticket_number").notNull(),
    requesterHash: text("requester_hash").notNull(),
    requesterName: text("requester_name").notNull(),
    requesterEmail: text("requester_email").notNull(),
    department: text("department").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    source: text("source").notNull(),
    location: text("location"),
    assetTag: text("asset_tag"),
    assignedTeam: text("assigned_team").notNull(),
    status: text("status").notNull().default("待處理"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("tickets_ticket_number_uq").on(table.ticketNumber),
    index("tickets_requester_created_idx").on(
      table.requesterHash,
      table.createdAt,
    ),
    index("tickets_status_priority_idx").on(table.status, table.priority),
  ],
);

export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorName: text("actor_name").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ticket_events_ticket_created_idx").on(
      table.ticketId,
      table.createdAt,
    ),
  ],
);
