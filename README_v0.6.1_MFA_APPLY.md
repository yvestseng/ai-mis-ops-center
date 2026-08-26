# v0.6.1 TOTP MFA — Apply Notes

This package is based on the approved department-P2 fix source baseline and adds only v0.6.1 authentication Security Hardening.

## Important before replacing files in the real Git checkout

The uploaded source archive did not include several repository root files. This prepared package restores `package.json`, `vite.config.ts`, `wrangler.jsonc`, and `postcss.config.mjs` from the approved GitHub baseline so the source regression suite can be verified here.

On the real `D:\DEV\ai-mis-ops-center` checkout:

1. do **not** delete unrelated local files such as `closure-baseline/`;
2. install the new QR dependency so `package-lock.json` is generated/updated;
3. inspect `git diff` before commit;
4. do not apply remote D1 or deploy until lint/build/test gates pass.

## Dependency update

```powershell
npm install qrcode@^1.5.4
npm install -D @types/qrcode@^1.5.5
```

This updates `package-lock.json`; include the lockfile in the v0.6.1 commit.

## Validation already completed on the prepared source

```text
node --experimental-strip-types --test tests/*.test.mjs
126 tests
126 pass
0 fail
```

Build/lint were not claimed from this packaging environment because the uploaded source archive did not contain an installed `node_modules` tree. Run the normal repository gates in your real checkout after installing dependencies.

See `docs/16_MFA_SECURITY_HARDENING_v0.6.1.md` for migration, secret, release, rollback and handover procedures.

## Windows / Git Bash compatibility update

This final package includes `scripts/run-bash.mjs`. On Windows, npm scripts now prefer Git for Windows Bash (`C:\Program Files\Git\bin\bash.exe`) instead of accidentally invoking WSL. The wrapper is also used for build, lint, CI install, artifact validation, and Drizzle generation. `npm start` uses `cross-env` for portable environment-variable handling.

Recommended verification on Windows PowerShell:

```powershell
cd D:\DEV\ai-mis-ops-center
npm install
npm run lint
npm run build
node --experimental-strip-types --test tests/*.test.mjs
```
