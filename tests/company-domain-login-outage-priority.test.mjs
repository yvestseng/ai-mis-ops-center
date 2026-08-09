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
  new URL("../drizzle/0023_company_domain_login_outage_priority.sql", import.meta.url),
  "utf8",
);

function assertCompanyDomainOutage(input) {
  const normalized = normalizeSemanticText(input);
  assert.match(normalized, /全公司/, input);
  assert.match(normalized, /網域/, input);
  assert.match(normalized, /failure|down|中斷/, input);
  assert.equal(classifyWorkType(input).kind, "incident", input);

  const service = classifyService(input);
  assert.equal(service.serviceKey, "identity-system", input);
  assert.equal(service.category, "系統與帳號", input);
  assert.equal(service.assignedTeam, "系統維運組", input);

  const impact = analyzeImpact(input);
  assert.equal(impact.level, "company_wide", input);
  assert.equal(impact.label, "全公司", input);
  assert.equal(impact.serviceState, "outage", input);
}

test("company computers unable to log in to the domain normalize to company-wide identity outage semantics", () => {
  assertCompanyDomainOutage("公司電腦都無法登入網域");
});

test("common company-wide AD and domain login outage variants preserve P1 impact semantics", () => {
  for (const input of [
    "全公司電腦無法登入AD",
    "所有員工都無法登入網域",
    "全公司無法登入網域",
    "全公司無法登入Active Directory",
  ]) {
    assertCompanyDomainOutage(input);
  }
});

test("domain login routing takes precedence over generic endpoint wording", () => {
  for (const input of [
    "我的電腦無法登入網域",
    "某一台電腦登入網域失敗",
    "筆電無法登入 Active Directory",
  ]) {
    const service = classifyService(input);
    assert.equal(service.serviceKey, "identity-system", input);
    assert.equal(service.assignedTeam, "系統維運組", input);
  }
});

test("single-user domain login failure remains single-user and is not promoted to company-wide impact", () => {
  const input = "我的電腦無法登入網域";
  const impact = analyzeImpact(input);

  assert.equal(classifyWorkType(input).kind, "incident");
  assert.equal(classifyService(input).serviceKey, "identity-system");
  assert.equal(impact.level, "single_user");
  assert.notEqual(impact.level, "company_wide");
});

test("single-computer domain login failure is not promoted to company-wide impact", () => {
  const input = "某一台電腦登入網域失敗";
  const impact = analyzeImpact(input);

  assert.equal(classifyWorkType(input).kind, "incident");
  assert.equal(classifyService(input).serviceKey, "identity-system");
  assert.notEqual(impact.level, "company_wide");
  assert.equal(impact.serviceState, "outage");
});

test("0023 aligns D1 P1 vocabulary while preserving the existing company-wide outage safety gate", () => {
  assert.match(tickets, /priority-p1-major-outage/);
  assert.match(tickets, /impact\.serviceState !== "outage"/);
  assert.match(migration, /priority-p1-major-outage/);
  assert.match(migration, /公司電腦都無法登入網域/);
  assert.match(migration, /全公司電腦無法登入AD/);
  assert.match(migration, /所有員工都無法登入網域/);
  assert.match(migration, /priority_review_required = 1/);
  assert.match(migration, /require_impact_details = 1/);
});
