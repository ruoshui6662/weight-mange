import type { CSSProperties } from "react";
import type { Dashboard, Diary, Profile, WeightRecord, WeightTrend } from "../api";
import { daysAgo } from "../date";
import { Button, StatusMessage, Surface } from "./Primitives";
import { WeightTrendChart } from "./WeightTrendChart";

type EditableEntry = { id: string; displayName: string; amount: number; unit: string; mealSlotId: string; version: number };
type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

export type TodayPageProps = {
  today: string;
  dashboard: Dashboard | null;
  diary: Diary | null;
  profile: Profile | null;
  onStartMealAdd: (mealSlotId: string) => void;
  onCopyDay: () => Promise<void>;
  onEdit: (entry: EditableEntry) => void;
  onDelete: (entry: EditableEntry) => Promise<void>;
  onSave: (entry: EditableEntry) => Promise<void>;
  onCancelEdit: () => void;
  editingEntry?: EditableEntry | null;
  busyEntry?: string | null;
  weightRecords?: WeightRecord[];
  weightTrend?: WeightTrend | null;
};

const meals: Array<{ key: MealKey; label: string }> = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
];

export function TodayPage(props: TodayPageProps) {
  const dashboard = props.dashboard;
  const remaining = dashboard?.remainingKcal;
  const intake = dashboard?.intake.kcal;
  const goal = dashboard?.goal?.kcal;
  const progress = intake !== undefined && goal && goal > 0 ? Math.max(0, Math.min(100, Math.round((intake / goal) * 100))) : null;

  return <div className="today-page" data-today-layout="dashboard">
    <div className="today-page-main">
      {dashboard ? <CalorieHero dashboard={dashboard} remaining={remaining} intake={intake} goal={goal} progress={progress} /> : <StatusMessage kind="empty" title="今日数据暂不可用" description="服务还没有返回今天的预算和摄入。你仍然可以先记录一餐，稍后再刷新。" />}
      <MealGrid {...props} />
      <TodayWeightTrend today={props.today} records={props.weightRecords} trend={props.weightTrend} />
      <Surface className="today-weekly-summary"><div className="today-section-heading"><div><span className="today-kicker">趋势提示</span><h2>本周概览</h2></div><span className="today-muted">记录后逐步形成</span></div><p className="today-muted">本周的连续记录、摄入趋势和目标完成度会在数据足够后显示。当前不使用缺失日期填充为 0。</p></Surface>
    </div>
    <aside className="today-context-rail" aria-label="今日辅助信息"><Surface className="today-rail-card"><span className="today-kicker">DATA QUALITY</span><h2>数据说明</h2><p className="today-muted">没有饮食记录时，已摄入显示为 0；没有热量目标时，剩余预算显示为“暂不可用”。点击每餐的“添加”即可打开记录窗口。</p></Surface></aside>
  </div>;
}

function TodayWeightTrend(props: { today: string; records: WeightRecord[] | undefined; trend: WeightTrend | null | undefined }) {
  const startDate = daysAgo(props.today, 7);
  const recentRecords = (props.records ?? [])
    .filter((record) => record.localDate >= startDate && record.localDate <= props.today)
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.measuredAt.localeCompare(b.measuredAt));
  const points = (props.trend?.points ?? []).filter((point) => point.localDate >= startDate && point.localDate <= props.today);
  if (recentRecords.length === 0 || points.length === 0) return null;

  const latestRecord = recentRecords.at(-1)!;
  const firstPoint = points[0]!;
  const latestPoint = points.at(-1)!;
  const delta = points.length > 1 ? latestPoint.trendWeightKg - firstPoint.trendWeightKg : null;
  const deltaText = delta === null ? null : delta < 0 ? `↓ ${Math.abs(delta).toFixed(1)} kg` : delta > 0 ? `↑ ${delta.toFixed(1)} kg` : "→ 0.0 kg";

  return <Surface className="today-weight-trend" data-today-weight-trend="visible">
    <div className="today-weight-trend-heading">
      <div><span className="today-kicker">BODY · LAST 7 DAYS</span><h2>体重趋势</h2><p className="today-muted">从一周前开始，只展示真实记录，不用缺失日期补零。</p></div>
      <div className="today-weight-summary"><strong>{latestRecord.weightKg.toFixed(1)} kg</strong>{deltaText ? <span className={delta !== null && delta < 0 ? "today-weight-delta-down" : "today-weight-delta"}>{deltaText}</span> : <span className="today-muted">记录 1 天</span>}<small>最新记录 · {latestRecord.localDate}</small></div>
    </div>
    <WeightTrendChart points={points} rangeDays={7} ariaLabel="最近 7 天体重趋势图" />
  </Surface>;
}

