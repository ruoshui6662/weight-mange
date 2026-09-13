import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, type AnalyticsOverview, type Dashboard, type Diary, type Profile, type TdeeEstimate, type WeightRecord, type WeightTrend } from "./api";
import { bootstrapError, validateBootstrapInput, BOOTSTRAP_PASSWORD_MIN_LENGTH } from "./bootstrap-validation";
import { nextScreen, offlineLabel, type DashboardTab, type Screen } from "./flow";
import { searchStatusForResults, type FoodSearchStatus } from "./search-state";
import { daysAgo, localDateNow } from "./date";
import { RecipePanel } from "./RecipePanel";
import { AppShell } from "./ui/AppShell";
import { TodayPage } from "./ui/TodayPage";
import { DiaryPage } from "./ui/DiaryPage";
import { WeightPage } from "./ui/WeightPage";
import { AnalyticsPage } from "./ui/AnalyticsPage";
import { AuthShell } from "./ui/AuthShell";
import { ProfilePage } from "./ui/ProfilePage";

const errorText = (error: unknown) => error instanceof ApiError ? (error.code === "AUTH_INVALID_CREDENTIALS" ? "密码不正确，请重试。" : error.code === "AUTH_REQUIRED" ? "登录已失效，请重新登录。" : bootstrapError(error.code) ?? "请求未完成，请检查服务状态后重试。") : "网络连接失败，请稍后重试。";
const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
const readDashboard = (date: string) => Promise.all([api.getDashboard(date), api.getDiary(date)]);

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
  const sessionRequest = useRef(0);
  const dashboardRequest = useRef(0);
  const today = localDateNow(profile?.timezone ?? "UTC");

  useEffect(() => {
    const online = () => setOffline(false);
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offlineEvent); };
  }, []);

  const expireSession = useCallback(() => {
    ++sessionRequest.current; ++dashboardRequest.current;
    setProfile(null); setDashboard(null); setDiary(null);
    setError("登录已失效，请重新登录。"); setScreen("login");
  }, []);

  // All entry paths read the current profile before deciding readiness and local date.
  const restoreSession = useCallback(async () => {
    const request = ++sessionRequest.current;
    ++dashboardRequest.current;
    const active = () => request === sessionRequest.current;
    setScreen("loading"); setError("");
    try {
      const status = await api.getStatus();
      if (!active()) return;
      if (!status.initialized) { setScreen("bootstrap"); return; }
      const session = await api.getSession();
      if (!active()) return;
      if (!session.authenticated || session.user === null) {
        setProfile(null); setDashboard(null); setDiary(null); setScreen("login"); return;
      }
      const [currentProfile, goals] = await Promise.all([api.getProfile(), api.getGoals()]);
      if (!active()) return;
      setProfile(currentProfile);
      const destination = nextScreen("login", { type: "session", authenticated: true, profileReady: currentProfile.body !== null, goalReady: goals.length > 0 });
      if (destination === "setup") { setScreen("setup"); return; }
      const [nextDashboard, nextDiary] = await readDashboard(localDateNow(currentProfile.timezone));
      if (!active()) return;
      setDashboard(nextDashboard); setDiary(nextDiary); setScreen("dashboard");
    } catch (caught) {
      if (!active()) return;
      if (isUnauthorized(caught)) expireSession();
      else { setError(errorText(caught)); setScreen("load-error"); }
    }
  }, [expireSession]);

  const loadDashboard = useCallback(async (date = today) => {
    const request = ++dashboardRequest.current;
    const session = sessionRequest.current;
    const active = () => request === dashboardRequest.current && session === sessionRequest.current;
    try {
      const [nextDashboard, nextDiary] = await readDashboard(date);
      if (active()) { setDashboard(nextDashboard); setDiary(nextDiary); }
    } catch (caught) {
      if (!active()) return;
      if (isUnauthorized(caught)) expireSession();
      else throw caught;
    }
  }, [today, expireSession]);

  useEffect(() => {
    void restoreSession();
    return () => { ++sessionRequest.current; ++dashboardRequest.current; };
  }, [restoreSession]);

  const logout = useCallback(async () => {
    const request = ++sessionRequest.current;
    ++dashboardRequest.current;
    try {
      await api.logout();
      if (request !== sessionRequest.current) return;
      setProfile(null); setDashboard(null); setDiary(null); setError(""); setScreen("login");
    } catch (caught) {
      if (request !== sessionRequest.current) return;
      if (isUnauthorized(caught)) expireSession();
      else setError(errorText(caught));
    }
  }, [expireSession]);

  let content: React.ReactNode;
  if (screen === "loading") content = <Shell title="正在准备你的空间" subtitle="只需要几秒钟。"><div className="card loading" role="status">正在连接本地服务…</div></Shell>;
  else if (screen === "load-error") content = <AuthShell eyebrow="CONNECTION" title="暂时无法加载你的空间" subtitle="服务连接或数据读取未完成，无需重新输入密码。" error={error}><button type="button" className="dg-button dg-button-primary" onClick={() => void restoreSession()}>重新加载</button></AuthShell>;
  else if (screen === "bootstrap") content = <Bootstrap onDone={(user) => { setProfile(user); setScreen("setup"); }} error={error} setError={setError} />;
  else if (screen === "login") content = <Login onDone={restoreSession} error={error} setError={setError} />;
  else if (screen === "setup") content = <Setup today={today} profile={profile} onDone={restoreSession} error={error} setError={setError} />;
  else content = <DashboardView today={today} dashboard={dashboard} diary={diary} profile={profile} loadDashboard={loadDashboard} onLogout={logout} onAuthExpired={expireSession} onOpenSetup={() => { ++dashboardRequest.current; setScreen("setup"); }} error={error} setError={setError} />;
  return <><OfflineNotice offline={offline} /><div aria-live="polite" className="sr-only">{offlineLabel(!offline)}</div>{content}</>;
}

