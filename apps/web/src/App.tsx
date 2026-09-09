import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api, type Dashboard, type Diary, type Profile } from "./api";
import { bootstrapError, validateBootstrapInput, BOOTSTRAP_PASSWORD_MIN_LENGTH } from "./bootstrap-validation";
import { nextScreen, offlineLabel, type Screen } from "./flow";

const today = new Date().toISOString().slice(0, 10);
const errorText = (error: unknown) => error instanceof ApiError ? (error.code === "AUTH_INVALID_CREDENTIALS" ? "密码不正确，请重试。" : error.code === "AUTH_REQUIRED" ? "登录已失效，请重新登录。" : bootstrapError(error.code) ?? "请求未完成，请检查服务状态后重试。") : "网络连接失败，请稍后重试。";

function Field(props: { label: string; name: string; value: string; type?: string; onChange: (value: string) => void; min?: string; minLength?: number; step?: string }) {
  return <label className="field"><span>{props.label}</span><input name={props.name} type={props.type ?? "text"} value={props.value} min={props.min} minLength={props.minLength} step={props.step} onChange={(event) => props.onChange(event.target.value)} required /></label>;
}

function Shell(props: { children: React.ReactNode; title: string; subtitle?: string }) {
  return <main className="shell"><header className="brand"><span className="brand-mark" aria-hidden="true">秤</span><div><p className="eyebrow">NUTRITION TRACKER</p><h1>{props.title}</h1>{props.subtitle ? <p className="subtitle">{props.subtitle}</p> : null}</div></header>{props.children}</main>;
}

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [diary, setDiary] = useState<Diary | null>(null);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offlineEvent); };
  }, []);

  const loadDashboard = useCallback(async (date = today) => {
    const [nextDashboard, nextDiary] = await Promise.all([api.getDashboard(date), api.getDiary(date)]);
    setDashboard(nextDashboard); setDiary(nextDiary);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const status = await api.getStatus();
        if (!active) return;
        if (!status.initialized) { setScreen(nextScreen("loading", { type: "status", initialized: false })); return; }
        const session = await api.getSession();
        if (!session.authenticated || session.user === null) { setScreen("login"); return; }
        const [currentProfile, goals] = await Promise.all([api.getProfile(), api.getGoals()]);
        setProfile(currentProfile);
        setScreen(nextScreen("login", { type: "session", authenticated: true, profileReady: currentProfile.body !== null, goalReady: goals.length > 0 }));
      } catch (caught) { if (active) { setError(errorText(caught)); setScreen("login"); } }
    })();
    return () => { active = false; };
  }, []);

  let content: React.ReactNode;
  if (screen === "loading") content = <Shell title="正在准备你的空间" subtitle="只需要几秒钟。"><div className="card loading" role="status">正在连接本地服务…</div></Shell>;
  else if (screen === "bootstrap") content = <Bootstrap onDone={(user) => { setProfile(user); setScreen("setup"); }} error={error} setError={setError} />;
  else if (screen === "login") content = <Login onDone={async () => { const currentProfile = await api.getProfile(); const goals = await api.getGoals(); setProfile(currentProfile); setScreen(currentProfile.body !== null && goals.length > 0 ? "dashboard" : "setup"); }} error={error} setError={setError} />;
  else if (screen === "setup") content = <Setup profile={profile} onDone={async () => { setScreen("dashboard"); await loadDashboard(); }} error={error} setError={setError} />;
  else content = <DashboardView dashboard={dashboard} diary={diary} profile={profile} loadDashboard={loadDashboard} onLogout={async () => { await api.logout(); setScreen("login"); setDashboard(null); setDiary(null); }} error={error} setError={setError} />;
  return <><OfflineNotice offline={offline} /><div aria-live="polite" className="sr-only">{offlineLabel(!offline)}</div>{content}</>;
}

function OfflineNotice(props: { offline: boolean }) { return props.offline ? <div className="offline-banner" role="status"><span>{offlineLabel(false)}</span><button onClick={() => window.location.reload()}>重试</button></div> : null; }

