import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function permissionBlock(source, entity) {
  const pattern = new RegExp(`${entity}: \\{ read: "([^"]+)"(?:, write: "([^"]+)")? \\}`);
  const match = source.match(pattern);
  assert.ok(match, `missing permission block for ${entity}`);
  return { read: match[1], write: match[2] || null };
}

test("admin APIs require server-side permissions for all privileged resources", async () => {
  const [worker, admin] = await Promise.all([
    read("worker/index.ts"),
    read("worker/admin.ts"),
  ]);

  assert.match(
    worker,
    /\^\\\/api\\\/admin\\\/\(users\|roles\|teams\|assets\|services\|audit\)/,
  );
  assert.match(admin, /const entityPermission/);
  assert.match(admin, /requirePermission\(request, db, required\)/);

  assert.deepEqual(permissionBlock(admin, "users"), {
    read: "rbac.manage",
    write: "rbac.manage",
  });
  assert.deepEqual(permissionBlock(admin, "roles"), {
    read: "rbac.manage",
    write: "rbac.manage",
  });
  assert.deepEqual(permissionBlock(admin, "teams"), {
    read: "rbac.manage",
    write: "rbac.manage",
  });
  assert.deepEqual(permissionBlock(admin, "audit"), {
    read: "audit.read",
    write: null,
  });
  assert.deepEqual(permissionBlock(admin, "assets"), {
    read: "assets.read",
    write: "assets.write",
  });
  assert.deepEqual(permissionBlock(admin, "services"), {
    read: "services.read",
    write: "services.write",
  });
});

test("three built-in roles preserve expected privileged API access boundaries", async () => {
  const auth = await read("worker/auth.ts");

  const rolePermissions = Object.fromEntries(
    [...auth.matchAll(/code: "(admin|operator|user)",[\s\S]*?permissions:\s*'([^']+)'/g)]
      .map(([, code, permissions]) => [code, JSON.parse(permissions)]),
  );

  assert.ok(rolePermissions.admin, "admin role seed is missing");
  assert.ok(rolePermissions.operator, "operator role seed is missing");
  assert.ok(rolePermissions.user, "user role seed is missing");

  assert.ok(rolePermissions.admin.includes("rbac.manage"));
  assert.ok(rolePermissions.admin.includes("audit.read"));
  assert.ok(rolePermissions.admin.includes("tickets.read.all"));
  assert.ok(rolePermissions.admin.includes("tickets.assign"));

  assert.equal(rolePermissions.operator.includes("rbac.manage"), false);
  assert.equal(rolePermissions.operator.includes("audit.read"), false);
  assert.ok(rolePermissions.operator.includes("tickets.read.all"));
  assert.ok(rolePermissions.operator.includes("tickets.assign"));

  assert.equal(rolePermissions.user.includes("rbac.manage"), false);
  assert.equal(rolePermissions.user.includes("audit.read"), false);
  assert.equal(rolePermissions.user.includes("tickets.read.all"), false);
  assert.equal(rolePermissions.user.includes("tickets.assign"), false);
  assert.ok(rolePermissions.user.includes("tickets.read.own"));
});

test("ticket APIs enforce own-vs-all reads and assignment escalation checks", async () => {
  const tickets = await read("worker/tickets.ts");

  assert.match(tickets, /const all = hasPermission\(identity, "tickets\.read\.all"\)/);
  assert.match(tickets, /WHERE \(\? = 1 OR t\.requester_hash = \?\)/);
  assert.match(tickets, /AND \(\? = 1 OR t\.requester_hash = \?\)/);
  assert.match(tickets, /request\.method === "PATCH"\s*\? "tickets\.update"/);
  assert.match(tickets, /assignmentRequested && !hasPermission\(identity, "tickets\.assign"\)/);
  assert.match(tickets, /error: "FORBIDDEN"/);
});

test("priority review queue is protected and reads tickets with their latest event", async () => {
  const [worker, tickets] = await Promise.all([
    read("worker/index.ts"),
    read("worker/tickets.ts"),
  ]);

  assert.match(worker, /\/api\/tickets\/priority-reviews/);
  assert.match(tickets, /handleTicketPriorityReviewRequest/);
  assert.match(tickets, /requirePermission\(request, db, "tickets\.update"\)/);
  assert.match(tickets, /FROM tickets t/);
  assert.match(tickets, /ticket_events latest/);
  assert.match(tickets, /t\.priority_review_required = 1/);
  assert.match(tickets, /t\.priority_confirmed_at IS NULL/);
});

test("governance APIs enforce management and one-time import permissions", async () => {
  const [worker, governance, auth, migration, workflow] = await Promise.all([
    read("worker/index.ts"),
    read("worker/governance.ts"),
    read("worker/auth.ts"),
    read("drizzle/0016_governance_knowledge_incidents.sql"),
    read("drizzle/0017_governance_management_workflow.sql"),
  ]);

  assert.match(worker, /knowledge-articles/);
  assert.match(worker, /major-incidents/);
  assert.match(worker, /candidate-tickets/);
  assert.match(worker, /import-candidates/);
  assert.match(governance, /requirePermission\(request, db, permission\)/);
  assert.match(governance, /"knowledge\.read"/);
  assert.match(governance, /"knowledge\.manage"/);
  assert.match(governance, /"incidents\.read"/);
  assert.match(governance, /"incidents\.manage"/);
  assert.match(governance, /"governance\.import"/);
  assert.match(governance, /importCandidates/);
  assert.match(governance, /saveArticle/);
  assert.match(governance, /saveIncident/);
  assert.match(governance, /FROM knowledge_articles a/);
  assert.match(governance, /knowledge_article_ticket_links l/);
  assert.match(governance, /FROM major_incidents i/);
  assert.match(governance, /major_incident_notifications/);
  assert.match(auth, /"knowledge\.read"/);
  assert.match(auth, /"knowledge\.manage"/);
  assert.match(auth, /"incidents\.manage"/);
  assert.match(auth, /"governance\.import"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS knowledge_articles/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS major_incidents/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS major_incident_notifications/);
  assert.match(workflow, /closure_summary/);
  assert.match(workflow, /recipient_email/);
  assert.match(workflow, /knowledge\.manage/);
  assert.match(workflow, /governance\.import/);
});

test("account disabling blocks self-disable and last-admin lockout", async () => {
  const admin = await read("worker/admin.ts");

  assert.match(admin, /SELF_DISABLE_BLOCKED/);
  assert.match(admin, /LAST_ADMIN_DISABLE_BLOCKED/);
  assert.match(admin, /id === identity\.id/);
  assert.match(admin, /r\.code = 'admin' AND u\.status = 'active'/);
  assert.match(admin, /DELETE FROM auth_sessions WHERE user_id = \?/);
});

test("expected manual three-role API matrix is documented", async () => {
  const checklist = await read("docs/RBAC_API_AUTHORIZATION_CHECKLIST.md");

  for (const expected of [
    "GET /api/admin/users",
    "GET /api/admin/roles",
    "GET /api/admin/audit",
    "GET /api/admin/teams",
    "PATCH /api/tickets/:id",
    "403",
    "200",
  ]) {
    assert.match(checklist, new RegExp(expected.replaceAll("/", "\\/")));
  }
});
