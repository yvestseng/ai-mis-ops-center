import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
  normalizeSemanticText,
} from "../worker/ticket-classification.ts";

test("company device network outage wording is company-wide instead of department", () => {
  for (const input of [
    "公司全部電腦都無法上網",
    "公司所有電腦都不能上網",
    "公司全部 PC 無法連網",
    "所有公司電腦目前都無法上網",
    "全公司所有電腦都不能連外",
  ]) {
    const normalized = normalizeSemanticText(input);
    const impact = analyzeImpact(input);

    assert.match(normalized, /全公司/, input);
    assert.equal(impact.level, "company_wide", input);
    assert.equal(impact.label, "全公司", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyWorkType(input).kind, "incident", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("company device Wi-Fi outage wording is company-wide", () => {
  for (const input of [
    "公司全部電腦都無法連WiFi，導致都無法上網",
    "公司所有電腦不能連無線網路",
    "全公司全部PC無法連Wi-Fi",
    "所有公司電腦目前都不能連WiFi",
    "公司全數 computer 無法連 wi fi",
  ]) {
    const normalized = normalizeSemanticText(input);
    const impact = analyzeImpact(input);

    assert.match(normalized, /全公司/, input);
    assert.match(normalized, /網路/, input);
    assert.equal(impact.level, "company_wide", input);
    assert.equal(impact.label, "全公司", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyWorkType(input).kind, "incident", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("company all Wi-Fi outage wording is company-wide", () => {
  const input = "公司所有 Wi-Fi，從早上開始一直斷線";
  const normalized = normalizeSemanticText(input);
  const impact = analyzeImpact(input);
  const service = classifyService(input);

  assert.match(normalized, /全公司/, input);
  assert.match(normalized, /網路|wifi|wi-fi|無線網/, input);
  assert.equal(impact.level, "company_wide", input);
  assert.equal(impact.label, "全公司", input);
  assert.equal(impact.serviceState, "outage", input);
  assert.equal(classifyWorkType(input).kind, "incident", input);
  assert.equal(service.serviceKey, "core-network", input);
  assert.equal(service.assignedTeam, "網路維運組", input);
});

test("department-wide network outages remain department impact", () => {
  for (const input of [
    "財務部全部電腦都無法上網",
    "資訊部所有電腦無法上網",
    "財務部全部電腦都無法連WiFi",
    "資訊部所有PC不能連無線網路",
  ]) {
    const impact = analyzeImpact(input);

    assert.equal(impact.level, "department", input);
    assert.equal(impact.label, "部門", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("single-user network outage remains single-user impact", () => {
  for (const input of [
    "我的電腦無法上網",
    "我這台電腦無法連WiFi",
  ]) {
    const impact = analyzeImpact(input);

    assert.equal(impact.level, "single_user", input);
    assert.equal(impact.label, "單一使用者", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("department Wi-Fi connection failure is recognized as an outage", () => {
  const input = "資訊部所有PC不能連無線網路";
  const impact = analyzeImpact(input);

  assert.equal(impact.level, "department");
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyWorkType(input).kind, "incident");
  assert.equal(classifyService(input).serviceKey, "core-network");
});
