#!/usr/bin/env node
/**
 * Production smoke test for AI MIS Ops Center.
 *
 * Required env:
 *   BASE_URL, ADMIN_ID, ADMIN_PASSWORD, USER_ID, USER_PASSWORD
 *
 * The test is intentionally read-mostly. The diagnose endpoint evaluates
 * priority without creating a ticket.
 */
const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "");
const adminId = process.env.ADMIN_ID || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const userId = process.env.USER_ID || "";
const userPassword = process.env.USER_PASSWORD || "";
const adminTotpCode = process.env.ADMIN_TOTP_CODE || "";

if (!baseUrl || !adminId || !adminPassword || !userId || !userPassword || !adminTotpCode) {
  console.error(
    "Missing BASE_URL, ADMIN_ID, ADMIN_PASSWORD, ADMIN_TOTP_CODE, USER_ID or USER_PASSWORD. " +
      "Secrets must be supplied via environment variables.",
  );
  process.exit(2);
}

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(path, { cookie = "", ...init } = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers,
  });
}

function sessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  return setCookie ? setCookie.split(";", 1)[0] : "";
}

async function expectStatus(name, path, expected, init = {}) {
  try {
    const response = await request(path, init);
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    const ok = expectedStatuses.includes(response.status);
    record(name, ok, `HTTP ${response.status}`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function login(name, username, password, portal, totpCode = "") {
  try {
    const response = await request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ username, password, portal }),
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 202 && payload?.mfaRequired) {
      if (payload?.mfaEnrollmentRequired) {
        record(name, false, "Admin MFA 尚未完成註冊；Production Smoke 不會自動旋轉 MFA Secret");
        return { response, cookie: "", body: JSON.stringify(payload) };
      }
      if (!totpCode || !payload?.challengeToken) {
        record(name, false, "MFA challenge received but ADMIN_TOTP_CODE/challenge is missing");
        return { response, cookie: "", body: JSON.stringify(payload) };
      }
      const verify = await request("/api/auth/mfa/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ challengeToken: payload.challengeToken, code: totpCode }),
      });
      const verifyBody = await verify.text();
      const cookie = sessionCookie(verify);
      const ok = verify.ok && Boolean(cookie);
      record(name, ok, `HTTP ${verify.status}, MFA ${ok ? "verified" : "failed"}${cookie ? ", session cookie received" : ""}`);
      if (!ok) console.error(verifyBody.slice(0, 500));
      return { response: verify, cookie, body: verifyBody };
    }

    const body = JSON.stringify(payload);
    const cookie = sessionCookie(response);
    const ok = response.ok && Boolean(cookie);
    record(name, ok, `HTTP ${response.status}${cookie ? ", session cookie received" : ", no session cookie"}`);
    if (!ok) console.error(body.slice(0, 500));
    return { response, cookie, body };
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return { response: null, cookie: "", body: "" };
  }
}

async function expectRole(name, cookie, expectedRole) {
  try {
    const response = await request("/api/session", {
      cookie,
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    const role = payload?.user?.roleCode ?? payload?.identity?.roleCode ?? null;
    const ok = response.ok && role === expectedRole;
    record(name, ok, `HTTP ${response.status}, role=${role ?? "N/A"}`);
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

await expectStatus("Public user login page", "/user/login", 200);
await expectStatus("Public admin login page", "/admin/login", 200);

const admin = await login("Admin login + TOTP MFA via admin portal", adminId, adminPassword, "admin", adminTotpCode);
const user = await login("User login via user portal", userId, userPassword, "user");

await expectStatus(
  "User rejected by admin portal",
  "/api/auth/login",
  403,
  {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username: userId, password: userPassword, portal: "admin" }),
  },
);

await expectStatus(
  "Admin rejected by user portal",
  "/api/auth/login",
  403,
  {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username: adminId, password: adminPassword, portal: "user" }),
  },
);

if (admin.cookie) {
  await expectRole("Admin session role", admin.cookie, "admin");
  await expectStatus("Admin workspace", "/admin", 200, { cookie: admin.cookie });
  await expectStatus(
    "Classification Review page",
    "/admin/classification-reviews",
    200,
    { cookie: admin.cookie },
  );
  await expectStatus(
    "Classification Quality page",
    "/admin/classification-quality",
    200,
    { cookie: admin.cookie },
  );
  await expectStatus(
    "Review queue API",
    "/api/classification-reviews",
    200,
    { cookie: admin.cookie, headers: { accept: "application/json" } },
  );
  await expectStatus(
    "Quality KPI API",
    "/api/classification-reviews/kpi",
    200,
    { cookie: admin.cookie, headers: { accept: "application/json" } },
  );
  await expectStatus(
    "Support teams API",
    "/api/support-teams",
    200,
    { cookie: admin.cookie, headers: { accept: "application/json" } },
  );

  try {
    const response = await request("/api/tickets/diagnose", {
      cookie: admin.cookie,
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        title: "Smoke Test - 全公司 Wi-Fi 中斷",
        description: "全公司所有使用者 Wi-Fi 無法連線，請只做診斷不要建立工單。",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const ok = response.ok && payload?.priority?.code === "P1";
    record(
      "P1 priority diagnose",
      ok,
      `HTTP ${response.status}, priority=${payload?.priority?.code ?? "N/A"}`,
    );
  } catch (error) {
    record(
      "P1 priority diagnose",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (user.cookie) {
  await expectRole("User session role", user.cookie, "user");
}

if (admin.cookie) {
  const logout = await expectStatus("Admin logout", "/api/auth/logout", 200, {
    cookie: admin.cookie,
    method: "POST",
    headers: { accept: "application/json" },
  });
  if (logout?.ok) {
    await expectStatus("Admin session invalidated", "/api/session", 401, {
      cookie: admin.cookie,
      headers: { accept: "application/json" },
    });
  }
}

if (user.cookie) {
  await expectStatus("User logout", "/api/auth/logout", 200, {
    cookie: user.cookie,
    method: "POST",
    headers: { accept: "application/json" },
  });
}

const failed = results.filter((item) => !item.ok);
console.log(`\nSmoke Test: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
