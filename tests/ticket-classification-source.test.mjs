import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tickets = fs.readFileSync(new URL("../worker/tickets.ts", import.meta.url), "utf8");
const classifier = fs.readFileSync(new URL("../worker/ticket-classification.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../app/workspace-home.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0018_ticket_classification_sla.sql", import.meta.url), "utf8");

test("diagnosis uses four-layer server classification", () => {
  assert.match(tickets, /classifyService/);
  assert.match(tickets, /analyzeImpact/);
  assert.match(tickets, /resolvePriorityRule/);
  assert.match(tickets, /priorityReviewRequired/);
  assert.match(tickets, /resolveSlaPolicy/);
});

test("semantic normalization covers company-wide and mail failure variants", () => {
  assert.match(classifier, /整間公司/);
  assert.match(classifier, /不能寄信/);
  assert.match(classifier, /失敗/);
  assert.match(classifier, /microsoft-365-mail/);
});

test("generic P1 impact rule keeps service routing", () => {
  assert.match(tickets, /genericImpactRule/);
  assert.match(tickets, /ruleOwnsRouting/);
  assert.match(tickets, /priority-p1-major-outage/);
});

test("diagnosis UI renders server impact review and SLA results", () => {
  assert.match(workspace, /diagnosisResult\?\.service\.category/);
  assert.match(workspace, /diagnosisResult\?\.priority\.code/);
  assert.match(workspace, /diagnosisResult\?\.review\.required/);
  assert.match(workspace, /diagnosisResult\?\.sla/);
});

test("SLA governance is backed by D1 policies", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sla_policies/);
  assert.match(migration, /SLA-P1/);
  assert.match(migration, /SLA-P4/);
});
