"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Target,
  TriangleAlert,
} from "lucide-react";
import styles from "./classification-quality-dashboard.module.css";

type Baseline = {
  totalCaptured: number;
  totalReviewed: number;
  overallClassificationAccuracy: number | null;
  serviceAccuracy: number | null;
  priorityAccuracy: number | null;
  p1Precision: number | null;
  p1Recall: number | null;
  manualReviewRate: number | null;
  aiRecommendationAcceptanceRate: number | null;
};

type BreakdownRow = {
  dimension: string | null;
  reviewed: number | string;
  correct: number | string;
};

type BaselineMaturity = {
  code: "insufficient" | "early" | "usable" | "baseline_v1";
  label: string;
  reviewed: number;
  nextTarget: number | null;
  remaining: number;
};

type P1SampleAdequacy = {
  predictedP1: number;
  actualP1: number;
  truePositiveP1: number;
  minimumActualP1: number;
  sufficient: boolean;
  label: string;
};

type WeeklyTrendRow = {
  week: string;
  reviewed: number;
  overallClassificationAccuracy: number | null;
  serviceAccuracy: number | null;
  priorityAccuracy: number | null;
  p1Precision: number | null;
  p1Recall: number | null;
  aiRecommendationAcceptanceRate: number | null;
};

type MisclassificationRow = {
  dimension: string;
  reviewed: number;
  errors: number;
  errorRate: number | null;
};

type BaselineOperations = {
  maturity: BaselineMaturity;
  p1SampleAdequacy: P1SampleAdequacy;
  weeklyTrend: WeeklyTrendRow[];
  topMisclassifications: {
    services: MisclassificationRow[];
    priorities: MisclassificationRow[];
  };
};

type KpiResponse = {
  baseline: Baseline;
  priorityBreakdown: BreakdownRow[];
  serviceBreakdown: BreakdownRow[];
  operations: BaselineOperations;
  message?: string;
};

type MetricConfig = {
  key: keyof Baseline;
  label: string;
  target?: number;
  note: string;
};

const metricConfig: MetricConfig[] = [
  {
    key: "overallClassificationAccuracy",
    label: "Overall Accuracy",
    target: 0.9,
    note: "工作類型、服務、團隊、Priority 與 Impact 全部正確",
  },
  {
    key: "serviceAccuracy",
    label: "Service Accuracy",
    target: 0.95,
    note: "服務分類與維運團隊同時正確",
  },
  {
    key: "priorityAccuracy",
    label: "Priority Accuracy",
    target: 0.9,
    note: "AI Priority 與 MIS 最終 Priority 一致",
  },
  {
    key: "p1Precision",
    label: "P1 Precision",
    target: 0.95,
    note: "AI 判為 P1 的案件中，真正 P1 的比例",
  },
  {
    key: "p1Recall",
    label: "P1 Recall",
    target: 0.95,
    note: "真正 P1 的案件中，被 AI 正確辨識的比例",
  },
  {
    key: "manualReviewRate",
    label: "Manual Review Rate",
    note: "需人工覆核的分類占全部 captured records 的比例",
  },
  {
    key: "aiRecommendationAcceptanceRate",
    label: "AI Acceptance Rate",
    note: "MIS 完整接受 AI 建議、未修改分類的比例",
  },
];

function formatRate(value: number | null) {
  return value == null ? "N/A" : `${Math.round(value * 1000) / 10}%`;
}

function statusFor(value: number | null, target?: number) {
  if (value == null) return { label: "N/A", className: styles.na };
  if (target == null) return { label: "Baseline", className: styles.baseline };
  if (value >= target) return { label: "達標", className: styles.good };
  if (value >= target - 0.05) return { label: "觀察", className: styles.watch };
  return { label: "未達標", className: styles.bad };
}

function accuracy(row: BreakdownRow) {
  const reviewed = Number(row.reviewed || 0);
  const correct = Number(row.correct || 0);
  return reviewed > 0 ? correct / reviewed : null;
}

