"use client";

import { useEffect } from "react";

/**
 * The root URL deliberately contains no login form.  Authentication starts
 * only at /user/login or /admin/login, where the portal is enforced again by
 * the server before a session can be issued.
 */
export default function RootPage() {
  useEffect(() => {
    window.location.replace("/user/login");
  }, []);

  return (
    <main className="auth-loading" aria-label="正在導向使用者登入頁">
      <span className="brandmark">A</span>
      <p>請由指定入口登入系統…</p>
    </main>
  );
}