function CalorieHero(props: { dashboard: Dashboard; remaining: number | null | undefined; intake: number | undefined; goal: number | undefined; progress: number | null }) {
  const remainingValue = typeof props.remaining === "number" ? Math.round(props.remaining) : null;
  const overBudget = remainingValue !== null && remainingValue < 0;
  const remainingText = remainingValue === null ? "暂不可用" : `${Math.max(0, remainingValue)} kcal`;
  const intakeText = props.intake === undefined ? "暂不可用" : `${Math.round(props.intake)} kcal`;
  const goalText = props.goal === undefined ? "暂不可用" : `${Math.round(props.goal)} kcal`;
  return <Surface className="today-calorie-hero" data-calorie-summary="combined">
    <div className="today-hero-header"><div><span className="today-kicker">TODAY · ENERGY BUDGET</span><h2>今日热量</h2></div><span className="today-progress-label">{props.progress === null ? "目标暂不可用" : `已完成 ${props.progress}%`}</span></div>
    <div className="today-energy-overview">
      <div className="today-energy-stat"><span>已摄入 <b>{intakeText}</b></span></div>
      <div className="today-hero-ring" role="progressbar" aria-label={`今日热量完成 ${props.progress ?? 0}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={props.progress ?? 0} style={{ "--today-progress": `${props.progress ?? 0}%` } as CSSProperties}><span className="today-remaining-label">还可以吃</span><strong className="today-remaining-value">{remainingText}</strong><small>{overBudget ? `已超出 ${Math.abs(remainingValue!)} kcal` : `目标 ${goalText}`}</small></div>
      <div className="today-energy-stat"><span>今日目标 <b>{goalText}</b></span></div>
    </div>
    <p className="today-energy-note">{overBudget ? `已超出预算 ${Math.abs(remainingValue!)} kcal` : "剩余预算基于今天已记录的摄入计算"}</p>
    <MacroOverview dashboard={props.dashboard} />
  </Surface>;
}

function MacroOverview({ dashboard }: { dashboard: Dashboard }) {
  const metrics = [
    { label: "碳水", value: dashboard.intake.carbG, goal: dashboard.goal?.carbG, tone: "mint" },
    { label: "蛋白质", value: dashboard.intake.proteinG, goal: dashboard.goal?.proteinG, tone: "coral" },
    { label: "脂肪", value: dashboard.intake.fatG, goal: dashboard.goal?.fatG, tone: "sunflower" },
  ];
  return <section className="today-macro-strip" data-macro-layout="inline" aria-label="营养概览">{metrics.map((metric) => {
    const goalAvailable = metric.goal !== null && metric.goal !== undefined;
    const valueText = goalAvailable ? `${Math.round(metric.value)} / ${Math.round(metric.goal!)} g` : `${Math.round(metric.value)} g`;
    return <div className={`today-macro-item today-macro-${metric.tone}`} key={metric.label}><span className="today-macro-label">{metric.label}</span><strong className="today-macro-value">{valueText}</strong><div className="today-macro-track" aria-hidden="true"><span style={{ width: goalAvailable && metric.goal! > 0 ? `${Math.min(100, (metric.value / metric.goal!) * 100)}%` : "0%" }} /></div><span className="today-macro-goal">{goalAvailable ? `${Math.round((metric.value / metric.goal!) * 100)}%` : "暂无目标"}</span></div>;
  })}</section>;
}

function MealGrid(props: TodayPageProps) {
  const hasEntries = (props.diary?.entries.length ?? 0) > 0;
  return <section className="today-meals" aria-labelledby="today-meals-title">
    <div className="today-section-heading"><div><span className="today-kicker">MEAL PLAN</span><h2 id="today-meals-title">今日饮食记录</h2><p className="today-muted">从对应餐次的“添加”按钮开始记录。</p></div><div className="today-meal-actions"><Button variant="tertiary" type="button" onClick={() => void props.onCopyDay()} busy={props.busyEntry === "copy-day"}>复制昨日整天</Button></div></div>
    <div className="today-meal-grid">{meals.map((meal) => <MealGroup key={meal.key} {...props} meal={meal} />)}</div>
    {!hasEntries ? <div className="today-empty-record" data-today-empty-state="visible"><strong>今天还没有记录任何食物</strong><p>点击对应餐次的“添加”按钮开始记录。</p></div> : null}
  </section>;
}

function MealGroup(props: TodayPageProps & { meal: { key: MealKey; label: string } }) {
  const slot = props.diary?.mealSlots.find((item) => item.key === props.meal.key);
  const entries = props.diary?.entries.filter((entry) => entry.mealSlotId === slot?.id) ?? [];
  const kcal = props.dashboard?.meals.find((item) => item.key === props.meal.key)?.totals.kcal;
  return <article className="today-meal-group"><div className="today-meal-heading"><div><h3>{props.meal.label}</h3><span className="today-muted">{kcal === undefined ? "暂无数据" : `${Math.round(kcal)} kcal`}</span></div><div className="today-meal-actions"><Button variant="secondary" type="button" data-meal-add={props.meal.key} aria-label={`添加${props.meal.label}食物`} onClick={() => props.onStartMealAdd(props.meal.key)}>＋ 添加</Button></div></div>{entries.length === 0 ? <p className="today-empty-meal">还没有记录 · 点击“添加”开始记录</p> : <div className="today-entry-list">{entries.map((entry) => <DiaryEntry key={entry.id} {...props} entry={{ id: entry.id, displayName: entry.displayNameSnapshot, amount: entry.amount, unit: entry.unit, mealSlotId: props.meal.key, version: entry.version }} />)}</div>}</article>;
}

function DiaryEntry(props: TodayPageProps & { entry: EditableEntry }) {
  const isEditing = props.editingEntry?.id === props.entry.id;
  const entryLabel = `${props.entry.displayName} · ${props.entry.amount}${props.entry.unit}`;
  return <div className="today-entry"><div><strong>{entryLabel}</strong></div><div className="today-entry-actions"><Button variant="tertiary" aria-label={`编辑${props.entry.displayName}`} onClick={() => props.onEdit(props.entry)}>编辑</Button><Button variant="destructive" aria-label={`删除${props.entry.displayName}`} onClick={() => void props.onDelete(props.entry)} disabled={props.busyEntry === props.entry.id}>删除</Button></div>{isEditing ? <form className="today-entry-edit" onSubmit={(event) => { event.preventDefault(); void props.onSave(props.editingEntry!); }}><label className="field"><span>份量（{props.entry.unit}）</span><input name={`edit-amount-${props.entry.id}`} type="number" min="1" step="0.1" value={props.editingEntry?.amount ?? props.entry.amount} onChange={(event) => props.onEdit({ ...props.editingEntry!, amount: Number(event.target.value) })} /></label><label className="field"><span>餐次</span><select aria-label={`编辑餐次-${props.entry.displayName}`} value={props.editingEntry?.mealSlotId ?? props.entry.mealSlotId} onChange={(event) => props.onEdit({ ...props.editingEntry!, mealSlotId: event.target.value })}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><div className="today-entry-actions"><Button type="submit" variant="primary" busy={props.busyEntry === props.entry.id}>保存修改</Button><Button type="button" variant="secondary" onClick={props.onCancelEdit}>取消</Button></div></form> : null}</div>;
}