function OfflineNotice(props: { offline: boolean }) { return props.offline ? <div className="offline-banner" role="status"><span>{offlineLabel(false)}</span><button onClick={() => window.location.reload()}>重试</button></div> : null; }

function Bootstrap(props: { onDone: (user: Profile) => void; error: string; setError: (value: string) => void }) {
  const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [timezone, setTimezone] = useState("Asia/Shanghai"); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); const validation = validateBootstrapInput({ displayName: name, password }); if (validation) { props.setError(bootstrapError(validation) ?? "请检查输入。"); return; } setBusy(true); try { const result = await api.bootstrap({ displayName: name.trim(), password, timezone }); props.onDone(result.user); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <AuthShell eyebrow="FIRST SETUP" title="先建立你的空间" subtitle="数据保存在你自己的服务中，首次设置只需完成一次。" error={props.error} busy={busy}><form className="dg-auth-form" onSubmit={submit}><Field label="称呼" name="displayName" value={name} onChange={setName} /><Field label={`密码（至少 ${BOOTSTRAP_PASSWORD_MIN_LENGTH} 个字符）`} name="password" type="password" value={password} onChange={setPassword} minLength={BOOTSTRAP_PASSWORD_MIN_LENGTH} /><Field label="时区" name="timezone" value={timezone} onChange={setTimezone} /><button className="dg-button dg-button-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? "正在创建…" : "创建并继续"}</button></form></AuthShell>;
}

