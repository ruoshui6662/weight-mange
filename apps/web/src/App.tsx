import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api, type Dashboard, type Diary, type Profile } from "./api";
import { bootstrapError, validateBootstrapInput, BOOTSTRAP_PASSWORD_MIN_LENGTH } from "./bootstrap-validation";
import { DASHBOARD_TABS, nextScreen, offlineLabel, type DashboardTab, type Screen } from "./flow";
import { searchStatusForResults, type FoodSearchStatus } from "./search-state";

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
  else if (screen === "login") content = <Login onDone={async () => { const currentProfile = await api.getProfile(); const goals = await api.getGoals(); setProfile(currentProfile); if (currentProfile.body !== null && goals.length > 0) { await loadDashboard(); setScreen("dashboard"); } else setScreen("setup"); }} error={error} setError={setError} />;
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

export function DashboardView(props: { dashboard: Dashboard | null; diary: Diary | null; profile: Profile | null; loadDashboard: (date?: string) => Promise<void>; onLogout: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; summary: { energyKcal: number | null } }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [meal, setMeal] = useState("breakfast");
  const [busy, setBusy] = useState(false);
  const [searchStatus, setSearchStatus] = useState<FoodSearchStatus>("idle");
  const [showImportGuide, setShowImportGuide] = useState(false);
  const kcalGoal = props.dashboard?.goal?.kcal ?? 0;
  const intake = props.dashboard?.intake.kcal ?? 0;
  const progress = kcalGoal > 0 ? Math.min(100, Math.round((intake / kcalGoal) * 100)) : 0;
  const mealEntries = useMemo(() => new Map((props.diary?.meals ?? []).map((item) => [item.mealSlot.key, item])), [props.diary]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const text = query.trim();
    props.setError("");
    setShowImportGuide(false);
    if (!text) { setResults([]); setSearchStatus("idle"); return; }
    setResults([]); setSelected(null); setSearchStatus("loading");
    try {
      const nextResults = (await api.searchFoods(text)).data;
      setResults(nextResults);
      setSearchStatus(searchStatusForResults(nextResults.length));
    } catch (caught) {
      setSearchStatus("error");
      props.setError(errorText(caught));
    }
  }

  async function addEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await api.createDiaryEntry(today, { mealSlotId: meal, foodId: selected, amount: Number(amount), unit: "g", source: "manual" });
      setSelected(null); setQuery(""); setResults([]); setSearchStatus("idle");
      await props.loadDashboard();
    } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); }
  }

  const searchCard = <FoodSearchCard query={query} setQuery={setQuery} results={results} selected={selected} setSelected={setSelected} amount={amount} setAmount={setAmount} meal={meal} setMeal={setMeal} busy={busy} searchStatus={searchStatus} showImportGuide={showImportGuide} setShowImportGuide={setShowImportGuide} onSearch={search} onAddEntry={addEntry} />;
  return <main className="app-shell"><header className="topbar"><div><p className="eyebrow">{activeTab.toUpperCase()} · {today}</p><h1>你好，{props.profile?.displayName ?? "朋友"}</h1></div><button className="text-button" onClick={() => void props.onLogout()}>退出</button></header>
    {activeTab === "today" ? <><section className="hero-card card"><div><p className="muted">今日热量</p><strong className="calorie-number">{Math.round(intake)}<small> / {kcalGoal || "—"} kcal</small></strong><div className="progress" aria-label={`今日热量完成 ${progress}%`}><span style={{ width: `${progress}%` }} /></div><p className="muted">剩余 {props.dashboard?.remainingKcal === null || props.dashboard?.remainingKcal === undefined ? "—" : Math.round(props.dashboard.remainingKcal)} kcal</p></div></section><section className="macro-grid" aria-label="营养概览"><Metric label="蛋白质" value={props.dashboard?.intake.proteinG ?? 0} unit="g" /><Metric label="脂肪" value={props.dashboard?.intake.fatG ?? 0} unit="g" /><Metric label="碳水" value={props.dashboard?.intake.carbG ?? 0} unit="g" /></section><MealSummary dashboard={props.dashboard} mealEntries={mealEntries} /><section className="card add-card"><div className="section-heading"><h2>快速添加</h2><span className="muted">3 步完成记录</span></div>{searchCard}</section></> : null}
    {activeTab === "diary" ? <section className="card add-card"><div className="section-heading"><h2>饮食记录</h2><span className="status-chip">本地记录</span></div><p className="muted">搜索食物并添加到今天的餐次，历史营养以记录时快照保存。</p>{searchCard}</section> : null}
    {activeTab === "profile" ? <ProfilePanel profile={props.profile} showImportGuide={showImportGuide} setShowImportGuide={setShowImportGuide} /> : null}
    {activeTab === "weight" ? <ComingSoon title="体重" detail="体重记录与趋势将在 M2 里程碑实现。" /> : null}
    {activeTab === "analytics" ? <ComingSoon title="分析" detail="营养趋势和基础分析将在 M2 里程碑实现。" /> : null}
    {props.error ? <p className="error page-error" role="alert">{props.error}</p> : null}
    <nav className="bottom-nav" aria-label="主导航">{DASHBOARD_TABS.map((tab) => <button type="button" key={tab.key} className={activeTab === tab.key ? "active" : ""} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => { props.setError(""); setActiveTab(tab.key); }}>{tab.label}</button>)}</nav>
  </main>;
}

