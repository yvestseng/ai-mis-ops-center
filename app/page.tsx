"use client";

import { useEffect, useMemo, useState } from "react";

const initialTickets = [
  ["INC-20260718-0123", "筆電無法連線公司 Wi-Fi", "王小明", "AI 報修", "高", "09:15", "張志豪"],
  ["INC-20260718-0119", "無法存取檔案伺服器", "林佳穎", "表單報修", "中", "08:47", "李柏翰"],
  ["INC-20260718-0112", "Outlook 無法同步郵件", "陳思穎", "AI 報修", "中", "08:21", "吳宜庭"],
  ["INC-20260718-0107", "VPN 連線不穩定", "黃致遠", "AI 報修", "高", "07:52", "張志豪"],
  ["INC-20260718-0098", "印表機離線無法列印", "周子涵", "表單報修", "低", "07:31", "劉又誠"],
];

const nav = [
  ["▦", "營運總覽"], ["✦", "AI 資訊報修"], ["▤", "我的工單"],
  ["▥", "設備與服務"], ["♢", "資安監控"], ["◫", "服務治理"],
  ["♙", "權限管理"], ["⚙", "系統設定"],
];

const modules = ["營運總覽", "AI 資訊報修", "工單管理", "設備與服務", "資安監控", "服務治理", "權限管理", "系統設定"];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button>;
}

