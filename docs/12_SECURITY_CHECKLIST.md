# 12 Security Checklist

- [ ] `.dev.vars` / secret 不在 Release ZIP
- [ ] Production `AUTH_ALLOW_DEMO=false`
- [ ] Login Rate Limit regression PASS
- [ ] Cross Portal negative tests PASS
- [ ] API permission negative tests PASS
- [ ] Password metadata migration 0030 applied
- [ ] 新/重設密碼使用 100,000 PBKDF2 iterations
- [ ] Legacy 10,000 accounts可透明升級
- [ ] HttpOnly / SameSite / Secure cookie 檢查
- [ ] CSP / X-Frame-Options / nosniff 檢查
- [ ] Secret scan
- [ ] Production Smoke PASS

目前 100,000 是 Cloudflare Worker CPU 限制下的 bounded hardening baseline；未來提高成本前需 benchmark，或遷移 Entra ID / 適合的集中式 Identity Provider。
