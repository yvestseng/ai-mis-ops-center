# Governance data management update

Copy the contents of this update into the repository root (`D:\DEV\ai-mis-ops-center`), preserving folders.

## Included capability

- Knowledge articles: create, edit, publish, disable, review date, and ticket links.
- Major incidents: create, edit, ticket links, impact scope, severity, owner, supervisor, close summary, and notification history.
- Candidate import: only creates `草稿` articles from closed tickets or `待確認重大事件` from high-risk active tickets. It never publishes or closes records automatically.
- RBAC: only Admin and Operator receive `knowledge.manage` and `governance.import`; User receives no governance access.

## Apply and validate

```powershell
cd D:\DEV\ai-mis-ops-center
npx wrangler d1 migrations apply site-creator-d1 --remote
npm.cmd run lint
npm.cmd run build
npm.cmd run test
```

Then release using the existing approved release script:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Release-AiMisOpsCenter.ps1 -CommitMessage "feat: add governance data management and ticket candidate import"
```

`0016_governance_knowledge_incidents.sql` remains unchanged. This update adds only `0017_governance_management_workflow.sql`, so it is safe for the D1 database where 0016 has already been applied.
