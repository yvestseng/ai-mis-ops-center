const tickets = [
  {
    id: "IT-20260725-001",
    subject: "Outlook 無法收信且顯示同步錯誤",
    status: "待人工確認",
    priority: "P2",
    category: "Email 問題",
    assignee: "林佳穎",
    sla: "28 分鐘內回應",
    ai: 82,
    risk: "中",
    requester: "財務部 王小姐",
    summary: "多位使用者回報 Outlook 同步錯誤，疑似 Microsoft 365 或網路連線異常。",
    response: "已建議確認 Exchange Online 健康狀態、使用者端同步設定與 DNS 解析。"
  },
  {
    id: "IT-20260725-002",
    subject: "VPN 連線後無法進入 ERP",
    status: "處理中",
    priority: "P3",
    category: "網路與連線",
    assignee: "陳柏安",
    sla: "3 小時 12 分",
    ai: 91,
    risk: "低",
    requester: "業務部 張先生",
    summary: "單一使用者 VPN 可連線但 ERP 無法存取，可能與路由、權限或 ERP 白名單有關。",
    response: "請確認 VPN 分配 IP、ERP 存取權限與防火牆紀錄。"
  },
  {
    id: "IT-20260725-003",
    subject: "疑似釣魚郵件要求重設密碼",
    status: "新建",
    priority: "P1",
    category: "資訊安全",
    assignee: "資安值班",
    sla: "12 分鐘內回應",
    ai: 96,
    risk: "高",
    requester: "人資部 李小姐",
    summary: "郵件要求使用者輸入 Microsoft 365 帳密，AI 判斷為高風險釣魚事件。",
    response: "需人工覆核，暫停自動回覆，建議立即隔離郵件並檢查點擊紀錄。"
  },
  {
    id: "IT-20260725-004",
    subject: "新進人員筆電與 Office 授權申請",
    status: "等待使用者",
    priority: "P4",
    category: "新增與異動",
    assignee: "吳怡君",
    sla: "1 工作日",
    ai: 88,
    risk: "低",
    requester: "行政部 陳小姐",
    summary: "新人設備與軟體授權需求，缺少到職日與職務別。",
    response: "請補充到職日期、部門主管與是否需 VPN 權限。"
  }
];

const kpis = [
  ["今日新增", "24", "+18%"],
  ["未處理", "9", "-6%"],
  ["即將逾期", "5", "需關注"],
  ["SLA 達成率", "96%", "+2.1%"],
  ["AI 採用率", "83%", "+4.7%"],
  ["IT 服務滿意度", "4.6", "+0.2"],
  ["系統使用滿意度", "4.4", "穩定"],
  ["一次解決率", "78%", "+5%"],
  ["問卷填答率", "64%", "+9%"],
  ["低分待追蹤", "3", "主管追蹤"]
];

const trend = [18, 24, 16, 31, 26, 19, 24];
const categories = [
  ["Email 問題", "34%", "#1b6f8f"],
  ["帳號與權限", "23%", "#1d8f62"],
  ["網路與連線", "19%", "#b7791f"],
  ["軟體問題", "14%", "#4766b0"],
  ["資訊安全", "10%", "#c2413b"]
];

const slaPolicies = [
  ["P1 緊急", "首次回應 15 分鐘，2 小時內提出暫時方案", "全公司中斷、重大資安事件"],
  ["P2 高", "首次回應 30 分鐘，4 小時處理目標", "部門服務中斷、多位使用者受影響"],
  ["P3 一般", "首次回應 4 小時，1 個工作日處理目標", "單一使用者一般軟硬體問題"],
  ["P4 低", "首次回應 1 個工作日，3 個工作日處理目標", "軟體安裝、設備申請、改善建議"]
];

const knowledge = [
  ["Outlook 同步錯誤排查 SOP", "已發布", "使用 42 次，解決成功率 86%"],
  ["VPN 可連線但內部系統不可達", "審核中", "由 IT-20260720-018 轉為草稿"],
  ["釣魚郵件通報與隔離流程", "已發布", "下次複核日 2026-08-15"]
];

const incidents = [
  ["Microsoft 365 收信延遲", "候選重大事件", "已關聯 7 張相似工單，影響財務、業務與採購部。"],
  ["總部三樓 Wi-Fi 不穩", "監控中", "近 2 小時新增 4 張工單，建議通知網路組。"]
];

const settings = [
  ["使用者與 RBAC", "角色、權限、部門與資料範圍限制"],
  ["Microsoft Graph", "報修信箱、Message ID、Conversation ID 與重試設定"],
  ["AI Provider", "IAiService、模型版本、Prompt 版本與信心門檻"],
  ["分類與技能", "主分類、子分類、技術人員技能與責任系統"],
  ["通知範本", "Email、Teams、系統內通知與失敗重試"],
  ["問卷發送規則", "結案觸發、抽樣、匿名與有效期間"]
];