function Login(props: { onDone: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); setBusy(true); try { await api.login(password); await props.onDone(); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <AuthShell eyebrow="WELCOME BACK" title="欢迎回来" subtitle="输入密码继续记录今天的饮食。" error={props.error} busy={busy}><form className="dg-auth-form" onSubmit={submit}><Field label="密码" name="password" type="password" value={password} onChange={setPassword} /><button className="dg-button dg-button-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? "正在登录…" : "登录"}</button></form></AuthShell>;
}

function Setup(props: { today: string; profile: Profile | null; onDone: () => Promise<void>; error: string; setError: (value: string) => void }) {
  const [height, setHeight] = useState(""); const [sex, setSex] = useState("none"); const [activity, setActivity] = useState("light"); const [goalType, setGoalType] = useState("loss"); const [calories, setCalories] = useState("1800"); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); props.setError(""); setBusy(true); try { await api.updateProfile({ heightCm: Number(height), sexForFormula: sex, activityLevel: activity }); await api.createGoal({ goalType, calorieTargetKcal: Number(calories), effectiveFrom: props.today, source: "manual" }); await props.onDone(); } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); } }
  return <AuthShell eyebrow="YOUR STARTING POINT" title={`完善 ${props.profile?.displayName ?? "你的"} 的目标`} subtitle="这些信息只用于计算每日预算，你可以随时调整。" error={props.error} busy={busy}><form className="dg-auth-form" onSubmit={submit}><Field label="身高（cm）" name="heightCm" type="number" min="1" step="0.1" value={height} onChange={setHeight} /><label className="field"><span>公式性别</span><select value={sex} onChange={(event) => setSex(event.target.value)}><option value="none">不指定</option><option value="female">女性</option><option value="male">男性</option></select></label><label className="field"><span>活动水平</span><select value={activity} onChange={(event) => setActivity(event.target.value)}><option value="sedentary">久坐</option><option value="light">轻度活动</option><option value="moderate">中度活动</option><option value="high">高活动</option><option value="very_high">极高活动</option></select></label><label className="field"><span>当前目标</span><select value={goalType} onChange={(event) => setGoalType(event.target.value)}><option value="loss">减脂</option><option value="maintain">维持</option><option value="gain">增重</option></select></label><Field label="每日热量目标（kcal）" name="calorieTargetKcal" type="number" min="1" step="1" value={calories} onChange={setCalories} /><button className="dg-button dg-button-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? "正在保存…" : "完成设置"}</button></form></AuthShell>;
}

