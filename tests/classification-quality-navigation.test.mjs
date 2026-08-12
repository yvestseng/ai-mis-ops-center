import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(
  new URL("../app/workspace-home.tsx", import.meta.url),
  "utf8",
);

test("service governance exposes classification review and quality dashboard navigation", () => {
  assert.ok(workspace.includes("MIS 分類覆核"));
  assert.ok(workspace.includes("分類品質 Dashboard"));
  assert.ok(workspace.includes("/admin/classification-reviews"));
  assert.ok(workspace.includes("/admin/classification-quality"));
});