function MealSummary(props: { dashboard: Dashboard | null; mealEntries: Map<string, Diary["meals"][number]> }) {
  return <section className="card"><div className="section-heading"><h2>今天吃了什么</h2><span className="status-chip">本地记录</span></div><div className="meals">{["breakfast", "lunch", "dinner", "snack"].map((key) => <div className="meal" key={key}><div><strong>{props.mealEntries.get(key)?.mealSlot.displayName ?? ({ breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" } as Record<string, string>)[key]}</strong>{(props.mealEntries.get(key)?.entries ?? []).map((entry) => <p className="meal-entry" key={entry.id}>{entry.displayName} · {entry.amount}{entry.unit}</p>)}</div><span>{Math.round(props.dashboard?.meals.find((item) => item.key === key)?.totals.kcal ?? 0)} kcal</span></div>)}</div></section>;
}

export function FoodSearchCard(props: { query: string; setQuery: (value: string) => void; results: Array<{ id: string; name: string; summary: { energyKcal: number | null } }>; selected: string | null; setSelected: (value: string) => void; amount: string; setAmount: (value: string) => void; meal: string; setMeal: (value: string) => void; busy: boolean; searchStatus: FoodSearchStatus; showImportGuide: boolean; setShowImportGuide: (value: boolean) => void; onSearch: (event: React.FormEvent) => Promise<void>; onAddEntry: (event: React.FormEvent) => Promise<void> }) {
  return <><form className="search-row" onSubmit={(event) => void props.onSearch(event)}><input aria-label="搜索食物" placeholder="搜索馒头、鸡蛋…" value={props.query} onChange={(event) => props.setQuery(event.target.value)} /><button className="soft-button" disabled={props.searchStatus === "loading"}>{props.searchStatus === "loading" ? "搜索中…" : "搜索"}</button></form>{props.searchStatus === "loading" ? <p className="loading" role="status">正在搜索本地食物目录…</p> : null}{props.searchStatus === "empty" ? <div className="empty-state" role="status"><strong>没有找到匹配食物</strong><p>当前只搜索本地食物目录。如果目录尚未导入，请先完成受控离线导入。</p><button type="button" className="soft-button" onClick={() => props.setShowImportGuide(!props.showImportGuide)}>{props.showImportGuide ? "收起导入说明" : "查看导入说明"}</button></div> : null}{props.showImportGuide ? <div className="import-guide" role="note"><strong>本地目录导入</strong><p>请在服务端使用仓库中的 <code>tools/food-import</code> 导入受控 JSON 数据，然后重新搜索；浏览器不会连接外部食品库。</p></div> : null}{props.searchStatus === "success" ? <div className="results">{props.results.map((food) => <button type="button" className={`food-result ${props.selected === food.id ? "selected" : ""}`} key={food.id} onClick={() => props.setSelected(food.id)}><span>{food.name}</span><small>{food.summary.energyKcal ?? "—"} kcal / 100g</small></button>)}</div> : null}{props.selected ? <form className="add-form" onSubmit={(event) => void props.onAddEntry(event)}><label className="field"><span>餐次</span><select value={props.meal} onChange={(event) => props.setMeal(event.target.value)}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><Field label="份量（g）" name="amount" type="number" min="1" value={props.amount} onChange={props.setAmount} /><button className="primary" disabled={props.busy}>{props.busy ? "保存中…" : "加入记录"}</button></form> : null}</>;
}

function ProfilePanel(props: { profile: Profile | null; showImportGuide: boolean; setShowImportGuide: (value: boolean) => void }) {
  return <section className="card profile-card"><div className="section-heading"><h2>我的</h2><span className="status-chip">本地账户</span></div><p>当前账户：{props.profile?.displayName ?? "朋友"}</p><p className="muted">数据保存在你自己的服务中。食物搜索使用本地目录，不会自动访问外部食品库。</p><button type="button" className="soft-button" onClick={() => props.setShowImportGuide(!props.showImportGuide)}>{props.showImportGuide ? "收起导入说明" : "查看食物目录导入说明"}</button>{props.showImportGuide ? <div className="import-guide" role="note"><strong>受控离线导入</strong><p>请在服务端使用仓库中的 <code>tools/food-import</code> 导入受控 JSON 数据，再回到饮食页面搜索。</p></div> : null}</section>;
}

function ComingSoon(props: { title: string; detail: string }) { return <section className="card tab-placeholder" role="status"><h2>{props.title}</h2><p>{props.detail}</p><span className="status-chip">后续开发中</span></section>; }

function Metric(props: { label: string; value: number; unit: string }) { return <div className="metric card"><span className="muted">{props.label}</span><strong>{Math.round(props.value)}<small>{props.unit}</small></strong></div>; }