export function DashboardView(props: { today: string; dashboard: Dashboard | null; diary: Diary | null; profile: Profile | null; loadDashboard: (date?: string) => Promise<void>; onLogout: () => Promise<void>; onAuthExpired?: () => void; onOpenSetup?: () => void; error: string; setError: (value: string) => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; summary: { energyKcal: number | null } }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [meal, setMeal] = useState("breakfast");
  const [busy, setBusy] = useState(false);
  const [searchStatus, setSearchStatus] = useState<FoodSearchStatus>("idle");
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [todayWeightRecords, setTodayWeightRecords] = useState<WeightRecord[]>([]);
  const [todayWeightTrend, setTodayWeightTrend] = useState<WeightTrend | null>(null);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [tdee, setTdee] = useState<TdeeEstimate | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<7 | 30 | 90>(30);
  const [m2Loading, setM2Loading] = useState(false);
  const [m2Error, setM2Error] = useState("");
  const [editingEntry, setEditingEntry] = useState<EditableDiaryEntry | null>(null);
  const [entryBusy, setEntryBusy] = useState<string | null>(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const panelEpoch = useRef(0);
  const todayRequest = useRef(0);
  const weightRequest = useRef(0);
  const analyticsRequest = useRef(0);
  const onAuthExpired = props.onAuthExpired;
  const today = props.today;
  const mealEntries = useMemo(() => new Map((props.diary?.mealSlots ?? []).map((slot) => [slot.key, {
    mealSlot: { key: slot.key, displayName: slot.displayName },
    entries: (props.diary?.entries ?? []).filter((entry) => entry.mealSlotId === slot.id).map((entry) => ({ id: entry.id, displayName: entry.displayNameSnapshot, amount: entry.amount, unit: entry.unit, mealSlotId: slot.key, version: entry.version })),
  }])), [props.diary]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const text = query.trim();
    props.setError("");
    setShowImportGuide(false);
    if (!text) { setResults([]); setSearchStatus("idle"); return; }
    setResults([]); setSelected(null); setSearchStatus("loading");
    try {
      const nextResults = await api.searchFoods(text);
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
      setFoodModalOpen(false);
      await props.loadDashboard();
    } catch (caught) { props.setError(errorText(caught)); } finally { setBusy(false); }
  }

  async function saveEntry(entry: EditableDiaryEntry) {
    setEntryBusy(entry.id); props.setError("");
    try {
      await api.updateDiaryEntry(today, entry.id, { amount: Number(entry.amount), mealSlotId: entry.mealSlotId, unit: "g", version: entry.version });
      setEditingEntry(null); await props.loadDashboard();
    } catch (caught) { props.setError(errorText(caught)); }
    finally { setEntryBusy(null); }
  }

  async function removeEntry(entry: EditableDiaryEntry) {
    if (!window.confirm(`删除“${entry.displayName}”？`)) return;
    setEntryBusy(entry.id); props.setError("");
    try { await api.deleteDiaryEntry(today, entry.id); setEditingEntry(null); await props.loadDashboard(); }
    catch (caught) { props.setError(errorText(caught)); }
    finally { setEntryBusy(null); }
  }

  async function copyDay() {
    setEntryBusy("copy-day"); props.setError("");
    try { await api.copyDiaryDay(today, daysAgo(today, 1)); await props.loadDashboard(); }
    catch (caught) { props.setError(errorText(caught)); }
    finally { setEntryBusy(null); }
  }

  const loadWeightPanel = useCallback(async () => {
    const epoch = panelEpoch.current;
    const request = ++weightRequest.current;
    const active = () => epoch === panelEpoch.current && request === weightRequest.current;
    setM2Loading(true); setM2Error("");
    try {
      const from = daysAgo(today, 89);
      const [nextWeights, nextTrend] = await Promise.all([api.getWeights(from, today), api.getWeightTrend(90)]);
      if (active()) { setWeights(nextWeights); setWeightTrend(nextTrend); }
    } catch (caught) {
      if (!active()) return;
      if (isUnauthorized(caught) && onAuthExpired) onAuthExpired();
      else setM2Error(errorText(caught));
    } finally { if (active()) setM2Loading(false); }
  }, [today, onAuthExpired]);

  const loadTodayWeightTrend = useCallback(async () => {
    const epoch = panelEpoch.current;
    const request = ++todayRequest.current;
    const active = () => epoch === panelEpoch.current && request === todayRequest.current;
    try {
      const from = daysAgo(today, 7);
      const [nextRecords, nextTrend] = await Promise.all([api.getWeights(from, today), api.getWeightTrend(7)]);
      if (active()) { setTodayWeightRecords(nextRecords); setTodayWeightTrend(nextTrend); }
    } catch (caught) {
      if (!active()) return;
      if (isUnauthorized(caught) && onAuthExpired) { onAuthExpired(); return; }
      // The trend is an optional enrichment for Today; it must not block diary or calorie data.
      // Keep the last successful snapshot when a refresh fails.
    }
  }, [today, onAuthExpired]);

  const loadAnalyticsPanel = useCallback(async (periodDays = analyticsPeriod) => {
    const epoch = panelEpoch.current;
    const request = ++analyticsRequest.current;
    const active = () => epoch === panelEpoch.current && request === analyticsRequest.current;
    setM2Loading(true); setM2Error("");
    try {
      const from = daysAgo(today, periodDays - 1);
      const [nextOverview, nextTdee] = await Promise.all([api.getAnalyticsOverview(from, today), api.getTdee(from, today)]);
      if (active()) { setAnalyticsOverview(nextOverview); setTdee(nextTdee); }
    } catch (caught) {
      if (!active()) return;
      if (isUnauthorized(caught) && onAuthExpired) onAuthExpired();
      else setM2Error(errorText(caught));
    } finally { if (active()) setM2Loading(false); }
  }, [analyticsPeriod, today, onAuthExpired]);

  useEffect(() => {
    if (activeTab === "today") void loadTodayWeightTrend();
    if (activeTab === "weight") void loadWeightPanel();
    if (activeTab === "analytics") void loadAnalyticsPanel();
    return () => { ++panelEpoch.current; };
  }, [activeTab, loadAnalyticsPanel, loadTodayWeightTrend, loadWeightPanel]);

  const navigate = (tab: DashboardTab) => {
    if (tab !== activeTab) ++panelEpoch.current;
    props.setError(""); setActiveTab(tab);
  };
  const logout = async () => { await props.onLogout(); };

  const searchCardProps: FoodSearchCardProps = { query, setQuery, results, selected, setSelected, amount, setAmount, meal, setMeal, busy, searchStatus, showImportGuide, setShowImportGuide, onSearch: search, onAddEntry: addEntry };
  const startMealAdd = (mealSlotId: string) => {
    setMeal(mealSlotId); setSelected(null); setAmount("100"); props.setError("");
    window.requestAnimationFrame(() => {
      document.getElementById("today-food-search")?.focus();
    });
  };
  const startTodayMealAdd = (mealSlotId: string) => {
    setMeal(mealSlotId); setSelected(null); setAmount("100"); setQuery(""); setResults([]); setSearchStatus("idle"); setShowImportGuide(false); props.setError(""); setFoodModalOpen(true);
  };
  const closeFoodModal = useCallback(() => setFoodModalOpen(false), []);
  return <><AppShell activeTab={activeTab} onNavigate={navigate} eyebrow={`${activeTab.toUpperCase()} · ${today}`} title={`你好，${props.profile?.displayName ?? "朋友"}`} headerAction={<button type="button" className="text-button" onClick={() => void logout()}>退出</button>}>
    {activeTab === "today" ? <TodayPage today={today} dashboard={props.dashboard} diary={props.diary} profile={props.profile} weightRecords={todayWeightRecords} weightTrend={todayWeightTrend} onStartMealAdd={startTodayMealAdd} onCopyDay={copyDay} onEdit={setEditingEntry} onDelete={removeEntry} onSave={saveEntry} onCancelEdit={() => setEditingEntry(null)} editingEntry={editingEntry} busyEntry={entryBusy} /> : null}
    {activeTab === "diary" ? <DiaryPage today={today} dashboard={props.dashboard} diary={props.diary} query={query} setQuery={setQuery} results={results} selected={selected} setSelected={setSelected} amount={amount} setAmount={setAmount} meal={meal} setMeal={setMeal} busy={busy} searchStatus={searchStatus} searchError={searchStatus === "error" ? props.error : undefined} showImportGuide={showImportGuide} setShowImportGuide={setShowImportGuide} onSearch={search} onAddEntry={addEntry} onStartMealAdd={startMealAdd} mealEntries={mealEntries} editingEntry={editingEntry} busyEntry={entryBusy} onEdit={setEditingEntry} onDelete={removeEntry} onSave={saveEntry} onCancelEdit={() => setEditingEntry(null)} onCopyDay={copyDay} /> : null}
    {activeTab === "recipe" ? <RecipePanel today={today} client={api} onDiaryReload={() => props.loadDashboard(today)} onOpenDiary={() => navigate("diary")} /> : null}
    {activeTab === "profile" ? <ProfilePage profile={props.profile} showImportGuide={showImportGuide} onToggleImportGuide={() => setShowImportGuide(!showImportGuide)} onOpenSetup={props.onOpenSetup} onLogout={() => void logout()} /> : null}
    {activeTab === "weight" ? <WeightPage today={today} records={weights} trend={weightTrend} loading={m2Loading} error={m2Error} onRetry={loadWeightPanel} onAdd={async (input) => { const epoch = panelEpoch.current; await api.createWeight(input); if (epoch === panelEpoch.current) await loadWeightPanel(); }} /> : null}
    {activeTab === "analytics" ? <AnalyticsPage overview={analyticsOverview} tdee={tdee} periodDays={analyticsPeriod} onPeriodChange={(periodDays) => { if (periodDays !== analyticsPeriod) { ++panelEpoch.current; setAnalyticsPeriod(periodDays); } }} loading={m2Loading} error={m2Error} onRetry={loadAnalyticsPanel} /> : null}
    {props.error ? <p className="error page-error" role="alert">{props.error}</p> : null}
  </AppShell>{foodModalOpen ? <FoodSearchModal {...searchCardProps} onClose={closeFoodModal} /> : null}</>;
}

type EditableDiaryEntry = { id: string; displayName: string; amount: number; unit: string; mealSlotId: string; version: number };

export type FoodSearchCardProps = { query: string; setQuery: (value: string) => void; results: Array<{ id: string; name: string; summary: { energyKcal: number | null } }>; selected: string | null; setSelected: (value: string) => void; amount: string; setAmount: (value: string) => void; meal: string; setMeal: (value: string) => void; busy: boolean; searchStatus: FoodSearchStatus; showImportGuide: boolean; setShowImportGuide: (value: boolean) => void; onSearch: (event: React.FormEvent) => Promise<void>; onAddEntry: (event: React.FormEvent) => Promise<void> };

export function FoodSearchModal(props: FoodSearchCardProps & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.querySelector<HTMLElement>(".dg-shell");
    const previousAriaHidden = shell?.getAttribute("aria-hidden") ?? null;
    if (shell) { shell.inert = true; shell.setAttribute("aria-hidden", "true"); }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { props.onClose(); return; }
    };
    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => document.getElementById("today-food-search")?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (shell) { shell.inert = false; if (previousAriaHidden === null) shell.removeAttribute("aria-hidden"); else shell.setAttribute("aria-hidden", previousAriaHidden); }
      previousFocus.current?.focus();
    };
  }, [props.onClose]);
  const mealLabels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  return <div className="food-modal-backdrop"><div ref={dialogRef} onKeyDown={trapFocus} className="food-modal" data-modal-focus-trap="true" role="dialog" aria-modal="true" aria-labelledby="food-modal-title"><div className="food-modal-header"><div><p className="eyebrow">QUICK RECORD</p><h2 id="food-modal-title">添加{mealLabels[props.meal] ?? "饮食"}</h2></div><button type="button" className="food-modal-close" aria-label="关闭记录饮食" onClick={props.onClose}>×</button></div><FoodSearchCard {...props} /></div></div>;
}

