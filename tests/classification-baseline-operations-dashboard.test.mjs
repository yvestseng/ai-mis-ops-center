import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(
  new URL("../app/admin/classification-quality/page.tsx", import.meta.url),
  "utf8",
);

const styles = fs.readFileSync(
  new URL("../app/admin/classification-quality/classification-quality-dashboard.module.css", import.meta.url),
  "utf8",
);

test("classification quality dashboard renders baseline operations governance signals", () => {
  assert.match(page, /BASELINE OPERATIONS V1/);
  assert.match(page, /Weekly KPI Trend/);
  assert.match(page, /Top Service Misclassifications/);
  assert.match(page, /Top Priority Misclassifications/);
  assert.match(page, /p1SampleAdequacy/);
  assert.match(page, /maturity/);
});

test("classification quality dashboard distinguishes missing data from KPI failure", () => {
  assert.match(page, /value == null\) return \{ label: "N\/A"/);
  assert.match(page, /if \(!data\?\.baseline\.totalCaptured\) return null/);
  assert.match(page, /formatRate\(reviewedCoverage\)/);
  assert.match(styles, /\.na\s*\{/);
});

test("baseline operations dashboard is responsive", () => {
  assert.match(styles, /\.operationsGrid/);
  assert.match(styles, /\.sampleCounts/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});
