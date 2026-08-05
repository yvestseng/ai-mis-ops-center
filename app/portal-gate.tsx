"use client";

import { useEffect, useState } from "react";
import WorkspaceHome from "./workspace-home";
import type { SessionUser } from "./admin-data-console";

type Portal = "user" | "admin";

function allowed(portal: Portal, user: SessionUser) {
  return portal === "user" ? user.roleCode === "user" : user.roleCode === "admin" || user.roleCode === "operator";
}

export function PortalLogin({ portal }: { portal: Portal }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const userPortal = portal === "user";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, portal }),
      });
      const result = await response.json() as { message?: string; user?: SessionUser };
      if (!response.ok || !result.user) throw new Error(result.message || "登入失敗。");
      window.location.assign(userPortal ? "/user" : "/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    } finally { setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-intro"><div className="login-brand"><span className="brandmark">A</span><span><strong>AI 資訊報修</strong><small>MIS 維運／資安監控中心</small></span></div><div className="login-message"><span className="login-kicker">{userPortal ? "USER SERVICE PORTAL" : "ADMIN OPERATIONS PORTAL"}</span><h1>{userPortal ? "資訊服務，\n隨時可追蹤。" : "維運治理，\n集中可掌握。"}</h1><p>{userPortal ? "建立 AI 報修、查詢自己的工單，並回饋服務品質。" : "處理工單、服務資產、權限與稽核作業。"}</p></div></section>
    <section className="login-panel"><div className="login-card"><span className="login-shield">✓</span><div><span className="eyebrow">{userPortal ? "USER LOGIN" : "ADMIN LOGIN"}</span><h2>{userPortal ? "使用者前台登入" : "管理後台登入"}</h2><p>{userPortal ? "僅限一般使用者帳號。" : "限系統管理員與 MIS 維運人員。"}</p></div><form className="login-form" onSubmit={(event) => void submit(event)}><label>登入帳號<div className="login-input"><span>◎</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label><label>密碼<div className="login-input"><span>●</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>{message && <div className="login-error" role="alert"><b>無法登入</b><span>{message}</span></div>}<button className="login-submit" disabled={loading}>{loading ? "正在驗證…" : "安全登入"} <span>→</span></button></form><p className="login-security">{userPortal ? <>管理或維運人員？請由 <a href="/admin/login">管理後台登入</a></> : <>一般使用者？請由 <a href="/user/login">使用者前台登入</a></>}</p></div></section>
  </main>;
}

export function PortalWorkspace({ portal }: { portal: Portal }) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/session", { credentials: "include", cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() as { user?: SessionUser } }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (!response.ok || !result.user || !allowed(portal, result.user)) {
          void fetch("/api/auth/logout", { method: "POST", credentials: "include" });
          window.location.replace(portal === "user" ? "/user/login" : "/admin/login");
          setState("denied");
          return;
        }
        setState("allowed");
      })
      .catch(() => { if (!cancelled) { window.location.replace(portal === "user" ? "/user/login" : "/admin/login"); setState("denied"); } });
    return () => { cancelled = true; };
  }, [portal]);
  if (state !== "allowed") return <main className="auth-loading"><span className="brandmark">A</span><p>{state === "loading" ? "正在驗證登入狀態…" : "正在導向登入頁…"}</p></main>;
  return <WorkspaceHome />;
}
