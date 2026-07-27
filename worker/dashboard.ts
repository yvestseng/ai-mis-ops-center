import { hasPermission, json, requirePermission } from "./auth";

export async function handleDashboardRequest(
  request: Request,
  db: D1Database,
) {
  const auth = await requirePermission(request, db, "dashboard.read");
  if (!auth.identity) return auth.response!;
  if (auth.response) return auth.response;

  const [ticketSummary, ticketTrend, assets, services, surveys, audit] =
    await db.batch([
      db.prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN status='待處理' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status='處理中' THEN 1 ELSE 0 END) AS processing,
          SUM(CASE WHEN status IN ('已解決','已結案') THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN priority IN ('緊急','高') THEN 1 ELSE 0 END) AS high_priority
         FROM tickets`,
      ),
      db.prepare(
        `SELECT substr(created_at,1,10) AS date, COUNT(*) AS count
         FROM tickets
         WHERE created_at >= datetime('now','-6 days')
         GROUP BY substr(created_at,1,10) ORDER BY date`,
      ),
      db.prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN status='使用中' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN warranty_end IS NOT NULL
                   AND warranty_end <= date('now','+60 days') THEN 1 ELSE 0 END) AS warranty_due
         FROM assets`,
      ),
      db.prepare(
        `SELECT COUNT(*) AS total,
          SUM(CASE WHEN status='正常' THEN 1 ELSE 0 END) AS healthy,
          ROUND(AVG(availability),2) AS availability
         FROM managed_services`,
      ),
      db.prepare(
        `SELECT COUNT(*) AS total, ROUND(AVG(overall_score),1) AS average_score,
          SUM(CASE WHEN needs_followup=1 THEN 1 ELSE 0 END) AS followups
         FROM survey_responses`,
      ),
      db.prepare(
        `SELECT actor_email AS actorEmail, action, entity_type AS entityType,
                created_at AS createdAt
         FROM audit_logs ORDER BY created_at DESC LIMIT 8`,
      ),
    ]);

  return json({
    tickets: ticketSummary.results[0] || {},
    ticketTrend: ticketTrend.results,
    assets: assets.results[0] || {},
    services: services.results[0] || {},
    surveys: surveys.results[0] || {},
    recentActivity: hasPermission(auth.identity, "audit.read")
      ? audit.results
      : [],
  });
}
