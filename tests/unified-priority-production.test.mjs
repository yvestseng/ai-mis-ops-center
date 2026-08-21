import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tickets = fs.readFileSync(new URL('../worker/tickets.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../drizzle/0027_unified_priority_review_capture.sql', import.meta.url), 'utf8');
const smoke = fs.readFileSync(new URL('../scripts/production-smoke-test.mjs', import.meta.url), 'utf8');

test('ticket creation uses the same authoritative classification as diagnosis', () => {
  assert.match(tickets, /const category = classification\.category/);
  assert.match(tickets, /const priority = classification\.priority/);
  assert.match(tickets, /const assignedTeam = classification\.assignedTeam/);
  assert.doesNotMatch(tickets, /const priority = matchedRule \? classification\.priority : \(submittedPriority/);
});

test('stale preview values are rejected instead of silently diverging at creation', () => {
  assert.match(tickets, /STALE_PRIORITY_DIAGNOSIS/);
  assert.match(tickets, /expectedPriorityCode: priorityCode\(priority\)/);
  assert.match(tickets, /STALE_CATEGORY_DIAGNOSIS/);
  assert.match(tickets, /STALE_ASSIGNMENT_DIAGNOSIS/);
  assert.match(tickets, /STALE_IMPACT_DIAGNOSIS/);
});

test('review snapshot persists exact work type, service state and team id', () => {
  assert.match(migration, /classification_work_type/);
  assert.match(migration, /classification_service_state/);
  assert.match(migration, /NEW\.assigned_team_id/);
  assert.match(migration, /suggested_confidence/);
  assert.match(migration, /DROP TRIGGER IF EXISTS ticket_classification_reviews_capture_after_ticket_insert/);
});

test('production smoke test covers login, navigation and core governance APIs', () => {
  assert.match(smoke, /Admin login/);
  assert.match(smoke, /Classification Review page/);
  assert.match(smoke, /Classification Quality page/);
  assert.match(smoke, /Review queue API/);
  assert.match(smoke, /Quality KPI API/);
  assert.match(smoke, /P1 priority diagnose/);
  assert.match(smoke, /process\.env\.ADMIN_PASSWORD/);
});
