import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
  normalizeSemanticText,
} from "../worker/ticket-classification.ts";

test("Taipei headquarters all-user wired and Wi-Fi outage is broad P1 impact signal", () => {
  const input =
    "台北總公司所有使用者目前都無法連上公司網路，Wi-Fi 與有線網路皆無法使用，ERP、Email 與內部系統全部中斷，請立即協助處理。";
  const normalized = normalizeSemanticText(input);
  const impact = analyzeImpact(input);

  assert.match(normalized, /所有使用者受影響|全公司|主要據點/);
  assert.ok(
    impact.level === "company_wide" || impact.level === "site_wide",
    `expected broad impact, got ${impact.level}`,
  );
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyWorkType(input).kind, "incident");
  assert.equal(classifyService(input).serviceKey, "core-network");
});

test("English all-user headquarters wired and Wi-Fi outage is broad impact", () => {
  const input =
    "All users at Taipei headquarters cannot connect to the corporate network. Both Wi-Fi and wired LAN are unavailable. ERP, Email and internal systems are all down.";
  const impact = analyzeImpact(input);

  assert.ok(
    impact.level === "company_wide" || impact.level === "site_wide",
    `expected broad impact, got ${impact.level}`,
  );
  assert.equal(impact.serviceState, "outage");
  assert.equal(classifyWorkType(input).kind, "incident");
  assert.equal(classifyService(input).serviceKey, "core-network");
});

test("department Wi-Fi outage remains department impact", () => {
  const input =
    "台北總公司財務部約 15 位同仁目前無法使用 Wi-Fi，其他部門與有線網路皆正常。";
  const impact = analyzeImpact(input);

  assert.equal(impact.level, "department");
  assert.equal(impact.serviceState, "outage");
});

test("single-user Wi-Fi outage remains single-user impact", () => {
  const input =
    "我的筆電無法連公司 Wi-Fi，其他同事都正常，有線網路也可以使用。";
  const impact = analyzeImpact(input);

  assert.equal(impact.level, "single_user");
  assert.equal(impact.serviceState, "outage");
});

test("single AP degradation is never promoted to broad impact", () => {
  const input =
    "17 樓一台 AP 發生故障，附近幾位使用者 Wi-Fi 訊號不穩，其他樓層與有線網路正常。";
  const impact = analyzeImpact(input);

  assert.notEqual(impact.level, "company_wide");
  assert.notEqual(impact.level, "site_wide");
});

test("internal-system wording is not mistaken for a department name", () => {
  const input =
    "所有使用者無法使用 ERP、Email 與內部系統，服務全部中斷。";
  const impact = analyzeImpact(input);

  assert.notEqual(impact.level, "department");
  assert.equal(impact.level, "company_wide");
  assert.equal(impact.serviceState, "outage");
});
