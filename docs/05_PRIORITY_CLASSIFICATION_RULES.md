# 05 Priority Classification Rules

## Priority
- P1 緊急
- P2 高
- P3 中
- P4 低

## 判斷概念
```text
Incident text
→ normalization
→ scope / impact
→ category
→ priority rule
→ proposed P1-P4
→ human confirmation
```

## Regression Focus
- 全公司網路中斷
- 全公司 Wi-Fi 中斷
- Domain Login Outage
- Department Outage
- Business Application Outage
- Network Degradation
- 單 AP / 單人不得誤升 P1

每次調整規則必須增加或更新 regression test。
