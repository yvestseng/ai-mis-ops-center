"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import styles from "./classification-review-workbench.module.css";

type ReviewListItem = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  title: string;
  suggestedPriority: string;
  finalPriority: string | null;
  suggestedServiceKey: string;
  finalServiceKey: string | null;
  suggestedImpactLevel: string;
  finalImpactLevel: string | null;
  suggestedConfidence: number | string | null;
  suggestedReviewRequired: number | string | null;
  reviewResult: "accepted" | "modified" | null;
  overallCorrect: number | string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewDetail = ReviewListItem & {
  suggestedWorkType: string;
  suggestedTeamId: string | null;
  suggestedServiceState: string | null;
  finalWorkType: string | null;
  finalTeamId: string | null;
  workTypeCorrect: number | null;
  priorityCorrect: number | null;
  serviceCorrect: number | null;
  teamCorrect: number | null;
  impactCorrect: number | null;
  reviewReason: string | null;
};

type SupportTeam = {
  id: string;
  teamCode: string;
  teamName: string;
  description?: string | null;
};

type ReviewDraft = {
  finalWorkType: string;
  finalServiceKey: string;
  finalTeamId: string;
  finalPriority: string;
  finalImpactLevel: string;
  reviewReason: string;
};

type Filter = "pending" | "reviewed" | "all";

const workTypes = [
  { value: "incident", label: "Incident / 事件" },
  { value: "request", label: "Request / 服務申請" },
  { value: "unknown", label: "Unknown / 待判定" },
];
const priorities = ["P1", "P2", "P3", "P4"];
const impacts = [
  "company_wide",
  "site_wide",
  "department",
  "multiple_users",
  "single_user",
  "unknown",
];

function confidenceLabel(value: number | string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "N/A";
}

function formatTime(value: string | null) {
  if (!value) return "尚未覆核";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-TW");
}

function draftFromReview(review: ReviewDetail): ReviewDraft {
  return {
    finalWorkType: review.finalWorkType || review.suggestedWorkType || "unknown",
    finalServiceKey: review.finalServiceKey || review.suggestedServiceKey || "unknown",
    finalTeamId: review.finalTeamId ?? review.suggestedTeamId ?? "",
    finalPriority: review.finalPriority || review.suggestedPriority || "P3",
    finalImpactLevel: review.finalImpactLevel || review.suggestedImpactLevel || "unknown",
    reviewReason: review.reviewReason || "",
  };
}

