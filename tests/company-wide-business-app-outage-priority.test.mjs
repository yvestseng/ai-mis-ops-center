import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
} from "../worker/ticket-classification.ts";

function expectedPriority(workType, impact) {
  if (workType.kind === "request") return "P4";
  if (impact.level === "company_wide" && impact.serviceState === "outage") return "P1";
  return "P3";
}

test("company-wide ERP login outage is normalized as a P1 business application outage", () => {
  const input = "全公司ERP都無法登入";
  const workType = classifyWorkType(input);
  const service = classifyService(input);
  const impact = analyzeImpact(input);

  assert.equal(workType.kind, "incident");
  assert.equal(service.serviceKey, "application");
  assert.equal(service.assignedTeamId, "team-application");
  assert.equal(impact.level, "company_wide");
  assert.equal(impact.serviceState, "outage");
  assert.equal(expectedPriority(workType, impact), "P1");
});

test("ERP boundary cases do not promote ordinary or request cases to P1", () => {
  const cases = [
    { input: "我的 ERP 程式錯誤無法使用", priority: "P3" },
    { input: "財務部ERP無法登入", priority: "P3" },
    { input: "我要申請ERP帳號", priority: "P4" },
    { input: "我的ERP帳號申請重設密碼", priority: "P4" },
  ];

  for (const item of cases) {
    const workType = classifyWorkType(item.input);
    const impact = analyzeImpact(item.input);
    assert.equal(expectedPriority(workType, impact), item.priority, item.input);
  }
});
