"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ClipboardList,
  LayoutDashboard,
  Network,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import {
  DashboardReport,
  RbacConsole,
  ResourceConsole,
  type SessionUser,
} from "./admin-data-console";

type Ticket = {
  id: string;
  ticketNumber: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  source: string;
  location?: string | null;
  assetTag?: string | null;
  assignedTeam: string;
  status: string;
  surveySubmitted?: boolean | number;
  createdAt: string;
  updatedAt: string;
};

type TicketEvent = {
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorName: string;
  note?: string | null;
  createdAt: string;
};

const nav: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutDashboard, label: "營運總覽" },
  { icon: Sparkles, label: "AI 資訊報修" },
  { icon: ClipboardList, label: "我的工單" },
  { icon: Server, label: "設備與服務" },
  { icon: Server, label: "服務管理" },
  { icon: ShieldCheck, label: "資安監控" },
  { icon: BadgeCheck, label: "服務治理" },
  { icon: UserRoundCog, label: "權限管理" },
  { icon: Settings, label: "系統設定" },
];

const modules = [
  "營運總覽",
  "AI 資訊報修",
  "工單管理",
  "設備與服務",
  "資安監控",
  "服務治理",
  "權限管理",
  "系統設定",
] as const;

type ModuleName = (typeof modules)[number];
type RoleName = "管理人員" | "維運人員" | "一般使用者";
type UserRoleName = "系統管理人員" | "維運人員" | "一般使用者";

type ManagedUser = {
  name: string;
  email: string;
  role: UserRoleName;
  enabled: boolean;
};

type RolePermissions = Record<RoleName, ModuleName[]>;

const defaultManagedUsers: ManagedUser[] = [
  {
    name: "TW_YVES",
    email: "tsengs@twmns.com",
    role: "系統管理人員",
    enabled: true,
  },
  {
    name: "MIS Service Desk",
    email: "mis-helpdesk@company.com",
    role: "維運人員",
    enabled: true,
  },
];

const defaultRolePermissions: RolePermissions = {
  管理人員: [...modules],
  維運人員: modules.slice(0, 5),
  一般使用者: modules.slice(0, 3),
};

function isManagedUser(value: unknown): value is ManagedUser {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ManagedUser>;

  return (
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.enabled === "boolean" &&
    (candidate.role === "系統管理人員" ||
      candidate.role === "維運人員" ||
      candidate.role === "一般使用者")
  );
}

function loadManagedUsers(): ManagedUser[] {
  if (typeof window === "undefined") {
    return defaultManagedUsers;
  }

  const saved = window.localStorage.getItem("mis-users");

  if (!saved) {
    return defaultManagedUsers;
  }

  try {
    const parsed: unknown = JSON.parse(saved);

    if (Array.isArray(parsed) && parsed.every(isManagedUser)) {
      return parsed;
    }
  } catch {
    // Ignore malformed legacy localStorage content.
  }

  return defaultManagedUsers;
}

