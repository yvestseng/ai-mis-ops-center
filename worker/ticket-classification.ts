export type ServiceClassification = {
  serviceKey: string;
  category: string;
  assignedTeam: string;
  assignedTeamId?: string;
  confidence: number;
  evidence: string[];
};

export type ImpactAnalysis = {
  level: "company_wide" | "site_wide" | "department" | "multiple_users" | "single_user" | "unknown";
  label: string;
  serviceState: "outage" | "degraded" | "request" | "unknown";
  confidence: number;
  evidence: string[];
};

const semanticAliases: Array<[RegExp, string]> = [
  [/整間公司|整個公司|全體同仁|全公司所有人|公司所有人|所有員工|全員/g, "全公司"],
  [/整個廠區|整廠|全廠區/g, "全廠"],
  [/整個據點|整個辦公室|整棟辦公室/g, "主要據點"],
  [/大量同仁|大批使用者|大範圍使用者/g, "大量使用者受影響"],
  [/不能寄信|寄不出去|寄信失敗|無法寄出|信寄不出去/g, "無法寄信"],
  [/不能收信|收不到信|收信失敗|無法收到/g, "無法收信"],
  [/連不上|無法連線|連線失敗|connection failed|connection failure/g, "連線 failure"],
  [/失敗|故障|掛掉|掛了|停止服務|服務中斷|不可用|無法使用/g, " failure down "],
  [/郵件系統|mail service|mail system/g, "郵件服務"],
  [/exchange online/g, "exchange"],
  [/office 365|o365/g, "microsoft 365"],
  [/核心交換機/g, "核心交換器"],
];

export function normalizeSemanticText(value: string) {
  let normalized = value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[，。；、：！？（）【】「」『』]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of semanticAliases) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function evidence(text: string, patterns: Array<[RegExp, string]>) {
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function classifyService(rawText: string): ServiceClassification {
  const text = normalizeSemanticText(rawText);
  const classifiers: Array<{
    serviceKey: string;
    category: string;
    assignedTeam: string;
    assignedTeamId: string;
    patterns: Array<[RegExp, string]>;
  }> = [
    {
      serviceKey: "microsoft-365-mail",
      category: "Microsoft 365",
      assignedTeam: "系統維運組",
      assignedTeamId: "team-system",
      patterns: [[/exchange|smtp|outlook|郵件服務|mail server|無法寄信|無法收信/, "Exchange / SMTP / Outlook"]],
    },
    {
      serviceKey: "security",
      category: "資訊安全",
      assignedTeam: "資安管理組",
      assignedTeamId: "team-security",
      patterns: [[/病毒|釣魚|wazuh|edr|資安|異常登入|勒索|malware|phishing/, "資訊安全事件"]],
    },
    {
      serviceKey: "core-network",
      category: "網路連線",
      assignedTeam: "網路維運組",
      assignedTeamId: "team-network",
      patterns: [[/core switch|core router|核心交換器|核心路由器|對外網路|網際網路主線|wifi|wi-fi|網路|斷線/, "網路服務"]],
    },
    {
      serviceKey: "database",
      category: "資料庫服務",
      assignedTeam: "資料庫管理組",
      assignedTeamId: "team-database",
      patterns: [[/oracle|mysql|sql server|資料庫|db client|database/, "資料庫服務"]],
    },
    {
      serviceKey: "application",
      category: "應用系統",
      assignedTeam: "ERP／應用系統組",
      assignedTeamId: "team-application",
      patterns: [[/erp|應用系統|程式錯誤|application error/, "應用系統"]],
    },
    {
      serviceKey: "endpoint",
      category: "電腦與周邊設備",
      assignedTeam: "電腦與設備維護組",
      assignedTeamId: "team-endpoint",
      patterns: [[/印表機|筆電|電腦|螢幕|鍵盤|軟體安裝|安裝.*軟體|軟體.*安裝|printer|laptop/, "端點設備"]],
    },
    {
      serviceKey: "identity-system",
      category: "系統與帳號",
      assignedTeam: "系統維運組",
      assignedTeamId: "team-system",
      patterns: [[/windows|伺服器|server|帳號|登入|active directory|ldap|entra/, "系統 / 帳號"]],
    },
  ];

  for (const classifier of classifiers) {
    const hits = evidence(text, classifier.patterns);
    if (hits.length) {
      return { ...classifier, confidence: Math.min(0.98, 0.8 + hits.length * 0.08), evidence: hits };
    }
  }
  return {
    serviceKey: "service-desk",
    category: "其他",
    assignedTeam: "MIS 服務台",
    assignedTeamId: "team-service-desk",
    confidence: 0.55,
    evidence: ["未辨識到明確服務"],
  };
}

export function analyzeImpact(rawText: string): ImpactAnalysis {
  const text = normalizeSemanticText(rawText);
  const outage = /failure|down|中斷|無法寄信|無法收信|無法使用|無法運作|無法啟動|無法開機|斷線/.test(text);
  const degraded = /異常|很慢|延遲|不穩|偶發|部分|間歇/.test(text);
  const request = /申請|安裝|建議|新增|開通|權限/.test(text) && !outage;

  const scopes: Array<[ImpactAnalysis["level"], string, RegExp, number]> = [
    ["company_wide", "全公司", /全公司|全廠|主要據點|大量使用者受影響/, 0.97],
    ["site_wide", "據點／辦公區", /整層|整樓|整個辦公室|廠區|據點/, 0.9],
    ["department", "部門", /部門|整個.*部|全.*部/, 0.84],
    ["multiple_users", "多位使用者", /多位|多人|數名|一群|部分使用者|使用者們/, 0.78],
    ["single_user", "單一使用者", /我的|我這台|我本人|單一使用者|一位使用者/, 0.75],
  ];
  for (const [level, label, pattern, confidence] of scopes) {
    if (pattern.test(text)) {
      return {
        level,
        label,
        serviceState: outage ? "outage" : degraded ? "degraded" : request ? "request" : "unknown",
        confidence,
        evidence: [label, outage ? "服務中斷" : degraded ? "服務降級" : request ? "申請需求" : "影響狀態待確認"],
      };
    }
  }
  return {
    level: "unknown",
    label: "待確認",
    serviceState: outage ? "outage" : degraded ? "degraded" : request ? "request" : "unknown",
    confidence: outage || degraded || request ? 0.66 : 0.5,
    evidence: [outage ? "偵測到服務中斷語意" : degraded ? "偵測到服務異常語意" : request ? "偵測到申請需求" : "未辨識到影響範圍"],
  };
}

export function priorityCode(priority: string) {
  return priority === "緊急" ? "P1" : priority === "高" ? "P2" : priority === "中" ? "P3" : "P4";
}
