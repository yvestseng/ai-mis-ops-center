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

test("department-wide network outages remain department impact", () => {
  for (const input of [
    "財務部全部電腦都無法上網",
    "資訊部所有電腦無法上網",
  ]) {
    const impact = analyzeImpact(input);

    assert.equal(impact.level, "department", input);
    assert.equal(impact.label, "部門", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(classifyService(input).serviceKey, "core-network", input);
  }
});

test("single-user network outage remains single-user impact", () => {
  const input = "我的電腦無法上網";
  const impact = analyzeImpact(input);

  assert.equal(impact.level, "single_user");
  assert.equal(impact.label, "單一使用者");
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyService(input).serviceKey, "core-network");
});
