import type { DailyLog, AnalysisResults } from "../types";

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8002";

type AuthResponse = {
  success: boolean;
  user?: any;
  detail?: string;
};

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export const apiService = {
  register: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await safeJson(res);
    if (!res.ok) return { success: false, detail: data?.detail || `Register failed (${res.status})` };

    return { success: true, user: data.user };
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await safeJson(res);
    if (!res.ok) return { success: false, detail: data?.detail || `Login failed (${res.status})` };

    return { success: true, user: data.user };
  },

  // ✅ 拉取一周日志（每个 day 最新一条）
  getWeekLogs: async (email: string): Promise<DailyLog[]> => {
    const res = await fetch(`${API_BASE}/logs/week?email=${encodeURIComponent(email)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.detail || "Failed to load logs");

    return (data.logs || []) as DailyLog[];
  },

  // ✅ 保存某一天（点 Save 时调用）
  upsertDayLog: async (email: string, log: DailyLog): Promise<void> => {
    const res = await fetch(`${API_BASE}/logs/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, log }),
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.detail || "Failed to save log");
  },

  // ✅ 计算（字段映射，避免“后端有返回但前端不显示”）
  calculateMetrics: async (email: string, logs: DailyLog[]): Promise<AnalysisResults> => {
    const res = await fetch(`${API_BASE}/analysis/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, logs }),
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.detail || "Backend calculation failed");

    // 如果你自己的 AnalysisResults 就是这些字段名，那直接 return data
    // 否则这里把后端字段映射到你前端 Dashboard 需要的字段
    const mapped: any = {
      ...data,
      // 常见前端用的命名（按需删改）
      battery: data.emotionalBattery,
      burnout: data.burnoutLikelihood,
      accumulation: data.stressAccumulation,
      volatility: data.volatilityScore,
      risk: data.riskLevel,
      balance: data.loveStressBalance,
    };

    return mapped as AnalysisResults;
  },
};
