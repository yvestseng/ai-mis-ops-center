---
name: ai-it-helpdesk-weekly-report
description: >-
  產生 AI IT Helpdesk 證據導向週報；依 Git、測試、Database Migration、部署、Smoke Test、Rollback 與 Handover 證據，嚴格區分 Requirement、Implemented、Tested 與 Production Verified。適用於 AI 資訊報修、IT Service Desk、Incident Management、AI Ticket Classification、SLA、RBAC、正式釋出與結案評估。
---

# AI IT Helpdesk Weekly Project Report

**Version:** v1.2 Formal

**Status:** Production Standard

**Technology Selection:** Evidence-Driven Technology Profile

## Purpose

產生主管、MIS／IT、開發、維運、資安、顧問與利害關係人可快速驗證的 AI IT Helpdesk 週報。以 Outcome 為主，不把活動清單當成交付成果。

必須同時回答：

- 專案目前狀態、Milestone 與 Release 推進位置。
- 本週可驗收成果及其 Delivery Stage。
- AI 分類、P1～P4、Impact／Urgency、派工、SLA、RBAC 與 Production 是否可驗證。
- Issue、Risk、Blocker、需要的決策與下週 Deliverables。
- 是否達到可驗證、可追溯、可維護、可回滾、可交接。

## Required References

產出報告前依任務讀取以下一層 references：

1. 必須讀取 [Evidence and Stage Rules](references/evidence-and-stage-rules.md)，用於成熟度、證據狀態、衝突與正式驗證判定。
2. 必須讀取 [Technology Profiles](references/technology-profiles.md)，用於 Deployment Platform、Database Provider 與 Profile 選擇。
3. 必須讀取 [Report Template](references/report-template.md)，依其中章節與表格輸出完整週報。

不要以記憶取代 reference；reference 與 repository 證據衝突時，以 current repository 及較保守成熟度為準。

## Mandatory Evidence Workflow

依序執行，不得跳階：

1. 讀取 repository instructions，例如 `AGENTS.md`。
2. 讀取 `git status`、目前 branch、HEAD、upstream parity、recent commits、tag 與 diff。
3. 讀取本週交付、前週報告、Roadmap、release notes 與 closure 文件，區分本週新增、延續工作與歷史背景。
4. 從 repository 辨識程式語言、framework、deployment config、database adapter、binding、schema、migrations 與 runtime。
5. 讀取 tests；只有 test file 代表測試已實作，不代表測試已執行。
6. 讀取實際 test command output、CI log 或 release gate output，判定 Tested。
7. 讀取 `release-output`、Production Deployment Log、Worker／service version、migration state、Smoke Test、log、query 或 screenshot。
8. 讀取 rollback script、runbook、known-good target、bookmark／backup 與 dry-run／exercise evidence。
9. 讀取 handover checklist、operations runbook、交接紀錄、獨立人員 dry-run 與簽核。
10. 將每個成果分別判定為 Requirement、Implemented、Tested 或 Production Verified。
11. 任何缺少、版本不明或互相矛盾的證據標示 `TBD / Missing / Conflicting`。
12. 產出報告後執行 Final Management Check。

## Evidence-First Mandatory Rules

- Requirement 不得當成 Implemented。
- Implemented 不得當成 Tested。
- Tested 不得當成 Production Verified。
- 只有部署成功仍不等於功能已 Production Verified。
- Production Verified 必須把 exact release／version 與部署後正式環境驗證關聯起來。
- 每個主要 Achievement 必須包含 `Delivery Stage`、`Evidence Source`、`Evidence Status`。
- 只有 Requirement 的項目不得列為 Key Achievement。
- 沒有證據時標示 `TBD / Missing`，不得套用預設值。
- 不得虛構 commit、PR、tag、測試、KPI、Migration、部署、Smoke Test、Rollback、Handover、日期、Owner 或結案。
- 不同子功能處於不同階段時分開標示，不用單一狀態概括整個 Milestone。
- 證據互相矛盾時採較保守階段，標示 `Conflicting` 並提出關閉方式。

完整定義與 Release gate 見 [Evidence and Stage Rules](references/evidence-and-stage-rules.md)。

## Technology Selection

不得為所有專案預設 ASP.NET Core、MySQL、IIS、Cloudflare Workers、D1、SQL Server、AWS 或 GCP。

依下列順序選擇技術：

1. current repository；
2. deployment／release evidence；
3. architecture／configuration；
4. user-provided evidence；
5. 無證據時 `TBD / Missing`。

AI MIS OPS Center 只有在 repository 的 Worker entry point、D1 binding、Drizzle adapter、Migration、deployment config 與 release evidence支持時選用 Profile B。Meeting Room System 只有在 current repository、部署或架構證據支持時選用 Profile A。專案名稱本身不是技術證據。

