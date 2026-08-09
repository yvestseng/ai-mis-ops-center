# Four-layer AI ticket diagnosis upgrade

Implemented architecture:
1. Service classification
2. Impact scope analysis
3. Priority Rule resolution
4. MIS review decision

Also connected diagnosis results to D1-backed SLA policies used by Service Governance.

Key files:
- worker/ticket-classification.ts
- worker/tickets.ts
- worker/governance.ts
- worker/index.ts
- app/workspace-home.tsx
- app/globals.css
- db/schema.ts
- drizzle/0018_ticket_classification_sla.sql
- tests/ticket-classification-source.test.mjs

Required deployment order:
1. Apply D1 migration 0018_ticket_classification_sla.sql.
2. Run lint/build/test in the complete project checkout.
3. Deploy Worker/Application.

Validation completed in the uploaded source package:
- TypeScript/TSX syntax transpilation: PASS for modified TS/TSX files.
- New four-layer source tests: 5/5 PASS.
- Full existing test suite could not be completed from this upload because root files such as package.json, vite.config.ts, wrangler.jsonc, postcss.config.mjs and docs/RBAC_API_AUTHORIZATION_CHECKLIST.md are absent from the uploaded ZIP.
