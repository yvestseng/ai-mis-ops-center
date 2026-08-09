import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(
  new URL("../app/workspace-home.tsx", import.meta.url),
  "utf8",
);

test("AI review governance exposes classification review workbench navigation", () => {
  assert.match(workspace, /Classification Review Workbench/);
  assert.match(workspace, /KPI Ground Truth/);
  assert.match(
    workspace,
    /window\.location\.assign\("\/admin\/classification-reviews"\)/,
  );
  assert.match(workspace, /\u958b\u555f\u5206\u985e\u8986\u6838\u5de5\u4f5c\u53f0/);
});
