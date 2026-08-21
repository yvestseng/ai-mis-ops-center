-- Treat severe company/site-wide core-network degradation as a P1 major incident.
-- Runtime logic in worker/tickets.ts still gates this rule by semantic scope,
-- service type and degradation severity, so department/single-user slowness does
-- not become P1 merely because words such as "很慢" appear in the ticket.
UPDATE ticket_priority_rules
SET
  description = '明確描述全公司、全廠、主要據點、大量使用者的服務中斷，或全公司／主要據點核心網路嚴重降級（例如很慢、非常慢、嚴重延遲、高延遲、packet loss）時套用。部門、單一設備、單一使用者或一般輕微效能問題不得直接判為 P1。',
  priority_review_required = 1,
  require_impact_details = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system'
WHERE id = 'priority-p1-major-outage';
