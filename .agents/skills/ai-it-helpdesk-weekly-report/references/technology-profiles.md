# Technology Profiles

## Contents

1. Selection order
2. Required evidence
3. Reference Profile A
4. Reference Profile B
5. Unknown and conflicting profiles
6. Technology health checklist

## Selection Order

依序辨識目前專案技術：

1. **Current repository**：package／project file、source、adapter、schema、Migration、deployment config。
2. **Deployment／release evidence**：CI/CD、release-output、runtime binding、Production Deployment Log。
3. **Architecture／configuration**：架構文件、環境設定、基礎設施文件。
4. **User-provided evidence**：明確屬於目前專案的命令輸出或資料。
5. **No evidence**：標示 `TBD / Missing`。

不要從專案名稱、歷史專案、參考 Profile 或技能範例推論實際技術。

## Required Evidence by Dimension

| Dimension | Preferred evidence |
|---|---|
| Backend／runtime | entry point、project/package dependency、runtime config |
| Frontend | package/project dependency、app source、build config |
| Deployment Platform | deployment config、CI/CD、deploy log、runtime ID |
| Database Provider | driver／ORM adapter、binding／connection config、schema |
| Migration | migration files加 list／apply output |
| Identity | authentication source、provider config、integration evidence |
| Integration | adapter、API config、integration test／trace |
| AI Provider | provider adapter、config、model invocation evidence |

各 dimension 分開判定；缺少其中一項只把該項標示 TBD，不要否定其他已證實項目。

## Reference Profile A — Microsoft Application Stack

只有證據符合時選用：

- ASP.NET Core 10／C#。
- MySQL 8。
- IIS／Windows Server。
- Microsoft Graph。
- Microsoft Entra ID 或 AD／LDAP。

Meeting Room System 只有 current repository、deployment／release evidence 或 architecture／configuration 實際支持時才可選用 Profile A。若只證實 ASP.NET Core 與 IIS、未證實 MySQL 或 Graph，對未證實項目填 `TBD / Missing`。

可接受的 Profile A 證據例如：

- `.csproj` target framework 與 C# source。
- MySQL provider package、connection configuration、Migration。
- IIS deployment log、web.config、AppPool／site evidence。
- Graph SDK／API adapter 與 integration test／trace。
- Entra／LDAP configuration 與 authentication evidence。

## Reference Profile B — Cloudflare Application Stack

只有證據符合時選用：

- TypeScript。
- React／vinext。
- Cloudflare Workers。
- Cloudflare D1。
- Drizzle ORM。

AI MIS OPS Center 應從下列證據選用 Profile B：

- Worker entry point 與 Cloudflare deployment config。
- React／vinext／TypeScript dependencies 或 source。
- D1 binding、database name／ID。
- `drizzle-orm/d1` adapter、schema 與 migrations directory。
- Release evidence 中的 Worker／D1 deployment identity。

任一要素缺少時對該要素標示 `TBD / Missing`，不得只因專案名稱強制填滿 Profile B。

## Unknown and Conflicting Profiles

無 repository、deployment、architecture 或 user evidence 時：

| Field | Value |
|---|---|
| Technology Profile | TBD / Missing |
| Deployment Platform | TBD / Missing |
| Database Provider | TBD / Missing |
| Identity Provider | TBD / Missing |

不得選 Profile A 或 B。

若 repository 顯示 D1，但舊文件寫 MySQL：

- Current repository 的 D1 為較高優先證據。
- MySQL 標示 historical／conflicting，不當成 active datastore。
- 要求目前 connection、adapter、migration 與 deployment evidence 關閉衝突。

## Technology Health Checklist

| Dimension | Status | Evidence requirement |
|---|---|---|
| Backend／Runtime | 🟢／🟡／🔴／TBD | repository entry point、dependencies、runtime config |
| Frontend | 🟢／🟡／🔴／TBD | app source、dependencies、build result |
| Deployment Platform | 🟢／🟡／🔴／TBD | deployment config與release evidence |
| Database Provider | 🟢／🟡／🔴／TBD | adapter、binding／connection、schema |
| Database Migration | 🟢／🟡／🔴／TBD | migration files與list／apply evidence |
| Identity／Authentication | 🟢／🟡／🔴／TBD | auth source、provider config、tests |
| Integration | 🟢／🟡／🔴／TBD | adapter與Integration Test／trace |
| Observability | 🟢／🟡／🔴／TBD | logs、monitoring、audit evidence |

沒有證據時使用 TBD，不得套用 IIS、MySQL、Workers、D1 或其他預設健康閘門。