function Bootstrap(props: { onDone: (user: Profile) => void; error: string; setError: (value: string) => void }) {
  const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [timezone, setTimezone] = useState("Asia/Shanghai"); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); const validation = validateBootstrapInput({ displayName: name, password }); if (validation) { props.setError(bootstrapError(validation) ?? "请检查输入。"); return; } setBusy(true); try { const result = await api.bootstrap({ displayName: name.trim(), password, timezone }); props.onDone(result.user); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <Shell title="先建立你的空间" subtitle="数据保存在你自己的服务中，首次设置只需完成一次。"><form className="card form" onSubmit={submit}><Field label="称呼" name="displayName" value={name} onChange={setName} /><Field label={`密码（至少 ${BOOTSTRAP_PASSWORD_MIN_LENGTH} 个字符）`} name="password" type="password" value={password} onChange={setPassword} minLength={BOOTSTRAP_PASSWORD_MIN_LENGTH} /><Field label="时区" name="timezone" value={timezone} onChange={setTimezone} />{props.error ? <p className="error" role="alert">{props.error}</p> : null}<button className="primary" disabled={busy}>{busy ? "正在创建…" : "创建并继续"}</button></form></Shell>;
}

function Login(props: { onDone: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); setBusy(true); try { await api.login(password); await props.onDone(); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <Shell title="欢迎回来" subtitle="输入密码继续记录今天的饮食。"><form className="card form" onSubmit={submit}><Field label="密码" name="password" type="password" value={password} onChange={setPassword} />{props.error ? <p className="error" role="alert">{props.error}</p> : null}<button className="primary" disabled={busy}>{busy ? "正在登录…" : "登录"}</button></form></Shell>;
}

function Setup(props: { profile: Profile | null; onDone: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [height, setHeight] = useState(""); const [sex, setSex] = useState("none"); const [activity, setActivity] = useState("light"); const [goalType, setGoalType] = useState("loss"); const [calories, setCalories] = useState("1800"); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); setBusy(true); try { await api.updateProfile({ heightCm: Number(height), sexForFormula: sex, activityLevel: activity }); await api.createGoal({ goalType, calorieTargetKcal: Number(calories), effectiveFrom: today, source: "manual" }); await props.onDone(); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <Shell title={`完善 ${props.profile?.displayName ?? "你的"} 的目标`} subtitle="这些信息只用于计算每日预算，你可以随时调整。"><form className="card form" onSubmit={submit}><Field label="身高（cm）" name="heightCm" type="number" min="1" step="0.1" value={height} onChange={setHeight} /><label className="field"><span>公式性别</span><select value={sex} onChange={(event) => setSex(event.target.value)}><option value="none">不指定</option><option value="female">女性</option><option value="male">男性</option></select></label><label className="field"><span>活动水平</span><select value={activity} onChange={(event) => setActivity(event.target.value)}><option value="sedentary">久坐</option><option value="light">轻度活动</option><option value="moderate">中度活动</option><option value="high">高活动</option><option value="very_high">极高活动</option></select></label><label className="field"><span>当前目标</span><select value={goalType} onChange={(event) => setGoalType(event.target.value)}><option value="loss">减脂</option><option value="maintain">维持</option><option value="gain">增重</option></select></label><Field label="每日热量目标（kcal）" name="calorieTargetKcal" type="number" min="1" step="1" value={calories} onChange={setCalories} />{props.error ? <p className="error" role="alert">{props.error}</p> : null}<button className="primary" disabled={busy}>{busy ? "正在保存…" : "完成设置"}</button></form></Shell>;
}

function DashboardView(props: { dashboard: Dashboard | null; diary: Diary | null; profile: Profile | null; loadDashboard: (date?: string) => Promise<void>; onLogout: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Array<{ id: string; name: string; summary: { energyKcal: number | null } }>>([]); const [selected, setSelected] = useState<string | null>(null); const [amount, setAmount] = useState("100"); const [meal, setMeal] = useState("breakfast"); const [busy, setBusy] = useState(false);
  const kcalGoal = props.dashboard?.goal?.kcal ?? 0; const intake = props.dashboard?.intake.kcal ?? 0; const progress = kcalGoal > 0 ? Math.min(100, Math.round((intake / kcalGoal) * 100)) : 0;
  async function search(event: React.FormEvent) { event.preventDefault(); if (!query.trim()) return; try { setResults((await api.searchFoods(query)).data); } catch (caught) { props.setError(errorText(caught)); } }
  async function addEntry(event: React.FormEvent) { event.preventDefault(); if (!selected) return; setBusy(true); try { await api.createDiaryEntry(today, { mealSlotId: meal, foodId: selected, amount: Number(amount), unit: "g", source: "manual" }); setSelected(null); setQuery(""); setResults([]); await props.loadDashboard(); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  const mealEntries = useMemo(() => new Map((props.diary?.meals ?? []).map((item) => [item.mealSlot.key, item])), [props.diary]);
  return <main className="app-shell"><header className="topbar"><div><p className="eyebrow">TODAY · {today}</p><h1>你好，{props.profile?.displayName ?? "朋友"}</h1></div><button className="text-button" onClick={() => void props.onLogout()}>退出</button></header><section className="hero-card card"><div><p className="muted">今日热量</p><strong className="calorie-number">{Math.round(intake)}<small> / {kcalGoal || "—"} kcal</small></strong><div className="progress" aria-label={`今日热量完成 ${progress}%`}><span style={{ width: `${progress}%` }} /></div><p className="muted">剩余 {props.dashboard?.remainingKcal === null || props.dashboard?.remainingKcal === undefined ? "—" : Math.round(props.dashboard.remainingKcal)} kcal</p></div></section><section className="macro-grid" aria-label="营养概览"><Metric label="蛋白质" value={props.dashboard?.intake.proteinG ?? 0} unit="g" /><Metric label="脂肪" value={props.dashboard?.intake.fatG ?? 0} unit="g" /><Metric label="碳水" value={props.dashboard?.intake.carbG ?? 0} unit="g" /></section><section className="card"><div className="section-heading"><h2>今天吃了什么</h2><span className="status-chip">本地记录</span></div><div className="meals">{["breakfast", "lunch", "dinner", "snack"].map((key) => <div className="meal" key={key}><div><strong>{mealEntries.get(key)?.mealSlot.displayName ?? ({ breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" } as Record<string, string>)[key]}</strong>{(mealEntries.get(key)?.entries ?? []).map((entry) => <p className="meal-entry" key={entry.id}>{entry.displayName} · {entry.amount}{entry.unit}</p>)}</div><span>{Math.round(props.dashboard?.meals.find((item) => item.key === key)?.totals.kcal ?? 0)} kcal</span></div>)}</div></section><section className="card add-card"><div className="section-heading"><h2>快速添加</h2><span className="muted">3 步完成记录</span></div><form className="search-row" onSubmit={search}><input aria-label="搜索食物" placeholder="搜索馒头、鸡蛋…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="soft-button">搜索</button></form>{results.length > 0 ? <div className="results">{results.map((food) => <button className={`food-result ${selected === food.id ? "selected" : ""}`} key={food.id} onClick={() => setSelected(food.id)}><span>{food.name}</span><small>{food.summary.energyKcal ?? "—"} kcal / 100g</small></button>)}</div> : null}{selected ? <form className="add-form" onSubmit={addEntry}><label className="field"><span>餐次</span><select value={meal} onChange={(event) => setMeal(event.target.value)}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><Field label="份量（g）" name="amount" type="number" min="1" value={amount} onChange={setAmount} /><button className="primary" disabled={busy}>{busy ? "保存中…" : "加入记录"}</button></form> : null}</section>{props.error ? <p className="error page-error" role="alert">{props.error}</p> : null}<nav className="bottom-nav" aria-label="主导航"><button className="active">今日</button><button>饮食</button><button>体重</button><button>分析</button><button>我的</button></nav></main>;
}

function Metric(props: { label: string; value: number; unit: string }) { return <div className="metric card"><span className="muted">{props.label}</span><strong>{Math.round(props.value)}<small>{props.unit}</small></strong></div>; }
