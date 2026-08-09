[CmdletBinding()]
param(
    [string]$ProjectPath = 'D:\DEV\ai-mis-ops-center'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Replace-Exact {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Old,
        [Parameter(Mandatory=$true)][string]$New,
        [Parameter(Mandatory=$true)][string]$Label
    )
    $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if (-not $content.Contains($Old)) {
        throw "Cannot apply '$Label': expected source block was not found in $Path. Stop without guessing."
    }
    $updated = $content.Replace($Old, $New)
    Set-Content -LiteralPath $Path -Value $updated -Encoding UTF8 -NoNewline
    Write-Host "Updated: $Label" -ForegroundColor Green
}

$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$classifierPath = Join-Path $ProjectPath 'worker\ticket-classification.ts'
$ticketsPath = Join-Path $ProjectPath 'worker\tickets.ts'
$testPath = Join-Path $ProjectPath 'tests\ticket-classification-source.test.mjs'
$migrationPath = Join-Path $ProjectPath 'drizzle\0019_request_type_priority_routing.sql'

foreach ($path in @($classifierPath, $ticketsPath, $testPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file not found: $path"
    }
}
if (Test-Path -LiteralPath $migrationPath) {
    throw "Migration already exists: $migrationPath"
}

# 1) Add work-type model.
Replace-Exact -Path $classifierPath -Label 'WorkTypeClassification type' -Old @'
export type ImpactAnalysis = {
  level: "company_wide" | "site_wide" | "department" | "multiple_users" | "single_user" | "unknown";
  label: string;
  serviceState: "outage" | "degraded" | "request" | "unknown";
  confidence: number;
  evidence: string[];
};
'@ -New @'
export type ImpactAnalysis = {
  level: "company_wide" | "site_wide" | "department" | "multiple_users" | "single_user" | "unknown";
  label: string;
  serviceState: "outage" | "degraded" | "request" | "unknown";
  confidence: number;
  evidence: string[];
};

export type WorkTypeClassification = {
  kind: "incident" | "request" | "unknown";
  requestType:
    | "software_installation"
    | "software_request"
    | "device_request"
    | "access_request"
    | "improvement"
    | "general_request"
    | null;
  label: string;
  confidence: number;
  evidence: string[];
};
'@

