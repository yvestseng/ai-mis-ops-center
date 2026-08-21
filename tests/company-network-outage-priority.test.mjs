import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
  normalizeSemanticText,
} from "../worker/ticket-classification.ts";

const tickets = fs.readFileSync(new URL("../worker/tickets.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../app/workspace-home.tsx", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../drizzle/0021_company_network_outage_priority.sql", import.meta.url),
  "utf8",
);

test("company-wide network outage phrase normalizes to company scope and outage semantics", () => {
  const input = "公司網路全部中斷無法上網";
  const normalized = normalizeSemanticText(input);
  assert.match(normalized, /全公司/);
  assert.match(normalized, /網路/);
  assert.match(normalized, /failure|down|中斷/);

  const workType = classifyWorkType(input);
  assert.equal(workType.kind, "incident");

  const service = classifyService(input);
  assert.equal(service.serviceKey, "core-network");
  assert.equal(service.category, "網路連線");
  assert.equal(service.assignedTeam, "網路維運組");

  const impact = analyzeImpact(input);
  assert.equal(impact.level, "company_wide");
  assert.equal(impact.label, "全公司");
  assert.equal(impact.serviceState, "outage");
});

test("common company-wide network outage variants preserve P1 impact semantics", () => {
  for (const input of [
    "公司網路全面中斷",
    "全公司網路中斷",
    "全公司無法上網",
    "公司全面斷網",
  ]) {
    const impact = analyzeImpact(input);
    assert.equal(impact.level, "company_wide", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyWorkType(input).kind, "incident", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("P1 remains gated by outage or severe broad network degradation and P2 core-network rule remains available", () => {
  assert.match(tickets, /priority-p1-major-outage/);
  assert.match(tickets, /severeNetworkDegradation/);
  assert.match(tickets, /qualifyingMajorIncident/);
  assert.match(tickets, /priority-p2-core-network|resolvePriorityRule/);
  assert.match(migration, /priority-p1-major-outage/);
  assert.match(migration, /公司網路全部中斷/);
  assert.match(migration, /全公司無法上網/);
  assert.match(migration, /priority_review_required = 1/);
  assert.match(migration, /require_impact_details = 1/);
});

test("front-end diagnosis preview is driven by server diagnosis priority and impact", () => {
  assert.match(workspace, /fetch\("\/api\/tickets\/diagnose"/);
  assert.match(workspace, /diagnosisResult\?\.priority\.code/);
  assert.match(workspace, /diagnosisResult\?\.priority\.value/);
  assert.match(workspace, /diagnosisResult\.impact\.label/);
  assert.match(workspace, /diagnosisResult\?\.review\.required/);
  assert.match(workspace, /diagnosisResult\?\.sla/);
});
