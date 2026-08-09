import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(
  new URL("../app/workspace-home.tsx", import.meta.url),
  "utf8",
);

test("service governance exposes classification quality dashboard navigation", () => {
  assert.match(
    workspace,
    /"AI \u8986\u6838",\s*"\u5206\u985e\u54c1\u8cea",\s*"\u77e5\u8b58\u5eab",/,
  );

  assert.match(
    workspace,
    /if \(x === "\u5206\u985e\u54c1\u8cea"\) \{\s*window\.location\.assign\("\/admin\/classification-quality"\);\s*return;\s*\}/,
  );
});
