import { audit, json, requireIdentity, requirePermission, type Identity } from "./auth";

type RulePayload = Record<string, unknown>;
type PriorityRuleDbRow = Record<string, unknown>;

function clean(value: unknown, max = 200) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function cleanTerms(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
  return [...new Set(values.map((item) => clean(item, 80)).filter(Boolean))].slice(0, 30);
}
function bool(value: unknown) { return value === true || value === 1 || value === "true" || value === "1"; }
async function payload(request: Request): Promise<RulePayload | null> { try { return await request.json() as RulePayload; } catch { return null; } }

// [MODIFIED: lint-safe D1 row parsing]
// D1 returns untyped row values. Validate the JSON columns before returning them
// so an invalid stored value cannot break the rule-management page.
function parseTerms(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string")
      : [];
  } catch {
    return [];
  }
}

async function list(db: D1Database) {
  const result = await db.prepare(`SELECT id, rule_name AS ruleName, description,
    match_all_terms AS matchAllTerms, match_any_terms AS matchAnyTerms, priority, category,
    assigned_team AS assignedTeam, priority_review_required AS priorityReviewRequired,
    require_impact_details AS requireImpactDetails, display_order AS displayOrder,
    is_active AS isActive, created_at AS createdAt, created_by AS createdBy,
    updated_at AS updatedAt, updated_by AS updatedBy
    FROM ticket_priority_rules ORDER BY display_order, rule_name`).all();
  const rules = (result.results ?? []).map((row) => {
    const rule = row as PriorityRuleDbRow;
    return {
      ...rule,
      matchAllTerms: parseTerms(rule.matchAllTerms),
      matchAnyTerms: parseTerms(rule.matchAnyTerms),
    };
  });
  return json({ rules });
}
function validate(data: RulePayload) {
  const ruleName = clean(data.ruleName, 100); const priority = clean(data.priority, 10);
  if (!ruleName || !["緊急", "高", "中", "低"].includes(priority)) return null;
  return { ruleName, description: clean(data.description, 500) || null, matchAllTerms: cleanTerms(data.matchAllTerms), matchAnyTerms: cleanTerms(data.matchAnyTerms), priority, category: clean(data.category, 40) || "其他", assignedTeam: clean(data.assignedTeam, 80) || "MIS 服務台", priorityReviewRequired: bool(data.priorityReviewRequired), requireImpactDetails: bool(data.requireImpactDetails), displayOrder: Math.max(0, Math.min(9999, Number(data.displayOrder) || 100)), isActive: bool(data.isActive) };
}
async function create(data: RulePayload, db: D1Database, identity: Identity) {
  const rule = validate(data); if (!rule) return json({ message: "請填寫規則名稱並選擇有效的 P1～P4 優先級。" }, 400);
  const id = `priority-rule-${crypto.randomUUID()}`; const now = new Date().toISOString();
  await db.prepare(`INSERT INTO ticket_priority_rules (id,rule_name,description,match_all_terms,match_any_terms,priority,category,assigned_team,priority_review_required,require_impact_details,display_order,is_active,created_at,created_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, rule.ruleName, rule.description, JSON.stringify(rule.matchAllTerms), JSON.stringify(rule.matchAnyTerms), rule.priority, rule.category, rule.assignedTeam, +rule.priorityReviewRequired, +rule.requireImpactDetails, rule.displayOrder, +rule.isActive, now, identity.email, now, identity.email).run();
  await audit(db, identity, "create", "ticket_priority_rule", id, rule); return json({ ok: true, id, message: "優先級規則已建立。" }, 201);
}
async function update(id: string, data: RulePayload, db: D1Database, identity: Identity) {
  const rule = validate(data); if (!rule) return json({ message: "請填寫規則名稱並選擇有效的 P1～P4 優先級。" }, 400);
  const current = await db.prepare("SELECT id FROM ticket_priority_rules WHERE id=?").bind(id).first(); if (!current) return json({ message: "找不到規則。" }, 404);
  const now = new Date().toISOString(); await db.prepare(`UPDATE ticket_priority_rules SET rule_name=?,description=?,match_all_terms=?,match_any_terms=?,priority=?,category=?,assigned_team=?,priority_review_required=?,require_impact_details=?,display_order=?,is_active=?,updated_at=?,updated_by=? WHERE id=?`).bind(rule.ruleName, rule.description, JSON.stringify(rule.matchAllTerms), JSON.stringify(rule.matchAnyTerms), rule.priority, rule.category, rule.assignedTeam, +rule.priorityReviewRequired, +rule.requireImpactDetails, rule.displayOrder, +rule.isActive, now, identity.email, id).run();
  await audit(db, identity, "update", "ticket_priority_rule", id, rule); return json({ ok: true, message: "優先級規則已更新。" });
}
export function handlePriorityRuleRequest(request: Request, db: D1Database, id?: string) {
  return (async () => { const auth = request.method === "GET" ? await requireIdentity(request, db) : await requirePermission(request, db, "rbac.manage"); if (!auth.identity) return auth.response!; if (auth.response) return auth.response;
    if (request.method === "GET") return list(db);
    const data = await payload(request); if (!data) return json({ message: "資料格式不正確。" }, 400);
    if (request.method === "POST" && !id) return create(data, db, auth.identity);
    if (request.method === "PATCH" && id) return update(id, data, db, auth.identity);
    if (request.method === "DELETE" && id) { await db.prepare("DELETE FROM ticket_priority_rules WHERE id=?").bind(id).run(); await audit(db, auth.identity, "delete", "ticket_priority_rule", id, {}); return json({ ok: true, message: "規則已刪除。" }); }
    return json({ message: "不支援此操作。" }, 405);
  })().catch((error) => { console.error("priority rule request failed", error); return json({ message: "優先級規則服務暫時無法使用。" }, 500); });
}
