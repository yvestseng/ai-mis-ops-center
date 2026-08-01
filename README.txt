修正內容：
1. 移除 IT 人員服務調查中的假資料／硬編碼服務人員。
2. 輸入工單編號並離開欄位後，自動查詢該工單實際 assigned_user_id 對應的 app_users.display_name。
3. 服務人員欄位改為唯讀，使用者不能自行選擇或竄改。
4. 工單未結案、非本人提出、或尚未指派實際處理人員時，禁止送出服務調查。
5. 後端送出時再次依 D1 查核實際處理人員，不信任前端傳入值。

覆蓋檔案：
app/page.tsx
worker/surveys.ts

套用後執行：
npm.cmd run lint
npm.cmd run build
git add app/page.tsx worker/surveys.ts
git commit -m "fix: bind service survey to actual assigned engineer"
git push origin main
npx wrangler deploy
