import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/admin/classification-quality/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/admin/classification-quality/classification-quality-dashboard.module.css", import.meta.url), "utf8");

test("classification quality dashboard reads governance KPI data", () => {
  assert.ok(page.includes('/api/classification-reviews/kpi'));
  assert.ok(page.includes('credentials: "include"'));
  assert.ok(page.includes('cache: "no-store"'));
});

test("classification quality dashboard shows KPI targets and baseline metrics", () => {
  for (const label of ["Overall Accuracy", "Service Accuracy", "Priority Accuracy", "P1 Precision", "P1 Recall", "Manual Review Rate", "AI Acceptance Rate"]) {
    assert.ok(page.includes(label), label);
  }
  assert.ok(page.includes("target: 0.9"));
  assert.ok(page.includes("target: 0.95"));
  assert.ok(page.includes("Baseline"));
});

test("classification quality dashboard makes reviewed ground truth coverage explicit", () => {
  assert.ok(page.includes("Ground Truth Coverage"));
  assert.ok(page.includes("Reviewed / Captured"));
  assert.ok(page.includes("totalReviewed"));
  assert.ok(page.includes("totalCaptured"));
});

test("classification quality dashboard renders priority and service breakdowns", () => {
  assert.ok(page.includes("Priority Accuracy Breakdown"));
  assert.ok(page.includes("Service Accuracy Breakdown"));
  assert.ok(page.includes("priorityBreakdown"));
  assert.ok(page.includes("serviceBreakdown"));
});

test("classification quality dashboard has responsive styling", () => {
  assert.ok(css.includes(".summaryGrid"));
  assert.ok(css.includes(".metricGrid"));
  assert.ok(css.includes(".breakdownGrid"));
  assert.ok(css.includes("@media (max-width: 760px)"));
});
