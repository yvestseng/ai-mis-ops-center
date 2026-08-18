#!/usr/bin/env node
/**
 * Production smoke test for AI MIS Ops Center.
 * Required env: BASE_URL, ADMIN_ID, ADMIN_PASSWORD
 * Example (PowerShell):
 *   $env:BASE_URL='https://ai-mis-ops-center.amtran.workers.dev'
 *   $env:ADMIN_ID='admin01'
 *   $env:ADMIN_PASSWORD='<secret>'
 *   node .\scripts\production-smoke-test.mjs
 */
const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const adminId = process.env.ADMIN_ID || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

if (!baseUrl || !adminId || !adminPassword) {
  console.error('Missing BASE_URL, ADMIN_ID or ADMIN_PASSWORD. Secrets must be supplied via environment variables.');
  process.exit(2);
}

const results = [];
let cookie = '';

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';', 1)[0];
  return response;
}

async function expectOk(name, path, init) {
  try {
    const response = await request(path, init);
    const ok = response.status >= 200 && response.status < 400;
    record(name, ok, `HTTP ${response.status}`);
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

await expectOk('Public admin login page', '/admin/login');

try {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ username: adminId, password: adminPassword }),
  });
  const body = await response.text();
  const ok = response.ok && Boolean(cookie);
  record('Admin login', ok, `HTTP ${response.status}${cookie ? ', session cookie received' : ', no session cookie'}`);
  if (!ok) console.error(body.slice(0, 500));
} catch (error) {
  record('Admin login', false, error instanceof Error ? error.message : String(error));
}

await expectOk('Admin workspace', '/admin');
await expectOk('Classification Review page', '/admin/classification-reviews');
await expectOk('Classification Quality page', '/admin/classification-quality');
await expectOk('Session API', '/api/session', { headers: { accept: 'application/json' } });
await expectOk('Review queue API', '/api/classification-reviews', { headers: { accept: 'application/json' } });
await expectOk('Quality KPI API', '/api/classification-reviews/kpi', { headers: { accept: 'application/json' } });
await expectOk('Support teams API', '/api/support-teams', { headers: { accept: 'application/json' } });

try {
  const response = await request('/api/tickets/diagnose', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      title: 'Smoke Test - 全公司 Wi-Fi 中斷',
      description: '全公司所有使用者 Wi-Fi 無法連線，請只做診斷不要建立工單。',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const ok = response.ok && payload?.priority?.code === 'P1';
  record('Priority Evaluation smoke', ok, `HTTP ${response.status}, priority=${payload?.priority?.code ?? 'N/A'}`);
} catch (error) {
  record('Priority Evaluation smoke', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\nSmoke Test: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
