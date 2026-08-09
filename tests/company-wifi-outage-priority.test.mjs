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
const migration = fs.readFileSync(
  new URL("../drizzle/0022_company_wifi_outage_priority.sql", import.meta.url),
  "utf8",
);

function assertCompanyWifiOutage(input) {
  const normalized = normalizeSemanticText(input);
  assert.match(normalized, /全公司/, input);
  assert.match(normalized, /網路/, input);
  assert.match(normalized, /failure|down|中斷/, input);

  const workType = classifyWorkType(input);
  assert.equal(workType.kind, "incident", input);

  const service = classifyService(input);
  assert.equal(service.serviceKey, "core-network", input);
  assert.equal(service.category, "網路連線", input);
  assert.equal(service.assignedTeam, "網路維運組", input);

  const impact = analyzeImpact(input);
  assert.equal(impact.level, "company_wide", input);
  assert.equal(impact.label, "全公司", input);
  assert.equal(impact.serviceState, "outage", input);
}

test("company WIFI outage is normalized as a company-wide network outage", () => {
  assertCompanyWifiOutage("公司WIFI全部中斷無法上網");
});

test("common Wi-Fi and wireless company-wide outage variants keep P1 impact semantics", () => {
  for (const input of [
    "公司WiFi全部中斷",
    "公司Wi-Fi全部中斷",
    "全公司WIFI中斷",
    "全公司WiFi中斷",
    "全公司Wi-Fi中斷",
    "公司無線網路全部中斷",
    "公司無線網路全面中斷",
    "全公司無線網路中斷",
    "公司無線網全部斷線",
    "全公司無法連WiFi",
    "全公司無法連線WiFi",
  ]) {
    assertCompanyWifiOutage(input);
  }
});

test("single AP failure is not promoted to company-wide impact", () => {
  const input = "公司的某一台 WiFi AP 故障";
  const impact = analyzeImpact(input);
  assert.notEqual(impact.level, "company_wide");
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyService(input).serviceKey, "core-network");
});

test("single-user Wi-Fi problem is not promoted to company-wide impact", () => {
  const input = "我的筆電連不上公司 WiFi";
  const impact = analyzeImpact(input);
  assert.notEqual(impact.level, "company_wide");
  assert.equal(classifyService(input).serviceKey, "core-network");
});

test("D1 Wi-Fi vocabulary keeps the existing P1 outage safety gate and review requirements", () => {
  assert.match(tickets, /priority-p1-major-outage/);
  assert.match(tickets, /impact\.serviceState !== "outage"/);
  assert.match(migration, /公司WIFI全部中斷/);
  assert.match(migration, /公司Wi-Fi全部中斷/);
  assert.match(migration, /全公司無法連WiFi/);
  assert.match(migration, /priority_review_required = 1/);
  assert.match(migration, /require_impact_details = 1/);
});