const audit = [
  ["09:42", "資訊主管調整 P2 SLA 升級規則", "保留變更前後值"],
  ["10:08", "AI 分類由 Email 問題修正為資訊安全", "IT-20260725-003"],
  ["10:31", "系統自動匯入 Email 建立工單", "Message ID 已記錄"]
];

const viewTitles = {
  dashboard: "服務營運儀表板",
  mydesk: "前台使用者工作台",
  tickets: "工單管理中心",
  aiReview: "AI 分析與人工覆核",
  sla: "SLA 與派工政策",
  knowledge: "知識庫治理",
  incidents: "重大事件管理",
  surveys: "問卷調查與服務評價",
  settings: "系統管理設定"
};

function badgeClass(value) {
  if (["P1", "高", "逾期"].includes(value)) return "bad";
  if (["P2", "待人工確認", "即將逾期"].includes(value)) return "warn";
  if (["P3", "處理中", "已解決"].includes(value)) return "info";
  return "good";
}

function renderKpis() {
  document.querySelector("#kpiGrid").innerHTML = kpis.map(([label, value, delta]) => `
    <div class="kpi-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${delta}</small>
    </div>
  `).join("");
}

function renderCharts() {
  const max = Math.max(...trend);
  document.querySelector("#trendChart").innerHTML = trend.map((value, index) => `
    <div class="bar">
      <div class="bar-fill" style="height:${Math.round(value / max * 100)}%"></div>
      <label>7/${19 + index}<br>${value}</label>
    </div>
  `).join("");

  document.querySelector("#categoryLegend").innerHTML = categories.map(([name, percent, color]) => `
    <div class="legend-item"><span><i class="dot" style="background:${color}"></i>${name}</span><strong>${percent}</strong></div>
  `).join("");
}

function renderDashboardLists() {
  document.querySelector("#riskList").innerHTML = tickets.filter(ticket => ticket.priority === "P1" || ticket.status === "待人工確認").map(ticket => `
    <div class="risk-item">
      <strong>${ticket.id} ${ticket.subject}</strong>
      <p><span class="badge ${badgeClass(ticket.priority)}">${ticket.priority}</span> ${ticket.sla} · ${ticket.risk}風險</p>
    </div>
  `).join("");

  document.querySelector("#ratingBoard").innerHTML = [
    ["林佳穎", "4.8", "Email / Microsoft 365"],
    ["陳柏安", "4.5", "網路 / VPN"],
    ["吳怡君", "4.7", "設備 / 授權"]
  ].map(([name, score, area]) => `
    <div class="rating-item">
      <strong>${name}</strong>
      <p>${area}</p>
      <span class="badge good">${score} / 5</span>
    </div>
  `).join("");
}

