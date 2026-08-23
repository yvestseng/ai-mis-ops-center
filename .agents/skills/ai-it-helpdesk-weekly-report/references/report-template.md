# Weekly Report Template

## Contents

1. Project overview
2. Executive summary
3. Project health
4. Milestones and achievements
5. Work, risks and decisions
6. Next priorities and validation
7. Release evidence
8. Closure readiness
9. Final management check

依實際證據調整表格列數，不為填表創造資訊。

# AI 資訊報修系統 — Weekly Project Report

## 1. Project Overview

| Item | Detail | Evidence Source | Evidence Status |
|---|---|---|---|
| Project | 實際專案名稱 | repository／document | Verified／Partial／Missing |
| Reporting Period | YYYY-MM-DD～YYYY-MM-DD | evidence dates |  |
| Report Week | YYYY-Wxx | calendar |  |
| Current Release | version／SHA／tag／TBD | Git／release |  |
| Environment | Development／Test／Staging／Production／TBD | deployment evidence |  |
| Technology Profile | Profile A／Profile B／Custom／TBD | repository／deployment |  |
| Deployment Platform | provider／TBD | configuration／deploy log |  |
| Database Provider | provider／TBD | adapter／binding／connection |  |

明確區分本週新增、延續工作與歷史背景。不要把過去成果列為本週 Achievement。

## 2. Executive Summary

先輸出：

**Overall Status：🟢 On Track／🟡 Attention／🔴 At Risk／TBD**

以 3～5 句回答：

- 本週最重要且有證據的成果。
- 專案目前階段。
- AI／Ticket 核心流程成熟度。
- 最大 Evidence Gap／Risk。
- 下週目標與所需決策。

## 3. Project Health

| Dimension | Status | Assessment | Evidence Source | Evidence Status |
|---|---|---|---|---|
| Scope | 🟢／🟡／🔴／TBD | Scope、Freeze、Creep |  |  |
| Schedule | 🟢／🟡／🔴／TBD | Roadmap／Milestone |  |  |
| Quality | 🟢／🟡／🔴／TBD | Build、test、regression、bug |  |  |
| AI Classification | 🟢／🟡／🔴／TBD | 分類、Impact、P1～P4 |  |  |
| Assignment／Workflow | 🟢／🟡／🔴／TBD | 派工、覆核、workflow |  |  |
| SLA／Operations | 🟢／🟡／🔴／TBD | SLA、notification、operations |  |  |
| Security／RBAC | 🟢／🟡／🔴／TBD | auth、authorization、audit |  |  |
| Deployment | 🟢／🟡／🔴／TBD | deploy、Smoke、rollback |  |  |
| Deployment Platform | 🟢／🟡／🔴／TBD | provider evidence |  |  |
| Database Provider | 🟢／🟡／🔴／TBD | adapter、Migration |  |  |
| Observability | 🟢／🟡／🔴／TBD | log、monitoring、audit |  |  |
| Handover Readiness | 🟢／🟡／🔴／TBD | docs、dry-run、sign-off |  |  |
| Overall | 🟢／🟡／🔴／TBD | 綜合判定 |  |  |

## 4. Milestone Progress

| Milestone | Status | Progress | Delivery Stage | Evidence Source | Evidence Status | Notes |
|---|---|---|---|---|---|---|
| M1 | ✅／🟡／🔴／TBD | Completed／In Progress／Blocked／TBD | Requirement／Implemented／Tested／Production Verified |  | Verified／Partial／Missing／Conflicting |  |

可參考但不得強制套用：

- M1：Ticket／User／RBAC。
- M2：Email-to-Ticket。
- M3：AI Classification／P1～P4。
- M4：Assignment／SLA／Notification。
- M5：Knowledge Base／Dashboard／Governance。
- M6：Production Hardening／Closure／Handover。

## 5. Key Achievements

只列 Implemented 或更高階段；只有 Requirement 不得列入。

| Achievement | Value | Delivery Stage | Evidence Source | Evidence Status |
|---|---|---|---|---|
| 完成什麼 | 帶來什麼可驗收價值 | Implemented／Tested／Production Verified | Commit／Test／Log／Query／Document | Verified／Partial／Conflicting |

不要只寫修改程式、Debug、開會、處理 AI、調整分類或測試網站。

## 6. Work in Progress

| Work Item | Current Status | Delivery Stage | Evidence Source | Evidence Status | Next Action | Owner | Target |
|---|---|---|---|---|---|---|---|
|  |  | Requirement／Implemented／Tested |  |  |  | TBD | TBD |

若專案已進入 Function Freeze／Stabilization／Closure，明確標示 Regression、Documentation、Production Evidence、Handover 與 Closure，不寫成繼續擴充功能。

