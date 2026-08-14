import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
} from "../worker/ticket-classification.ts";

const tickets = fs.readFileSync(new URL("../worker/tickets.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../drizzle/0026_department_outage_priority.sql", import.meta.url),
  "utf8",
);

function expectedBoundaryPriority(input) {
  const workType = classifyWorkType(input);
  const impact = analyzeImpact(input);

  if (workType.kind === "request") return "P4";
  if (
    impact.serviceState === "outage" &&
    (impact.level === "company_wide" || impact.level === "site_wide")
  ) return "P1";
  if (
    impact.serviceState === "outage" &&
    (impact.level === "department" || impact.level === "multiple_users")
  ) return "P2";
  return "P3";
}

test("P1/P2/P3 Wi-Fi outage boundaries stay separated", () => {
  const cases = [
    ["公司 Wi-Fi，從早上開始一直斷線所有人員都無法連線", "company_wide", "P1"],
    ["財務部所有人員都無法連公司 WiFi", "department", "P2"],
    ["多人無法連公司 WiFi", "multiple_users", "P2"],
    ["公司的某一台 WiFi AP 故障", "unknown", "P3"],
    ["我的筆電連不上公司 WiFi", "single_user", "P3"],
  ];

  for (const [input, impactLevel, priority] of cases) {
    const impact = analyzeImpact(input);
    assert.equal(classifyWorkType(input).kind, "incident", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
    assert.equal(impact.level, impactLevel, input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(expectedBoundaryPriority(input), priority, input);
  }
});

test("0026 creates an active P2 department/multi-user outage rule", () => {
  assert.match(migration, /priority-p2-department-outage/);
  assert.match(migration, /P2－部門／多人服務中斷/);
  assert.match(migration, /'高'/);
  assert.match(migration, /priority_review_required = 1/);
  assert.match(migration, /require_impact_details = 1/);
  assert.match(migration, /display_order = 25/);
});

test("priority engine gates generic P2 by outage and semantic impact scope", () => {
  assert.match(tickets, /priority-p2-department-outage/);
  assert.match(tickets, /impact\.level === "department"/);
  assert.match(tickets, /impact\.level === "multiple_users"/);
  assert.match(tickets, /impact\.serviceState === "outage"/);
  assert.match(tickets, /!departmentOrMultiUserOutage/);
});

test("generic P2 preserves service routing instead of forcing MIS service desk", () => {
  assert.match(
    tickets,
    /matchedRule\?\.id === "priority-p2-department-outage"/,
  );
  assert.match(
    tickets,
    /ruleOwnsRouting = Boolean/,
  );
});
