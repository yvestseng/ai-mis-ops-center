import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("service feedback keeps one D1 source of truth and database duplicate protection", async () => {
  const [schema, surveys] = await Promise.all([read("db/schema.ts"), read("worker/surveys.ts")]);
  assert.match(schema, /"survey_responses"/);
  assert.match(schema, /"survey_answers"/);
  assert.match(schema, /"survey_followups"/);
  assert.match(schema, /survey_responses_ticket_reference_uq/);
  assert.match(surveys, /survey_type = 'it_service'/);
  assert.match(surveys, /DUPLICATE_SUBMISSION/);
  assert.doesNotMatch(schema, /feedback_v2|satisfaction_v2/i);
});

test("low score follow-up preserves the existing business rule", async () => {
  const surveys = await read("worker/surveys.ts");
  assert.match(surveys, /Math\.min\(response, expertise, communication\) < 3/);
  assert.match(surveys, /resolvedStatus !== "是"/);
  assert.match(surveys, /INSERT INTO survey_followups/);
});

test("admin service feedback exposes dashboard records and follow-up read views", async () => {
  const [surveys, ui] = await Promise.all([read("worker/surveys.ts"), read("app/workspace-home.tsx")]);
  assert.match(surveys, /view === "records"/);
  assert.match(surveys, /view === "summary"/);
  assert.match(surveys, /view === "followups"/);
  assert.match(surveys, /identity\.permissions\.includes\("tickets\.update"\)/);
  assert.match(ui, /服務品質 Dashboard/);
  assert.match(ui, /服務調查紀錄/);
  assert.match(ui, /低分改善追蹤/);
  assert.match(ui, /view: "records"/);
  assert.match(ui, /api\/surveys\?view=summary/);
  assert.match(ui, /view: "followups"/);
});

test("management records are read from existing survey and ticket data", async () => {
  const surveys = await read("worker/surveys.ts");
  assert.match(surveys, /JOIN tickets t ON t\.ticket_number = sr\.ticket_reference/);
  assert.match(surveys, /LEFT JOIN survey_answers sa ON sa\.response_id = sr\.id/);
  assert.match(surveys, /t\.requester_name AS evaluatorName/);
  assert.match(surveys, /sr\.engineer_name AS engineerName/);
});