function renderTickets() {
  const keyword = document.querySelector("#ticketSearch").value.trim().toLowerCase();
  const status = document.querySelector("#statusFilter").value;
  const filtered = tickets.filter(ticket => {
    const text = `${ticket.id} ${ticket.subject} ${ticket.category}`.toLowerCase();
    const statusMatch = status === "all" || ticket.status === status;
    return statusMatch && text.includes(keyword);
  });

  document.querySelector("#ticketRows").innerHTML = filtered.map(ticket => `
    <tr data-ticket="${ticket.id}">
      <td><strong>${ticket.id}</strong></td>
      <td>${ticket.subject}</td>
      <td><span class="badge ${badgeClass(ticket.status)}">${ticket.status}</span></td>
      <td><span class="badge ${badgeClass(ticket.priority)}">${ticket.priority}</span></td>
      <td>${ticket.category}</td>
      <td>${ticket.assignee}</td>
      <td>${ticket.sla}</td>
      <td>${ticket.ai}%</td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-ticket]").forEach(row => {
    row.addEventListener("click", () => showTicket(row.dataset.ticket));
  });

  if (!document.querySelector("#ticketDetail").innerHTML && filtered[0]) {
    showTicket(filtered[0].id);
  }
}

function showTicket(id) {
  const ticket = tickets.find(item => item.id === id);
  document.querySelector("#ticketDetail").innerHTML = `
    <div class="panel-head">
      <h2>${ticket.id}</h2>
      <span>${ticket.requester}</span>
    </div>
    <h2>${ticket.subject}</h2>
    <div class="detail-grid">
      <div><span class="eyebrow">狀態</span><br><strong>${ticket.status}</strong></div>
      <div><span class="eyebrow">優先度</span><br><strong>${ticket.priority}</strong></div>
      <div><span class="eyebrow">分類</span><br><strong>${ticket.category}</strong></div>
      <div><span class="eyebrow">AI 信心</span><br><strong>${ticket.ai}%</strong></div>
    </div>
    <p>${ticket.summary}</p>
    <div class="timeline">
      <div class="timeline-item"><span>新建</span><strong>10:05</strong></div>
      <div class="timeline-item"><span>AI 分析完成</span><strong>10:06</strong></div>
      <div class="timeline-item"><span>指派 ${ticket.assignee}</span><strong>10:08</strong></div>
      <div class="timeline-item"><span>SLA ${ticket.sla}</span><strong>進行中</strong></div>
    </div>
    <p><strong>AI 建議回覆：</strong>${ticket.response}</p>
    <div class="top-actions">
      <button class="primary-btn">採用 AI 建議</button>
      <button class="ghost-btn">轉派</button>
      <button class="ghost-btn">升級</button>
      <button class="ghost-btn">轉知識草稿</button>
    </div>
  `;
}

function renderAiReview() {
  document.querySelector("#aiCards").innerHTML = tickets.map(ticket => `
    <div class="review-card">
      <div>
        <strong>${ticket.id}</strong>
        <p>${ticket.subject}</p>
      </div>
      <span class="badge ${badgeClass(ticket.priority)}">${ticket.priority} · ${ticket.risk}風險</span>
      <p>${ticket.summary}</p>
      <div class="confidence"><span style="width:${ticket.ai}%"></span></div>
      <p>建議分類：${ticket.category} · 建議派工：${ticket.assignee} · 信心 ${ticket.ai}%</p>
      <div class="top-actions">
        <button class="primary-btn">採用</button>
        <button class="ghost-btn">修正</button>
      </div>
    </div>
  `).join("");
}

function renderStaticSections() {
  document.querySelector("#myTimeline").innerHTML = tickets.slice(0, 3).map(ticket => `
    <div class="timeline-item"><span>${ticket.subject}</span><strong>${ticket.status}</strong></div>
  `).join("");

  document.querySelector("#slaPolicies").innerHTML = slaPolicies.map(([name, rule, example]) => `
    <div class="policy-card">
      <span class="badge ${badgeClass(name.slice(0, 2))}">${name}</span>
      <h2>${rule}</h2>
      <p>${example}</p>
    </div>
  `).join("");

  document.querySelector("#knowledgeList").innerHTML = knowledge.map(([title, status, desc]) => `
    <div class="knowledge-item">
      <h2>${title}</h2>
      <p>${desc}</p>
      <span class="badge ${status === "已發布" ? "good" : "warn"}">${status}</span>
    </div>
  `).join("");

  document.querySelector("#incidentBoard").innerHTML = incidents.map(([title, status, desc]) => `
    <div class="incident-card">
      <span class="badge warn">${status}</span>
      <h2>${title}</h2>
      <p>${desc}</p>
      <button class="ghost-btn">通知主管確認</button>
    </div>
  `).join("");

  document.querySelector("#surveyResults").innerHTML = [
    ["系統使用滿意度", "4.4 / 5", "填答率 64%，NPS 42"],
    ["IT 服務滿意度", "4.6 / 5", "一次解決率 78%"],
    ["低分案件追蹤", "3 件", "2 件已建立改善事項"]
  ].map(([title, value, desc]) => `
    <div class="survey-result">
      <strong>${title}</strong>
      <p>${desc}</p>
      <span class="badge info">${value}</span>
    </div>
  `).join("");

  document.querySelector("#settingsGrid").innerHTML = settings.map(([title, desc]) => `
    <div class="setting-card">
      <h2>${title}</h2>
      <p>${desc}</p>
    </div>
  `).join("");

  document.querySelector("#auditList").innerHTML = audit.map(([time, action, detail]) => `
    <div class="audit-item">
      <strong>${time} ${action}</strong>
      <p>${detail}</p>
    </div>
  `).join("");
}

function switchView(id) {
  const target = id === "newTicket" ? "mydesk" : id;
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === target));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === target));
  document.querySelector("#pageTitle").textContent = viewTitles[target] || "服務營運儀表板";
  if (id === "newTicket") {
    setTimeout(() => document.querySelector("#newTicket").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-link]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.viewLink));
  });
  document.querySelector("#ticketSearch").addEventListener("input", renderTickets);
  document.querySelector("#statusFilter").addEventListener("change", renderTickets);
  document.querySelector("#roleSelect").addEventListener("change", event => {
    document.querySelector("#roleLabel").textContent = `${event.target.value}工作台`;
    showToast(`已切換為 ${event.target.value} 檢視`);
  });
  document.querySelector("#simulateEmailBtn").addEventListener("click", () => {
    showToast("已模擬 Microsoft Graph 收件並建立工單 IT-20260725-005");
  });
  document.querySelector("#ticketForm").addEventListener("submit", event => {
    event.preventDefault();
    showToast("工單已建立：IT-20260725-005，AI 分析佇列處理中");
    switchView("tickets");
  });
}

renderKpis();
renderCharts();
renderDashboardLists();
renderTickets();
renderAiReview();
renderStaticSections();
bindEvents();