function PermissionConsole() {
  const [users, setUsers] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("mis-users");
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return [
      { name: "TW_YVES", email: "tsengs@twmns.com", role: "系統管理人員", enabled: true },
      { name: "MIS Service Desk", email: "mis-helpdesk@company.com", role: "維運人員", enabled: true },
    ];
  });
  const [roles, setRoles] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("mis-roles");
      if (saved) try { return JSON.parse(saved); } catch {}
    }
    return { 管理人員: modules, 維運人員: modules.slice(0, 5), 一般使用者: modules.slice(0, 3) };
  });
  const [selectedRole, setSelectedRole] = useState<keyof typeof roles>("管理人員");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const filtered = users.filter(u => `${u.name}${u.email}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { window.localStorage.setItem("mis-users", JSON.stringify(users)); }, [users]);
  useEffect(() => { window.localStorage.setItem("mis-roles", JSON.stringify(roles)); }, [roles]);
  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function addUser() {
    if (!newEmail.includes("@") || users.some(u => u.email === newEmail)) return flash("請輸入有效且未重複的電子郵件");
    setUsers([...users, { name: newEmail.split("@")[0], email: newEmail, role: "一般使用者", enabled: true }]); setNewEmail(""); setShowAdd(false); flash("使用者已加入授權清單");
  }
  function togglePermission(module: string) {
    const current = roles[selectedRole];
    setRoles({ ...roles, [selectedRole]: current.includes(module) ? current.filter(x => x !== module) : [...current, module] });
  }
  return <section className="management-console">
    <div className="page-heading"><div><span className="eyebrow">ACCESS CONTROL</span><h2>權限管理</h2><p>集中管理授權人員、角色與各模組存取權限。</p></div><div className="toolbar"><button className="secondary" onClick={() => flash("LDAP 同步完成，沒有異動")}>↻ 同步 LDAP</button><button className="primary" onClick={() => setShowAdd(true)}>＋ 新增使用者</button></div></div>
    <div className="admin-stats"><article><b>{users.length}</b><span>授權帳號</span></article><article><b>3</b><span>權限角色</span></article><article><b>{users.filter(u => u.enabled).length}</b><span>啟用中</span></article><article><b>0</b><span>登入異常</span></article></div>
    <div className="manage-grid"><div className="card manage-card"><div className="card-head"><div><h3>使用者帳號</h3><p>只有清單內帳號可以進入系統</p></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋姓名或信箱" aria-label="搜尋使用者" /></div><div className="user-list">{filtered.map(u => <div className="user-row" key={u.email}><span className="mini-avatar">{u.name.slice(0,2).toUpperCase()}</span><div><b>{u.name}</b><small>{u.email}</small></div><select value={u.role} onChange={e => setUsers(users.map(x => x.email === u.email ? {...x, role:e.target.value}:x))}><option>系統管理人員</option><option>維運人員</option><option>一般使用者</option></select><Toggle label={`${u.name} 帳號狀態`} checked={u.enabled} onChange={() => setUsers(users.map(x => x.email === u.email ? {...x, enabled:!x.enabled}:x))}/><button className="icon-action" onClick={() => u.email === "tsengs@twmns.com" ? flash("主要管理人員不可刪除") : setUsers(users.filter(x => x.email !== u.email))} aria-label={`刪除 ${u.name}`}>刪除</button></div>)}</div></div>
      <div className="card manage-card"><div className="card-head"><div><h3>角色功能權限</h3><p>選擇角色後設定可使用的模組</p></div><select value={selectedRole} onChange={e => setSelectedRole(e.target.value as keyof typeof roles)}><option>管理人員</option><option>維運人員</option><option>一般使用者</option></select></div><div className="permission-list">{modules.map(m => <label key={m}><span><b>{m}</b><small>{m === "權限管理" || m === "系統設定" ? "管理功能" : "業務功能"}</small></span><Toggle label={`${selectedRole} ${m}`} checked={roles[selectedRole].includes(m)} onChange={() => togglePermission(m)}/></label>)}</div><div className="card-actions"><button className="secondary" onClick={() => setRoles({...roles, [selectedRole]: []})}>清除</button><button className="primary" onClick={() => flash(`${selectedRole}權限已儲存`)}>儲存權限</button></div></div></div>
    {showAdd && <div className="modal-backdrop"><div className="modal card"><h3>新增授權使用者</h3><p>新增後可指定角色與功能權限。</p><label>公司電子郵件<input autoFocus value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@company.com" /></label><div><button className="secondary" onClick={() => setShowAdd(false)}>取消</button><button className="primary" onClick={addUser}>確認新增</button></div></div></div>}{toast && <div className="toast">✓ {toast}</div>}
  </section>;
}

function SettingsConsole() {
  const [tab, setTab] = useState("一般設定"); const [saved, setSaved] = useState("");
  const [settings, setSettings] = useState(() => {
    const defaults = { siteName:"AI 資訊報修與 MIS 資安監控中心", timezone:"Asia/Taipei", language:"繁體中文", helpdesk:"mis-helpdesk@company.com", ai:true, autoAssign:true, email:true, security:true, daily:true, confidence:"80", session:"8", retention:"180" };
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("mis-settings");
      if (stored) try { return {...defaults, ...JSON.parse(stored)}; } catch {}
    }
    return defaults;
  });
  function save() { window.localStorage.setItem("mis-settings", JSON.stringify(settings)); setSaved("設定已儲存並立即生效"); window.setTimeout(() => setSaved(""), 2400); }
  const set = (key:string, value:string|boolean) => setSettings({...settings, [key]:value});
  return <section className="management-console"><div className="page-heading"><div><span className="eyebrow">SYSTEM CONFIGURATION</span><h2>系統設定</h2><p>管理平台基本資料、AI 自動化、通知與資訊安全原則。</p></div><button className="primary" onClick={save}>儲存所有變更</button></div><div className="settings-layout"><nav className="settings-nav card">{["一般設定","AI 與派工","通知設定","資安設定","系統資訊"].map(x => <button className={tab===x?"active":""} onClick={() => setTab(x)} key={x}>{x}<span>›</span></button>)}</nav><div className="card settings-card">
    {tab === "一般設定" && <><h3>一般設定</h3><p>網站識別與區域設定</p><div className="form-grid"><label className="wide">系統名稱<input value={settings.siteName} onChange={e=>set("siteName",e.target.value)}/></label><label>時區<select value={settings.timezone} onChange={e=>set("timezone",e.target.value)}><option>Asia/Taipei</option><option>Asia/Ho_Chi_Minh</option></select></label><label>預設語言<select value={settings.language} onChange={e=>set("language",e.target.value)}><option>繁體中文</option><option>English</option></select></label><label className="wide">服務台信箱<input value={settings.helpdesk} onChange={e=>set("helpdesk",e.target.value)} /></label></div></>}
    {tab === "AI 與派工" && <><h3>AI 與自動派工</h3><p>控制報修分析與工作分派流程</p><div className="setting-rows"><SettingRow title="AI 自動分類" note="分析問題描述並判斷工單類別" value={settings.ai} onChange={()=>set("ai",!settings.ai)}/><SettingRow title="依技能自動派工" note="依類別、負載與值班表指派負責人" value={settings.autoAssign} onChange={()=>set("autoAssign",!settings.autoAssign)}/><label>最低分類信心值<input type="range" min="50" max="100" value={settings.confidence} onChange={e=>set("confidence",e.target.value)}/><b>{settings.confidence}%</b></label></div></>}
    {tab === "通知設定" && <><h3>通知設定</h3><p>設定事件與工單通知管道</p><div className="setting-rows"><SettingRow title="電子郵件通知" note="工單建立、指派與狀態異動時寄送" value={settings.email} onChange={()=>set("email",!settings.email)}/><SettingRow title="高風險即時告警" note="偵測高風險資安事件時通知管理人員" value={settings.security} onChange={()=>set("security",!settings.security)}/><SettingRow title="每日營運摘要" note="每日 08:30 寄送服務與資安摘要" value={settings.daily} onChange={()=>set("daily",!settings.daily)}/></div></>}
    {tab === "資安設定" && <><h3>資安與稽核</h3><p>管理登入工作階段及操作紀錄</p><div className="form-grid"><label>工作階段逾時（小時）<input type="number" value={settings.session} onChange={e=>set("session",e.target.value)}/></label><label>稽核紀錄保留（天）<input type="number" value={settings.retention} onChange={e=>set("retention",e.target.value)}/></label></div><div className="security-banner"><b>登入保護已啟用</b><span>僅授權帳號可存取，管理操作會記錄帳號與時間。</span></div></>}
    {tab === "系統資訊" && <><h3>系統資訊</h3><p>目前執行環境與服務狀態</p><dl className="system-info"><div><dt>系統版本</dt><dd>v2.1.0</dd></div><div><dt>執行環境</dt><dd>Production</dd></div><div><dt>AI 服務</dt><dd className="ok">● 正常</dd></div><div><dt>最後設定更新</dt><dd>2026/07/18 14:08</dd></div></dl><button className="secondary" onClick={()=>setSaved("連線測試完成：所有服務正常")}>執行服務連線測試</button></>}
    <div className="settings-footer"><span>變更將記錄於系統稽核日誌</span><button className="primary" onClick={save}>儲存設定</button></div></div></div>{saved && <div className="toast">✓ {saved}</div>}</section>;
}

function SettingRow({title,note,value,onChange}:{title:string;note:string;value:boolean;onChange:()=>void}) { return <div><span><b>{title}</b><small>{note}</small></span><Toggle label={title} checked={value} onChange={onChange}/></div> }

type TestState = "待測試" | "測試中" | "通過";

function GovernanceConsole({ onOpen, onEmailTicket }: { onOpen: (title:string, body:string) => void; onEmailTicket: () => void }) {
  const [tab, setTab] = useState("SLA 與派工");
  const [toast, setToast] = useState("");
  const flash = (message:string) => { setToast(message); window.setTimeout(() => setToast(""), 2300); };
  const tabs = ["SLA 與派工", "AI 覆核", "知識庫", "重大事件", "服務評價"];
  const sla = [
    ["P1 緊急", "15 分鐘", "2 小時", "重大資安事件、全公司服務中斷"],
    ["P2 高", "30 分鐘", "4 小時", "多位使用者或部門服務中斷"],
    ["P3 一般", "4 小時", "1 工作日", "單一使用者一般軟硬體問題"],
    ["P4 低", "1 工作日", "3 工作日", "設備申請、軟體安裝與改善建議"],
  ];
  const reviews = [
    ["INC-20260725-003", "疑似釣魚郵件要求重設密碼", "96%", "高風險・資安值班"],
    ["INC-20260725-001", "Outlook 無法收信且顯示同步錯誤", "82%", "P2・系統維運組"],
    ["INC-20260725-006", "VPN 登入後無法進入 ERP", "78%", "待人工確認"],
  ];
  const knowledge = [
    ["Outlook 同步錯誤排查 SOP", "已發布", "使用 42 次・解決成功率 86%"],
    ["VPN 已連線但內部系統不可達", "審核中", "由工單轉為知識草稿"],
    ["釣魚郵件通報與隔離流程", "已發布", "下次複核 2026/08/15"],
  ];
  const incidents = [
    ["Microsoft 365 收信延遲", "候選重大事件", "已關聯 7 張相似工單，影響財務、業務與採購部。"],
    ["總部三樓 Wi-Fi 不穩", "監控中", "近 2 小時新增 4 張工單，建議通知網路組。"],
  ];
  return <section className="management-console governance">
    <div className="page-heading"><div><span className="eyebrow">IT SERVICE GOVERNANCE</span><h2>服務治理中心</h2><p>統一管理 SLA、AI 覆核、知識庫、重大事件與服務品質。</p></div><div className="toolbar"><button className="secondary" onClick={onEmailTicket}>✉ 模擬 Email 建單</button><button className="primary" onClick={() => flash("治理規則檢查完成，未發現衝突")}>執行治理檢查</button></div></div>
    <nav className="governance-tabs card">{tabs.map(x => <button key={x} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>{x}</button>)}</nav>
    {tab === "SLA 與派工" && <div className="governance-grid">{sla.map(([level,response,target,scope]) => <article className="card governance-card" key={level}><span className={`governance-level ${level.slice(0,2).toLowerCase()}`}>{level}</span><dl><div><dt>首次回應</dt><dd>{response}</dd></div><div><dt>處理目標</dt><dd>{target}</dd></div></dl><p>{scope}</p><button className="secondary" onClick={() => onOpen(`${level} SLA 政策`, `首次回應 ${response}，處理目標 ${target}。適用範圍：${scope}。`)}>檢視與調整</button></article>)}</div>}
    {tab === "AI 覆核" && <div className="card governance-list"><div className="card-head"><div><h3>人工覆核佇列</h3><p>低信心、P1/P2 與高風險事件必須人工確認</p></div><span className="queue-count">{reviews.length} 件待處理</span></div>{reviews.map(([id,title,confidence,meta]) => <button key={id} onClick={() => onOpen(id, `${title}。AI 信心 ${confidence}，判定結果：${meta}。請確認分類、優先度及派工對象。`)}><span><b>{id}</b><small>{title}</small></span><em>{confidence}</em><i>{meta}</i><strong>覆核 ›</strong></button>)}</div>}
    {tab === "知識庫" && <div className="card governance-list"><div className="card-head"><div><h3>知識庫治理</h3><p>以解決成功率與複核日期維持內容品質</p></div><button className="primary" onClick={() => flash("已建立新的知識文章草稿")}>新增文章</button></div>{knowledge.map(([title,status,meta]) => <button key={title} onClick={() => onOpen(title, `${status}。${meta}。可在正式串接後編輯內容、送審或發布。`)}><span><b>{title}</b><small>{meta}</small></span><i className={status === "已發布" ? "good" : ""}>{status}</i><strong>管理 ›</strong></button>)}</div>}
    {tab === "重大事件" && <div className="governance-grid incidents">{incidents.map(([title,status,body]) => <article className="card governance-card" key={title}><span className="governance-level p2">{status}</span><h3>{title}</h3><p>{body}</p><div className="card-actions"><button className="secondary" onClick={() => onOpen(title, body)}>檢視關聯工單</button><button className="primary" onClick={() => flash(`${title} 已通知主管確認`)}>通知主管</button></div></article>)}</div>}
    {tab === "服務評價" && <div className="survey-dashboard"><div className="module-summary"><article className="card"><span>系統使用滿意度</span><b>4.4 / 5</b><small>填答率 64%・NPS 42</small></article><article className="card"><span>IT 服務滿意度</span><b>4.6 / 5</b><small>一次解決率 78%</small></article><article className="card"><span>低分待追蹤</span><b>3 件</b><small>2 件已建立改善事項</small></article></div><div className="card survey-form"><h3>結案服務評價</h3><p>模擬使用者完成工單後的服務品質回饋。</p><label>處理速度<input type="range" min="1" max="5" defaultValue="5" /></label><label>問題解決能力<input type="range" min="1" max="5" defaultValue="4" /></label><label>其他建議<textarea defaultValue="工程師說明清楚，處理速度很快。" /></label><button className="primary" onClick={() => flash("服務評價已送出並納入統計")}>送出評價</button></div></div>}
    {toast && <div className="toast">✓ {toast}</div>}
  </section>;
}

function ModuleConsole({ module, tickets, onOpen }: { module: string; tickets: string[][]; onOpen: (title:string, body:string) => void }) {
  const [filter, setFilter] = useState("全部");
  const [testStates, setTestStates] = useState<Record<string, TestState>>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(`mis-tests-${module}`);
      if (stored) try { return JSON.parse(stored); } catch {}
    }
    return {};
  });
  const [toast, setToast] = useState("");
  const flash = (message:string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  useEffect(() => {
    window.localStorage.setItem(`mis-tests-${module}`, JSON.stringify(testStates));
  }, [module, testStates]);
  const runTest = (name:string) => {
    setTestStates(x => ({...x, [name]:"測試中"}));
    window.setTimeout(() => { setTestStates(x => ({...x, [name]:"通過"})); flash(`${name}測試通過`); }, 650);
  };
  const runAll = (items:string[]) => {
    items.forEach(name => setTestStates(x => ({...x, [name]:"測試中"})));
    window.setTimeout(() => { setTestStates(Object.fromEntries(items.map(x => [x,"通過"]))); flash("全部功能測試通過"); }, 850);
  };

  const definitions: Record<string, { kicker:string; title:string; description:string; tests:string[] }> = {
    "AI 資訊報修": { kicker:"AI SERVICE DESK", title:"AI 資訊報修", description:"輸入問題、完成 AI 分析，確認後直接建立並追蹤工單。", tests:["AI 分類引擎","優先級判斷","自動派工","通知服務"] },
    "我的工單": { kicker:"TICKET WORKSPACE", title:"我的工單", description:"查詢、篩選與更新目前負責或提出的資訊服務工單。", tests:["工單查詢","狀態更新","指派流程","歷程紀錄"] },
    "設備與服務": { kicker:"ASSET & SERVICE", title:"設備與服務", description:"集中查看端點設備、企業服務健康度與維護狀態。", tests:["資產連線","服務探測","保固資料","遠端管理"] },
    "資安監控": { kicker:"SECURITY OPERATIONS", title:"資安監控", description:"檢視風險事件、告警分級、調查狀態及處置流程。", tests:["Wazuh 事件","異常登入","弱點掃描","告警通知"] },
  };
  const def = definitions[module];
  if (!def) return null;

  const records = module === "我的工單" ? tickets.map((x,i) => ({name:x[0], detail:x[1], meta:`${x[4]}優先・${x[6]}`, status:i < 2 ? "處理中":"待處理"}))
    : module === "設備與服務" ? [
      {name:"Microsoft 365",detail:"郵件、Teams、SharePoint",meta:"可用率 99.99%",status:"正常"},
      {name:"公司網路",detail:"核心交換器與無線網路",meta:"延遲 8 ms",status:"正常"},
      {name:"VPN Gateway",detail:"遠端存取服務",meta:"延遲偏高",status:"注意"},
      {name:"ERP Production",detail:"企業資源管理系統",meta:"最後檢查 1 分鐘前",status:"正常"}]
    : module === "資安監控" ? [
      {name:"異常登入嘗試",detail:"非辦公地區連續登入失敗",meta:"12 個事件",status:"高風險"},
      {name:"端點高風險弱點",detail:"需安排修補與重新掃描",meta:"7 台設備",status:"待處置"},
      {name:"惡意郵件攔截",detail:"郵件閘道已完成隔離",meta:"5 封郵件",status:"已阻擋"},
      {name:"防火牆規則稽核",detail:"本週設定基準比對完成",meta:"0 個異常",status:"正常"}]
    : [
      {name:"無法連線公司 Wi-Fi",detail:"AI 判定：網路連線／高優先",meta:"建議指派網路維運組",status:"待確認"},
      {name:"Outlook 無法同步",detail:"AI 判定：Microsoft 365／中優先",meta:"建議指派系統維運組",status:"待確認"},
      {name:"VPN 經常斷線",detail:"AI 判定：遠端連線／高優先",meta:"已完成初步診斷",status:"可建立"}];
  const shown = filter === "全部" ? records : records.filter(x => x.status === filter);

  return <section className="module-console">
    <div className="page-heading"><div><span className="eyebrow">{def.kicker}</span><h2>{def.title}</h2><p>{def.description}</p></div><button className="primary" onClick={() => runAll(def.tests)}>▶ 執行全部測試</button></div>
    <div className="module-summary">
      <article className="card"><span>今日資料</span><b>{records.length * 4 + 3}</b><small>資料同步正常</small></article>
      <article className="card"><span>待處理</span><b>{Math.max(2, records.length - 1)}</b><small>依優先級排序</small></article>
      <article className="card"><span>服務健康度</span><b>99.9%</b><small className="ok">● 運作正常</small></article>
    </div>
    <div className="module-grid">
      <div className="card record-panel"><div className="card-head"><div><h3>{module === "設備與服務" ? "服務清單" : module === "資安監控" ? "最新事件" : "工作項目"}</h3><p>點選資料可開啟詳細內容與操作</p></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>全部</option>{[...new Set(records.map(x=>x.status))].map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="record-list">{shown.map(x=><button key={x.name} onClick={()=>onOpen(x.name, `${x.detail}。${x.meta}。目前狀態：${x.status}。你可以在正式串接後於此執行指派、更新、調查或處置。`)}><span><b>{x.name}</b><small>{x.detail}</small></span><em>{x.meta}</em><i className={x.status.includes("正常")||x.status.includes("阻擋")||x.status.includes("建立")?"good":""}>{x.status}</i><strong>›</strong></button>)}</div>
      </div>
      <div className="card test-panel"><div className="card-head"><div><h3>功能測試中心</h3><p>逐項確認模組功能是否可正常執行</p></div></div>
        {def.tests.map(name => <div className="test-row" key={name}><span className={`test-dot ${testStates[name] === "通過" ? "pass":testStates[name] === "測試中" ? "running":""}`}/><div><b>{name}</b><small>{testStates[name] || "待測試"}</small></div><button className="secondary" disabled={testStates[name] === "測試中"} onClick={()=>runTest(name)}>{testStates[name] === "通過" ? "重新測試":"開始測試"}</button></div>)}
      </div>
    </div>{toast && <div className="toast">✓ {toast}</div>}
  </section>;
}

export default function Home() {
  const [active, setActive] = useState("營運總覽");
  const [tickets, setTickets] = useState<string[][]>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("mis-tickets");
      if (stored) try { return JSON.parse(stored); } catch {}
    }
    return initialTickets;
  });
  const [issue, setIssue] = useState("我的筆電連不上公司 Wi-Fi，從早上開始一直斷線");
  const [diagnosis, setDiagnosis] = useState(false);
  const [formMode, setFormMode] = useState(false);
  const [requester, setRequester] = useState("TW_YVES");
  const [category, setCategory] = useState("自動判斷");
  const [notice, setNotice] = useState(false);
  const [noticeCount, setNoticeCount] = useState(3);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<{title:string;body:string}|null>(null);
  const count = issue.length;
  const aiResult = useMemo(() => ({ category: "網路連線", priority: issue.includes("斷線") ? "高" : "中", team: "網路維運組" }), [issue]);
  useEffect(() => { window.localStorage.setItem("mis-tickets", JSON.stringify(tickets)); }, [tickets]);

  function diagnose() {
    if (!issue.trim()) return flash("請先輸入問題描述");
    setDiagnosis(true);
  }
  function flash(message:string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function simulateEmailTicket() {
    const id = `INC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(124 + tickets.length).padStart(4,"0")}`;
    const row = [id, "Email 自動建單：Outlook 郵件同步異常", "財務部 王小姐", "Email 自動建單", "高", new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}), "系統維運組"];
    setTickets([row, ...tickets]);
    setNoticeCount(x => x + 1);
    flash(`已擷取報修信箱郵件並建立工單 ${id}`);
  }
  function createTicket() {
    const id = `INC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${String(124 + tickets.length).padStart(4,"0")}`;
    const row = [id, issue.trim(), requester, formMode ? "表單報修" : "AI 報修", aiResult.priority, new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}), aiResult.team];
    setTickets([row, ...tickets]);
    setDiagnosis(false); setIssue(""); setFormMode(false);
    flash(`工單 ${id} 已建立並指派給 ${aiResult.team}`);
  }
  const searchResults = search.trim() ? tickets.filter(x => x.join(" ").toLowerCase().includes(search.toLowerCase())).slice(0,5) : [];

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="主要導覽">
        <div className="brand"><span className="brandmark">A</span><div><strong>AI 資訊報修與</strong><b>MIS 維運／資安監控中心</b></div></div>
        <nav>{nav.map(([icon, label]) => <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)}><span>{icon}</span>{label}</button>)}</nav>
        <div className="sidebar-foot"><span className="online-dot" /> 系統連線正常<small>最後更新 11:42</small></div>
      </aside>

      <section className="workspace">
        <header>
          <div><h1>早安，Yves</h1><p>資訊服務與資安狀態一目掌握</p></div>
          <div className="header-tools"><label className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="搜尋" placeholder="搜尋工單、設備或服務…" /></label><span className="access-badge"><i />已安全登入</span><button className="bell" onClick={() => setNotice(!notice)} aria-label="通知">♢{noticeCount > 0 && <i>{noticeCount}</i>}</button><button className="profile-button" onClick={() => setProfile(!profile)} aria-label="開啟管理人員選單"><span className="avatar">YT</span><span className="profile-copy"><b>TW_YVES</b><small>系統管理人員</small></span><span>⌄</span></button></div>
          {search.trim() && <div className="search-results"><strong>搜尋結果</strong>{searchResults.length ? searchResults.map(row=><button key={row[0]} onClick={()=>{setDetail({title:row[0],body:`${row[1]}，申請人 ${row[2]}，指派對象 ${row[6]}。`});setSearch("");}}><b>{row[0]}</b><span>{row[1]}</span></button>) : <p>找不到相符工單</p>}</div>}
          {notice && <div className="notice"><strong>最新通知</strong><button onClick={()=>{setActive("設備與服務");setNotice(false)}}>VPN 閘道偵測到異常延遲</button><button onClick={()=>{setActive("資安監控");setNotice(false)}}>3 件高風險事件待確認</button><button className="read-all" onClick={()=>{setNoticeCount(0);setNotice(false);flash("通知已全部標示為已讀")}}>全部標示為已讀</button></div>}
          {profile && <div className="profile-menu"><div><span className="avatar">YT</span><p><strong>TW_YVES</strong><small>tsengs@twmns.com</small></p></div><span className="role-row"><b>角色</b><em>管理人員</em></span><button onClick={() => setActive("權限管理")}>管理帳號與權限</button><a href="/signout-with-chatgpt?return_to=/">安全登出</a></div>}
        </header>

        <div className={`dashboard ${active !== "營運總覽" ? "admin-mode" : ""}`}>
          {active === "權限管理" && <PermissionConsole />}
          {active === "系統設定" && <SettingsConsole />}
          {active === "服務治理" && <GovernanceConsole onOpen={(title,body)=>setDetail({title,body})} onEmailTicket={simulateEmailTicket} />}
          {["我的工單","設備與服務","資安監控"].includes(active) && <ModuleConsole key={active} module={active} tickets={tickets} onOpen={(title,body)=>setDetail({title,body})}/>}
          <section className="ai-card card">
            <div className="ai-copy"><span className="eyebrow">AI SERVICE DESK</span><h2>用一句話，讓 AI 幫你報修</h2><p>描述問題，AI 將自動分類、判斷優先級並指派負責人</p>
              {formMode && <div className="form-inline"><label>申請人<input value={requester} onChange={e=>setRequester(e.target.value)}/></label><label>問題類別<select value={category} onChange={e=>setCategory(e.target.value)}><option>自動判斷</option><option>網路</option><option>帳號權限</option><option>軟體</option><option>硬體</option></select></label></div>}
              <label className="issue-box"><textarea value={issue} maxLength={200} onChange={e => {setIssue(e.target.value); setDiagnosis(false)}} aria-label="問題描述" placeholder="請描述設備、錯誤訊息及發生時間" /><span>{count}/200</span></label>
              <div className="actions"><button className="primary" onClick={diagnose}>✦ 開始 AI 診斷</button><button className="link" onClick={() => {setFormMode(!formMode);setDiagnosis(false)}}>{formMode ? "返回 AI 快速報修" : "改用完整表單報修"} ›</button></div>
              <div className="suggestions">試試這些：{["無法登入", "網路異常", "軟體安裝"].map(x => <button key={x} onClick={() => setIssue(x)}>{x}</button>)}</div>
              {diagnosis && <div className="diagnosis"><span>AI 分析完成</span><b>{category === "自動判斷" ? aiResult.category : category}</b><b className="warn">{aiResult.priority}優先</b><b>{aiResult.team}</b><button onClick={createTicket}>建立工單</button></div>}
            </div>
            <div className="ai-visual" aria-hidden="true"><div className="orb"><span>AI</span></div><i className="ring r1"/><i className="ring r2"/><i className="node n1"/><i className="node n2"/><i className="node n3"/></div>
          </section>

          <section className="service-card card"><div className="section-title"><h2>服務狀態</h2><span className="healthy"><i/>整體運作正常</span></div><div className="service-body"><div className="availability"><div><strong>99.94%</strong><span>可用率</span><small>過去 7 天</small></div></div><div className="services">{[["◎","Microsoft 365","正常"],["⌁","公司網路","正常"],["♧","VPN","部分異常"],["▱","ERP","正常"]].map(([i,n,s]) => <button key={n} onClick={()=>setDetail({title:n,body:`${n}目前狀態：${s}。最近一次健康檢查已完成，可前往設備與服務模組執行連線測試。`})}><b>{i}</b><span>{n}</span><em className={s !== "正常" ? "degraded" : ""}>{s}</em><i>›</i></button>)}</div></div><button className="more" onClick={()=>setActive("設備與服務")}>查看服務狀態詳情 ›</button></section>

          <section className="metrics">{[["▣","待處理工單","12","較昨日 ↓ 3","blue"],["＋","今日新增","8","較昨日 ↑ 2","cyan"],["◷","平均回應","6 分鐘","較昨日 ↓ 2 分鐘","cyan"],["♢","高風險事件","3","較昨日 ↑ 1","red"]].map(([i,l,v,d,c]) => <article className="card metric" key={l}><span className={`metric-icon ${c}`}>{i}</span><div><p>{l}</p><strong>{v}</strong><small className={d.includes("↑") ? "up" : "down"}>{d}</small></div></article>)}</section>

          <section className="tickets card"><div className="section-title"><h2>待處理工單</h2><button onClick={()=>setActive("我的工單")}>查看全部 ›</button></div><div className="table-wrap"><table><thead><tr>{["工單編號","標題","申請人","來源","優先級","建立時間","指派對象"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{tickets.map(row => <tr key={row[0]} onClick={()=>setDetail({title:row[0],body:`${row[1]}，申請人 ${row[2]}，目前指派給 ${row[6]}。`})}>{row.map((v,i)=><td key={i}>{i===0?<a>{v}</a>:i===4?<span className={`priority p-${v}`}>{v}</span>:v}</td>)}</tr>)}</tbody></table></div></section>

          <section className="risk card"><div className="section-title"><h2>資安風險摘要</h2><button onClick={()=>setActive("資安監控")}>查看資安監控 ›</button></div><div className="risk-grid"><div className="chart"><p>風險事件趨勢（近 7 天）</p><div className="chart-area"><span className="y y40">40</span><span className="y y20">20</span><span className="y y0">0</span><svg viewBox="0 0 420 150" role="img" aria-label="近七日風險事件由17件上升至36件"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80ff" stopOpacity=".3"/><stop offset="1" stopColor="#2f80ff" stopOpacity="0"/></linearGradient></defs><path d="M20 105 L80 78 L140 103 L200 88 L260 72 L320 55 L390 25 L390 130 L20 130Z" fill="url(#fill)"/><polyline points="20,105 80,78 140,103 200,88 260,72 320,55 390,25" fill="none" stroke="#1769e0" strokeWidth="3"/>{[[20,105],[80,78],[140,103],[200,88],[260,72],[320,55],[390,25]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5" fill="#fff" stroke="#1769e0" strokeWidth="3"/>)}</svg><div className="dates"><span>7/12</span><span>7/13</span><span>7/14</span><span>7/15</span><span>7/16</span><span>7/17</span><span>7/18</span></div></div></div><div className="risks"><p>主要風險項目</p>{[["●","異常登入嘗試","多次失敗登入來自非辦公地區","12","critical"],["◉","弱點掃描待修補","部分端點存在高風險弱點","7","warning"],["✉","惡意郵件偵測","可疑郵件已攔截","5","mail"]].map(([i,t,s,n,c])=><button key={t} className={c} onClick={()=>setDetail({title:t,body:`${s}，目前共 ${n} 個事件。可前往資安監控模組進行調查及處置。`})}><i>{i}</i><span><b>{t}</b><small>{s}</small></span><em>{n}</em></button>)}</div></div></section>
        </div>
        {detail && <div className="modal-backdrop" onMouseDown={()=>setDetail(null)}><div className="modal card detail-modal" onMouseDown={e=>e.stopPropagation()}><span className="eyebrow">DETAIL & ACTION</span><h3>{detail.title}</h3><p>{detail.body}</p><label className="action-note">處理備註<textarea placeholder="輸入本次測試或處置結果"/></label><div className="detail-actions"><button className="secondary" onClick={()=>setDetail(null)}>關閉</button><button className="secondary" onClick={()=>{setDetail(null);flash(`${detail.title} 已轉派給第二線維運`)}}>轉派處理</button><button className="primary" onClick={()=>{setDetail(null);flash(`${detail.title} 已完成測試並寫入操作紀錄`)}}>完成測試</button></div></div></div>}
        {toast && <div className="toast">✓ {toast}</div>}
      </section>
    </main>
  );
}
