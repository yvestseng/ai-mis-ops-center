# 08 Rollback Runbook

## 原則
Rollback 必須是已核准的事故處置，不等於單純 `git checkout`。

## Before Release
保存：
- Known-good Git tag / SHA
- Known-good Worker Version ID
- D1 pre-release Time Travel bookmark
- Release manifest

## Worker Rollback
Script 預設 Dry Run：
```powershell
.\scripts\Rollback-AiMisOpsCenter.ps1 `
  -WorkerVersionId "<known-good-version-id>"
```

確認後：
```powershell
.\scripts\Rollback-AiMisOpsCenter.ps1 `
  -WorkerVersionId "<known-good-version-id>" `
  -Execute
```

## D1 Restore
僅在 schema/data 確實需要還原，且已有核准 bookmark 時：
```powershell
.\scripts\Rollback-AiMisOpsCenter.ps1 `
  -WorkerVersionId "<known-good-version-id>" `
  -D1Bookmark "<approved-bookmark>" `
  -Execute
```

D1 Time Travel restore 會覆寫資料庫現況，必須先評估資料損失窗口。

## After Rollback
1. Production Smoke Test
2. 確認 User/Admin login
3. 確認 ticket read/write policy
4. 確認 classification review / KPI
5. 記錄 rollback reason、執行人、時間、target version、D1 bookmark、驗證結果
