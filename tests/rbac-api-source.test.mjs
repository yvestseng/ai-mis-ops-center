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
    /\/api\/admin\/(users\|roles\|teams\|assets\|services\|audit)/,
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

test("account mutation APIs block self-removal and last-admin lockout", async () => {
  const admin = await read("worker/admin.ts");

  assert.match(admin, /SELF_DISABLE_DENIED/);
  assert.match(admin, /SELF_DELETE_DENIED/);
  assert.match(admin, /LAST_ADMIN_DENIED/);
  assert.match(admin, /countOtherActiveAdmins/);
  assert.match(admin, /current\.status === "active"/);
  assert.match(admin, /current\.roleCode === "admin"/);
  assert.match(admin, /normalizedRoleCode !== "admin"/);
  assert.match(admin, /DELETE FROM auth_sessions WHERE user_id = \?/);
});

test("expected manual three-role API matrix is documented", async () => {
  const checklist = await read("docs/RBAC_API_AUTHORIZATION_CHECKLIST.md");

  for (const expected of [
    "一般使用者",
    "MIS 維運人員",
    "系統管理員",
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
