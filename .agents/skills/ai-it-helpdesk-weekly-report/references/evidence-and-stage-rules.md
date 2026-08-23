# Evidence and Stage Rules

## Contents

1. Delivery stages
2. Evidence status
3. Evidence precedence
4. Test and production rules
5. Rollback and handover maturity
6. Missing and conflicting evidence

## Delivery Stages

| Stage | Required evidence | Allowed wording | Prohibited escalation |
|---|---|---|---|
| Requirement | Requirement、specification、User Story、design 或 plan | 已定義、已規劃、待實作 | 不得寫已實作、已完成 |
| Implemented | Source、configuration、schema、Migration、script 或 document 已存在 | 已實作、待測試 | 不得寫測試通過、已驗收 |
| Tested | 實際 Unit／Integration／Regression／UAT command output 或 CI PASS | 已測試、測試通過、待正式驗證 | 不得寫正式完成、正式驗收 |
| Production Verified | Exact release 已部署，且有部署後 Smoke、正式操作、log、query、screenshot 或等價證據 | 正式驗證完成、可正式驗收 | 不得用其他版本或部署前結果替代 |

判定每個子功能，不用一個階段概括整個 release。若來源互相矛盾，採較低階段。

## Evidence Status

| Status | Definition |
|---|---|
| Verified | 證據直接支持該成果、階段與版本關聯 |
| Partial | 只有部分證據，或版本、環境、時間關聯不完整 |
| Missing | 沒有可讀取或可驗證證據 |
| Conflicting | 不同來源互相矛盾，尚未釐清 |

每個主要 Achievement 必須同時填寫 Delivery Stage、Evidence Source、Evidence Status。

## Evidence Precedence

依下列優先順序判定：

1. Current repository source、configuration、Git state。
2. Actual command output、CI log、test report、deployment log、query、screenshot。
3. Release manifest、signed checklist、artifact hash。
4. Architecture／runbook／project document。
5. User-provided narrative。
6. 無證據：`TBD / Missing`。

Commit message 可以證明提交意圖，不單獨證明測試、部署或正式功能正常。文件中的「完成」敘述需有下層原始證據支持。

## Test Rules

- Test file 存在：測試已實作，Delivery Stage 仍可能只有 Implemented。
- Test command PASS：可判定該範圍 Tested。
- 部分 targeted tests PASS：只支持該 targeted scope，不代表 full regression PASS。
- 歷史版本 tests PASS：不得自動套用到之後的 commit。
- 手工測試敘述沒有日期、輸入、預期與實際結果時標示 Partial。
- KPI、Accuracy、Pass Rate 只能引用實測數值；否則填 TBD。

## Production Verification Rules

Production Verified 至少關聯：

- Git SHA／tag 或不可混淆的 release identity。
- Deployment Platform 上的 version／deployment ID 與 timestamp。
- Database Migration state 或 schema version（若適用）。
- 部署後 Production Smoke／正式操作結果。
- Smoke 所測功能與 Achievement 的 claim 相符。

Deploy success 只證明 deployment event。若沒有部署後 smoke，不得將 application behavior 標為 Production Verified。

舊 Worker／service version 的 Smoke PASS 不得證明新 Worker／service version。無法關聯 exact release 時標示 Partial。

## Release Evidence Matrix

| Evidence | Minimum status |
|---|---|
| Git Commit／Tag | SHA、branch、tag、upstream parity 可識別 |
| Working Tree | clean，或所有差異已明確列出且不混入 release |
| Build | command output PASS |
| Automated Test | command output與測試數 PASS |
| Deployment Platform | provider 與 exact deployment identity |
| Database Provider | adapter、binding／connection、Migration state |
| Database Migration | list／apply output；不得只看 SQL file |
| Production Deployment | deploy log、timestamp、version ID |
| Production Smoke | exact deployment 的 PASS output |
| Security／RBAC | automated／manual evidence 與版本關聯 |
| Backup／Rollback | known-good target、bookmark／backup、dry-run／exercise |
| Release Notes | release identity、changes、known limitations |
| Handover | checklist、runbook、independent dry-run、sign-off |

## Rollback Maturity

| Evidence | Stage |
|---|---|
| Requirement／planned rollback | Requirement |
| Script／runbook／SOP exists | Implemented |
| Dry-run validates resolved commands and targets | Tested |
| Controlled rollback exercise or actual rollback plus post-rollback verification | Production Verified for exercised scope |

執行 destructive database restore 前必須有明確授權、目標、資料損失窗口與備份。不得因報告任務自行 deploy、apply migration、restore 或 rollback。

## Handover Maturity

| Evidence | Stage |
|---|---|
| Handover plan／checklist | Requirement |
| Architecture、development、deployment、operations、troubleshooting、security、rollback docs | Implemented |
| 非主要開發者完成 dry-run 並記錄缺口 | Tested |
| 正式接管、責任簽核與營運驗證 | Production Verified／Handover Verified |

Checklist 未勾選不得視為完成。文件存在不等於第三方能獨立操作。

## Missing and Conflicting Evidence

使用以下規則：

- 找不到檔案、log 或 output：`Missing`。
- 只有摘要，沒有原始結果：`Partial`。
- Repository 與文件技術棧不同：`Conflicting`，以 current repository 為優先。
- Tag 不在 HEAD、release record 指向不同 SHA：分別列出，不自行合併。
- Current working tree dirty：列出差異，不宣稱 clean release state。
- 無權存取 Production：清楚標示限制，不假裝驗證。

提出關閉證據缺口的最小動作，但不得為填表創造 Owner、ETA 或決策。
