"use client";

import { useEffect, useState } from "react";
import * as QRCode from "qrcode";
import WorkspaceHome from "./workspace-home";
import type { SessionUser } from "./admin-data-console";

type Portal = "user" | "admin";
type MfaStage = "password" | "enroll" | "verify" | "recovery-codes";

type LoginResult = {
  message?: string;
  user?: SessionUser | { displayName?: string; username?: string; roleCode?: string };
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
  challengeToken?: string;
  challengeExpiresAt?: string;
  otpAuthUri?: string;
  manualSecret?: string;
};

type VerifyResult = {
  message?: string;
  user?: SessionUser;
  recoveryCodes?: string[];
  recoveryCodesShownOnce?: boolean;
};

function allowed(portal: Portal, user: SessionUser) {
  return portal === "user"
    ? user.roleCode === "user"
    : user.roleCode === "admin" || user.roleCode === "operator";
}

export function PortalLogin({ portal }: { portal: Portal }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<MfaStage>("password");
  const [challengeToken, setChallengeToken] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingDisplayName, setPendingDisplayName] = useState("");
  const userPortal = portal === "user";

  useEffect(() => {
    if (!otpAuthUri) {
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(otpAuthUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
    })
      .then((value) => {
        if (!cancelled) {
          setQrDataUrl(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("QR Code 產生失敗，請使用下方手動金鑰註冊。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [otpAuthUri]);

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, portal }),
      });
      const result = (await response.json()) as LoginResult;
      if (!response.ok && response.status !== 202) {
        throw new Error(result.message || "登入失敗。");
      }
      if (result.mfaRequired) {
        if (!result.challengeToken) throw new Error("MFA 驗證要求格式不完整，請重新登入。");
        setChallengeToken(result.challengeToken);
        setPendingDisplayName(result.user?.displayName || username);
        setQrDataUrl("");
        setOtpAuthUri(result.otpAuthUri || "");
        setManualSecret(result.manualSecret || "");
        setStage(result.mfaEnrollmentRequired ? "enroll" : "verify");
        setMessage(result.message || "請完成多因素驗證。");
        return;
      }
      if (!result.user || !("id" in result.user)) throw new Error(result.message || "登入失敗。");
      window.location.assign(userPortal ? "/user" : "/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          ...(useRecovery ? { recoveryCode } : { code: mfaCode }),
        }),
      });
      const result = (await response.json()) as VerifyResult;
      if (!response.ok || !result.user) throw new Error(result.message || "MFA 驗證失敗。");
      if (result.recoveryCodes?.length) {
        setRecoveryCodes(result.recoveryCodes);
        setStage("recovery-codes");
        setMessage("MFA 已啟用。請立即保存備援碼；離開此頁後系統不會再次顯示。");
        return;
      }
      window.location.assign(userPortal ? "/user" : "/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MFA 驗證失敗。");
    } finally {
      setLoading(false);
    }
  }

  function resetLogin() {
    setStage("password");
    setChallengeToken("");
    setOtpAuthUri("");
    setManualSecret("");
    setQrDataUrl("");
    setMfaCode("");
    setRecoveryCode("");
    setRecoveryCodes([]);
    setUseRecovery(false);
    setPassword("");
    setMessage("");
  }

  const loginHeading = userPortal ? "使用者前台登入" : "管理後台登入";

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <span className="brandmark">A</span>
          <span><strong>AI 資訊報修</strong><small>MIS 維運／資安監控中心</small></span>
        </div>
        <div className="login-message">
          <span className="login-kicker">{userPortal ? "USER SERVICE PORTAL" : "ADMIN OPERATIONS PORTAL"}</span>
          <h1>{userPortal ? "資訊服務，\n隨時可追蹤。" : "維運治理，\n集中可掌握。"}</h1>
          <p>{userPortal ? "建立 AI 報修、查詢自己的工單，並回饋服務品質。" : "管理與 MIS 維運帳號已強制啟用 TOTP 多因素驗證。"}</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="login-shield">{stage === "password" ? "✓" : "2"}</span>
          {stage === "password" && (
            <>
              <div><span className="eyebrow">{userPortal ? "USER LOGIN" : "ADMIN LOGIN + MFA"}</span><h2>{loginHeading}</h2><p>{userPortal ? "僅限一般使用者帳號。" : "限系統管理員與 MIS 維運人員；密碼正確後仍須完成 MFA。"}</p></div>
              <form className="login-form" onSubmit={(event) => void submitPassword(event)}>
                <label>登入帳號<div className="login-input"><span>◎</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label>
                <label>密碼<div className="login-input"><span>●</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
                {message && <div className="login-error" role="alert"><b>無法登入</b><span>{message}</span></div>}
                <button className="login-submit" disabled={loading}>{loading ? "正在驗證…" : "安全登入"} <span>→</span></button>
              </form>
            </>
          )}

          {stage === "enroll" && (
            <>
              <div><span className="eyebrow">MFA ENROLLMENT</span><h2>註冊驗證器</h2><p>{pendingDisplayName}，請使用 Microsoft Authenticator 或 Google Authenticator 掃描 QR Code。</p></div>
              {qrDataUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="mfa-qr" src={qrDataUrl} alt="TOTP MFA 註冊 QR Code" />
                </>
              )}
              <div className="mfa-secret"><small>無法掃描時可手動輸入</small><code>{manualSecret}</code></div>
              <form className="login-form" onSubmit={(event) => void submitMfa(event)}>
                <label>6 位數驗證碼<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
                {message && <div className="login-error" role="status"><b>MFA 註冊</b><span>{message}</span></div>}
                <button className="login-submit" disabled={loading || mfaCode.length !== 6}>{loading ? "正在驗證…" : "驗證並啟用 MFA"} <span>→</span></button>
              </form>
              <button className="secondary" type="button" onClick={resetLogin}>重新登入</button>
            </>
          )}

          {stage === "verify" && (
            <>
              <div><span className="eyebrow">MFA CHALLENGE</span><h2>多因素驗證</h2><p>{pendingDisplayName}，請輸入驗證器目前顯示的 6 位數代碼。</p></div>
              <form className="login-form" onSubmit={(event) => void submitMfa(event)}>
                {!useRecovery ? (
                  <label>6 位數驗證碼<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
                ) : (
                  <label>一次性備援碼<input required autoComplete="off" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value.toUpperCase().slice(0, 32))} /></label>
                )}
                {message && <div className="login-error" role="status"><b>MFA 驗證</b><span>{message}</span></div>}
                <button className="login-submit" disabled={loading}>{loading ? "正在驗證…" : "完成登入"} <span>→</span></button>
              </form>
              <button className="secondary" type="button" onClick={() => { setUseRecovery(!useRecovery); setMessage(""); }}>{useRecovery ? "改用驗證器代碼" : "使用備援碼"}</button>
              <button className="secondary" type="button" onClick={resetLogin}>重新登入</button>
            </>
          )}

          {stage === "recovery-codes" && (
            <>
              <div><span className="eyebrow">RECOVERY CODES</span><h2>保存一次性備援碼</h2><p>每組備援碼只能使用一次。請存放於安全的密碼管理工具，不要寄給他人。</p></div>
              <div className="mfa-recovery-list" aria-label="MFA 備援碼">
                {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
              </div>
              {message && <div className="login-error" role="status"><b>重要</b><span>{message}</span></div>}
              <button className="login-submit" type="button" onClick={() => window.location.assign(userPortal ? "/user" : "/admin")}>我已安全保存，進入系統 <span>→</span></button>
            </>
          )}

          <p className="login-security">{userPortal ? <>管理或維運人員？請由 <a href="/admin/login">管理後台登入</a></> : <>一般使用者？請由 <a href="/user/login">使用者前台登入</a></>}</p>
        </div>
      </section>
    </main>
  );
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