export function FoodSearchCard(props: FoodSearchCardProps) {
  const mealLabels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  return <><p className="today-active-meal" data-active-meal={props.meal}>当前添加到：{mealLabels[props.meal] ?? props.meal}</p><form className="search-row" onSubmit={(event) => void props.onSearch(event)}><input id="today-food-search" aria-label="搜索食物" placeholder="搜索馒头、鸡蛋…" value={props.query} onChange={(event) => props.setQuery(event.target.value)} /><button className="soft-button" disabled={props.searchStatus === "loading"}>{props.searchStatus === "loading" ? "搜索中…" : "搜索"}</button></form>{props.searchStatus === "loading" ? <p className="loading" role="status">正在搜索本地食物目录…</p> : null}{props.searchStatus === "empty" ? <div className="empty-state" role="status"><strong>没有找到匹配食物</strong><p>当前只搜索本地食物目录。如果目录尚未导入，请先完成受控离线导入。</p><button type="button" className="soft-button" onClick={() => props.setShowImportGuide(!props.showImportGuide)}>{props.showImportGuide ? "收起导入说明" : "查看导入说明"}</button></div> : null}{props.showImportGuide ? <div className="import-guide" role="note"><strong>本地目录导入</strong><p>请在服务端使用仓库中的 <code>tools/food-import</code> 导入受控 JSON 数据，然后重新搜索；浏览器不会连接外部食品库。</p></div> : null}{props.searchStatus === "success" ? <div className="results">{props.results.map((food) => <button type="button" className={`food-result ${props.selected === food.id ? "selected" : ""}`} key={food.id} onClick={() => props.setSelected(food.id)}><span>{food.name}</span><small>{food.summary.energyKcal ?? "—"} kcal / 100g</small></button>)}</div> : null}{props.selected ? <form className="add-form" onSubmit={(event) => void props.onAddEntry(event)}><label className="field"><span>餐次</span><select value={props.meal} onChange={(event) => props.setMeal(event.target.value)}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><Field label="份量（g）" name="amount" type="number" min="1" value={props.amount} onChange={props.setAmount} /><button className="primary" disabled={props.busy}>{props.busy ? "保存中…" : `加入${mealLabels[props.meal] ?? "饮食"}`}</button></form> : null}</>;
}

