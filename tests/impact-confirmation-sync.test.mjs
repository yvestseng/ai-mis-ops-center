import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workspace = fs.readFileSync(
  new URL("../app/workspace-home.tsx", import.meta.url),
  "utf8",
);
const tickets = fs.readFileSync(
  new URL("../worker/tickets.ts", import.meta.url),
  "utf8",
);

test("latest AI diagnosis always refreshes confirmation impact scope", () => {
  assert.match(workspace, /setImpactLevel\(result\.impact\.level\)/);
  assert.match(
    workspace,
    /setImpactScope\(result\.impact\.level === "unknown" \? "" : result\.impact\.label\)/,
  );
  assert.doesNotMatch(
    workspace,
    /if \(!impactScope\.trim\(\) && result\.impact\.level !== "unknown"\)/,
  );
});

test("ticket submission carries the canonical impact level shown by diagnosis", () => {
  assert.match(workspace, /const \[impactLevel, setImpactLevel\] = useState\(""\)/);
  assert.match(workspace, /serviceInterruption,\s*impactScope,\s*impactLevel,/);
  assert.match(workspace, /data-impact-level=\{impactLevel\}/);
});

test("server rejects stale impact diagnosis and persists authoritative canonical level", () => {
  assert.match(tickets, /submittedImpactLevel/);
  assert.match(tickets, /canonicalImpactLevel = classification\.impact\.level/);
  assert.match(
    tickets,
    /submittedImpactLevel && submittedImpactLevel !== canonicalImpactLevel/,
  );
  assert.match(tickets, /STALE_IMPACT_DIAGNOSIS/);
  assert.match(tickets, /expectedImpactLevel: canonicalImpactLevel/);
  assert.match(tickets, /impactLevel: canonicalImpactLevel/);
});

test("confirmation state is cleared when switching form mode or after ticket creation", () => {
  const resets = workspace.match(/setImpactLevel\(""\)/g) ?? [];
  assert.ok(resets.length >= 2);
  assert.match(workspace, /setImpactScope\(""\)/);
});
