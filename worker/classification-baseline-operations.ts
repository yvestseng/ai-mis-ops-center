export type BaselineMaturityCode =
  | "insufficient"
  | "early"
  | "usable"
  | "baseline_v1";

export type BaselineMaturity = {
  code: BaselineMaturityCode;
  label: string;
  reviewed: number;
  nextTarget: number | null;
  remaining: number;
};

export type P1SampleAdequacy = {
  predictedP1: number;
  actualP1: number;
  truePositiveP1: number;
  minimumActualP1: number;
  sufficient: boolean;
  label: string;
};

type AggregateRow = Record<string, number | string | null | undefined>;

const numeric = (value: unknown) => Number(value ?? 0);
const ratio = (numerator: number, denominator: number) =>
  denominator === 0
    ? null
    : Math.round((numerator / denominator) * 10_000) / 10_000;

export function classifyBaselineMaturity(reviewed: number): BaselineMaturity {
  if (reviewed >= 100) {
    return {
      code: "baseline_v1",
      label: "Baseline v1",
      reviewed,
      nextTarget: null,
      remaining: 0,
    };
  }

  if (reviewed >= 50) {
    return {
      code: "usable",
      label: "Usable Baseline",
      reviewed,
      nextTarget: 100,
      remaining: 100 - reviewed,
    };
  }

  if (reviewed >= 30) {
    return {
      code: "early",
      label: "Early Baseline",
      reviewed,
      nextTarget: 50,
      remaining: 50 - reviewed,
    };
  }

  return {
    code: "insufficient",
    label: "資料不足",
    reviewed,
    nextTarget: 30,
    remaining: Math.max(30 - reviewed, 0),
  };
}

export function evaluateP1SampleAdequacy(
  predictedP1: number,
  actualP1: number,
  truePositiveP1: number,
): P1SampleAdequacy {
  const minimumActualP1 = 10;
  const sufficient = actualP1 >= minimumActualP1;
  return {
    predictedP1,
    actualP1,
    truePositiveP1,
    minimumActualP1,
    sufficient,
    label: sufficient ? "樣本可觀察" : "樣本不足",
  };
}

export async function getBaselineOperationsDatasource(db: D1Database) {
  const [p1Counts, weeklyTrend, serviceErrors, priorityErrors] = await db.batch([
    db.prepare(
      `SELECT
         SUM(CASE WHEN suggested_priority = 'P1' THEN 1 ELSE 0 END) AS predictedP1,
         SUM(CASE WHEN final_priority = 'P1' THEN 1 ELSE 0 END) AS actualP1,
         SUM(CASE WHEN suggested_priority = 'P1' AND final_priority = 'P1' THEN 1 ELSE 0 END) AS truePositiveP1,
         COUNT(*) AS reviewed
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL`,
    ),
    db.prepare(
      `SELECT
         strftime('%Y-%W', reviewed_at) AS week,
         COUNT(*) AS reviewed,
         SUM(CASE WHEN overall_correct = 1 THEN 1 ELSE 0 END) AS overallCorrect,
         SUM(CASE WHEN service_correct = 1 AND team_correct = 1 THEN 1 ELSE 0 END) AS serviceCorrect,
         SUM(CASE WHEN priority_correct = 1 THEN 1 ELSE 0 END) AS priorityCorrect,
         SUM(CASE WHEN review_result = 'accepted' THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN suggested_priority = 'P1' THEN 1 ELSE 0 END) AS predictedP1,
         SUM(CASE WHEN final_priority = 'P1' THEN 1 ELSE 0 END) AS actualP1,
         SUM(CASE WHEN suggested_priority = 'P1' AND final_priority = 'P1' THEN 1 ELSE 0 END) AS truePositiveP1
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL
       GROUP BY strftime('%Y-%W', reviewed_at)
       ORDER BY week DESC
       LIMIT 12`,
    ),
    db.prepare(
      `SELECT
         final_service_key AS dimension,
         COUNT(*) AS reviewed,
         SUM(CASE WHEN service_correct = 0 OR team_correct = 0 THEN 1 ELSE 0 END) AS errors
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL
         AND final_service_key IS NOT NULL
       GROUP BY final_service_key
       HAVING errors > 0
       ORDER BY errors DESC, reviewed DESC, dimension
       LIMIT 10`,
    ),
    db.prepare(
      `SELECT
         final_priority AS dimension,
         COUNT(*) AS reviewed,
         SUM(CASE WHEN priority_correct = 0 THEN 1 ELSE 0 END) AS errors
       FROM ticket_classification_reviews
       WHERE reviewed_at IS NOT NULL
         AND final_priority IS NOT NULL
       GROUP BY final_priority
       HAVING errors > 0
       ORDER BY errors DESC, reviewed DESC, dimension
       LIMIT 10`,
    ),
  ]);

  const p1 = (p1Counts.results[0] ?? {}) as AggregateRow;
  const reviewed = numeric(p1.reviewed);
  const predictedP1 = numeric(p1.predictedP1);
  const actualP1 = numeric(p1.actualP1);
  const truePositiveP1 = numeric(p1.truePositiveP1);

  const weekly = (weeklyTrend.results ?? []).map((row) => {
    const value = row as AggregateRow;
    const weeklyReviewed = numeric(value.reviewed);
    const weeklyPredictedP1 = numeric(value.predictedP1);
    const weeklyActualP1 = numeric(value.actualP1);
    const weeklyTruePositiveP1 = numeric(value.truePositiveP1);
    return {
      week: String(value.week ?? ""),
      reviewed: weeklyReviewed,
      overallClassificationAccuracy: ratio(numeric(value.overallCorrect), weeklyReviewed),
      serviceAccuracy: ratio(numeric(value.serviceCorrect), weeklyReviewed),
      priorityAccuracy: ratio(numeric(value.priorityCorrect), weeklyReviewed),
      p1Precision: ratio(weeklyTruePositiveP1, weeklyPredictedP1),
      p1Recall: ratio(weeklyTruePositiveP1, weeklyActualP1),
      aiRecommendationAcceptanceRate: ratio(numeric(value.accepted), weeklyReviewed),
    };
  });

  const mapErrors = (rows: unknown[]) =>
    rows.map((row) => {
      const value = row as AggregateRow;
      const rowReviewed = numeric(value.reviewed);
      const errors = numeric(value.errors);
      return {
        dimension: String(value.dimension ?? "unknown"),
        reviewed: rowReviewed,
        errors,
        errorRate: ratio(errors, rowReviewed),
      };
    });

  return {
    maturity: classifyBaselineMaturity(reviewed),
    p1SampleAdequacy: evaluateP1SampleAdequacy(
      predictedP1,
      actualP1,
      truePositiveP1,
    ),
    weeklyTrend: weekly,
    topMisclassifications: {
      services: mapErrors((serviceErrors.results ?? []) as unknown[]),
      priorities: mapErrors((priorityErrors.results ?? []) as unknown[]),
    },
  };
}