## 7. Issues / Risks / Blockers

| ID | Type | Issue／Risk | Impact | Severity | Evidence／Status | Mitigation | Owner | ETA |
|---|---|---|---|---|---|---|---|---|
| R01 | Issue／Risk／Blocker |  |  | High／Medium／Low |  |  | TBD | TBD |

優先檢查：

- 重大事件降級或普通事件 priority inflation。
- Email thread／Message ID 去重失效。
- Low-confidence 自動派工或安全事件無人工覆核。
- SLA timer、RBAC、secret、audit、Production／Migration mismatch。
- 缺少 Production Smoke、Rollback、Backup、Handover 或正式結案證據。

## 8. Decisions Needed

| ID | Decision | Options | Recommendation | Decision By |
|---|---|---|---|---|

沒有真正需要主管決策時寫：

**No management decision required this week.**

## 9. Next Week Priorities

只列最重要 3～5 項，使用 Goal → Deliverable → Definition of Done。

| Priority | Deliverable | Definition of Done | Owner |
|---|---|---|---|
| P1 |  | 可觀察、可驗證的完成條件 | TBD |

不要只寫繼續優化 AI。

## 10. KPI / Validation

| KPI／Gate | Target | Current Evidence | Trend | Evidence Status | Comment |
|---|---|---|---|---|---|
| Build | PASS | command output／TBD | ↑／→／↓／TBD |  |  |
| Automated Test | PASS | count／TBD |  |  |  |
| Regression | PASS | result／TBD |  |  |  |
| Production Smoke | PASS | result／TBD |  |  |  |
| Classification Accuracy | target／TBD | measured value／TBD |  |  |  |
| RBAC／Security | PASS | result／TBD |  |  |  |

沒有實測數據時填 `尚未建立／尚未取得／TBD`，不虛構 Accuracy、SLA 或 Satisfaction。

## 11. AI / System Development Check

按證據摘要：

- Requirements／Function Freeze。
- Email-to-Ticket。
- AI Classification、Impact、P1～P4、regression。
- AI Assignment／Human-in-the-loop。
- SLA／Workflow／Notification。
- Authentication／RBAC／Security／Audit。
- Engineering：Build、Test、Migration、Production、Monitoring。

無證據項目標示 TBD／Missing，不因報告模板存在就推論專案包含該功能。

## 12. Release / Production Evidence

| Evidence | Status | Delivery Stage | Evidence Source | Evidence Status | Notes |
|---|---|---|---|---|---|
| Git Commit／Tag | ✅／🟡／🔴／TBD |  |  |  |  |
| Main Branch Sync |  |  |  |  |  |
| Working Tree |  |  |  |  |  |
| Build |  |  |  |  |  |
| Automated Test |  |  |  |  |  |
| Deployment Platform |  |  |  |  |  |
| Database Provider |  |  |  |  |  |
| Database Migration |  |  |  |  |  |
| Production Deployment |  |  |  |  |  |
| Production Smoke Test |  |  |  |  |  |
| Security／RBAC |  |  |  |  |  |
| Backup／Rollback |  |  |  |  |  |
| Release Notes／Artifact Hash |  |  |  |  |  |
| Handover |  |  |  |  |  |

## 13. Lessons Learned

最多 1～3 項，內容必須具體且可複用。例如：

- Priority 不能只依關鍵字，需結合範圍、服務狀態、否定語句與安全閘門。
- Classification rule 修改需同時增加 positive 與 negative regression。
- Production Closure 需要把 commit、Migration、deploy、Smoke、rollback 與 handover 串成同一證據鏈。

## 14. Knowledge Asset Opportunities

| Type | Topic | Recommended Action |
|---|---|---|
| SOP／Runbook／Regression Pack／Rulebook／Prompt／Skill／Technical Note |  |  |

沒有值得沉澱的內容時可省略。

## 15. Closure Readiness

| Capability | Status | Delivery Stage | Evidence Source | Evidence Status | Gap／Next Evidence |
|---|---|---|---|---|---|
| 可驗證 | 🟢／🟡／🔴／TBD |  |  |  |  |
| 可追溯 |  |  |  |  |  |
| 可維護 |  |  |  |  |  |
| 可回滾 |  |  |  |  |  |
| 可交接 |  |  |  |  |  |

最後明確輸出：

- **Overall Status**
- **Project Health**
- **Closure Readiness**
- **五項是否全部完成：是／否**

任何一項缺少必要證據時，五項全部完成必須回答「否」。

## Final Management Check

確認報告能在三分鐘內回答：目前位置、成果、階段、證據、AI 分類可信度、Production 安全性、風險、下一步、決策與五項結案能力。若不能，精簡或補上 Missing，不得補造證據。