export default function ClassificationReviewWorkbenchPage() {
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [selected, setSelected] = useState<ReviewDetail | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reviewResponse, teamResponse] = await Promise.all([
        fetch("/api/classification-reviews", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/support-teams", {
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ]);
      const reviewResult = (await reviewResponse.json()) as {
        reviews?: ReviewListItem[];
        message?: string;
      };
      const teamResult = (await teamResponse.json()) as {
        teams?: SupportTeam[];
        message?: string;
      };
      if (!reviewResponse.ok) throw new Error(reviewResult.message || "分類覆核清單讀取失敗");
      if (!teamResponse.ok) throw new Error(teamResult.message || "維運團隊清單讀取失敗");
      setReviews(reviewResult.reviews || []);
      setTeams(teamResult.teams || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "分類覆核工作台讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleReviews = useMemo(() => reviews.filter((review) => {
    if (filter === "pending") return !review.reviewedAt;
    if (filter === "reviewed") return Boolean(review.reviewedAt);
    return true;
  }), [filter, reviews]);

  const counts = useMemo(() => ({
    all: reviews.length,
    pending: reviews.filter((review) => !review.reviewedAt).length,
    reviewed: reviews.filter((review) => Boolean(review.reviewedAt)).length,
  }), [reviews]);

  const openReview = async (ticketId: string) => {
    setDetailLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/classification-reviews/${encodeURIComponent(ticketId)}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { review?: ReviewDetail; message?: string };
      if (!response.ok || !result.review) throw new Error(result.message || "分類覆核明細讀取失敗");
      setSelected(result.review);
      setDraft(draftFromReview(result.review));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "分類覆核明細讀取失敗");
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReview = async (acceptSuggestion: boolean) => {
    if (!selected || !draft || saving) return;
    const payload: ReviewDraft = acceptSuggestion
      ? {
          finalWorkType: selected.suggestedWorkType,
          finalServiceKey: selected.suggestedServiceKey,
          finalTeamId: selected.suggestedTeamId || "",
          finalPriority: selected.suggestedPriority,
          finalImpactLevel: selected.suggestedImpactLevel,
          reviewReason: "",
        }
      : draft;

    const changed =
      payload.finalWorkType !== selected.suggestedWorkType ||
      payload.finalServiceKey !== selected.suggestedServiceKey ||
      (payload.finalTeamId || null) !== (selected.suggestedTeamId || null) ||
      payload.finalPriority !== selected.suggestedPriority ||
      payload.finalImpactLevel !== selected.suggestedImpactLevel;
    if (changed && !payload.reviewReason.trim()) {
      setError("修改 AI 建議時必須填寫覆核原因。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/classification-reviews/${encodeURIComponent(selected.ticketId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...payload,
          finalTeamId: payload.finalTeamId || null,
          reviewReason: payload.reviewReason.trim() || null,
        }),
      });
      const result = (await response.json()) as { review?: ReviewDetail; message?: string };
      if (!response.ok || !result.review) throw new Error(result.message || "MIS 最終覆核儲存失敗");
      setSelected(result.review);
      setDraft(draftFromReview(result.review));
      setMessage(result.review.reviewResult === "accepted" ? "已接受 AI 建議並建立 ground truth。" : "MIS 修正結果已儲存並建立 ground truth。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "MIS 最終覆核儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> 返回管理中心</Link>
            <span className={styles.eyebrow}>CLASSIFICATION GOVERNANCE</span>
            <h1>Classification Review Workbench</h1>
            <p>由 MIS 將 AI suggested snapshot 轉成可稽核的 final review ground truth，持續建立 Classification KPI Baseline。</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/classification-quality" className={styles.secondaryLink}>查看品質儀表板</Link>
            <button className={styles.refresh} onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} className={loading ? styles.spinning : ""} /> {loading ? "更新中…" : "重新整理"}
            </button>
          </div>
        </header>

        <section className={styles.summaryGrid}>
          <article><BrainCircuit size={20} /><div><b>{counts.all}</b><span>Captured</span><small>Immutable AI snapshots</small></div></article>
          <article><ShieldAlert size={20} /><div><b>{counts.pending}</b><span>待覆核</span><small>尚未形成 MIS ground truth</small></div></article>
          <article><BadgeCheck size={20} /><div><b>{counts.reviewed}</b><span>已覆核</span><small>可納入 Accuracy KPI</small></div></article>
        </section>

        {error && <div className={styles.alert} role="alert"><ShieldAlert size={18} /><span>{error}</span></div>}
        {message && <div className={styles.success}><CheckCircle2 size={18} /><span>{message}</span></div>}

        <section className={styles.workbench}>
          <aside className={styles.queue}>
            <div className={styles.queueHead}>
              <div><span className={styles.eyebrow}>REVIEW QUEUE</span><h2>MIS 分類覆核</h2></div>
              <span>{visibleReviews.length} 筆</span>
            </div>
            <div className={styles.filters}>
              <button className={filter === "pending" ? styles.active : ""} onClick={() => setFilter("pending")}>待覆核 {counts.pending}</button>
              <button className={filter === "reviewed" ? styles.active : ""} onClick={() => setFilter("reviewed")}>已覆核 {counts.reviewed}</button>
              <button className={filter === "all" ? styles.active : ""} onClick={() => setFilter("all")}>全部 {counts.all}</button>
            </div>
            <div className={styles.queueList}>
              {loading && <div className={styles.empty}>正在讀取分類覆核資料…</div>}
              {!loading && visibleReviews.length === 0 && <div className={styles.empty}>目前沒有符合條件的分類覆核資料。</div>}
              {visibleReviews.map((review) => (
                <button
                  key={review.id}
                  className={selected?.ticketId === review.ticketId ? styles.selectedRow : styles.queueRow}
                  onClick={() => void openReview(review.ticketId)}
                >
                  <div className={styles.rowTop}><b>{review.ticketNumber}</b><em>{review.reviewResult || "pending"}</em></div>
                  <strong>{review.title}</strong>
                  <div className={styles.tags}>
                    <span>{review.suggestedPriority}</span><span>{review.suggestedServiceKey}</span><span>{confidenceLabel(review.suggestedConfidence)}</span>
                    {Number(review.suggestedReviewRequired) === 1 && <span className={styles.reviewRequired}>Review Required</span>}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.editor}>
            {!selected && !detailLoading && (
              <div className={styles.placeholder}><ClipboardCheck size={36} /><h2>選擇一筆工單開始覆核</h2><p>左側保留 AI 原始建議；右側輸入 MIS 最終判定。若有修改，覆核原因為必填。</p></div>
            )}
            {detailLoading && <div className={styles.placeholder}>正在讀取覆核明細…</div>}
            {selected && draft && !detailLoading && (
              <>
                <div className={styles.editorHead}>
                  <div><span className={styles.eyebrow}>GROUND TRUTH REVIEW</span><h2>{selected.ticketNumber}</h2><p>{selected.title}</p></div>
                  <div className={styles.reviewMeta}><span>{selected.reviewResult || "尚未覆核"}</span><small>{formatTime(selected.reviewedAt)}</small></div>
                </div>

                <div className={styles.comparisonHead}><span>AI 原始建議</span><span>MIS 最終結果</span></div>
                <ReviewField label="Work Type" suggested={selected.suggestedWorkType}>
                  <select value={draft.finalWorkType} onChange={(event) => setDraft({ ...draft, finalWorkType: event.target.value })}>
                    {workTypes.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                </ReviewField>
                <ReviewField label="Service" suggested={selected.suggestedServiceKey}>
                  <input value={draft.finalServiceKey} onChange={(event) => setDraft({ ...draft, finalServiceKey: event.target.value })} />
                </ReviewField>
                <ReviewField label="Support Team" suggested={teams.find((team) => team.id === selected.suggestedTeamId)?.teamName || selected.suggestedTeamId || "未指派"}>
                  <select value={draft.finalTeamId} onChange={(event) => setDraft({ ...draft, finalTeamId: event.target.value })}>
                    <option value="">未指派</option>
                    {teams.map((team) => <option value={team.id} key={team.id}>{team.teamName} ({team.teamCode})</option>)}
                  </select>
                </ReviewField>
                <ReviewField label="Priority" suggested={selected.suggestedPriority}>
                  <select value={draft.finalPriority} onChange={(event) => setDraft({ ...draft, finalPriority: event.target.value })}>
                    {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </ReviewField>
                <ReviewField label="Impact" suggested={selected.suggestedImpactLevel}>
                  <select value={draft.finalImpactLevel} onChange={(event) => setDraft({ ...draft, finalImpactLevel: event.target.value })}>
                    {impacts.map((impact) => <option key={impact}>{impact}</option>)}
                  </select>
                </ReviewField>

                <label className={styles.reason}>
                  <span>覆核原因 <small>修改任一 AI 建議時必填</small></span>
                  <textarea value={draft.reviewReason} onChange={(event) => setDraft({ ...draft, reviewReason: event.target.value })} placeholder="例如：實際影響為全公司服務中斷，因此 Priority 修正為 P1。" />
                </label>

                <div className={styles.actions}>
                  <button className={styles.accept} disabled={saving} onClick={() => void submitReview(true)}><CheckCircle2 size={17} />接受 AI 建議</button>
                  <button className={styles.save} disabled={saving} onClick={() => void submitReview(false)}><Save size={17} />{saving ? "儲存中…" : "儲存 MIS 最終覆核"}</button>
                </div>
                <p className={styles.immutability}>AI suggested_* 為 immutable snapshot；此工作台只寫入 final_* 與覆核結果，不覆寫原始建議。</p>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function ReviewField({ label, suggested, children }: { label: string; suggested: string; children: React.ReactNode }) {
  return (
    <div className={styles.reviewField}>
      <div><small>{label}</small><strong>{suggested || "unknown"}</strong></div>
      <span className={styles.arrow}>→</span>
      <label><small>MIS Final {label}</small>{children}</label>
    </div>
  );
}