export default function ClassificationQualityDashboardPage() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/classification-reviews/kpi", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as KpiResponse;
      if (!response.ok) {
        throw new Error(result.message || "分類品質 KPI 讀取失敗");
      }
      setData(result);
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "分類品質 KPI 讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reviewedCoverage = useMemo(() => {
    if (!data?.baseline.totalCaptured) return null;
    return data.baseline.totalReviewed / data.baseline.totalCaptured;
  }, [data]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link href="/admin" className={styles.backLink}>
              <ArrowLeft size={16} /> 返回管理中心
            </Link>
            <span className={styles.eyebrow}>CLASSIFICATION GOVERNANCE</span>
            <h1>Classification Quality Dashboard</h1>
            <p>
              以 Production D1 的 AI suggested snapshot 與 MIS final review 為基準，追蹤分類品質、P1 安全性與人工覆核負擔。
            </p>
          </div>
          <button className={styles.refresh} onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
            {loading ? "更新中…" : "重新整理"}
          </button>
        </header>

        {error && (
          <section className={styles.errorPanel} role="alert">
            <ShieldCheck size={20} />
            <div>
              <b>無法讀取分類治理資料</b>
              <span>{error}</span>
            </div>
          </section>
        )}

        {!error && data && (
          <>
            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <BrainCircuit size={20} />
                <div>
                  <b>{data.baseline.totalCaptured}</b>
                  <span>Captured Snapshots</span>
                  <small>Production immutable suggested records</small>
                </div>
              </article>
              <article className={styles.summaryCard}>
                <BadgeCheck size={20} />
                <div>
                  <b>{data.baseline.totalReviewed}</b>
                  <span>MIS Reviewed</span>
                  <small>{formatRate(reviewedCoverage)} 已形成 ground truth</small>
                </div>
              </article>
              <article className={styles.summaryCard}>
                <Target size={20} />
                <div>
                  <b>{formatRate(data.baseline.p1Precision)}</b>
                  <span>P1 Precision</span>
                  <small>目標 ≥ 95%</small>
                </div>
              </article>
              <article className={styles.summaryCard}>
                <Activity size={20} />
                <div>
                  <b>{formatRate(data.baseline.p1Recall)}</b>
                  <span>P1 Recall</span>
                  <small>目標 ≥ 95%</small>
                </div>
              </article>
            </section>

            <section className={styles.metricGrid}>
              {metricConfig.map((metric) => {
                const value = data.baseline[metric.key] as number | null;
                const status = statusFor(value, metric.target);
                return (
                  <article className={styles.metricCard} key={metric.key}>
                    <div className={styles.metricHead}>
                      <span>{metric.label}</span>
                      <em className={status.className}>{status.label}</em>
                    </div>
                    <strong>{formatRate(value)}</strong>
                    <p>{metric.note}</p>
                    {metric.target != null && <small>Target ≥ {metric.target * 100}%</small>}
                  </article>
                );
              })}
            </section>

            <section className={styles.operationsSection}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.eyebrow}>BASELINE OPERATIONS V1</span>
                  <h2>Baseline Readiness & Operational Signals</h2>
                  <p>樣本量成熟度與 P1 樣本充分度用來判斷 KPI 是否可被正式解讀，不把樣本不足誤判成品質失敗。</p>
                </div>
              </div>

              <div className={styles.operationsGrid}>
                <article className={styles.operationsCard}>
                  <div className={styles.operationsTitle}>
                    <BarChart3 size={18} />
                    <span>資料量成熟度</span>
                  </div>
                  <strong>{data.operations.maturity.label}</strong>
                  <p>已完成 MIS 覆核 {data.operations.maturity.reviewed} 筆。</p>
                  {data.operations.maturity.nextTarget == null ? (
                    <small>已達 Baseline v1 正式門檻。</small>
                  ) : (
                    <small>
                      下一門檻 {data.operations.maturity.nextTarget} 筆，尚需 {data.operations.maturity.remaining} 筆。
                    </small>
                  )}
                </article>

                <article className={styles.operationsCard}>
                  <div className={styles.operationsTitle}>
                    <TriangleAlert size={18} />
                    <span>P1 樣本充分度</span>
                  </div>
                  <strong>{data.operations.p1SampleAdequacy.label}</strong>
                  <div className={styles.sampleCounts}>
                    <span>Predicted P1 <b>{data.operations.p1SampleAdequacy.predictedP1}</b></span>
                    <span>Actual P1 <b>{data.operations.p1SampleAdequacy.actualP1}</b></span>
                    <span>True Positive <b>{data.operations.p1SampleAdequacy.truePositiveP1}</b></span>
                  </div>
                  <small>Actual P1 最低觀察門檻：{data.operations.p1SampleAdequacy.minimumActualP1} 筆。</small>
                </article>
              </div>

              <WeeklyTrendTable rows={data.operations.weeklyTrend} />

              <div className={styles.breakdownGrid}>
                <MisclassificationTable
                  title="Top Service Misclassifications"
                  description="依 MIS 最終 Service 聚合，優先找出規則或 routing 最常誤判的服務類別。"
                  rows={data.operations.topMisclassifications.services}
                />
                <MisclassificationTable
                  title="Top Priority Misclassifications"
                  description="依 MIS 最終 Priority 聚合，檢視優先級判斷最需要治理的區域。"
                  rows={data.operations.topMisclassifications.priorities}
                />
              </div>
            </section>

            <section className={styles.dataQuality}>
              <div>
                <span className={styles.eyebrow}>DATA QUALITY</span>
                <h2>Ground Truth Coverage</h2>
                <p>
                  Accuracy KPI 只使用已完成 MIS 覆核的資料。Captured records 尚未覆核前，不會被當成正確或錯誤樣本。
                </p>
              </div>
              <div className={styles.progressWrap}>
                <div className={styles.progressLabel}>
                  <span>Reviewed / Captured</span>
                  <b>{formatRate(reviewedCoverage)}</b>
                </div>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${Math.min((reviewedCoverage ?? 0) * 100, 100)}%` }} />
                </div>
              </div>
            </section>

            <section className={styles.breakdownGrid}>
              <BreakdownTable
                title="Priority Accuracy Breakdown"
                description="依 MIS 最終 Priority 分組，檢視各級別分類正確率。"
                rows={data.priorityBreakdown}
              />
              <BreakdownTable
                title="Service Accuracy Breakdown"
                description="依 MIS 最終 Service 分組，找出最容易誤判的服務類別。"
                rows={data.serviceBreakdown}
              />
            </section>
          </>
        )}

        {!error && !data && loading && (
          <section className={styles.loadingPanel}>正在讀取 Production Classification KPI…</section>
        )}
      </div>
    </main>
  );
}

function WeeklyTrendTable({ rows }: { rows: WeeklyTrendRow[] }) {
  return (
    <article className={styles.trendCard}>
      <div className={styles.cardHead}>
        <div>
          <h2>Weekly KPI Trend</h2>
          <p>最近 12 週 MIS Reviewed 樣本的品質趨勢；沒有分母的 KPI 顯示 N/A。</p>
        </div>
      </div>
      {rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Reviewed</th>
                <th>Overall</th>
                <th>Service</th>
                <th>Priority</th>
                <th>P1 Precision</th>
                <th>P1 Recall</th>
                <th>Acceptance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.week}>
                  <td><b>{row.week}</b></td>
                  <td>{row.reviewed}</td>
                  <td>{formatRate(row.overallClassificationAccuracy)}</td>
                  <td>{formatRate(row.serviceAccuracy)}</td>
                  <td>{formatRate(row.priorityAccuracy)}</td>
                  <td>{formatRate(row.p1Precision)}</td>
                  <td>{formatRate(row.p1Recall)}</td>
                  <td>{formatRate(row.aiRecommendationAcceptanceRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>尚無足夠的 MIS Reviewed 資料形成每週 KPI 趨勢。</div>
      )}
    </article>
  );
}

function MisclassificationTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: MisclassificationRow[];
}) {
  return (
    <article className={styles.breakdownCard}>
      <div className={styles.cardHead}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Reviewed</th>
                <th>Errors</th>
                <th>Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.dimension}>
                  <td><b>{row.dimension}</b></td>
                  <td>{row.reviewed}</td>
                  <td>{row.errors}</td>
                  <td>{formatRate(row.errorRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>目前沒有已覆核的誤判資料。</div>
      )}
    </article>
  );
}

function BreakdownTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: BreakdownRow[];
}) {
  return (
    <article className={styles.breakdownCard}>
      <div className={styles.cardHead}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Reviewed</th>
                <th>Correct</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.dimension || "unknown"}>
                  <td><b>{row.dimension || "unknown"}</b></td>
                  <td>{Number(row.reviewed || 0)}</td>
                  <td>{Number(row.correct || 0)}</td>
                  <td>{formatRate(accuracy(row))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>尚無已完成 MIS 覆核的 breakdown 資料。</div>
      )}
    </article>
  );
}
