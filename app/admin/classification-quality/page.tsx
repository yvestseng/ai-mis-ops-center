"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Target,
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

type KpiResponse = {
  baseline: Baseline;
  priorityBreakdown: BreakdownRow[];
  serviceBreakdown: BreakdownRow[];
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
  return value == null ? "尚無資料" : `${Math.round(value * 1000) / 10}%`;
}

function statusFor(value: number | null, target?: number) {
  if (value == null) return { label: "觀察", className: styles.watch };
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
    void load();
  }, [load]);

  const reviewedCoverage = useMemo(() => {
    if (!data?.baseline.totalCaptured) return 0;
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
                  <span style={{ width: `${Math.min(reviewedCoverage * 100, 100)}%` }} />
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