# 2) Add semantic incident-vs-request classifier before service classification.
Replace-Exact -Path $classifierPath -Label 'classifyWorkType' -Old @'
function evidence(text: string, patterns: Array<[RegExp, string]>) {
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function classifyService(rawText: string): ServiceClassification {
'@ -New @'
function evidence(text: string, patterns: Array<[RegExp, string]>) {
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function classifyWorkType(rawText: string): WorkTypeClassification {
  const text = normalizeSemanticText(rawText);
  const incidentPatterns: Array<[RegExp, string]> = [
    [/failure|failed|error|down|中斷|故障|異常|失敗|無法|不能使用|不能連線|斷線|掛掉|掛了/, "故障／異常"],
    [/無法寄信|無法收信|無法啟動|無法開機|無法運作/, "服務無法使用"],
  ];
  const incidentEvidence = evidence(text, incidentPatterns);
  if (incidentEvidence.length) {
    return {
      kind: "incident",
      requestType: null,
      label: "故障／異常",
      confidence: 0.94,
      evidence: incidentEvidence,
    };
  }

  const requestClassifiers: Array<{
    requestType: NonNullable<WorkTypeClassification["requestType"]>;
    label: string;
    patterns: Array<[RegExp, string]>;
  }> = [
    {
      requestType: "software_installation",
      label: "軟體安裝申請",
      patterns: [
        [/軟體安裝|安裝軟體|安裝\s*(office|autocad|adobe|應用程式|程式)|我要安裝|需要安裝|協助安裝/, "軟體安裝"],
        [/\boffice\s*\d{4}\b|\bautocad\b|\badobe\b/, "指定軟體"],
      ],
    },
    {
      requestType: "device_request",
      label: "設備申請",
      patterns: [
        [/設備申請|申請設備|申請筆電|申請電腦|更換電池|更換設備|設備更換|新增設備/, "設備需求"],
      ],
    },
    {
      requestType: "access_request",
      label: "帳號／權限申請",
      patterns: [
        [/帳號申請|申請帳號|權限申請|申請權限|開通權限|新增權限|存取權限|開通帳號/, "帳號／權限需求"],
      ],
    },
    {
      requestType: "improvement",
      label: "改善建議",
      patterns: [
        [/改善建議|功能建議|優化建議|建議新增|希望增加|希望新增|需求建議/, "改善／功能建議"],
      ],
    },
    {
      requestType: "software_request",
      label: "軟體申請",
      patterns: [
        [/軟體申請|申請軟體|軟體需求|授權申請|license\s*request/, "軟體需求"],
      ],
    },
    {
      requestType: "general_request",
      label: "一般服務申請",
      patterns: [
        [/申請|新增|開通|安裝|設定需求|需求申請/, "一般申請"],
      ],
    },
  ];

  for (const classifier of requestClassifiers) {
    const hits = evidence(text, classifier.patterns);
    if (hits.length) {
      return {
        kind: "request",
        requestType: classifier.requestType,
        label: classifier.label,
        confidence: Math.min(0.98, 0.86 + hits.length * 0.05),
        evidence: hits,
      };
    }
  }

  return {
    kind: "unknown",
    requestType: null,
    label: "待判斷",
    confidence: 0.5,
    evidence: ["未辨識到明確故障或申請語意"],
  };
}

export function classifyService(rawText: string): ServiceClassification {
'@

# 3) Improve endpoint/software routing.
Replace-Exact -Path $classifierPath -Label 'endpoint software request routing' -Old @'
      patterns: [[/印表機|筆電|電腦|螢幕|鍵盤|軟體安裝|安裝.*軟體|軟體.*安裝|printer|laptop/, "端點設備"]],
'@ -New @'
      patterns: [[/印表機|筆電|電腦|螢幕|鍵盤|設備申請|申請設備|更換電池|軟體安裝|安裝.*(軟體|office|autocad|adobe|應用程式|程式)|office\s*\d{4}|autocad|adobe|printer|laptop/, "端點／軟體服務"]],
'@

# 4) Reuse work-type result for impact serviceState.
Replace-Exact -Path $classifierPath -Label 'impact request detection' -Old @'
export function analyzeImpact(rawText: string): ImpactAnalysis {
  const text = normalizeSemanticText(rawText);
  const outage = /failure|down|中斷|無法寄信|無法收信|無法使用|無法運作|無法啟動|無法開機|斷線/.test(text);
  const degraded = /異常|很慢|延遲|不穩|偶發|部分|間歇/.test(text);
  const request = /申請|安裝|建議|新增|開通|權限/.test(text) && !outage;
'@ -New @'
export function analyzeImpact(rawText: string): ImpactAnalysis {
  const text = normalizeSemanticText(rawText);
  const workType = classifyWorkType(text);
  const outage = /failure|down|中斷|無法寄信|無法收信|無法使用|無法運作|無法啟動|無法開機|斷線/.test(text);
  const degraded = /異常|很慢|延遲|不穩|偶發|部分|間歇/.test(text);
  const request = workType.kind === "request";
'@

# 5) Import classifyWorkType.
Replace-Exact -Path $ticketsPath -Label 'tickets import classifyWorkType' -Old @'
import {
  analyzeImpact,
  classifyService,
  normalizeSemanticText,
  priorityCode,
} from "./ticket-classification";
'@ -New @'
import {
  analyzeImpact,
  classifyService,
  classifyWorkType,
  normalizeSemanticText,
  priorityCode,
} from "./ticket-classification";
'@

# 6) Request routing happens before normal priority matching/P3 fallback.
Replace-Exact -Path $ticketsPath -Label 'request before P3 fallback' -Old @'
    const content = normalizeSemanticText(`${title} ${description}`);
    const impact = analyzeImpact(content);
    const rules = result.results ?? [];
    const explicit = rules.find((rule) => {
      if (!ruleMatches(content, rule)) return false;
      // A broad impact phrase such as "全公司" is not enough for P1 by itself;
      // it must also describe an actual outage/failure, not a request or notice.
      if (rule.id === "priority-p1-major-outage" && impact.serviceState !== "outage") return false;
      return true;
    });
'@ -New @'
    const content = normalizeSemanticText(`${title} ${description}`);
    const impact = analyzeImpact(content);
    const workType = classifyWorkType(content);
    const rules = result.results ?? [];

    // First split the ticket into incident vs request. A clear request must
    // enter the P4 request policy before the generic P3 incident fallback.
    if (workType.kind === "request") {
      const requestRule = rules.find((rule) => rule.id === "priority-p4-request");
      if (requestRule) return requestRule;
      return null;
    }

    const explicit = rules.find((rule) => {
      if (!ruleMatches(content, rule)) return false;
      // P4 is reserved for request-type tickets. Wording such as
      // "安裝後失敗" must remain an incident and must not be downgraded.
      if (rule.id === "priority-p4-request") return false;
      // A broad impact phrase such as "全公司" is not enough for P1 by itself;
      // it must also describe an actual outage/failure, not a request or notice.
      if (rule.id === "priority-p1-major-outage" && impact.serviceState !== "outage") return false;
      return true;
    });
'@

# 7) Make P4 a generic priority rule; service classifier still owns category/team.
Replace-Exact -Path $ticketsPath -Label 'P4 routing and review policy' -Old @'
function buildClassification(title: string, description: string, matchedRule: PriorityRuleMatch | null) {
  const text = `${title} ${description}`;
  const service = classifyService(text);
  const impact = analyzeImpact(text);
  const genericImpactRule = matchedRule?.id === "priority-p1-major-outage";
  const fallbackRule = matchedRule?.id === "priority-p3-default-service";
  const ruleOwnsRouting = Boolean(matchedRule && !genericImpactRule && !fallbackRule);
  const category = ruleOwnsRouting ? matchedRule!.category : service.category;
  const assignedTeam = ruleOwnsRouting ? matchedRule!.assignedTeam : service.assignedTeam;
  const priority = matchedRule?.priority || (impact.serviceState === "request" ? "低" : "中");
  const confidence = Math.round(Math.min(service.confidence, impact.confidence) * 100) / 100;
  const reviewReasons: string[] = [];
  if (matchedRule?.priorityReviewRequired === 1) reviewReasons.push("優先級規則要求 MIS 覆核");
  if (priority === "緊急" || priority === "高") reviewReasons.push(`${priorityCode(priority)} 高影響工單`);
  if (impact.level === "unknown" && impact.serviceState === "outage") reviewReasons.push("已辨識服務中斷，但影響範圍尚未確認");
  if (confidence < 0.7) reviewReasons.push("分類信心不足 70%");
  return {
    service,
    impact,
    category,
    assignedTeam,
    assignedTeamId: ruleOwnsRouting ? undefined : service.assignedTeamId,
    priority,
    confidence,
    priorityReviewRequired: reviewReasons.length > 0,
    priorityReviewReason: reviewReasons.join("；"),
    requireImpactDetails: matchedRule?.requireImpactDetails === 1 || priority === "緊急" || priority === "高",
    classificationSource: fallbackRule
      ? "semantic+fallback-rule"
      : matchedRule
        ? "semantic+priority-rule"
        : "semantic-fallback",
  };
}
'@ -New @'
function buildClassification(title: string, description: string, matchedRule: PriorityRuleMatch | null) {
  const text = `${title} ${description}`;
  const service = classifyService(text);
  const impact = analyzeImpact(text);
  const workType = classifyWorkType(text);
  const genericImpactRule = matchedRule?.id === "priority-p1-major-outage";
  const fallbackRule = matchedRule?.id === "priority-p3-default-service";
  const genericRequestRule = matchedRule?.id === "priority-p4-request";
  const ruleOwnsRouting = Boolean(
    matchedRule && !genericImpactRule && !fallbackRule && !genericRequestRule,
  );
  const category = ruleOwnsRouting ? matchedRule!.category : service.category;
  const assignedTeam = ruleOwnsRouting ? matchedRule!.assignedTeam : service.assignedTeam;
  const priority = workType.kind === "request" ? "低" : matchedRule?.priority || "中";
  const confidence = Math.round(Math.min(service.confidence, impact.confidence) * 100) / 100;
  const reviewReasons: string[] = [];
  if (matchedRule?.priorityReviewRequired === 1) reviewReasons.push("優先級規則要求 MIS 覆核");
  if (priority === "緊急" || priority === "高") reviewReasons.push(`${priorityCode(priority)} 高影響工單`);
  if (impact.level === "unknown" && impact.serviceState === "outage") reviewReasons.push("已辨識服務中斷，但影響範圍尚未確認");
  if (confidence < 0.7 && workType.kind !== "request") reviewReasons.push("分類信心不足 70%");
  return {
    service,
    impact,
    category,
    assignedTeam,
    assignedTeamId: ruleOwnsRouting ? undefined : service.assignedTeamId,
    priority,
    confidence,
    priorityReviewRequired: reviewReasons.length > 0,
    priorityReviewReason: reviewReasons.join("；"),
    requireImpactDetails:
      workType.kind !== "request" &&
      (matchedRule?.requireImpactDetails === 1 || priority === "緊急" || priority === "高"),
    classificationSource: genericRequestRule
      ? "semantic+request-rule"
      : fallbackRule
        ? "semantic+fallback-rule"
        : matchedRule
          ? "semantic+priority-rule"
          : "semantic-fallback",
  };
}
'@

# 8) Make diagnostic text clearly explain request routing.
Replace-Exact -Path $ticketsPath -Label 'P4 diagnosis message' -Old @'
    message: matchedRule?.id === "priority-p3-default-service"
      ? "已完成四層診斷，未命中特定規則，套用 P3 預設服務異常政策。"
      : matchedRule
        ? `已完成四層診斷並命中：${matchedRule.ruleName}`
        : "已完成服務分類與影響分析，套用預設 Priority 與覆核政策。",
'@ -New @'
    message: matchedRule?.id === "priority-p4-request"
      ? "已完成四層診斷，辨識為服務申請，套用 P4 一般申請與建議政策。"
      : matchedRule?.id === "priority-p3-default-service"
        ? "已完成四層診斷，未命中特定規則，套用 P3 預設服務異常政策。"
        : matchedRule
          ? `已完成四層診斷並命中：${matchedRule.ruleName}`
          : "已完成服務分類與影響分析，套用預設 Priority 與覆核政策。",
'@

# 9) Add source tests and migration reference.
Replace-Exact -Path $testPath -Label 'request migration test source' -Old @'
const migration = fs.readFileSync(new URL("../drizzle/0018_ticket_classification_sla.sql", import.meta.url), "utf8");
'@ -New @'
const migration = fs.readFileSync(new URL("../drizzle/0018_ticket_classification_sla.sql", import.meta.url), "utf8");
const requestMigration = fs.readFileSync(new URL("../drizzle/0019_request_type_priority_routing.sql", import.meta.url), "utf8");
'@

$testAppend = @'

test("request type is separated from incident before P3 fallback", () => {
  assert.match(classifier, /classifyWorkType/);
  assert.match(classifier, /software_installation/);
  assert.match(classifier, /device_request/);
  assert.match(classifier, /access_request/);
  assert.match(classifier, /improvement/);
  assert.match(tickets, /workType\.kind === "request"/);
  assert.match(tickets, /priority-p4-request/);
  assert.match(tickets, /semantic\+request-rule/);
});

test("P4 request policy covers common enterprise service requests", () => {
  assert.match(requestMigration, /Office/);
  assert.match(requestMigration, /AutoCAD/);
  assert.match(requestMigration, /設備申請/);
  assert.match(requestMigration, /權限申請/);
  assert.match(requestMigration, /改善建議/);
});
'@

$testContent = Get-Content -LiteralPath $testPath -Raw -Encoding UTF8
if ($testContent -match 'request type is separated from incident before P3 fallback') {
    throw "Request-routing tests already exist; stopping to avoid duplicate tests."
}
Set-Content -LiteralPath $testPath -Value ($testContent.TrimEnd() + $testAppend + "`r`n") -Encoding UTF8 -NoNewline
Write-Host "Updated: P4 request routing tests" -ForegroundColor Green

# 10) New D1 migration aligns admin-visible P4 rule with semantic engine.
$migration = @'
-- Separate service requests from incidents before the P3 incident fallback.
-- The application also performs semantic work-type classification; this
-- migration keeps the administrator-visible P4 rule aligned with that engine.
UPDATE ticket_priority_rules
SET
  description = '一般服務申請：Office／AutoCAD 等軟體安裝或申請、設備申請、帳號／權限申請、功能與改善建議。故障、失敗、無法使用等異常事件不套用此規則。',
  match_any_terms = '[
    "帳號申請|申請帳號|開通帳號",
    "權限申請|申請權限|開通權限|新增權限|存取權限",
    "軟體安裝|安裝軟體|我要安裝|需要安裝|協助安裝|Office|AutoCAD|Adobe",
    "軟體申請|申請軟體|軟體需求|授權申請",
    "設備申請|申請設備|申請筆電|申請電腦|更換設備|更換電池",
    "功能建議|改善建議|優化建議|建議新增|希望增加|希望新增"
  ]',
  priority = '低',
  priority_review_required = 0,
  require_impact_details = 0,
  display_order = 100,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p4-request';
'@
Set-Content -LiteralPath $migrationPath -Value $migration -Encoding UTF8 -NoNewline
Write-Host "Created: drizzle\0019_request_type_priority_routing.sql" -ForegroundColor Green

Write-Host "`nP4 request routing fix applied successfully." -ForegroundColor Cyan
Write-Host "Next: npm.cmd run lint; npm.cmd run build; npm.cmd run test" -ForegroundColor Cyan