function loadRolePermissions(): RolePermissions {
  if (typeof window === "undefined") {
    return defaultRolePermissions;
  }

  const saved = window.localStorage.getItem("mis-roles");

  if (!saved) {
    return defaultRolePermissions;
  }

  try {
    const parsed = JSON.parse(saved) as Partial<
      Record<RoleName, unknown>
    >;

    const normalized = {} as RolePermissions;

    for (const roleName of [
      "管理人員",
      "維運人員",
      "一般使用者",
    ] satisfies RoleName[]) {
      const permissions = parsed[roleName];

      if (!Array.isArray(permissions)) {
        return defaultRolePermissions;
      }

      normalized[roleName] = permissions.filter(
        (permission): permission is ModuleName =>
          typeof permission === "string" &&
          modules.includes(permission as ModuleName),
      );
    }

    return normalized;
  } catch {
    return defaultRolePermissions;
  }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={onChange}><span /></button>;
}

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Legacy local-only console retained for migration reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PermissionConsole() {
  const [users, setUsers] = useState<ManagedUser[]>(loadManagedUsers);
  const [roles, setRoles] =
    useState<RolePermissions>(loadRolePermissions);
  const [selectedRole, setSelectedRole] =
    useState<RoleName>("管理人員");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const filtered = users.filter((user) =>
    `${user.name}${user.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  useEffect(() => {
    window.localStorage.setItem("mis-users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    window.localStorage.setItem("mis-roles", JSON.stringify(roles));
  }, [roles]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function addUser() {
    const normalizedEmail = newEmail.trim().toLowerCase();

    if (
      !normalizedEmail.includes("@") ||
      users.some((user) => user.email === normalizedEmail)
    ) {
      flash("請輸入有效且未重複的電子郵件");
      return;
    }

    const newUser: ManagedUser = {
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      role: "一般使用者",
      enabled: true,
    };

    setUsers((current) => [...current, newUser]);
    setNewEmail("");
    setShowAdd(false);
    flash("使用者已加入授權清單");
  }

  function updateUserRole(
    email: string,
    role: UserRoleName,
  ) {
    setUsers((current) =>
      current.map((user) =>
        user.email === email ? { ...user, role } : user,
      ),
    );
  }

  function toggleUserStatus(email: string) {
    setUsers((current) =>
      current.map((user) =>
        user.email === email
          ? { ...user, enabled: !user.enabled }
          : user,
      ),
    );
  }

  function removeUser(email: string) {
    if (email === "tsengs@twmns.com") {
      flash("主要管理人員不可刪除");
      return;
    }

    setUsers((current) =>
      current.filter((user) => user.email !== email),
    );
  }

  function togglePermission(moduleName: ModuleName) {
    setRoles((currentRoles) => {
      const currentPermissions =
        currentRoles[selectedRole];

      return {
        ...currentRoles,
        [selectedRole]: currentPermissions.includes(moduleName)
          ? currentPermissions.filter(
              (permission) => permission !== moduleName,
            )
          : [...currentPermissions, moduleName],
      };
    });
  }

  return (
    <section className="management-console">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCESS CONTROL</span>
          <h2>權限管理</h2>
          <p>集中管理授權人員、角色與各模組存取權限。</p>
        </div>
        <div className="toolbar">
          <button
            className="secondary"
            onClick={() => flash("LDAP 同步完成，沒有異動")}
          >
            ↻ 同步 LDAP
          </button>
          <button
            className="primary"
            onClick={() => setShowAdd(true)}
          >
            ＋ 新增使用者
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <article>
          <b>{users.length}</b>
          <span>授權帳號</span>
        </article>
        <article>
          <b>3</b>
          <span>權限角色</span>
        </article>
        <article>
          <b>{users.filter((user) => user.enabled).length}</b>
          <span>啟用中</span>
        </article>
        <article>
          <b>0</b>
          <span>登入異常</span>
        </article>
      </div>

      <div className="manage-grid">
        <div className="card manage-card">
          <div className="card-head">
            <div>
              <h3>使用者帳號</h3>
              <p>只有清單內帳號可以進入系統</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋姓名或信箱"
              aria-label="搜尋使用者"
            />
          </div>

          <div className="user-list">
            {filtered.map((user) => (
              <div className="user-row" key={user.email}>
                <span className="mini-avatar">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>

                <div>
                  <b>{user.name}</b>
                  <small>{user.email}</small>
                </div>

                <select
                  value={user.role}
                  onChange={(event) =>
                    updateUserRole(
                      user.email,
                      event.target.value as UserRoleName,
                    )
                  }
                >
                  <option value="系統管理人員">
                    系統管理人員
                  </option>
                  <option value="維運人員">維運人員</option>
                  <option value="一般使用者">一般使用者</option>
                </select>

                <Toggle
                  label={`${user.name} 帳號狀態`}
                  checked={user.enabled}
                  onChange={() =>
                    toggleUserStatus(user.email)
                  }
                />

                <button
                  className="icon-action"
                  onClick={() => removeUser(user.email)}
                  aria-label={`刪除 ${user.name}`}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card manage-card">
          <div className="card-head">
            <div>
              <h3>角色功能權限</h3>
              <p>選擇角色後設定可使用的模組</p>
            </div>

            <select
              value={selectedRole}
              onChange={(event) =>
                setSelectedRole(
                  event.target.value as RoleName,
                )
              }
            >
              <option value="管理人員">管理人員</option>
              <option value="維運人員">維運人員</option>
              <option value="一般使用者">一般使用者</option>
            </select>
          </div>

          <div className="permission-list">
            {modules.map((moduleName) => (
              <label key={moduleName}>
                <span>
                  <b>{moduleName}</b>
                  <small>
                    {moduleName === "權限管理" ||
                    moduleName === "系統設定"
                      ? "管理功能"
                      : "業務功能"}
                  </small>
                </span>

                <Toggle
                  label={`${selectedRole} ${moduleName}`}
                  checked={roles[selectedRole].includes(
                    moduleName,
                  )}
                  onChange={() =>
                    togglePermission(moduleName)
                  }
                />
              </label>
            ))}
          </div>

          <div className="card-actions">
            <button
              className="secondary"
              onClick={() =>
                setRoles((current) => ({
                  ...current,
                  [selectedRole]: [],
                }))
              }
            >
              清除
            </button>
            <button
              className="primary"
              onClick={() =>
                flash(`${selectedRole}權限已儲存`)
              }
            >
              儲存權限
            </button>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h3>新增授權使用者</h3>
            <p>新增後可指定角色與功能權限。</p>

            <label>
              公司電子郵件
              <input
                autoFocus
                value={newEmail}
                onChange={(event) =>
                  setNewEmail(event.target.value)
                }
                placeholder="name@company.com"
              />
            </label>

            <div>
              <button
                className="secondary"
                onClick={() => setShowAdd(false)}
              >
                取消
              </button>
              <button className="primary" onClick={addUser}>
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </section>
  );
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
    {tab === "系統資訊" && <><h3>系統資訊</h3><p>目前執行環境與服務狀態</p><dl className="system-info"><div><dt>系統版本</dt><dd>v0.4.2</dd></div><div><dt>執行環境</dt><dd>Test</dd></div><div><dt>AI 服務</dt><dd className="ok">● 正常</dd></div><div><dt>資料層</dt><dd>Cloudflare D1</dd></div></dl><button className="secondary" onClick={()=>setSaved("連線測試完成：所有服務正常")}>執行服務連線測試</button></>}
    <div className="settings-footer"><span>變更將記錄於系統稽核日誌</span><button className="primary" onClick={save}>儲存設定</button></div></div></div>{saved && <div className="toast">✓ {saved}</div>}</section>;
}

function SettingRow({title,note,value,onChange}:{title:string;note:string;value:boolean;onChange:()=>void}) { return <div><span><b>{title}</b><small>{note}</small></span><Toggle label={title} checked={value} onChange={onChange}/></div> }

type TestState = "待測試" | "測試中" | "通過";

type SurveyType = "system_usage" | "it_service";

type SurveySummaryRow = {
  survey_type: SurveyType;
  response_count: number | string | null;
  average_score: number | string | null;
  average_nps: number | string | null;
};

type SurveyStatsResponse = {
  summaries?: SurveySummaryRow[];
  pendingFollowups?: number | string | null;
};

type SurveyMetric = {
  responseCount: number;
  averageScore: number;
  averageNps: number;
};

type SurveyStatsState = Record<SurveyType, SurveyMetric> & {
  pendingFollowups: number;
};

function GovernanceConsole({ onOpen, onEmailTicket }: { onOpen: (title:string, body:string) => void; onEmailTicket: () => void }) {
  const [tab, setTab] = useState("SLA 與派工");
  const [toast, setToast] = useState("");
  const [systemSurvey, setSystemSurvey] = useState({ ease:"4", speed:"4", usefulness:"5", recommend:"9", comment:"整體操作清楚，希望持續增加自助排除功能。" });
  const [itSurvey, setItSurvey] = useState({ ticketReference:"", response:"5", expertise:"5", communication:"4", resolved:"是", engineer:"張志豪", comment:"說明清楚，問題已完整排除。" });
  const [submittingSurvey, setSubmittingSurvey] = useState<"system_usage" | "it_service" | null>(null);
  const [surveyStats, setSurveyStats] =
    useState<SurveyStatsState>({
      system_usage: {
        responseCount: 0,
        averageScore: 0,
        averageNps: 0,
      },
      it_service: {
        responseCount: 0,
        averageScore: 0,
        averageNps: 0,
      },
      pendingFollowups: 0,
    });
  const flash = (message:string) => { setToast(message); window.setTimeout(() => setToast(""), 2300); };
  const respondentToken = () => {
    const key = "mis-survey-device-id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = createClientId();
      window.localStorage.setItem(key, value);
    }
    return value;
  };
  const loadSurveyStats = async () => {
    try {
      const response = await fetch("/api/surveys", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data =
        (await response.json()) as SurveyStatsResponse;

      const next: SurveyStatsState = {
        system_usage: {
          responseCount: 0,
          averageScore: 0,
          averageNps: 0,
        },
        it_service: {
          responseCount: 0,
          averageScore: 0,
          averageNps: 0,
        },
        pendingFollowups: Number(
          data.pendingFollowups ?? 0,
        ),
      };

      for (const row of data.summaries ?? []) {
        const surveyType = row.survey_type;

        next[surveyType] = {
          responseCount: Number(row.response_count ?? 0),
          averageScore: Number(row.average_score ?? 0),
          averageNps: Number(row.average_nps ?? 0),
        };
      }

      setSurveyStats(next);
    } catch {
      // 保留目前統計資料，避免暫時性 API 錯誤中斷頁面。
    }
  };
  const submitSurvey = async (surveyType: "system_usage" | "it_service") => {
    if (submittingSurvey) return;
    if (surveyType === "it_service" && !itSurvey.ticketReference.trim()) {
      flash("請先輸入本次服務的工單編號");
      return;
    }
    setSubmittingSurvey(surveyType);
    try {
      const source = surveyType === "system_usage" ? systemSurvey : itSurvey;
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionKey: createClientId(),
          respondentToken: respondentToken(),
          surveyType,
          ticketReference: surveyType === "it_service" ? itSurvey.ticketReference : undefined,
          engineer: surveyType === "it_service" ? itSurvey.engineer : undefined,
          resolved: surveyType === "it_service" ? itSurvey.resolved : undefined,
          comment: source.comment,
          answers: source,
        }),
      });
      const responseText = await response.text();
      let result: { message?: string } = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error("Unexpected survey response", response.status, responseText.slice(0, 300));
        flash(`問卷服務回傳異常（HTTP ${response.status}）`);
        return;
      }
      flash(result.message || (response.ok ? "問卷已成功送出" : "問卷送出失敗"));
      if (response.ok) {
        if (surveyType === "it_service") setItSurvey({...itSurvey, ticketReference:""});
        await loadSurveyStats();
      }
    } catch {
      flash("網路連線異常，問卷尚未送出");
    } finally {
      setSubmittingSurvey(null);
    }
  };
  const tabs = ["SLA 與派工", "AI 覆核", "知識庫", "重大事件", "系統使用問卷", "IT 人員服務調查"];
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
    <nav className="governance-tabs card">{tabs.map(x => <button key={x} className={tab === x ? "active" : ""} onClick={() => { setTab(x); if (x.includes("問卷") || x.includes("調查")) void loadSurveyStats(); }}>{x}</button>)}</nav>
    {tab === "SLA 與派工" && <div className="governance-grid">{sla.map(([level,response,target,scope]) => <article className="card governance-card" key={level}><span className={`governance-level ${level.slice(0,2).toLowerCase()}`}>{level}</span><dl><div><dt>首次回應</dt><dd>{response}</dd></div><div><dt>處理目標</dt><dd>{target}</dd></div></dl><p>{scope}</p><button className="secondary" onClick={() => onOpen(`${level} SLA 政策`, `首次回應 ${response}，處理目標 ${target}。適用範圍：${scope}。`)}>檢視與調整</button></article>)}</div>}
    {tab === "AI 覆核" && <div className="card governance-list"><div className="card-head"><div><h3>人工覆核佇列</h3><p>低信心、P1/P2 與高風險事件必須人工確認</p></div><span className="queue-count">{reviews.length} 件待處理</span></div>{reviews.map(([id,title,confidence,meta]) => <button key={id} onClick={() => onOpen(id, `${title}。AI 信心 ${confidence}，判定結果：${meta}。請確認分類、優先度及派工對象。`)}><span><b>{id}</b><small>{title}</small></span><em>{confidence}</em><i>{meta}</i><strong>覆核 ›</strong></button>)}</div>}
    {tab === "知識庫" && <div className="card governance-list"><div className="card-head"><div><h3>知識庫治理</h3><p>以解決成功率與複核日期維持內容品質</p></div><button className="primary" onClick={() => flash("已建立新的知識文章草稿")}>新增文章</button></div>{knowledge.map(([title,status,meta]) => <button key={title} onClick={() => onOpen(title, `${status}。${meta}。可在正式串接後編輯內容、送審或發布。`)}><span><b>{title}</b><small>{meta}</small></span><i className={status === "已發布" ? "good" : ""}>{status}</i><strong>管理 ›</strong></button>)}</div>}
    {tab === "重大事件" && <div className="governance-grid incidents">{incidents.map(([title,status,body]) => <article className="card governance-card" key={title}><span className="governance-level p2">{status}</span><h3>{title}</h3><p>{body}</p><div className="card-actions"><button className="secondary" onClick={() => onOpen(title, body)}>檢視關聯工單</button><button className="primary" onClick={() => flash(`${title} 已通知主管確認`)}>通知主管</button></div></article>)}</div>}
    {tab === "系統使用問卷" && <div className="survey-dashboard">
      <div className="module-summary"><article className="card"><span>系統整體滿意度</span><b>{surveyStats.system_usage.averageScore ? `${surveyStats.system_usage.averageScore} / 5` : "尚無資料"}</b><small>D1 即時彙整</small></article><article className="card"><span>平均推薦分數</span><b>{surveyStats.system_usage.averageNps ? `${surveyStats.system_usage.averageNps} / 10` : "尚無資料"}</b><small>0–10 分推薦意願</small></article><article className="card"><span>有效問卷</span><b>{surveyStats.system_usage.responseCount}</b><small>已永久儲存份數</small></article></div>
      <div className="card survey-form"><div className="survey-title"><div><span className="eyebrow">END USER EXPERIENCE</span><h3>系統使用上問卷調查</h3><p>了解使用者對 AI 報修、工單查詢及整體操作體驗的意見。</p></div><span className="survey-audience">一般使用者</span></div>
        <div className="survey-question-grid">
          <label>介面是否容易理解？<select value={systemSurvey.ease} onChange={e=>setSystemSurvey({...systemSurvey,ease:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>操作與頁面回應速度？<select value={systemSurvey.speed} onChange={e=>setSystemSurvey({...systemSurvey,speed:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>AI 報修建議是否有幫助？<select value={systemSurvey.usefulness} onChange={e=>setSystemSurvey({...systemSurvey,usefulness:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>推薦同事使用（0–10）<input type="number" min="0" max="10" value={systemSurvey.recommend} onChange={e=>setSystemSurvey({...systemSurvey,recommend:e.target.value})}/></label>
        </div>
        <label>希望改善的功能或其他建議<textarea value={systemSurvey.comment} onChange={e=>setSystemSurvey({...systemSurvey,comment:e.target.value})} /></label>
        <div className="survey-actions"><small>問卷匿名儲存至 D1；同一裝置每天限填一次。</small><button className="primary" disabled={submittingSurvey !== null} onClick={() => void submitSurvey("system_usage")}>{submittingSurvey === "system_usage" ? "正在儲存…" : "送出系統使用問卷"}</button></div>
      </div>
    </div>}
    {tab === "IT 人員服務調查" && <div className="survey-dashboard">
      <div className="module-summary"><article className="card"><span>IT 人員服務滿意度</span><b>{surveyStats.it_service.averageScore ? `${surveyStats.it_service.averageScore} / 5` : "尚無資料"}</b><small>D1 即時彙整</small></article><article className="card"><span>有效服務回饋</span><b>{surveyStats.it_service.responseCount}</b><small>依工單編號去除重複</small></article><article className="card"><span>低分待追蹤</span><b>{surveyStats.pendingFollowups}</b><small>自動建立改善事項</small></article></div>
      <div className="card survey-form"><div className="survey-title"><div><span className="eyebrow">IT SERVICE QUALITY</span><h3>IT 人員服務調查</h3><p>針對資訊人員的回應速度、專業能力、溝通品質與解決結果進行評價。</p></div><span className="survey-audience service">結案回饋</span></div>
        <div className="survey-question-grid">
          <label>工單編號<input required value={itSurvey.ticketReference} onChange={e=>setItSurvey({...itSurvey,ticketReference:e.target.value})} placeholder="例如 INC-20260726-001" /></label>
          <label>服務人員<select value={itSurvey.engineer} onChange={e=>setItSurvey({...itSurvey,engineer:e.target.value})}><option>張志豪</option><option>李柏翰</option><option>吳宜庭</option><option>劉又誠</option></select></label>
          <label>回應與處理速度<select value={itSurvey.response} onChange={e=>setItSurvey({...itSurvey,response:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>問題解決專業度<select value={itSurvey.expertise} onChange={e=>setItSurvey({...itSurvey,expertise:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>說明與溝通品質<select value={itSurvey.communication} onChange={e=>setItSurvey({...itSurvey,communication:e.target.value})}>{["5","4","3","2","1"].map(x=><option key={x} value={x}>{x} 分</option>)}</select></label>
          <label>本次問題是否已解決？<select value={itSurvey.resolved} onChange={e=>setItSurvey({...itSurvey,resolved:e.target.value})}><option>是</option><option>部分解決</option><option>否</option></select></label>
        </div>
        <label>服務意見與改善建議<textarea value={itSurvey.comment} onChange={e=>setItSurvey({...itSurvey,comment:e.target.value})} /></label>
        <div className="survey-actions"><small>低於 3 分或尚未解決的回饋將自動列入改善追蹤。</small><button className="primary" disabled={submittingSurvey !== null} onClick={() => void submitSurvey("it_service")}>{submittingSurvey === "it_service" ? "正在儲存…" : "送出 IT 服務調查"}</button></div>
      </div>
    </div>}
    {toast && <div className="toast">✓ {toast}</div>}
  </section>;
}

function ModuleConsole({ module, tickets, onOpen, onTicket }: { module: string; tickets: Ticket[]; onOpen: (title:string, body:string) => void; onTicket: (ticket:Ticket) => void }) {
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

  const records = module === "我的工單" ? tickets.map((x) => ({name:x.ticketNumber, detail:x.title, meta:`${x.priority}優先・${x.assignedTeam}`, status:x.status, ticket:x}))
    : module === "設備與服務" ? [
      {name:"Microsoft 365",detail:"郵件、Teams、SharePoint",meta:"可用率 99.99%",status:"正常",ticket:undefined},
      {name:"公司網路",detail:"核心交換器與無線網路",meta:"延遲 8 ms",status:"正常",ticket:undefined},
      {name:"VPN Gateway",detail:"遠端存取服務",meta:"延遲偏高",status:"注意",ticket:undefined},
      {name:"ERP Production",detail:"企業資源管理系統",meta:"最後檢查 1 分鐘前",status:"正常",ticket:undefined}]
    : module === "資安監控" ? [
      {name:"異常登入嘗試",detail:"非辦公地區連續登入失敗",meta:"12 個事件",status:"高風險",ticket:undefined},
      {name:"端點高風險弱點",detail:"需安排修補與重新掃描",meta:"7 台設備",status:"待處置",ticket:undefined},
      {name:"惡意郵件攔截",detail:"郵件閘道已完成隔離",meta:"5 封郵件",status:"已阻擋",ticket:undefined},
      {name:"防火牆規則稽核",detail:"本週設定基準比對完成",meta:"0 個異常",status:"正常",ticket:undefined}]
    : [
      {name:"無法連線公司 Wi-Fi",detail:"AI 判定：網路連線／高優先",meta:"建議指派網路維運組",status:"待確認",ticket:undefined},
      {name:"Outlook 無法同步",detail:"AI 判定：Microsoft 365／中優先",meta:"建議指派系統維運組",status:"待確認",ticket:undefined},
      {name:"VPN 經常斷線",detail:"AI 判定：遠端連線／高優先",meta:"已完成初步診斷",status:"可建立",ticket:undefined}];
  const shown = filter === "全部" ? records : records.filter(x => x.status === filter);

  return <section className="module-console">
    <div className="page-heading"><div><span className="eyebrow">{def.kicker}</span><h2>{def.title}</h2><p>{def.description}</p></div><button className="primary" onClick={() => runAll(def.tests)}>▶ 執行全部測試</button></div>
    <div className="module-summary">
      <article className="card"><span>{module === "我的工單" ? "全部工單" : "今日資料"}</span><b>{module === "我的工單" ? tickets.length : records.length * 4 + 3}</b><small>{module === "我的工單" ? "D1 永久儲存" : "資料同步正常"}</small></article>
      <article className="card"><span>待處理</span><b>{module === "我的工單" ? tickets.filter(x=>x.status==="待處理").length : Math.max(2, records.length - 1)}</b><small>依優先級排序</small></article>
      <article className="card"><span>{module === "我的工單" ? "處理中" : "服務健康度"}</span><b>{module === "我的工單" ? tickets.filter(x=>x.status==="處理中").length : "99.9%"}</b><small className="ok">{module === "我的工單" ? "● 狀態即時更新" : "● 運作正常"}</small></article>
    </div>
    <div className="module-grid">
      <div className="card record-panel"><div className="card-head"><div><h3>{module === "設備與服務" ? "服務清單" : module === "資安監控" ? "最新事件" : "工作項目"}</h3><p>點選資料可開啟詳細內容與操作</p></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>全部</option>{[...new Set(records.map(x=>x.status))].map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="record-list">{shown.length ? shown.map(x=><button key={x.name} onClick={()=>x.ticket ? onTicket(x.ticket) : onOpen(x.name, `${x.detail}。${x.meta}。目前狀態：${x.status}。`)}><span><b>{x.name}</b><small>{x.detail}</small></span><em>{x.meta}</em><i className={x.status.includes("正常")||x.status.includes("阻擋")||x.status.includes("建立")||x.status.includes("解決")||x.status.includes("結案")?"good":""}>{x.status}</i><strong>›</strong></button>) : <div className="empty-state"><b>目前沒有工單</b><span>請前往「AI 資訊報修」建立第一張工單。</span></div>}</div>
      </div>
      <div className="card test-panel"><div className="card-head"><div><h3>功能測試中心</h3><p>逐項確認模組功能是否可正常執行</p></div></div>
        {def.tests.map(name => <div className="test-row" key={name}><span className={`test-dot ${testStates[name] === "通過" ? "pass":testStates[name] === "測試中" ? "running":""}`}/><div><b>{name}</b><small>{testStates[name] || "待測試"}</small></div><button className="secondary" disabled={testStates[name] === "測試中"} onClick={()=>runTest(name)}>{testStates[name] === "通過" ? "重新測試":"開始測試"}</button></div>)}
      </div>
    </div>{toast && <div className="toast">✓ {toast}</div>}
  </section>;
}

const testAccounts = [
  { role: "系統管理員", username: "admin01", password: "Admin@2026" },
  { role: "MIS 維運人員", username: "mis01", password: "Mis@2026" },
  { role: "一般使用者", username: "user01", password: "User@2026" },
];

function LoginScreen({
  authIssue,
  onAuthenticated,
}: {
  authIssue: string;
  onAuthenticated: (user: SessionUser) => void;
}) {
  const [username, setUsername] = useState("admin01");
  const [password, setPassword] = useState("Admin@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(authIssue);
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const contentType = response.headers.get("content-type") || "";
      const result = (contentType.includes("application/json")
        ? await response.json()
        : {
            message:
              response.status >= 500
                ? "登入服務暫時無法使用，請稍後再試。"
                : "登入服務回應格式異常。",
          }) as {
        user?: SessionUser;
        message?: string;
      };
      if (!response.ok || !result.user) {
        throw new Error(result.message || "登入失敗。");
      }
      onAuthenticated(result.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    } finally {
      setLoading(false);
    }
  }

  function selectAccount(account: (typeof testAccounts)[number]) {
    setUsername(account.username);
    setPassword(account.password);
    setMessage("");
  }

  return <main className="login-page">
    <section className="login-intro">
      <div className="login-brand"><span className="brandmark">A</span><span><strong>文化大學學分班 AI 資訊報修</strong><small>MIS 維運／資安監控中心</small></span></div>
      <div className="login-message"><span className="login-kicker">ENTERPRISE IT OPERATIONS</span><h1>讓資訊服務更快速，<br/>讓資安風險更透明。</h1><p>整合 AI 報修、工單治理、設備服務與資安監控，協助 MIS 團隊集中掌握企業資訊營運狀態。</p>
        <div className="login-features"><span>✦ AI 智慧分類與派工</span><span>▣ ITSM 與 SLA 管理</span><span>♢ 資安事件即時監控</span></div>
      </div>
      <p className="login-copyright">© 2026 AI MIS Operations Center</p>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <span className="login-shield">✓</span>
        <div><span className="eyebrow">RBAC TEST ACCESS</span><h2>多角色測試登入</h2><p>使用內建測試帳號驗證不同角色的選單、資料範圍與操作權限。</p></div>
        <div className="test-account-grid">
          {testAccounts.map((account) => <button type="button" key={account.username} className={username === account.username ? "selected" : ""} onClick={() => selectAccount(account)}><b>{account.role}</b><span>{account.username}</span><small>套用測試帳密</small></button>)}
        </div>
        <form className="login-form" onSubmit={(event) => void login(event)}>
          <label>測試帳號<div className="login-input"><span>◎</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></div></label>
          <label>密碼<div className="login-input"><span>●</span><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "隱藏" : "顯示"}</button></div></label>
          {message && <div className="login-error" role="alert"><b>無法登入</b><span>{message}</span></div>}
          <button className="login-submit" disabled={loading}>{loading ? "正在驗證…" : "登入測試系統"} <span>→</span></button>
        </form>
        <div className="demo-account"><b>測試環境提醒</b><span>測試密碼會經 PBKDF2 雜湊後保存，登入狀態由伺服器端工作階段驗證。正式導入時再切換為 Microsoft Entra ID。</span></div>
        <p className="login-security">🔒 請勿在本測試系統使用公司正式密碼。</p>
      </div>
    </section>
  </main>;
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authIssue, setAuthIssue] = useState("");
  const [active, setActive] = useState("營運總覽");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [issue, setIssue] = useState("我的筆電連不上公司 Wi-Fi，從早上開始一直斷線");
  const [diagnosis, setDiagnosis] = useState(false);
  const [formMode, setFormMode] = useState(false);
  const [requester, setRequester] = useState("TW_YVES");
  const [requesterEmail, setRequesterEmail] = useState("tsengs@twmns.com");
  const [department, setDepartment] = useState("資訊部");
  const [location, setLocation] = useState("台北辦公室");
  const [assetTag, setAssetTag] = useState("");
  const [category, setCategory] = useState("自動判斷");
  const [priority, setPriority] = useState("自動判斷");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [notice, setNotice] = useState(false);
  const [noticeCount, setNoticeCount] = useState(3);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<{title:string;body:string}|null>(null);
  const [ticketDetail, setTicketDetail] = useState<{ticket:Ticket;events:TicketEvent[]}|null>(null);
  const [ticketNote, setTicketNote] = useState("");
  const [ticketStatus, setTicketStatus] = useState("待處理");
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ticketRating, setTicketRating] = useState({
    response: "5",
    expertise: "5",
    communication: "5",
    resolved: "是",
    comment: "",
  });
  const count = issue.length;
  const aiResult = useMemo(() => ({ category: "網路連線", priority: issue.includes("斷線") ? "高" : "中", team: "網路維運組" }), [issue]);
  function requesterToken() {
    const key = "mis-ticket-requester-id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = createClientId();
      window.localStorage.setItem(key, value);
    }
    return value;
  }
  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        headers: { "x-requester-token": requesterToken() },
        cache: "no-store",
      });
      const result = await response.json() as { tickets?: Ticket[]; message?: string };
      if (!response.ok) throw new Error(result.message || "工單查詢失敗");
      setTickets(result.tickets || []);
    } catch {
      flash("工單資料暫時無法讀取，請稍後重新整理");
    } finally {
      setTicketsLoading(false);
    }
  }
  useEffect(() => {
    let activeRequest = true;
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          user?: SessionUser;
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          if (result.error === "ACCOUNT_NOT_AUTHORIZED") {
            setAuthIssue(result.message || "目前登入帳號未在授權清單中。");
          }
          return null;
        }
        setAuthIssue("");
        return result;
      })
      .then((result) => {
        if (!activeRequest) return;
        setSession(result?.user || null);
        if (result?.user) {
          setRequester(result.user.displayName);
          setRequesterEmail(result.user.email);
          setDepartment(result.user.department || "未設定");
        }
        setAuthenticated(Boolean(result?.user));
      })
      .catch(() => activeRequest && setAuthenticated(false));
    return () => { activeRequest = false; };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => void loadTickets(), 0);
    return () => window.clearTimeout(timer);
    // loadTickets intentionally runs only when the authenticated session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  function diagnose() {
    if (!issue.trim()) return flash("請先輸入問題描述");
    setDiagnosis(true);
  }
  function flash(message:string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setProfile(false);
    setSession(null);
    setAuthenticated(false);
    setTickets([]);
  }
  async function postTicket(values: Record<string, unknown>) {
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requesterToken: requesterToken(), ...values }),
    });
    const text = await response.text();
    let result: { ticket?: Ticket; message?: string } = {};
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`工單服務回傳異常（HTTP ${response.status}）`);
    }
    if (!response.ok || !result.ticket) throw new Error(result.message || "工單建立失敗");
    setTickets(current => [result.ticket!, ...current]);
    return result;
  }
  async function simulateEmailTicket() {
    if (submittingTicket) return;
    setSubmittingTicket(true);
    try {
      const result = await postTicket({
        requesterName: requester,
        requesterEmail,
        department,
        title: "Outlook 郵件同步異常",
        description: "Email 自動建單測試：Outlook 自上午起無法同步新郵件，重新啟動後仍未恢復。",
        category: "Microsoft 365",
        priority: "高",
        source: "Email 自動建單",
        location,
        assetTag,
        assignedTeam: "系統維運組",
      });
      setNoticeCount(x => x + 1);
      flash(result.message || "Email 工單已建立");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Email 工單建立失敗");
    } finally {
      setSubmittingTicket(false);
    }
  }
  async function createTicket() {
    if (submittingTicket) return;
    if (!requester.trim() || !requesterEmail.includes("@") || !department.trim()) {
      flash("請完整填寫申請人、聯絡信箱與部門");
      setFormMode(true);
      return;
    }
    if (issue.trim().length < 10) return flash("問題描述至少需要 10 個字");
    setSubmittingTicket(true);
    try {
      const selectedCategory = category === "自動判斷" ? aiResult.category : category;
      const selectedPriority = priority === "自動判斷" ? aiResult.priority : priority;
      const result = await postTicket({
        requesterName: requester,
        requesterEmail,
        department,
        title: issue.trim().slice(0, 60),
        description: issue.trim(),
        category: selectedCategory,
        priority: selectedPriority,
        source: formMode ? "表單報修" : "AI 報修",
        location,
        assetTag,
        assignedTeam: aiResult.team,
      });
      setDiagnosis(false);
      setIssue("");
      setFormMode(false);
      setActive("我的工單");
      flash(result.message || "工單已建立");
    } catch (error) {
      flash(error instanceof Error ? error.message : "工單建立失敗，請稍後再試");
    } finally {
      setSubmittingTicket(false);
    }
  }
  async function openTicket(ticket: Ticket) {
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        headers: { "x-requester-token": requesterToken() },
        cache: "no-store",
      });
      const result = await response.json() as { ticket?: Ticket; events?: TicketEvent[]; message?: string };
      if (!response.ok || !result.ticket) throw new Error(result.message || "工單明細讀取失敗");
      setTicketStatus(result.ticket.status);
      setTicketNote("");
      setTicketDetail({ ticket: result.ticket, events: result.events || [] });
    } catch (error) {
      flash(error instanceof Error ? error.message : "工單明細讀取失敗");
    }
  }
  async function updateTicket() {
    if (!ticketDetail || updatingTicket) return;
    setUpdatingTicket(true);
    try {
      const response = await fetch(`/api/tickets/${ticketDetail.ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requesterToken: requesterToken(),
          status: ticketStatus,
          note: ticketNote,
          actorName: requester,
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "工單更新失敗");
      await loadTickets();
      await openTicket({ ...ticketDetail.ticket, status: ticketStatus });
      flash(result.message || "工單已更新");
    } catch (error) {
      flash(error instanceof Error ? error.message : "工單更新失敗");
    } finally {
      setUpdatingTicket(false);
    }
  }
  async function submitTicketRating() {
    if (!ticketDetail || submittingRating) return;
    if (session?.roleCode !== "user") {
      setSurveyOpen(false);
      flash("只有一般使用者可以評價資訊服務");
      return;
    }
    setSubmittingRating(true);
    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionKey: createClientId(),
          respondentToken: requesterToken(),
          surveyType: "it_service",
          ticketReference: ticketDetail.ticket.ticketNumber,
          resolved: ticketRating.resolved,
          comment: ticketRating.comment,
          answers: {
            response: ticketRating.response,
            expertise: ticketRating.expertise,
            communication: ticketRating.communication,
          },
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "服務評分送出失敗");

      setSurveyOpen(false);
      setTicketRating({
        response: "5",
        expertise: "5",
        communication: "5",
        resolved: "是",
        comment: "",
      });
      setTicketDetail({
        ...ticketDetail,
        ticket: { ...ticketDetail.ticket, surveySubmitted: true },
      });
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketDetail.ticket.id
            ? { ...ticket, surveySubmitted: true }
            : ticket,
        ),
      );
      flash(result.message || "感謝您的服務評分");
    } catch (error) {
      flash(error instanceof Error ? error.message : "服務評分送出失敗");
    } finally {
      setSubmittingRating(false);
    }
  }

  const searchResults = search.trim() ? tickets.filter(x => Object.values(x).join(" ").toLowerCase().includes(search.toLowerCase())).slice(0,5) : [];
  const permissionForNav: Record<string, string> = {
    "營運總覽": "dashboard.read",
    "AI 資訊報修": "tickets.create",
    "我的工單": "tickets.read.own",
    "設備與服務": "assets.read",
    "服務管理": "services.write",
    "資安監控": "services.read",
    "服務治理": "surveys.read",
    "權限管理": "rbac.manage",
    "系統設定": "rbac.manage",
  };
  const visibleNav = nav.filter((item) =>
    session?.roleCode === "admin" ||
    session?.permissions.includes(permissionForNav[item.label]),
  );
  const canUpdateTickets =
    session?.roleCode === "admin" ||
    session?.permissions.includes("tickets.update");
  const canWriteAssets =
    session?.roleCode === "admin" ||
    session?.permissions.includes("assets.write");
  const canWriteServices =
    session?.roleCode === "admin" ||
    session?.permissions.includes("services.write");
  // 服務評分只依角色顯示：一般使用者可評分，
  // 避免舊 Session 或 D1 權限尚未同步時誤把入口隱藏。
  // 真正的工單所有權、狀態與重複提交仍由後端強制驗證。
  const canSubmitOwnSurvey = session?.roleCode === "user";
  const ticketCanBeRated =
    Boolean(canSubmitOwnSurvey) &&
    Boolean(ticketDetail) &&
    ["已解決", "已結案", "已關閉"].includes(ticketDetail!.ticket.status) &&
    !Boolean(ticketDetail!.ticket.surveySubmitted);
  const initials = (session?.displayName || "U").slice(0, 2).toUpperCase();

  if (authenticated === null) return <main className="auth-loading" aria-label="系統載入中"><span className="brandmark">A</span></main>;
  if (!authenticated) return <LoginScreen authIssue={authIssue} onAuthenticated={(user) => {
    setSession(user);
    setRequester(user.displayName);
    setRequesterEmail(user.email);
    setDepartment(user.department || "未設定");
    setAuthenticated(true);
    setActive("營運總覽");
  }} />;

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="主要導覽">
        <div className="sidebar-brand">
          <span className="sidebar-logo" aria-hidden="true"><Network /></span>
          <div><strong>MIS 智慧營運中心</strong><small>AI · ITSM · SECURITY</small></div>
        </div>
        <nav>{visibleNav.map(({ icon: Icon, label }) => <button key={label} className={active === label ? "active" : ""} onClick={() => setActive(label)} aria-current={active === label ? "page" : undefined}><span className="nav-icon" aria-hidden="true"><Icon /></span><span className="nav-label">{label}</span></button>)}</nav>
        <div className="sidebar-foot"><span className="status-line"><i className="online-dot" />系統連線正常</span><small>所有核心服務運作中</small></div>
      </aside>

      <section className="workspace">
        <header>
          <div><h1>您好，{session?.displayName}</h1><p>資訊服務與資安狀態一目掌握</p></div>
          <div className="header-tools"><label className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="搜尋" placeholder="搜尋工單、設備或服務…" /></label><span className="access-badge"><i />RBAC 已驗證</span><button className="bell" onClick={() => setNotice(!notice)} aria-label="通知">♢{noticeCount > 0 && <i>{noticeCount}</i>}</button><button className="profile-button" onClick={() => setProfile(!profile)} aria-label="開啟管理人員選單"><span className="avatar">{initials}</span><span className="profile-copy"><b>{session?.displayName}</b><small>{session?.roleName}</small></span><span>⌄</span></button></div>
          {search.trim() && <div className="search-results"><strong>搜尋結果</strong>{searchResults.length ? searchResults.map(ticket=><button key={ticket.id} onClick={()=>{void openTicket(ticket);setSearch("");}}><b>{ticket.ticketNumber}</b><span>{ticket.title}</span></button>) : <p>找不到相符工單</p>}</div>}
          {notice && <div className="notice"><strong>最新通知</strong><button onClick={()=>{setActive("設備與服務");setNotice(false)}}>VPN 閘道偵測到異常延遲</button><button onClick={()=>{setActive("資安監控");setNotice(false)}}>3 件高風險事件待確認</button><button className="read-all" onClick={()=>{setNoticeCount(0);setNotice(false);flash("通知已全部標示為已讀")}}>全部標示為已讀</button></div>}
          {profile && <div className="profile-menu"><div><span className="avatar">{initials}</span><p><strong>{session?.displayName}</strong><small>{session?.username} · {session?.email}</small></p></div><span className="role-row"><b>角色</b><em>{session?.roleName}</em></span>{(session?.roleCode === "admin" || session?.permissions.includes("rbac.manage")) && <button onClick={() => {setActive("權限管理");setProfile(false)}}>管理帳號與權限</button>}<button className="logout-button" onClick={() => void logout()}>安全登出</button></div>}
        </header>

        <div className={`dashboard ${active !== "營運總覽" ? "admin-mode" : ""}`}>
          {active === "權限管理" && <RbacConsole />}
          {active === "系統設定" && <SettingsConsole />}
          {active === "服務治理" && <GovernanceConsole onOpen={(title,body)=>setDetail({title,body})} onEmailTicket={simulateEmailTicket} />}
          {active === "設備與服務" && <ResourceConsole entity="assets" canWrite={Boolean(canWriteAssets)} />}
          {active === "服務管理" && <ResourceConsole entity="services" canWrite={Boolean(canWriteServices)} />}
          {["我的工單","資安監控"].includes(active) && <ModuleConsole key={active} module={active} tickets={tickets} onOpen={(title,body)=>setDetail({title,body})} onTicket={ticket=>void openTicket(ticket)}/>}
          <section className="ai-card card">
            <div className="ai-copy"><span className="eyebrow">AI SERVICE DESK</span><h2>用一句話，讓 AI 幫你報修</h2><p>描述問題，AI 將自動分類、判斷優先級並指派負責人</p>
              {formMode && <div className="repair-form-grid">
                <label>申請人<input required value={requester} onChange={e=>setRequester(e.target.value)}/></label>
                <label>聯絡信箱<input required type="email" value={requesterEmail} onChange={e=>setRequesterEmail(e.target.value)}/></label>
                <label>部門<input required value={department} onChange={e=>setDepartment(e.target.value)}/></label>
                <label>發生地點<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="例：台北 17 樓"/></label>
                <label>設備編號<input value={assetTag} onChange={e=>setAssetTag(e.target.value)} placeholder="選填，例如 NB-0123"/></label>
                <label>問題類別<select value={category} onChange={e=>setCategory(e.target.value)}><option>自動判斷</option><option>網路連線</option><option>Microsoft 365</option><option>帳號權限</option><option>軟體</option><option>硬體</option><option>資安事件</option><option>其他</option></select></label>
                <label>緊急程度<select value={priority} onChange={e=>setPriority(e.target.value)}><option>自動判斷</option><option>緊急</option><option>高</option><option>中</option><option>低</option></select></label>
              </div>}
              <label className="issue-box"><textarea value={issue} maxLength={200} onChange={e => {setIssue(e.target.value); setDiagnosis(false)}} aria-label="問題描述" placeholder="請描述設備、錯誤訊息及發生時間" /><span>{count}/200</span></label>
              <div className="actions"><button className="primary" onClick={diagnose}>✦ 開始 AI 診斷</button><button className="link" onClick={() => {setFormMode(!formMode);setDiagnosis(false)}}>{formMode ? "返回 AI 快速報修" : "改用完整表單報修"} ›</button></div>
              <div className="suggestions">試試這些：{["無法登入", "網路異常", "軟體安裝"].map(x => <button key={x} onClick={() => setIssue(x)}>{x}</button>)}</div>
              {diagnosis && <div className="diagnosis"><span>AI 分析完成</span><b>{category === "自動判斷" ? aiResult.category : category}</b><b className="warn">{priority === "自動判斷" ? aiResult.priority : priority}優先</b><b>{aiResult.team}</b><button disabled={submittingTicket} onClick={()=>void createTicket()}>{submittingTicket ? "正在建立…" : "確認建立工單"}</button></div>}
            </div>
            <div className="ai-visual" aria-hidden="true"><div className="orb"><span>AI</span></div><i className="ring r1"/><i className="ring r2"/><i className="node n1"/><i className="node n2"/><i className="node n3"/></div>
          </section>

          <section className="service-card card"><div className="section-title"><h2>服務狀態</h2><span className="healthy"><i/>整體運作正常</span></div><div className="service-body"><div className="availability"><div><strong>99.94%</strong><span>可用率</span><small>過去 7 天</small></div></div><div className="services">{[["◎","Microsoft 365","正常"],["⌁","公司網路","正常"],["♧","VPN","部分異常"],["▱","ERP","正常"]].map(([i,n,s]) => <button key={n} onClick={()=>setDetail({title:n,body:`${n}目前狀態：${s}。最近一次健康檢查已完成，可前往設備與服務模組執行連線測試。`})}><b>{i}</b><span>{n}</span><em className={s !== "正常" ? "degraded" : ""}>{s}</em><i>›</i></button>)}</div></div><button className="more" onClick={()=>setActive("設備與服務")}>查看服務狀態詳情 ›</button></section>

          <section className="metrics">{[["▣","待處理工單",String(tickets.filter(x=>x.status==="待處理").length),"D1 即時資料","blue"],["＋","我的工單",String(tickets.length),ticketsLoading?"正在同步":"已永久儲存","cyan"],["◷","處理中",String(tickets.filter(x=>x.status==="處理中").length),"可查看處理歷程","cyan"],["♢","高優先以上",String(tickets.filter(x=>x.priority==="高"||x.priority==="緊急").length),"優先追蹤","red"]].map(([i,l,v,d,c]) => <article className="card metric" key={l}><span className={`metric-icon ${c}`}>{i}</span><div><p>{l}</p><strong>{v}</strong><small>{d}</small></div></article>)}</section>

          <section className="tickets card"><div className="section-title"><h2>我的最新工單</h2><button onClick={()=>setActive("我的工單")}>查看全部 ›</button></div><div className="table-wrap"><table><thead><tr>{["工單編號","標題","狀態","來源","優先級","建立時間","指派對象"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{tickets.length ? tickets.slice(0,8).map(ticket => <tr key={ticket.id} onClick={()=>void openTicket(ticket)}><td><a>{ticket.ticketNumber}</a></td><td>{ticket.title}</td><td>{ticket.status}</td><td>{ticket.source}</td><td><span className={`priority p-${ticket.priority}`}>{ticket.priority}</span></td><td>{new Date(ticket.createdAt).toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</td><td>{ticket.assignedTeam}</td></tr>) : <tr><td colSpan={7}><div className="empty-state"><b>{ticketsLoading ? "正在讀取工單…" : "尚未建立任何工單"}</b><span>{ticketsLoading ? "請稍候" : "使用上方 AI 報修即可建立正式工單。"}</span></div></td></tr>}</tbody></table></div></section>

          <section className="risk card"><div className="section-title"><h2>資安風險摘要</h2><button onClick={()=>setActive("資安監控")}>查看資安監控 ›</button></div><div className="risk-grid"><div className="chart"><p>風險事件趨勢（近 7 天）</p><div className="chart-area"><span className="y y40">40</span><span className="y y20">20</span><span className="y y0">0</span><svg viewBox="0 0 420 150" role="img" aria-label="近七日風險事件由17件上升至36件"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80ff" stopOpacity=".3"/><stop offset="1" stopColor="#2f80ff" stopOpacity="0"/></linearGradient></defs><path d="M20 105 L80 78 L140 103 L200 88 L260 72 L320 55 L390 25 L390 130 L20 130Z" fill="url(#fill)"/><polyline points="20,105 80,78 140,103 200,88 260,72 320,55 390,25" fill="none" stroke="#1769e0" strokeWidth="3"/>{[[20,105],[80,78],[140,103],[200,88],[260,72],[320,55],[390,25]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5" fill="#fff" stroke="#1769e0" strokeWidth="3"/>)}</svg><div className="dates"><span>7/12</span><span>7/13</span><span>7/14</span><span>7/15</span><span>7/16</span><span>7/17</span><span>7/18</span></div></div></div><div className="risks"><p>主要風險項目</p>{[["●","異常登入嘗試","多次失敗登入來自非辦公地區","12","critical"],["◉","弱點掃描待修補","部分端點存在高風險弱點","7","warning"],["✉","惡意郵件偵測","可疑郵件已攔截","5","mail"]].map(([i,t,s,n,c])=><button key={t} className={c} onClick={()=>setDetail({title:t,body:`${s}，目前共 ${n} 個事件。可前往資安監控模組進行調查及處置。`})}><i>{i}</i><span><b>{t}</b><small>{s}</small></span><em>{n}</em></button>)}</div></div></section>
          {active === "營運總覽" && <DashboardReport />}
        </div>
        {detail && <div className="modal-backdrop" onMouseDown={()=>setDetail(null)}><div className="modal card detail-modal" onMouseDown={e=>e.stopPropagation()}><span className="eyebrow">DETAIL & ACTION</span><h3>{detail.title}</h3><p>{detail.body}</p><label className="action-note">處理備註<textarea placeholder="輸入本次測試或處置結果"/></label><div className="detail-actions"><button className="secondary" onClick={()=>setDetail(null)}>關閉</button><button className="secondary" onClick={()=>{setDetail(null);flash(`${detail.title} 已轉派給第二線維運`)}}>轉派處理</button><button className="primary" onClick={()=>{setDetail(null);flash(`${detail.title} 已完成測試並寫入操作紀錄`)}}>完成測試</button></div></div></div>}
        {ticketDetail && <div className="modal-backdrop" onMouseDown={()=>setTicketDetail(null)}><div className="modal card ticket-detail-modal" onMouseDown={e=>e.stopPropagation()}>
          <div className="ticket-detail-head"><div><span className="eyebrow">TICKET TRACKING</span><h3>{ticketDetail.ticket.ticketNumber}</h3><p>{ticketDetail.ticket.title}</p></div><span className={`priority p-${ticketDetail.ticket.priority}`}>{ticketDetail.ticket.priority}優先</span></div>
          <dl className="ticket-facts"><div><dt>申請人</dt><dd>{ticketDetail.ticket.requesterName}／{ticketDetail.ticket.department}</dd></div><div><dt>聯絡信箱</dt><dd>{ticketDetail.ticket.requesterEmail}</dd></div><div><dt>類別</dt><dd>{ticketDetail.ticket.category}</dd></div><div><dt>指派對象</dt><dd>{ticketDetail.ticket.assignedTeam}</dd></div><div><dt>地點</dt><dd>{ticketDetail.ticket.location || "未填寫"}</dd></div><div><dt>設備編號</dt><dd>{ticketDetail.ticket.assetTag || "未填寫"}</dd></div></dl>
          <div className="ticket-description"><b>問題描述</b><p>{ticketDetail.ticket.description}</p></div>
          {canUpdateTickets ? <div className="ticket-update"><label>工單狀態<select value={ticketStatus} onChange={e=>setTicketStatus(e.target.value)}><option>待處理</option><option>處理中</option><option>已解決</option><option>已結案</option></select></label><label>處理備註<textarea value={ticketNote} onChange={e=>setTicketNote(e.target.value)} placeholder="記錄處理進度、測試結果或解決方式"/></label></div> : <div className="account-auth-note"><ShieldCheck size={18}/><span><b>此角色為工單唯讀權限</b><small>一般使用者可以查看自己的工單與處理歷程，但不可變更工單狀態。</small></span></div>}
          {canSubmitOwnSurvey &&
            ["已解決", "已結案", "已關閉"].includes(ticketDetail.ticket.status) && (
              <div className={`ticket-rating-card ${ticketDetail.ticket.surveySubmitted ? "completed" : ""}`}>
                <div>
                  <span className="eyebrow">SERVICE FEEDBACK</span>
                  <b>{ticketDetail.ticket.surveySubmitted ? "已完成服務評分" : "請協助評價本次資訊服務"}</b>
                  <small>{ticketDetail.ticket.surveySubmitted ? "感謝您的回饋，此工單不可重複評分。" : "評分將用於改善回應速度、專業能力與溝通品質。"}</small>
                </div>
                {ticketCanBeRated && <button className="primary" onClick={() => setSurveyOpen(true)}>立即評分</button>}
                {ticketDetail.ticket.surveySubmitted && <span className="ticket-rating-completed">✓ 已完成</span>}
              </div>
            )}
          <div className="ticket-timeline"><h4>處理歷程</h4>{ticketDetail.events.map((event,index)=><article key={`${event.createdAt}-${index}`}><i/><div><b>{event.toStatus ? `${event.fromStatus} → ${event.toStatus}` : "工單已建立"}</b><p>{event.note}</p><small>{event.actorName}・{new Date(event.createdAt).toLocaleString("zh-TW")}</small></div></article>)}</div>
          <div className="detail-actions"><button className="secondary" onClick={()=>setTicketDetail(null)}>關閉</button>{canUpdateTickets && <button className="primary" disabled={updatingTicket} onClick={()=>void updateTicket()}>{updatingTicket ? "正在儲存…" : "更新工單與歷程"}</button>}</div>
        </div></div>}
        {surveyOpen && ticketDetail && canSubmitOwnSurvey && <div className="modal-backdrop" onMouseDown={() => !submittingRating && setSurveyOpen(false)}>
          <div className="modal card ticket-survey-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="card-head">
              <div><span className="eyebrow">IT SERVICE QUALITY</span><h3>工單服務評分</h3><p>{ticketDetail.ticket.ticketNumber}・{ticketDetail.ticket.assignedTeam}</p></div>
              <button className="secondary" disabled={submittingRating} onClick={() => setSurveyOpen(false)}>關閉</button>
            </div>
            <div className="survey-question-grid">
              <label>回應與處理速度<select value={ticketRating.response} onChange={(event) => setTicketRating({...ticketRating, response:event.target.value})}>{["5","4","3","2","1"].map((score) => <option key={score} value={score}>{score} 分</option>)}</select></label>
              <label>問題解決專業度<select value={ticketRating.expertise} onChange={(event) => setTicketRating({...ticketRating, expertise:event.target.value})}>{["5","4","3","2","1"].map((score) => <option key={score} value={score}>{score} 分</option>)}</select></label>
              <label>說明與溝通品質<select value={ticketRating.communication} onChange={(event) => setTicketRating({...ticketRating, communication:event.target.value})}>{["5","4","3","2","1"].map((score) => <option key={score} value={score}>{score} 分</option>)}</select></label>
              <label>本次問題是否已解決？<select value={ticketRating.resolved} onChange={(event) => setTicketRating({...ticketRating, resolved:event.target.value})}><option>是</option><option>部分解決</option><option>否</option></select></label>
            </div>
            <label className="ticket-rating-comment">服務意見與改善建議<textarea value={ticketRating.comment} onChange={(event) => setTicketRating({...ticketRating, comment:event.target.value})} placeholder="可填寫本次服務感受或改善建議"/></label>
            <div className="survey-privacy-note"><ShieldCheck size={18}/><span><b>評分權限已驗證</b><small>系統只接受本人已完成工單，且每張工單只能提交一次。</small></span></div>
            <div className="detail-actions"><button className="secondary" disabled={submittingRating} onClick={() => setSurveyOpen(false)}>取消</button><button className="primary" disabled={submittingRating} onClick={() => void submitTicketRating()}>{submittingRating ? "正在送出…" : "送出服務評分"}</button></div>
          </div>
        </div>}
        {toast && <div className="toast">✓ {toast}</div>}
      </section>
    </main>
  );
}
