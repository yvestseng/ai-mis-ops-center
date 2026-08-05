"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  ChartNoAxesCombined,
  Database,
  FileClock,
  Pencil,
  Plus,
  ServerCog,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  department: string | null;
  roleCode: string;
  roleName: string;
  permissions: string[];
  mustChangePassword?: boolean;
};

type ApiItem = Record<string, string | number | boolean | null>;
const allPermissions = [
  ["dashboard.read", "查看營運 Dashboard"],
  ["tickets.create", "建立工單"],
  ["tickets.read.own", "查看個人工單"],
  ["tickets.read.all", "查看全部工單"],
  ["tickets.update", "更新工單狀態"],
  ["tickets.assign", "轉派工單團隊與處理人員"],
  ["assets.read", "查看設備"],
  ["assets.write", "維護設備"],
  ["services.read", "查看服務"],
  ["services.write", "維護服務"],
  ["surveys.submit.own", "一般使用者評價自己的已完成工單"],
  ["surveys.read.own", "查看自己的服務評分"],
  ["surveys.read", "查看問卷報表"],
  ["surveys.read.all", "查看全部服務調查"],
  ["surveys.followup.manage", "管理低分改善追蹤"],
  ["rbac.manage", "管理帳號與角色"],
  ["audit.read", "查看稽核紀錄"],
] as const;

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const result = (await response.json()) as {
    items?: ApiItem[];
    message?: string;
  };
  if (!response.ok) throw new Error(result.message || "資料處理失敗");
  return result;
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal card data-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="card-head">
          <div>
            <span className="eyebrow">DATABASE FORM</span>
            <h3>{title}</h3>
          </div>
          <button className="secondary" onClick={onClose}>
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RbacConsole() {
  const [users, setUsers] = useState<ApiItem[]>([]);
  const [roles, setRoles] = useState<ApiItem[]>([]);
  const [teams, setTeams] = useState<ApiItem[]>([]);
  const [auditItems, setAuditItems] = useState<ApiItem[]>([]);
  const [tab, setTab] = useState<
    "users" | "roles" | "teams" | "members" | "audit"
  >("users");
  const [modal, setModal] = useState<"user" | "password" | "team" | null>(null);
  const [editingTeam, setEditingTeam] = useState<ApiItem | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    department: "",
    roleId: "role-user",
    teamId: "",
    isAssignable: false,
  });
  const [teamForm, setTeamForm] = useState({
    teamCode: "",
    teamName: "",
    description: "",
    displayOrder: 10,
    isActive: true,
  });
  const [passwordTarget, setPasswordTarget] = useState<ApiItem | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, r, a, t] = await Promise.all([
      api("/api/admin/users"),
      api("/api/admin/roles"),
      api("/api/admin/audit"),
      api("/api/admin/teams"),
    ]);
    setUsers(u.items || []);
    setRoles(r.items || []);
    setAuditItems(a.items || []);
    setTeams(t.items || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void load().catch((error) => setMessage(error.message)),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [load]);
  const flash = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2400);
  };

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setModal(null);
      setForm({
        username: "",
        password: "",
        displayName: "",
        email: "",
        department: "",
        roleId: "role-user",
        teamId: "",
        isAssignable: false,
      });
      await load();
      flash(result.message || "使用者已建立");
    } catch (error) {
      flash(error instanceof Error ? error.message : "建立使用者失敗");
    } finally {
      setBusy(false);
    }
  }
  async function updateUser(id: string, changes: Record<string, unknown>) {
    setUpdatingUserId(id);
    try {
      const result = await api(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await load();
      flash(result.message || "使用者已更新");
    } catch (error) {
      flash(error instanceof Error ? error.message : "使用者更新失敗");
    } finally {
      setUpdatingUserId(null);
    }
  }
  async function toggleUserStatus(user: ApiItem) {
    const id = String(user.id);
    const isEnabled = user.status === "active";
    const name = String(user.displayName || user.username || user.email);
    const notice = isEnabled
      ? `確定要停用「${name}」嗎？\n\n此帳號將無法再登入，且所有既有登入工作階段會立即失效。`
      : `確定要啟用「${name}」嗎？\n\n啟用後，使用者可依帳號狀態與角色權限重新登入。`;
    if (!window.confirm(notice)) return;
    await updateUser(id, { status: isEnabled ? "disabled" : "active" });
  }
  async function removeUser(id: string) {
    if (!window.confirm("確定要刪除此使用者？")) return;
    const result = await api(`/api/admin/users/${id}`, { method: "DELETE" });
    await load();
    flash(result.message || "使用者已刪除");
  }
  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordTarget) return;
    setBusy(true);
    try {
      const result = await api(`/api/admin/users/${passwordTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ username: resetUsername, newPassword }),
      });
      setModal(null);
      setPasswordTarget(null);
      setResetUsername("");
      setNewPassword("");
      await load();
      flash(result.message || "密碼已重設；使用者下次登入必須變更密碼。");
    } catch (error) {
      flash(error instanceof Error ? error.message : "重設密碼失敗");
    } finally {
      setBusy(false);
    }
  }
  async function saveTeam(event: React.FormEvent) {
    event.preventDefault();
    const path = editingTeam
      ? `/api/admin/teams/${editingTeam.id}`
      : "/api/admin/teams";
    const result = await api(path, {
      method: editingTeam ? "PATCH" : "POST",
      body: JSON.stringify(teamForm),
    });
    setModal(null);
    setEditingTeam(null);
    setTeamForm({
      teamCode: "",
      teamName: "",
      description: "",
      displayOrder: 10,
      isActive: true,
    });
    await load();
    flash(result.message || "維運團隊已儲存");
  }
  function openTeam(team?: ApiItem) {
    setEditingTeam(team || null);
    setTeamForm(
      team
        ? {
            teamCode: String(team.teamCode || ""),
            teamName: String(team.teamName || ""),
            description: String(team.description || ""),
            displayOrder: Number(team.displayOrder || 0),
            isActive: Boolean(team.isActive),
          }
        : {
            teamCode: "",
            teamName: "",
            description: "",
            displayOrder: (teams.length + 1) * 10,
            isActive: true,
          },
    );
    setModal("team");
  }
  async function removeTeam(id: string) {
    if (
      !window.confirm(
        "確定要刪除或停用此維運團隊？已有關聯資料時系統會自動改為停用。",
      )
    )
      return;
    const result = await api(`/api/admin/teams/${id}`, { method: "DELETE" });
    await load();
    flash(result.message || "團隊已處理");
  }
  async function toggleRolePermission(role: ApiItem, permission: string) {
    const roleCode = String(role.code);
    const userOnlyPermissions = new Set([
      "surveys.submit.own",
      "surveys.read.own",
    ]);
    if (userOnlyPermissions.has(permission) && roleCode !== "user")
      return flash("服務評分權限僅能授予一般使用者");
    if (roleCode === "user" && userOnlyPermissions.has(permission))
      return flash("一般使用者的服務評分權限為必要權限，不可移除");
    const current = JSON.parse(String(role.permissions || "[]")) as string[];
    const permissions = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    await api(`/api/admin/roles/${role.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    });
    await load();
    flash("角色權限已儲存並立即生效");
  }
  const operationalUsers = users.filter(
    (user) => String(user.roleCode) !== "user",
  );

  return (
    <section className="management-console">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SERVER-SIDE RBAC</span>
          <h2>權限管理</h2>
          <p>集中管理使用者與角色、維運團隊、派工成員及稽核紀錄。</p>
        </div>
        {tab === "teams" ? (
          <button className="primary" onClick={() => openTeam()}>
            <Plus size={16} /> 新增團隊
          </button>
        ) : tab === "users" ? (
          <button className="primary" onClick={() => setModal("user")}>
            <Plus size={16} /> 新增使用者
          </button>
        ) : null}
      </div>
      <div className="admin-stats">
        <article>
          <b>{users.length}</b>
          <span>授權帳號</span>
        </article>
        <article>
          <b>{teams.filter((x) => Boolean(x.isActive)).length}</b>
          <span>啟用團隊</span>
        </article>
        <article>
          <b>
            {operationalUsers.filter((x) => Boolean(x.isAssignable)).length}
          </b>
          <span>可派工成員</span>
        </article>
        <article>
          <b>{auditItems.length}</b>
          <span>最近稽核事件</span>
        </article>
      </div>
      <nav className="governance-tabs card">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          <UsersRound size={15} /> 使用者與角色
        </button>
        <button
          className={tab === "roles" ? "active" : ""}
          onClick={() => setTab("roles")}
        >
          <ShieldCheck size={15} /> 角色權限
        </button>
        <button
          className={tab === "teams" ? "active" : ""}
          onClick={() => setTab("teams")}
        >
          <Building2 size={15} /> 維運團隊
        </button>
        <button
          className={tab === "members" ? "active" : ""}
          onClick={() => setTab("members")}
        >
          <UserCog size={15} /> 派工成員
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          <FileClock size={15} /> 稽核紀錄
        </button>
      </nav>

      {tab === "users" && (
        <div className="card data-table">
          <div className="account-auth-note">
            <ShieldCheck size={18} />
            <span>
              <b>使用者與角色管理</b>
              <small>
                可使用 Enable／Disable
                管理帳號登入資格；停用會立即撤銷帳號的既有工作階段。維運團隊及派工資格請至「派工成員」管理。
              </small>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>使用者</th>
                <th>登入帳號</th>
                <th>部門</th>
                <th>角色</th>
                <th>密碼狀態</th>
                <th>狀態</th>
                <th>最近登入</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isEnabled = user.status === "active";
                const isUpdating = updatingUserId === String(user.id);
                return (
                  <tr key={String(user.id)}>
                    <td>
                      <b>{String(user.displayName)}</b>
                      <small>{String(user.email)}</small>
                    </td>
                    <td>
                      <b>{String(user.username || "尚未設定")}</b>
                    </td>
                    <td>{String(user.department || "未設定")}</td>
                    <td>
                      <select
                        value={String(user.roleId)}
                        disabled={isUpdating}
                        onChange={(event) =>
                          void updateUser(String(user.id), {
                            roleId: event.target.value,
                          })
                        }
                      >
                        {roles.map((role) => (
                          <option key={String(role.id)} value={String(role.id)}>
                            {String(role.name)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`sso-pill ${user.hasPassword ? "ready" : ""}`}
                      >
                        {!user.hasPassword
                          ? "待重設"
                          : user.mustChangePassword
                            ? "首次登入需變更"
                            : "可登入"}
                      </span>
                    </td>
                    <td>
                      <span className={`state-pill ${isEnabled ? "good" : ""}`}>
                        {isEnabled ? "已啟用" : "已停用"}
                      </span>
                    </td>
                    <td>
                      {user.lastLoginAt
                        ? new Date(String(user.lastLoginAt)).toLocaleString(
                            "zh-TW",
                          )
                        : "待首次登入"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className={`account-status-action ${isEnabled ? "disable" : "enable"}`}
                          disabled={isUpdating}
                          aria-label={`${isEnabled ? "停用" : "啟用"} ${String(user.displayName)}`}
                          title={isEnabled ? "Disable 帳號" : "Enable 帳號"}
                          onClick={() => void toggleUserStatus(user)}
                        >
                          {isUpdating
                            ? "處理中…"
                            : isEnabled
                              ? "Disable"
                              : "Enable"}
                        </button>
                        <button
                          disabled={isUpdating}
                          aria-label="重設密碼"
                          title="重設密碼"
                          onClick={() => {
                            setPasswordTarget(user);
                            setResetUsername(
                              String(user.username || user.email || "")
                                .split("@")[0]
                                .toLowerCase(),
                            );
                            setNewPassword("");
                            setModal("password");
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled={isUpdating}
                          aria-label="刪除使用者"
                          title="刪除使用者"
                          onClick={() => void removeUser(String(user.id))}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "roles" && (
        <div className="role-grid">
          {roles.map((role) => {
            const permissions = JSON.parse(
              String(role.permissions || "[]"),
            ) as string[];
            return (
              <article className="card role-card" key={String(role.id)}>
                <div className="card-head">
                  <div>
                    <h3>{String(role.name)}</h3>
                    <p>
                      {String(role.code)} · {permissions.length} 項權限
                    </p>
                  </div>
                  <ShieldCheck size={24} />
                </div>
                <div className="permission-checks">
                  {allPermissions.map(([code, label]) => (
                    <label key={code}>
                      <span>
                        {label}
                        <small>{code}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.includes(code)}
                        disabled={
                          role.code === "admin" ||
                          ((code === "surveys.submit.own" ||
                            code === "surveys.read.own") &&
                            role.code !== "user") ||
                          (role.code === "user" &&
                            (code === "surveys.submit.own" ||
                              code === "surveys.read.own"))
                        }
                        onChange={() => void toggleRolePermission(role, code)}
                      />
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "teams" && (
        <div className="card data-table">
          <div className="account-auth-note">
            <Building2 size={18} />
            <span>
              <b>維運團隊主檔</b>
              <small>
                可新增、編輯、排序及停用。已有工單或成員關聯的團隊刪除時會自動改為停用，以保留歷史資料。
              </small>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>排序</th>
                <th>團隊</th>
                <th>代碼</th>
                <th>說明</th>
                <th>成員</th>
                <th>可派工</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={String(team.id)}>
                  <td>{String(team.displayOrder)}</td>
                  <td>
                    <b>{String(team.teamName)}</b>
                  </td>
                  <td>
                    <code>{String(team.teamCode)}</code>
                  </td>
                  <td>{String(team.description || "—")}</td>
                  <td>{String(team.memberCount || 0)}</td>
                  <td>{String(team.assignableCount || 0)}</td>
                  <td>
                    <span
                      className={`state-pill ${team.isActive ? "good" : ""}`}
                    >
                      {team.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        aria-label="編輯團隊"
                        onClick={() => openTeam(team)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="刪除或停用團隊"
                        onClick={() => void removeTeam(String(team.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "members" && (
        <div className="card data-table">
          <div className="account-auth-note">
            <UserCog size={18} />
            <span>
              <b>派工成員管理</b>
              <small>
                只有系統管理員與 MIS
                維運人員可設定團隊及接受派工；一般使用者不會出現在工單處理人員清單。
              </small>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>成員</th>
                <th>角色</th>
                <th>部門</th>
                <th>所屬團隊</th>
                <th>可接受派工</th>
                <th>帳號狀態</th>
              </tr>
            </thead>
            <tbody>
              {operationalUsers.map((user) => (
                <tr key={String(user.id)}>
                  <td>
                    <b>{String(user.displayName)}</b>
                    <small>{String(user.email)}</small>
                  </td>
                  <td>{String(user.roleName)}</td>
                  <td>{String(user.department || "未設定")}</td>
                  <td>
                    <select
                      value={String(user.teamId || "")}
                      onChange={(event) =>
                        void updateUser(String(user.id), {
                          teamId: event.target.value,
                          isAssignable: event.target.value
                            ? Boolean(user.isAssignable)
                            : false,
                        })
                      }
                    >
                      <option value="">未指定</option>
                      {teams
                        .filter(
                          (team) =>
                            Boolean(team.isActive) ||
                            String(team.id) === String(user.teamId),
                        )
                        .map((team) => (
                          <option key={String(team.id)} value={String(team.id)}>
                            {String(team.teamName)}
                            {team.isActive ? "" : "（已停用）"}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <label className="inline-switch">
                      <input
                        type="checkbox"
                        checked={Boolean(user.isAssignable)}
                        disabled={!user.teamId || user.status !== "active"}
                        onChange={(event) =>
                          void updateUser(String(user.id), {
                            teamId: user.teamId,
                            isAssignable: event.target.checked,
                          })
                        }
                      />
                      <span>{user.isAssignable ? "可派工" : "不可派工"}</span>
                    </label>
                  </td>
                  <td>
                    <span
                      className={`state-pill ${user.status === "active" ? "good" : ""}`}
                    >
                      {user.status === "active" ? "啟用" : "停用"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="card data-table">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>操作者</th>
                <th>動作</th>
                <th>資料類型</th>
                <th>識別碼</th>
              </tr>
            </thead>
            <tbody>
              {auditItems.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {new Date(String(row.createdAt)).toLocaleString("zh-TW")}
                  </td>
                  <td>{String(row.actorEmail)}</td>
                  <td>
                    <span className="state-pill">{String(row.action)}</span>
                  </td>
                  <td>{String(row.entityType)}</td>
                  <td>{String(row.entityId || "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "user" && (
        <Modal title="新增測試使用者" onClose={() => !busy && setModal(null)}>
          <form
            className="data-form"
            onSubmit={(event) => void createUser(event)}
          >
            <div className="auth-method-note wide">
              <ShieldCheck size={19} />
              <span>
                <b>建立帳號後首次登入需變更密碼</b>
                <small>
                  初始密碼至少 8
                  碼，需包含英文大小寫、數字與特殊符號；系統只保存不可逆的密碼雜湊。
                </small>
              </span>
            </div>
            <label>
              登入帳號
              <input
                required
                autoComplete="off"
                value={form.username}
                onChange={(event) =>
                  setForm({
                    ...form,
                    username: event.target.value.toLowerCase(),
                  })
                }
              />
            </label>
            <label>
              初始密碼
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </label>
            <label>
              姓名
              <input
                required
                value={form.displayName}
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
              />
            </label>
            <label>
              電子郵件
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label>
              部門
              <input
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
              />
            </label>
            <label>
              角色
              <select
                value={form.roleId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    roleId: event.target.value,
                    teamId:
                      event.target.value === "role-user" ? "" : form.teamId,
                    isAssignable:
                      event.target.value === "role-user"
                        ? false
                        : form.isAssignable,
                  })
                }
              >
                {roles.map((role) => (
                  <option key={String(role.id)} value={String(role.id)}>
                    {String(role.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              維運團隊
              <select
                value={form.teamId}
                disabled={form.roleId === "role-user"}
                onChange={(event) =>
                  setForm({ ...form, teamId: event.target.value })
                }
              >
                <option value="">未指定</option>
                {teams
                  .filter((team) => Boolean(team.isActive))
                  .map((team) => (
                    <option key={String(team.id)} value={String(team.id)}>
                      {String(team.teamName)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.isAssignable}
                disabled={form.roleId === "role-user" || !form.teamId}
                onChange={(event) =>
                  setForm({ ...form, isAssignable: event.target.checked })
                }
              />{" "}
              可接受工單指派
            </label>
            <div className="form-actions wide">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "建立中…" : "建立使用者"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "password" && passwordTarget && (
        <Modal
          title={`設定 ${String(passwordTarget.displayName)} 登入資料`}
          onClose={() => !busy && setModal(null)}
        >
          <form
            className="data-form"
            onSubmit={(event) => void resetPassword(event)}
          >
            <label>
              登入帳號
              <input
                required
                minLength={3}
                value={resetUsername}
                onChange={(event) =>
                  setResetUsername(event.target.value.toLowerCase())
                }
              />
            </label>
            <label>
              新密碼
              <input
                required
                minLength={8}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <p className="wide">
              儲存後會撤銷舊工作階段，使用者下次登入必須變更密碼。
            </p>
            <div className="form-actions wide">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "儲存中…" : "儲存登入資料"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "team" && (
        <Modal
          title={editingTeam ? "編輯維運團隊" : "新增維運團隊"}
          onClose={() => setModal(null)}
        >
          <form
            className="data-form"
            onSubmit={(event) => void saveTeam(event)}
          >
            <label>
              團隊代碼
              <input
                required
                value={teamForm.teamCode}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    teamCode: event.target.value.toUpperCase(),
                  })
                }
                placeholder="例如 NETWORK"
              />
            </label>
            <label>
              團隊名稱
              <input
                required
                value={teamForm.teamName}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, teamName: event.target.value })
                }
              />
            </label>
            <label>
              顯示順序
              <input
                type="number"
                min="0"
                max="9999"
                value={teamForm.displayOrder}
                onChange={(event) =>
                  setTeamForm({
                    ...teamForm,
                    displayOrder: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={teamForm.isActive}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, isActive: event.target.checked })
                }
              />{" "}
              啟用團隊
            </label>
            <label className="wide">
              團隊說明
              <textarea
                value={teamForm.description}
                onChange={(event) =>
                  setTeamForm({ ...teamForm, description: event.target.value })
                }
              />
            </label>
            <div className="form-actions wide">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(null)}
              >
                取消
              </button>
              <button className="primary">儲存團隊</button>
            </div>
          </form>
        </Modal>
      )}
      {message && <div className="toast">{message}</div>}
    </section>
  );
}

export function ResourceConsole({
  entity,
  canWrite = false,
}: {
  entity: "assets" | "services";
  canWrite?: boolean;
}) {
  const isAsset = entity === "assets";
  const [items, setItems] = useState<ApiItem[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ApiItem | "new" | null>(null);
  const [message, setMessage] = useState("");
  const empty: Record<string, string | number> = isAsset
    ? {
        assetTag: "",
        name: "",
        assetType: "筆記型電腦",
        ownerName: "",
        department: "",
        location: "",
        status: "使用中",
        warrantyEnd: "",
        notes: "",
      }
    : {
        name: "",
        serviceType: "SaaS",
        ownerTeam: "MIS 服務台",
        status: "正常",
        availability: 99.9,
        endpoint: "",
        description: "",
      };

  const [form, setForm] = useState<Record<string, string | number>>(() => ({
    ...empty,
  }));

  const load = useCallback(async () => {
    const result = await api(`/api/admin/${entity}`);
    setItems(result.items || []);
  }, [entity]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const shown = useMemo(
    () =>
      items.filter((item) =>
        Object.values(item)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const flash = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2400);
  };

  function open(item?: ApiItem) {
    setEditing(item ?? "new");

    if (!item) {
      setForm({ ...empty });
      return;
    }

    const normalizedForm = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        typeof value === "boolean" ? Number(value) : (value ?? ""),
      ]),
    ) as Record<string, string | number>;

    setForm(normalizedForm);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const id = editing && editing !== "new" ? String(editing.id) : null;
    const result = await api(`/api/admin/${entity}${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(form),
    });
    setEditing(null);
    await load();
    flash(result.message || "資料已儲存");
  }
  async function remove(id: string) {
    if (!window.confirm("確定要刪除此筆資料？")) return;
    const result = await api(`/api/admin/${entity}/${id}`, {
      method: "DELETE",
    });
    await load();
    flash(result.message || "資料已刪除");
  }
  const update = (key: string, value: string | number) =>
    setForm({ ...form, [key]: value });

  return (
    <section className="management-console">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {isAsset ? "ASSET DATABASE" : "SERVICE CATALOG"}
          </span>
          <h2>{isAsset ? "設備資產管理" : "企業服務管理"}</h2>
          <p>
            {isAsset
              ? "管理設備生命週期、使用人、位置與保固資料。"
              : "管理服務目錄、負責團隊、健康度與可用率。"}
          </p>
        </div>
        {canWrite ? (
          <button className="primary" onClick={() => open()}>
            <Plus size={16} /> {isAsset ? "新增設備" : "新增服務"}
          </button>
        ) : (
          <span className="access-badge">
            <i />
            唯讀權限
          </span>
        )}
      </div>
      <div className="resource-summary">
        <article className="card">
          <span>{isAsset ? <Boxes /> : <ServerCog />}</span>
          <div>
            <b>{items.length}</b>
            <small>{isAsset ? "設備總數" : "服務總數"}</small>
          </div>
        </article>
        <article className="card">
          <span>
            <Database />
          </span>
          <div>
            <b>
              {
                items.filter((x) => x.status === (isAsset ? "使用中" : "正常"))
                  .length
              }
            </b>
            <small>{isAsset ? "使用中" : "健康服務"}</small>
          </div>
        </article>
        <article className="card">
          <span>
            <ChartNoAxesCombined />
          </span>
          <div>
            <b>
              {isAsset
                ? items.filter((x) => x.status === "維修中").length
                : `${Math.round((Number(items.reduce((sum, x) => sum + Number(x.availability || 0), 0)) / Math.max(items.length, 1)) * 10) / 10}%`}
            </b>
            <small>{isAsset ? "維修中" : "平均可用率"}</small>
          </div>
        </article>
      </div>
      <div className="card data-table">
        <div className="card-head">
          <div>
            <h3>{isAsset ? "設備清冊" : "服務目錄"}</h3>
            <p>資料由 Cloudflare D1 即時讀取</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋資料…"
            aria-label="搜尋資料"
          />
        </div>
        <table>
          <thead>
            <tr>
              {(isAsset
                ? [
                    "設備編號",
                    "名稱／類型",
                    "使用人",
                    "部門／地點",
                    "狀態",
                    "保固到期",
                    "操作",
                  ]
                : [
                    "服務名稱",
                    "類型",
                    "負責團隊",
                    "狀態",
                    "可用率",
                    "最後檢查",
                    "操作",
                  ]
              ).map((value) => (
                <th key={value}>{value}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={String(item.id)}>
                {isAsset ? (
                  <>
                    <td>
                      <b>{String(item.assetTag)}</b>
                    </td>
                    <td>
                      <b>{String(item.name)}</b>
                      <small>{String(item.assetType)}</small>
                    </td>
                    <td>{String(item.ownerName || "未指派")}</td>
                    <td>
                      {String(item.department || "—")}
                      <small>{String(item.location || "—")}</small>
                    </td>
                    <td>
                      <span
                        className={`state-pill ${item.status === "使用中" ? "good" : ""}`}
                      >
                        {String(item.status)}
                      </span>
                    </td>
                    <td>{String(item.warrantyEnd || "未設定")}</td>
                  </>
                ) : (
                  <>
                    <td>
                      <b>{String(item.name)}</b>
                    </td>
                    <td>{String(item.serviceType)}</td>
                    <td>{String(item.ownerTeam)}</td>
                    <td>
                      <span
                        className={`state-pill ${item.status === "正常" ? "good" : ""}`}
                      >
                        {String(item.status)}
                      </span>
                    </td>
                    <td>{String(item.availability)}%</td>
                    <td>
                      {item.lastCheckedAt
                        ? new Date(String(item.lastCheckedAt)).toLocaleString(
                            "zh-TW",
                          )
                        : "尚未檢查"}
                    </td>
                  </>
                )}
                <td className="row-actions">
                  {canWrite ? (
                    <>
                      <button aria-label="編輯" onClick={() => open(item)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="刪除"
                        onClick={() => void remove(String(item.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <span>唯讀</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty-state">
            <b>目前沒有資料</b>
            <span>
              {canWrite
                ? "使用右上角按鈕建立第一筆資料。"
                : "目前沒有可顯示的資料。"}
            </span>
          </div>
        )}
      </div>
      {editing && (
        <Modal
          title={`${editing === "new" ? "新增" : "編輯"}${isAsset ? "設備" : "服務"}`}
          onClose={() => setEditing(null)}
        >
          <form className="data-form" onSubmit={(event) => void save(event)}>
            {isAsset ? (
              <>
                <label>
                  設備編號
                  <input
                    required
                    disabled={editing !== "new"}
                    value={String(form.assetTag)}
                    onChange={(e) => update("assetTag", e.target.value)}
                  />
                </label>
                <label>
                  設備名稱
                  <input
                    required
                    value={String(form.name)}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </label>
                <label>
                  設備類型
                  <select
                    value={String(form.assetType)}
                    onChange={(e) => update("assetType", e.target.value)}
                  >
                    <option>筆記型電腦</option>
                    <option>桌上型電腦</option>
                    <option>伺服器</option>
                    <option>網路設備</option>
                    <option>行動裝置</option>
                    <option>周邊設備</option>
                  </select>
                </label>
                <label>
                  使用人
                  <input
                    value={String(form.ownerName)}
                    onChange={(e) => update("ownerName", e.target.value)}
                  />
                </label>
                <label>
                  部門
                  <input
                    value={String(form.department)}
                    onChange={(e) => update("department", e.target.value)}
                  />
                </label>
                <label>
                  地點
                  <input
                    value={String(form.location)}
                    onChange={(e) => update("location", e.target.value)}
                  />
                </label>
                <label>
                  狀態
                  <select
                    value={String(form.status)}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option>使用中</option>
                    <option>庫存</option>
                    <option>維修中</option>
                    <option>已報廢</option>
                  </select>
                </label>
                <label>
                  保固到期
                  <input
                    type="date"
                    value={String(form.warrantyEnd)}
                    onChange={(e) => update("warrantyEnd", e.target.value)}
                  />
                </label>
                <label className="wide">
                  備註
                  <textarea
                    value={String(form.notes)}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  服務名稱
                  <input
                    required
                    value={String(form.name)}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </label>
                <label>
                  服務類型
                  <select
                    value={String(form.serviceType)}
                    onChange={(e) => update("serviceType", e.target.value)}
                  >
                    <option>SaaS</option>
                    <option>網路服務</option>
                    <option>內部系統</option>
                    <option>資安服務</option>
                    <option>基礎架構</option>
                  </select>
                </label>
                <label>
                  負責團隊
                  <input
                    required
                    value={String(form.ownerTeam)}
                    onChange={(e) => update("ownerTeam", e.target.value)}
                  />
                </label>
                <label>
                  狀態
                  <select
                    value={String(form.status)}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option>正常</option>
                    <option>部分異常</option>
                    <option>中斷</option>
                    <option>維護中</option>
                  </select>
                </label>
                <label>
                  可用率（%）
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Number(form.availability)}
                    onChange={(e) =>
                      update("availability", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  監控端點
                  <input
                    value={String(form.endpoint)}
                    onChange={(e) => update("endpoint", e.target.value)}
                  />
                </label>
                <label className="wide">
                  說明
                  <textarea
                    value={String(form.description)}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </label>
              </>
            )}
            <div className="form-actions wide">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
              <button className="primary">儲存資料</button>
            </div>
          </form>
        </Modal>
      )}
      {message && <div className="toast">{message}</div>}
    </section>
  );
}

export function DashboardReport() {
  type DashboardData = {
    tickets?: ApiItem;
    assets?: ApiItem;
    services?: ApiItem;
    surveys?: ApiItem;
    ticketTrend?: ApiItem[];
    recentActivity?: ApiItem[];
  };
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setData(null);
          return;
        }

        const result = (await response.json()) as DashboardData;
        setData(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setData(null);
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, []);
  if (!data) return null;
  const max = Math.max(
    ...(data.ticketTrend || []).map((x: ApiItem) => Number(x.count)),
    1,
  );
  return (
    <section className="management-report card">
      <div className="section-title">
        <div>
          <span className="eyebrow">LIVE MANAGEMENT REPORT</span>
          <h2>即時管理報表</h2>
        </div>
        <span className="healthy">
          <i />
          D1 即時彙總
        </span>
      </div>
      <div className="report-kpis">
        <article>
          <b>{Number(data.tickets?.total || 0)}</b>
          <span>累計工單</span>
          <small>{Number(data.tickets?.resolved || 0)} 件已解決</small>
        </article>
        <article>
          <b>{Number(data.assets?.total || 0)}</b>
          <span>設備資產</span>
          <small>{Number(data.assets?.warranty_due || 0)} 件保固即將到期</small>
        </article>
        <article>
          <b>{Number(data.services?.availability || 0)}%</b>
          <span>服務可用率</span>
          <small>{Number(data.services?.healthy || 0)} 項運作正常</small>
        </article>
        <article>
          <b>{Number(data.surveys?.average_score || 0)}</b>
          <span>平均滿意度</span>
          <small>{Number(data.surveys?.total || 0)} 份有效問卷</small>
        </article>
      </div>
      <div className="report-body">
        <div>
          <h3>近 7 日工單趨勢</h3>
          <div className="bar-chart">
            {(data.ticketTrend || []).map((row: ApiItem) => (
              <div key={String(row.date)}>
                <span
                  style={{
                    height: `${Math.max(8, (Number(row.count) / max) * 100)}%`,
                  }}
                />
                <b>{Number(row.count)}</b>
                <small>{String(row.date).slice(5)}</small>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>最近管理活動</h3>
          <div className="activity-list">
            {(data.recentActivity || []).map((row: ApiItem, index: number) => (
              <article key={`${row.createdAt}-${index}`}>
                <i />
                <div>
                  <b>
                    {String(row.action)} · {String(row.entityType)}
                  </b>
                  <span>{String(row.actorEmail)}</span>
                  <small>
                    {new Date(String(row.createdAt)).toLocaleString("zh-TW")}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
