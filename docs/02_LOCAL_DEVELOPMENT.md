# 02 Local Development

## Prerequisite
- Node.js >= 22.13
- npm
- Wrangler 4.x
- Git

## Setup
```powershell
git clone <repository>
cd ai-mis-ops-center
npm ci
```

建立本機 `.dev.vars`，不得提交至 Git。

## Commands
```powershell
npm run dev
npm run test:source
npm run lint
npm run build
npm test
npm run validate:artifact
```

若乾淨環境無法 `npm ci`，先處理 Registry / Proxy / Internet 問題，不可改用未鎖版依賴繞過。
