import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../drizzle/0024_ticket_classification_reviews.sql", import.meta.url),
  "utf8",
);
const reviews = fs.readFileSync(
  new URL("../worker/classification-reviews.ts", import.meta.url),
  "utf8",
);
const workerIndex = fs.readFileSync(
  new URL("../worker/index.ts", import.meta.url),
  "utf8",
);

test("0024 creates an auditable classification review table with immutable suggestion and final review dimensions", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ticket_classification_reviews/);
  for (const column of [
    "suggested_work_type",
    "suggested_service_key",
    "suggested_team_id",
    "suggested_priority",
    "suggested_impact_level",
    "suggested_service_state",
    "suggested_confidence",
    "suggested_review_required",
    "final_work_type",
    "final_service_key",
    "final_team_id",
    "final_priority",
    "final_impact_level",
    "review_result",
    "work_type_correct",
    "priority_correct",
    "service_correct",
    "team_correct",
    "impact_correct",
    "overall_correct",
    "review_reason",
    "reviewed_by",
    "reviewed_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`), column);
  }
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS ticket_classification_reviews_ticket_uq/);
  assert.match(migration, /REFERENCES tickets\(id\) ON DELETE CASCADE/);
});

test("0024 automatically captures one immutable governance snapshot when a new ticket is inserted", () => {
  assert.match(
    migration,
    /CREATE TRIGGER IF NOT EXISTS ticket_classification_reviews_capture_after_ticket_insert/,
  );
  assert.match(migration, /AFTER INSERT ON tickets/);
  assert.match(migration, /INSERT OR IGNORE INTO ticket_classification_reviews/);
  assert.match(migration, /NEW\.classification_service/);
  assert.match(migration, /NEW\.impact_level/);
  assert.match(migration, /NEW\.classification_confidence/);
  assert.match(migration, /NEW\.priority_review_required/);
  assert.match(migration, /WHEN '緊急' THEN 'P1'/);
  assert.match(migration, /WHEN '低' THEN 'P4'/);
  assert.match(migration, /SELECT id FROM support_teams WHERE team_name = NEW\.assigned_team/);
});

test("classification review capture derives suggested values from authoritative ticket data and semantic classifiers", () => {
  assert.match(reviews, /SELECT id, title, description, priority/);
  assert.match(reviews, /classification_service AS classificationService/);
  assert.match(reviews, /classification_confidence AS classificationConfidence/);
  assert.match(reviews, /classifyWorkType\(content\)/);
  assert.match(reviews, /classifyService\(content\)/);
  assert.match(reviews, /analyzeImpact\(content\)/);
  assert.match(reviews, /INSERT INTO ticket_classification_reviews/);
  assert.match(reviews, /REVIEW_ALREADY_CAPTURED/);
});

test("MIS final review updates never overwrite suggested classification fields", () => {
  const updateStatement = reviews.match(/UPDATE ticket_classification_reviews[\s\S]*?WHERE ticket_id = \?/);
  assert.ok(updateStatement, "review update SQL should exist");
  assert.doesNotMatch(updateStatement[0], /SET[\s\S]*suggested_/);
  assert.match(updateStatement[0], /final_work_type = \?/);
  assert.match(updateStatement[0], /final_priority = \?/);
  assert.match(updateStatement[0], /review_result = \?/);
  assert.match(updateStatement[0], /reviewed_by = \?/);
  assert.match(updateStatement[0], /reviewed_at = \?/);
});

test("review result distinguishes accepted from modified and requires a reason for modifications", () => {
  assert.match(reviews, /const reviewResult = overallCorrect \? "accepted" : "modified"/);
  assert.match(reviews, /REVIEW_REASON_REQUIRED/);
  assert.match(reviews, /workTypeCorrect && serviceCorrect && teamCorrect && priorityCorrect && impactCorrect/);
});

test("classification governance KPI datasource exposes accuracy, P1 precision/recall, manual review and acceptance rates", () => {
  assert.match(reviews, /overallClassificationAccuracy/);
  assert.match(reviews, /serviceAccuracy/);
  assert.match(reviews, /priorityAccuracy/);
  assert.match(reviews, /p1Precision/);
  assert.match(reviews, /p1Recall/);
  assert.match(reviews, /manualReviewRate/);
  assert.match(reviews, /aiRecommendationAcceptanceRate/);
  assert.match(reviews, /priorityBreakdown/);
  assert.match(reviews, /serviceBreakdown/);
});

test("classification review APIs are protected by MIS update permission and routed before generic ticket APIs", () => {
  assert.match(reviews, /requirePermission\(request, db, "tickets\.update"\)/);
  assert.match(workerIndex, /\/api\/classification-reviews\/kpi/);
  assert.match(workerIndex, /\/api\/classification-reviews/);
  assert.match(workerIndex, /handleClassificationReviewRequest/);

  const reviewRoute = workerIndex.indexOf('/api/classification-reviews');
  const ticketRoute = workerIndex.indexOf('/api/tickets"');
  assert.ok(reviewRoute >= 0 && ticketRoute >= 0 && reviewRoute < ticketRoute);
});