export function WeightPanel(props: { records: WeightRecord[]; trend: WeightTrend | null; loading: boolean; error: string; onRetry: () => Promise<void>; onAdd: (input: { measuredAt: string; weightKg: number; note?: string }) => Promise<void> }) {
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { await props.onAdd({ measuredAt: new Date().toISOString(), weightKg: Number(weight) }); setWeight(""); } finally { setBusy(false); } }
  return <section className="card add-card"><div className="section-heading"><h2>体重</h2><span className="status-chip">本地记录</span></div>{props.loading ? <p className="loading" role="status">正在加载体重记录…</p> : null}{props.error ? <div className="empty-state" role="alert"><strong>体重服务暂时不可用</strong><p>{props.error}</p><button type="button" className="soft-button" onClick={() => void props.onRetry()}>重试</button></div> : null}{!props.loading && !props.error && props.records.length === 0 ? <div className="empty-state" role="status"><strong>暂无体重记录</strong><p>添加第一条记录后，这里会显示当前体重和趋势。</p></div> : null}{props.records.length > 0 ? <div className="meals">{props.records.slice().reverse().slice(0, 10).map((record) => <div className="meal" key={record.id}><strong>{record.localDate}</strong><span>{record.weightKg.toFixed(1)} kg</span></div>)}</div> : null}{props.trend && props.trend.points.length > 0 ? <p className="muted">趋势体重：{props.trend.points[props.trend.points.length - 1]!.trendWeightKg.toFixed(1)} kg（{props.trend.method === "ewma" ? "EWMA" : "rolling"}）</p> : null}<form className="add-form" onSubmit={(event) => void submit(event)}><Field label="当前体重（kg）" name="weightKg" type="number" min="1" step="0.1" value={weight} onChange={setWeight} /><button className="primary" disabled={busy}>{busy ? "保存中…" : "添加体重"}</button></form></section>;
}

