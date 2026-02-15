import React, { useState, useEffect } from "react";
import { DailyLog, AnalysisResults } from "./types";
import { MOCK_LOGS } from "./utils/calculations";
import DailyLogForm from "./components/DailyLogForm";
import CalendarDashboard from "./components/CalendarDashboard";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { apiService } from "./services/apiService";
import { Heart, Brain, Sparkles, LogOut, User as UserIcon } from "lucide-react";

const INITIAL_LOGS: DailyLog[] = Array.from({ length: 7 }, (_, i) => ({
  day: i + 1,
  mood: 5,
  stress: 5,
  energy: 5,
  sleep: 7,
  reflection: "",
}));

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<DailyLog[]>(INITIAL_LOGS);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(false);

  // 1) 从 localStorage 恢复 user
  useEffect(() => {
    const savedUser = localStorage.getItem("lovecare_user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // 2) 一旦 user 有了 -> 自动从数据库拉取 week logs 回显
  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const dbLogs = await apiService.getWeekLogs(user.email);
        // 把 dbLogs 覆盖到 INITIAL_LOGS（没记录的 day 保持默认）
        const next = [...INITIAL_LOGS];
        for (const l of dbLogs) {
          const idx = l.day - 1;
          if (idx >= 0 && idx < 7) next[idx] = l;
        }
        setLogs(next);
      } catch (e) {
        // 没有记录也没关系，保持默认
        console.log("No logs loaded or failed to load logs:", e);
      }
    })();
  }, [user?.email]);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    localStorage.setItem("lovecare_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setResults(null);
    setLogs(INITIAL_LOGS);
    localStorage.removeItem("lovecare_user");
  };

  // ✅ 保存当天：更新 state + 立刻写库
  const updateSingleDay = async (updatedLog: DailyLog) => {
    const newLogs = [...logs];
    newLogs[activeDayIndex!] = updatedLog;
    setLogs(newLogs);

    // 自动保存到数据库
    if (user?.email) {
      try {
        await apiService.upsertDayLog(user.email, updatedLog);
      } catch (e) {
        console.error("Save to DB failed:", e);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const data = await apiService.calculateMetrics(user.email, logs);
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      setLogs(MOCK_LOGS);
      const data = await apiService.calculateMetrics(user.email, MOCK_LOGS);
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  const resetToCalendar = () => {
    setResults(null);
    setActiveDayIndex(null);
  };

  const isReadyForAnalysis =
    logs.filter((l) => l.reflection !== "" || l.mood !== 5 || l.stress !== 5).length >= 2;

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-100 flex flex-col">
      <nav className="border-b border-white/5 py-4 px-6 flex justify-between items-center glass sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={resetToCalendar}>
          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">LoveCare</span>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium">
                <UserIcon className="w-3 h-3 text-rose-500" />
                {user.name}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all text-stone-400 hover:text-rose-500"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:py-12">
        {!user ? (
          <div className="py-12">
            <Login onLoginSuccess={handleLoginSuccess} />
          </div>
        ) : !results ? (
          <div className="max-w-4xl mx-auto space-y-12">
            {activeDayIndex === null ? (
              <>
                <header className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3" />
                    Python Predictive Engine
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Weekly <span className="text-gradient">Emotional</span> Snapshot
                  </h1>
                  <p className="text-stone-400 max-w-xl mx-auto font-light leading-relaxed">
                    Map your internal landscape across the last 7 days. Once logged, our Python
                    models will reveal your readiness for Valentine's Day.
                  </p>
                </header>

                <div className="glass rounded-[3rem] p-10 border border-white/10 relative overflow-hidden">
                  <CalendarDashboard
                    logs={logs}
                    onSelectDay={setActiveDayIndex}
                    onAnalyze={handleAnalyze}
                    isReady={isReadyForAnalysis}
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                      <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-rose-500 font-bold animate-pulse">Running Regressions...</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleSimulate}
                    className="text-stone-600 hover:text-stone-400 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                  >
                    <Brain className="w-3 h-3" /> Skip to Simulation Data
                  </button>
                </div>
              </>
            ) : (
              <div className="max-w-2xl mx-auto glass rounded-[3rem] p-10 border border-white/10 shadow-2xl">
                <DailyLogForm
                  log={logs[activeDayIndex]}
                  onUpdate={updateSingleDay}
                  onBack={() => setActiveDayIndex(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <Dashboard logs={logs} results={results} onReset={resetToCalendar} />
        )}
      </main>

      <footer className="py-8 text-center text-stone-600 text-xs border-t border-white/5">
        <p>&copy; Beta Version</p>
      </footer>
    </div>
  );
};

export default App;
