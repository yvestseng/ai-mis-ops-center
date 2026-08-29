import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeImpact,
  classifyWorkType,
} from "../worker/ticket-classification.ts";

function boundaryPriority(input) {
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

test("department outage is not promoted by a negative rest-of-company phrase", () => {
  const cases = [
    "採購所有同仁今天都無法連線部門共用系統，但全公司其他單位沒有問題。",
    "財務所有人員無法使用部門系統，不過公司其他部門皆正常。",
    "人資部全體同仁無法使用共用系統，但其餘單位未受影響。",
    "研發所有使用者無法連線內部服務，然而全公司其他部門沒有異常。",
  ];

  for (const input of cases) {
    const impact = analyzeImpact(input);
    assert.equal(classifyWorkType(input).kind, "incident", input);
    assert.equal(impact.level, "department", input);
    assert.equal(impact.label, "部門", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(boundaryPriority(input), "P2", input);
  }
});

test("true company-wide outage wording still remains P1", () => {
  const cases = [
    "全公司所有同仁都無法使用共用系統。",
    "全公司所有使用者都無法連線，其他服務也受到影響。",
  ];

  for (const input of cases) {
    const impact = analyzeImpact(input);
    assert.equal(impact.level, "company_wide", input);
    assert.equal(impact.serviceState, "outage", input);
    assert.equal(boundaryPriority(input), "P1", input);
  }
});
