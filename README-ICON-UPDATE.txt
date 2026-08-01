AI MIS Ops Center 圖示優化版

本次修改：
1. AI 報修區改用全息 AI 智慧核心 SVG。
2. 服務狀態改用 Microsoft 365 四色品牌識別、公司網路、VPN、ERP 專用圖示。
3. 四張 KPI 卡片改用獨立 3D 科技 SVG 圖示。
4. 保留既有 React、D1、RBAC、工單與後端程式邏輯。

主要修改檔案：
- app/page.tsx
- app/globals.css
- public/ui/ai-core.svg
- public/ui/service-microsoft365.svg
- public/ui/service-network.svg
- public/ui/service-vpn.svg
- public/ui/service-erp.svg
- public/ui/kpi-all-tickets.svg
- public/ui/kpi-my-tickets.svg
- public/ui/kpi-processing.svg
- public/ui/kpi-high-priority.svg

注意：原始上傳壓縮檔沒有 package.json、package-lock.json、vite.config.ts 與 wrangler 設定檔，因此無法在此執行 npm build。此次未改動或虛構這些環境設定。
