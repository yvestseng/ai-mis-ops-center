import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
} from "../worker/ticket-classification.ts";
import {
  calculateClassificationKpis,
  evaluateKpiTargets,
} from "../worker/classification-governance.ts";

const baseline = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/ticket-classification-baseline.json", import.meta.url),
    "utf8",
  ),
);

function baselinePriority(workType, impact) {
  if (workType.kind === "request") return "P4";
  if (
    (impact.level === "company_wide" || impact.level === "site_wide") &&
    impact.serviceState === "outage"
  ) return "P1";
  if (
    (impact.level === "department" || impact.level === "multiple_users") &&
    impact.serviceState === "outage"
  ) return "P2";
  return "P3";
}

function evaluateCase(item) {
  const workType = classifyWorkType(item.input);
  const service = classifyService(item.input);
  const impact = analyzeImpact(item.input);
  const priority = baselinePriority(workType, impact);
  const confidence = Math.round(Math.min(service.confidence, impact.confidence) * 100) / 100;
  const reviewRequired =
    priority === "P1" ||
    (workType.kind !== "request" && confidence < 0.7);

  return {
    id: item.id,
    expected: item.expected,
    actual: {
      workType: workType.kind,
      serviceKey: service.serviceKey,
      assignedTeamId: service.assignedTeamId ?? null,
      impactLevel: impact.level,
      serviceState: impact.serviceState,
      priority,
      confidence,
      reviewRequired,
      reviewResult: null,
    },
  };
}

test("golden classification dataset has stable unique IDs and required dimensions", () => {
  assert.ok(baseline.length >= 16);
  assert.equal(new Set(baseline.map((item) => item.id)).size, baseline.length);

  for (const item of baseline) {
    assert.match(item.id, /^CLS-[A-Z]+-\d{3}$/);
    assert.ok(item.input.length > 0, item.id);
    assert.ok(Array.isArray(item.tags) && item.tags.length > 0, item.id);
    for (const field of [
      "workType",
      "serviceKey",
      "assignedTeamId",
      "impactLevel",
      "serviceState",
      "priority",
    ]) {
      assert.ok(field in item.expected, `${item.id}: missing ${field}`);
    }
  }
});

test("golden dataset contains positive P1 cases and boundary/negative P1 cases", () => {
  assert.ok(baseline.some((item) => item.expected.priority === "P1"));
  assert.ok(baseline.some((item) => item.expected.priority === "P2"));
  assert.ok(baseline.some((item) => item.tags.includes("negative-p1")));
  assert.ok(baseline.some((item) => item.tags.includes("single-user")));
  assert.ok(baseline.some((item) => item.tags.includes("single-device")));
  assert.ok(baseline.some((item) => item.expected.priority === "P4"));
});

test("classification golden baseline meets v1 KPI targets", () => {
  const records = baseline.map(evaluateCase);
  const kpis = calculateClassificationKpis(records, baseline.length);
  const targets = evaluateKpiTargets(kpis);

  assert.equal(kpis.sampleSize, baseline.length);
  assert.equal(kpis.regressionCoverage, 1);
  assert.equal(kpis.aiRecommendationAcceptanceRate, null);

  assert.equal(targets.overallClassificationAccuracy, true, JSON.stringify(kpis, null, 2));
  assert.equal(targets.serviceAccuracy, true, JSON.stringify(kpis, null, 2));
  assert.equal(targets.priorityAccuracy, true, JSON.stringify(kpis, null, 2));
  assert.equal(targets.p1Precision, true, JSON.stringify(kpis, null, 2));
  assert.equal(targets.p1Recall, true, JSON.stringify(kpis, null, 2));
});

test("P1 precision and recall are measured independently", () => {
  const base = {
    workType: "incident",
    serviceKey: "core-network",
    assignedTeamId: "team-network",
    impactLevel: "company_wide",
    serviceState: "outage",
  };
  const records = [
    { id: "tp", expected: { ...base, priority: "P1" }, actual: { ...base, priority: "P1" } },
    { id: "fn", expected: { ...base, priority: "P1" }, actual: { ...base, priority: "P3" } },
    { id: "fp", expected: { ...base, priority: "P3" }, actual: { ...base, priority: "P1" } },
    { id: "tn", expected: { ...base, priority: "P3" }, actual: { ...base, priority: "P3" } },
  ];

  const kpis = calculateClassificationKpis(records);
  assert.equal(kpis.p1Precision, 0.5);
  assert.equal(kpis.p1Recall, 0.5);
  assert.equal(kpis.priorityAccuracy, 0.5);
});

test("manual review and AI acceptance rates are calculated from governance outcomes", () => {
  const expected = {
    workType: "incident",
    serviceKey: "identity-system",
    assignedTeamId: "team-system",
    impactLevel: "company_wide",
    serviceState: "outage",
    priority: "P1",
  };
  const records = [
    { id: "accepted", expected, actual: { ...expected, reviewRequired: true, reviewResult: "accepted" } },
    { id: "modified", expected, actual: { ...expected, priority: "P2", reviewRequired: true, reviewResult: "modified" } },
    { id: "auto", expected: { ...expected, priority: "P3" }, actual: { ...expected, priority: "P3", reviewRequired: false, reviewResult: null } },
  ];

  const kpis = calculateClassificationKpis(records);
  assert.equal(kpis.manualReviewRate, 0.6667);
  assert.equal(kpis.aiRecommendationAcceptanceRate, 0.5);
});
