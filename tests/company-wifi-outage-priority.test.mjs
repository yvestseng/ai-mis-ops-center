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

const impactAliasMigration = fs.readFileSync(
  new URL("../drizzle/0025_company_wide_impact_aliases.sql", import.meta.url),
  "utf8",
);

const allWifiAliasMigration = fs.readFileSync(
  new URL("../drizzle/0028_company_all_wifi_outage_alias.sql", import.meta.url),
  "utf8",
);

function assertCompanyWifiOutage(input) {
  const normalized = normalizeSemanticText(input);
  assert.match(normalized, /全公司|所有使用者受影響/, input);
  assert.match(normalized, /網路|wifi|wi-fi|無線網/, input);
  assert.match(normalized, /failure|down|中斷|斷線|不能連線|無法連線|連不上|不能上網|無法上網|無法使用/, input);

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
    "公司所有 Wi-Fi，從早上開始一直斷線",
    "公司全部 WiFi 從早上開始一直斷線",
    "公司所有無線網路一直中斷",
    "公司全數 Wi-Fi 都無法連線",
  ]) {
    assertCompanyWifiOutage(input);
  }
});

test("natural-language all-personnel Wi-Fi outage is promoted to company-wide P1 semantics", () => {
  assertCompanyWifiOutage("公司 Wi-Fi，從早上開始一直斷線所有人員都無法連線");
});

test("common workforce-wide wording is normalized as company-wide impact", () => {
  for (const input of [
    "公司 WiFi 一直斷線，全部人員都不能連線",
    "公司無線網路中斷，所有同仁都無法上網",
    "公司 Wi-Fi 掛了，全部同仁都無法使用",
    "公司無線網路斷線，所有使用者都連不上",
    "公司 WiFi 中斷，全體使用者都不能上網",
  ]) {
    assertCompanyWifiOutage(input);
  }
});

test("department-wide all-personnel outage is not promoted to company-wide P1 impact", () => {
  const input = "財務部所有人員都無法連公司 WiFi";
  const impact = analyzeImpact(input);

  assert.equal(impact.level, "department");
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyService(input).serviceKey, "core-network");
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
  assert.match(tickets, /qualifyingMajorIncident/);
  assert.match(tickets, /severeNetworkDegradation/);
  assert.match(migration, /公司WIFI全部中斷/);
  assert.match(migration, /公司Wi-Fi全部中斷/);
  assert.match(migration, /全公司無法連WiFi/);
  assert.match(migration, /priority_review_required = 1/);
  assert.match(migration, /require_impact_details = 1/);
  assert.match(impactAliasMigration, /所有人員/);
  assert.match(impactAliasMigration, /所有使用者受影響/);
  assert.match(impactAliasMigration, /priority_review_required = 1/);
  assert.match(allWifiAliasMigration, /公司所有WiFi斷線/);
  assert.match(allWifiAliasMigration, /公司所有Wi-Fi斷線/);
  assert.match(allWifiAliasMigration, /公司全部WiFi斷線/);
  assert.match(allWifiAliasMigration, /公司所有無線網路斷線/);
  assert.match(allWifiAliasMigration, /公司全數WiFi無法連線/);
  assert.match(allWifiAliasMigration, /priority_review_required = 1/);
  assert.match(allWifiAliasMigration, /require_impact_details = 1/);
});