export function AnalyticsPanel(props: { overview: AnalyticsOverview | null; tdee: Pick<TdeeEstimate, "status" | "estimatedTdeeKcal" | "reason" | "confidence"> | null; loading: boolean; error: string; onRetry: () => Promise<void> }) {
  return <section className="card add-card"><div className="section-heading"><h2>分析</h2><span className="status-chip">只读估算</span></div>{props.loading ? <p className="loading" role="status">正在加载分析…</p> : null}{props.error ? <div className="empty-state" role="alert"><strong>分析服务暂时不可用</strong><p>{props.error}</p><button type="button" className="soft-button" onClick={() => void props.onRetry()}>重试</button></div> : null}{!props.loading && !props.error && props.overview ? <><div className="macro-grid"><Metric label="平均摄入" value={props.overview.averages.intakeKcal ?? 0} unit="kcal" /><Metric label="平均蛋白质" value={props.overview.averages.proteinG ?? 0} unit="g" /><Metric label="记录覆盖" value={props.overview.recordCoverage.ratio * 100} unit="%" /></div><p className="muted">体重变化：{props.overview.weight.deltaKg === null ? "—" : `${props.overview.weight.deltaKg.toFixed(1)} kg`}</p></> : null}{!props.loading && !props.error && (!props.tdee || props.tdee.status !== "estimated") ? <div className="empty-state" role="status"><strong>数据不足</strong><p>当前数据不足以生成 Adaptive TDEE，不会伪造估算。</p></div> : null}{props.tdee?.status === "estimated" ? <p className="muted">估算维持热量：{Math.round(props.tdee.estimatedTdeeKcal ?? 0)} kcal · 置信度 {(props.tdee.confidence * 100).toFixed(0)}%</p> : null}</section>;
}

function Metric(props: { label: string; value: number; unit: string }) { return <div className="metric card"><span className="muted">{props.label}</span><strong>{Math.round(props.value)}<small>{props.unit}</small></strong></div>; }
