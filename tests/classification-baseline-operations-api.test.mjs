import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../worker/classification-reviews.ts", import.meta.url),
  "utf8",
);

test("classification KPI API includes baseline operations without replacing existing KPI fields", () => {
  assert.match(source, /getBaselineOperationsDatasource/);
  assert.match(source, /const operations = await operationsPromise/);
  assert.match(source, /baseline:/);
  assert.match(source, /priorityBreakdown:/);
  assert.match(source, /serviceBreakdown:/);
  assert.match(source, /operations,/);
});