Profile 定義、必要證據與健康度欄位見 [Technology Profiles](references/technology-profiles.md)。

## AI Helpdesk Review Scope

只報告本週相關且有證據的項目，至少檢查：

### Classification and Priority

- P1／P2／P3／P4 規則與顯示標籤。
- Impact Scope、Urgency、Service State 與 Priority rule precedence。
- company／site-wide aliases、department／multiple-user／single-user 邊界。
- network outage／degradation normalization。
- Positive、negative、boundary regression tests。
- Preview、API、ticket creation、database rule 與 review result 是否一致。
- P1、安全敏感、低信心或 review-required 是否保留 Human-in-the-loop。

Wi-Fi、ERP、VPN、Domain Login、Security Incident 與 Network Degradation 只是可能的 regression scenarios；沒有專案證據時不得假設存在。

### Authentication and Security

- Authentication、Authorization、RBAC 與跨 Portal／角色邊界。
- Session、first-login password change、rate limit、password hash、cookie、CSP、安全標頭與 audit。
- Secret、敏感資料、AI output validation 與高風險人工確認。

### Ticket Operations

- Email-to-Ticket provider、Message ID 去重、thread、attachment 與 mail trace。
- Assignment、人工覆核、Ticket Workflow、SLA、notification 與 audit trail。
- Knowledge Base、Major Incident、重複工單與 Quality KPI。

無證據的模組保留在 Scope／WIP 或 Gap，不得寫成已完成成果。

## Release and Closure Review

若本週有 release，分別檢查：

- Git commit／tag／main sync／working tree。
- lint、build、automated tests 與 regression。
- Deployment Platform、Database Provider、Migration state。
- Production deployment identity 與 timestamp。
- exact release 的 Production Smoke Test。
- Security／RBAC verification。
- Backup／bookmark、rollback target、dry-run 與 rollback-after-smoke。
- Release notes、artifact hash、handover docs、independent handover dry-run。

Rollback script 或 runbook 存在只算 Implemented；dry-run 才能支持 Tested；實際事故或受控 exercise 並完成回滾後驗證，才能支持對應正式能力。

Handover 文件存在只算 Documentation Ready；未參與主要開發的人員能依文件完成 clone／install／test／build／verify／rollback dry-run，才可宣稱 Handover Verified。

## Output Requirements

依 [Report Template](references/report-template.md) 的順序輸出繁體中文報告，專有名詞保留英文。

至少包含：

- Project Overview 與 Reporting Period。
- Overall Status 與 3～5 句 Executive Summary。
- Project Health、Milestone Progress、Key Achievements。
- Work in Progress、Issues／Risks／Blockers、Decisions Needed。
- Next Week Priorities、KPI／Validation、AI／System Development Check。
- Release／Production Evidence、Lessons Learned、Knowledge Assets。
- Closure Readiness 與五項能力逐項判定。

狀態使用：

- `🟢`：有足夠證據，可按計畫推進或驗收。
- `🟡`：部分證據或有可控缺口。
- `🔴`：影響核心流程、Production 或主要 Milestone。
- `TBD`：無證據，不能判定。

不要用無依據百分比。Owner、ETA、KPI 或 Accuracy 不明時填 `TBD`。

## Final Management Check

輸出前確認主管能在三分鐘內回答：

1. Where are we？
2. What did we achieve？
3. 哪些項目只是 Requirement、Implemented、Tested 或 Production Verified？
4. AI Classification／P1～P4 是否可靠且有 regression evidence？
5. 系統能否安全維運於 Production？
6. 最大 Risk／Blocker 與下一步為何？
7. 是否需要決策？
8. 每個 Achievement 是否都有三個 evidence 欄位？
9. 是否達到可驗證、可追溯、可維護、可回滾、可交接？

任一問題無法回答時，重整報告或明確標示 Missing，不得補造答案。

## Invocation Example

> 請使用 `ai-it-helpdesk-weekly-report`，讀取目前 repository 的 Git status、recent commits、tests、migrations、release-output、deployment evidence、Smoke Tests、Rollback evidence 與 Handover evidence，再產生本週週報。嚴格區分 Requirement、Implemented、Tested 與 Production Verified；所有主要成果標示 Delivery Stage、Evidence Source、Evidence Status；沒有證據標示 TBD／Missing。

## Version History

### v1.2 Formal

- 採用 Evidence-Driven Technology Profile。
- 移除固定 IIS／MySQL health gate。
- 新增 Cloudflare Workers／D1／Drizzle 參考 Profile。
- 無技術證據時改為 `TBD / Missing`。
- 加入有效 YAML frontmatter。
- 啟動流程改讀 Git、tests、migrations、release-output、deployment、Smoke、Rollback 與 Handover evidence。
- 將詳細證據規則、技術 Profile 與報告模板拆至一層 references，降低核心 Skill 載入成本。
