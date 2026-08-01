# AI MIS Ops Center v0.5.5

This release fixes the complete local release pipeline reported on 2026-08-01.

## Fixed

- Restored the required `@vitejs/plugin-rsc` App Router dependency.
- Added reviewed npm `allowScripts` entries for native/build dependencies.
- Replaced all raw `<img>` elements with `next/image`.
- Replaced the anonymous PostCSS default export with a named constant.
- Added source regression tests for the RSC dependency and lint fixes.
- Rebuilt the release script as ASCII-only PowerShell.
- Added repository source synchronization before install/build/deploy.
- Added a hard `--max-warnings=0` ESLint release gate.
- Added an explicit `npm ls @vitejs/plugin-rsc` build prerequisite check.

## Release command

```powershell
Set-ExecutionPolicy -Scope Process Bypass

.\release.ps1 `
  -RepositoryPath "D:\碩士班\ai-mis-ops-center-main" `
  -Version "0.5.5" `
  -Branch "main"
```
