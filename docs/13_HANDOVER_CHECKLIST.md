# 13 Handover Checklist

## Source
- [ ] Git main 是唯一 Source of Truth
- [ ] 無 `.before-*`
- [ ] 無 `.dev.vars` / local secret
- [ ] package / lock version 一致
- [ ] final Git tag 建立

## Build/Test
- [ ] `npm ci`
- [ ] `npm run test:source`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run validate:artifact`
- [ ] `npm test`

## Release
- [ ] D1 bookmark
- [ ] migrations applied
- [ ] Worker Version ID
- [ ] Git SHA / tag
- [ ] Production Smoke
- [ ] Release ZIP
- [ ] SHA256

## Rollback Drill
- [ ] 找得到 Known Good Worker Version
- [ ] Rollback script dry-run
- [ ] D1 restore SOP 已理解
- [ ] rollback 後 smoke procedure 可執行

## Dry-run Handover
由未參與主要開發的人依文件完成：
```text
clone → install → test → build → deploy/verify → rollback dry-run
```

任何一步必須詢問原開發者才能完成，均視為交接缺口。
