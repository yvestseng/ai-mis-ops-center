export type ClassificationSnapshot = {
  workType: string;
  serviceKey: string;
  assignedTeamId: string | null;
  impactLevel: string;
  serviceState: string;
  priority: string;
  confidence?: number | null;
  reviewRequired?: boolean;
  reviewResult?: "accepted" | "modified" | null;
};

export type ClassificationEvaluationRecord = {
  id: string;
  expected: ClassificationSnapshot;
  actual: ClassificationSnapshot;
};

export type ClassificationKpiBaseline = {
  sampleSize: number;
  overallClassificationAccuracy: number;
  serviceAccuracy: number;
  priorityAccuracy: number;
  p1Precision: number;
  p1Recall: number;
  manualReviewRate: number;
  aiRecommendationAcceptanceRate: number | null;
  regressionCoverage: number;
  counts: {
    overallCorrect: number;
    serviceCorrect: number;
    priorityCorrect: number;
    predictedP1: number;
    expectedP1: number;
    truePositiveP1: number;
    manualReviewRequired: number;
    reviewed: number;
    accepted: number;
  };
};

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundRate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function classificationFieldsMatch(
  expected: ClassificationSnapshot,
  actual: ClassificationSnapshot,
) {
  return expected.workType === actual.workType &&
    expected.serviceKey === actual.serviceKey &&
    expected.assignedTeamId === actual.assignedTeamId &&
    expected.impactLevel === actual.impactLevel &&
    expected.serviceState === actual.serviceState &&
    expected.priority === actual.priority;
}

export function calculateClassificationKpis(
  records: ClassificationEvaluationRecord[],
  targetRegressionCases?: number,
): ClassificationKpiBaseline {
  let overallCorrect = 0;
  let serviceCorrect = 0;
  let priorityCorrect = 0;
  let predictedP1 = 0;
  let expectedP1 = 0;
  let truePositiveP1 = 0;
  let manualReviewRequired = 0;
  let reviewed = 0;
  let accepted = 0;

  for (const record of records) {
    if (classificationFieldsMatch(record.expected, record.actual)) overallCorrect += 1;
    if (
      record.expected.serviceKey === record.actual.serviceKey &&
      record.expected.assignedTeamId === record.actual.assignedTeamId
    ) {
      serviceCorrect += 1;
    }
    if (record.expected.priority === record.actual.priority) priorityCorrect += 1;

    const isExpectedP1 = record.expected.priority === "P1";
    const isPredictedP1 = record.actual.priority === "P1";
    if (isExpectedP1) expectedP1 += 1;
    if (isPredictedP1) predictedP1 += 1;
    if (isExpectedP1 && isPredictedP1) truePositiveP1 += 1;

    if (record.actual.reviewRequired) manualReviewRequired += 1;
    if (record.actual.reviewResult) {
      reviewed += 1;
      if (record.actual.reviewResult === "accepted") accepted += 1;
    }
  }

  const sampleSize = records.length;
  const regressionTarget = targetRegressionCases ?? sampleSize;

  return {
    sampleSize,
    overallClassificationAccuracy: roundRate(ratio(overallCorrect, sampleSize)),
    serviceAccuracy: roundRate(ratio(serviceCorrect, sampleSize)),
    priorityAccuracy: roundRate(ratio(priorityCorrect, sampleSize)),
    p1Precision: roundRate(ratio(truePositiveP1, predictedP1)),
    p1Recall: roundRate(ratio(truePositiveP1, expectedP1)),
    manualReviewRate: roundRate(ratio(manualReviewRequired, sampleSize)),
    aiRecommendationAcceptanceRate: reviewed > 0 ? roundRate(ratio(accepted, reviewed)) : null,
    regressionCoverage: roundRate(ratio(sampleSize, regressionTarget)),
    counts: {
      overallCorrect,
      serviceCorrect,
      priorityCorrect,
      predictedP1,
      expectedP1,
      truePositiveP1,
      manualReviewRequired,
      reviewed,
      accepted,
    },
  };
}

export const CLASSIFICATION_KPI_TARGETS = {
  overallClassificationAccuracy: 0.9,
  serviceAccuracy: 0.95,
  priorityAccuracy: 0.9,
  p1Precision: 0.95,
  p1Recall: 0.95,
} as const;

export function evaluateKpiTargets(kpis: ClassificationKpiBaseline) {
  return {
    overallClassificationAccuracy:
      kpis.overallClassificationAccuracy >= CLASSIFICATION_KPI_TARGETS.overallClassificationAccuracy,
    serviceAccuracy: kpis.serviceAccuracy >= CLASSIFICATION_KPI_TARGETS.serviceAccuracy,
    priorityAccuracy: kpis.priorityAccuracy >= CLASSIFICATION_KPI_TARGETS.priorityAccuracy,
    p1Precision: kpis.p1Precision >= CLASSIFICATION_KPI_TARGETS.p1Precision,
    p1Recall: kpis.p1Recall >= CLASSIFICATION_KPI_TARGETS.p1Recall,
  };
}
