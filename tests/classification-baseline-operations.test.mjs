import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../worker/classification-baseline-operations.ts", import.meta.url),
  "utf8",
);

test("baseline operations defines reviewed-sample maturity gates", () => {
  assert.match(source, /reviewed >= 100/);
  assert.match(source, /reviewed >= 50/);
  assert.match(source, /reviewed >= 30/);
  assert.match(source, /Baseline v1/);
  assert.match(source, /Usable Baseline/);
  assert.match(source, /Early Baseline/);
});

test("P1 adequacy exposes predicted actual and true-positive sample counts", () => {
  assert.match(source, /predictedP1/);
  assert.match(source, /actualP1/);
  assert.match(source, /truePositiveP1/);
  assert.match(source, /minimumActualP1 = 10/);
  assert.match(source, /樣本不足/);
});

test("weekly KPI trend is grouped from completed MIS reviews", () => {
  assert.match(source, /strftime\('%Y-%W', reviewed_at\)/);
  assert.match(source, /WHERE reviewed_at IS NOT NULL/);
  assert.match(source, /overallClassificationAccuracy/);
  assert.match(source, /serviceAccuracy/);
  assert.match(source, /priorityAccuracy/);
  assert.match(source, /p1Precision/);
  assert.match(source, /p1Recall/);
  assert.match(source, /aiRecommendationAcceptanceRate/);
});

test("top misclassification dimensions include errors and error rate", () => {
  assert.match(source, /service_correct = 0 OR team_correct = 0/);
  assert.match(source, /priority_correct = 0/);
  assert.match(source, /ORDER BY errors DESC/);
  assert.match(source, /errorRate/);
  assert.match(source, /topMisclassifications/);
});
