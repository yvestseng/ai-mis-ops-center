import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(
  new URL("../app/admin/classification-reviews/page.tsx", import.meta.url),
  "utf8",
);
const css = fs.readFileSync(
  new URL("../app/admin/classification-reviews/classification-review-workbench.module.css", import.meta.url),
  "utf8",
);

test("classification review workbench reads review queue and support teams", () => {
  assert.match(page, /fetch\("\/api\/classification-reviews"/);
  assert.match(page, /fetch\("\/api\/support-teams"/);
  assert.match(page, /credentials: "include"/);
});

test("classification review workbench reads detail and persists MIS final review", () => {
  assert.match(page, /\/api\/classification-reviews\/\$\{encodeURIComponent\(ticketId\)\}/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /finalWorkType/);
  assert.match(page, /finalServiceKey/);
  assert.match(page, /finalTeamId/);
  assert.match(page, /finalPriority/);
  assert.match(page, /finalImpactLevel/);
});

test("classification review workbench supports pending reviewed and all filters", () => {
  assert.match(page, /type Filter = "pending" \| "reviewed" \| "all"/);
  assert.match(page, /setFilter\("pending"\)/);
  assert.match(page, /setFilter\("reviewed"\)/);
  assert.match(page, /setFilter\("all"\)/);
});

test("classification review workbench requires a reason when MIS modifies AI suggestion", () => {
  assert.match(page, /if \(changed && !payload\.reviewReason\.trim\(\)\)/);
  assert.match(page, /修改 AI 建議時必須填寫覆核原因/);
  assert.match(page, /接受 AI 建議/);
  assert.match(page, /儲存 MIS 最終覆核/);
});

test("classification review workbench keeps suggested evidence visually distinct and immutable", () => {
  assert.match(page, /AI 原始建議/);
  assert.match(page, /MIS 最終結果/);
  assert.match(page, /suggested_\* 為 immutable snapshot/);
  assert.match(page, /只寫入 final_\*/);
});

test("classification review workbench has responsive two-pane styling", () => {
  assert.match(css, /\.workbench\s*\{/);
  assert.match(css, /grid-template-columns:/);
  assert.match(css, /@media \(max-width: 1080px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
