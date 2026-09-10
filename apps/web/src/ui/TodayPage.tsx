import type { ReactNode } from "react";
import type { Dashboard, Diary, Profile } from "../api";
import { Button, Metric, StatusMessage, Surface } from "./Primitives";

type EditableEntry = { id: string; displayName: string; amount: number; unit: string; mealSlotId: string; version: number };
type MealKey = "breakfast" | "lunch" | "dinner" | "snack";

export type TodayPageProps = {
  today: string;
  dashboard: Dashboard | null;
  diary: Diary | null;
  profile: Profile | null;
  onAddFood: ReactNode;
  onCopyDay: () => Promise<void>;
  onCopyMeal: (mealSlotId: string) => Promise<void>;
  onEdit: (entry: EditableEntry) => void;
  onDelete: (entry: EditableEntry) => Promise<void>;
  onSave: (entry: EditableEntry) => Promise<void>;
  onCancelEdit: () => void;
  editingEntry?: EditableEntry | null;
  busyEntry?: string | null;
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
  const progress = intake !== undefined && goal && goal > 0 ? Math.min(100, Math.round((intake / goal) * 100)) : null;

  return <div className="today-page" data-today-layout="dashboard">
    <div className="today-page-main">
      {dashboard ? <CalorieHero remaining={remaining} intake={intake} goal={goal} progress={progress} /> : <StatusMessage kind="empty" title="今日数据暂不可用" description="服务还没有返回今天的预算和摄入。你仍然可以先记录一餐，稍后再刷新。" action={<a className="dg-button dg-button-secondary" href="#today-quick-record">先记录一餐</a>} />}
      {dashboard ? <MacroOverview dashboard={dashboard} /> : null}
      <MealGrid {...props} />
      <Surface className="today-weekly-summary"><div className="today-section-heading"><div><span className="today-kicker">趋势提示</span><h2>本周概览</h2></div><span className="today-muted">记录后逐步形成</span></div><p className="today-muted">本周的连续记录、摄入趋势和目标完成度会在数据足够后显示。当前不使用缺失日期填充为 0。</p></Surface>
      <section className="today-quick-record" id="today-quick-record"><div className="today-section-heading"><div><span className="today-kicker">行动</span><h2>记录今天的饮食</h2></div><span className="today-muted">本地目录</span></div><p className="today-muted">选择食物、确认份量，再加入对应餐次。历史营养会按记录时快照保存。</p>{props.onAddFood}</section>
    </div>
    <aside className="today-context-rail" aria-label="今日辅助信息"><Surface className="today-rail-card"><span className="today-kicker">QUICK RECORD</span><h2>快速记录</h2><p className="today-muted">不必先理解全部数据。先完成一笔真实记录，页面会逐步补齐你的花园。</p><a className="dg-button dg-button-secondary" href="#today-quick-record">前往记录区</a></Surface><Surface className="today-rail-card"><span className="today-kicker">DATA QUALITY</span><h2>数据说明</h2><p className="today-muted">缺失的目标、快照或历史数据会明确标记为“暂不可用”，不会伪装成零。</p></Surface></aside>
  </div>;
}

function CalorieHero(props: { remaining: number | null | undefined; intake: number | undefined; goal: number | undefined; progress: number | null }) {
  const remainingText = props.remaining === null || props.remaining === undefined ? "暂不可用" : `${Math.round(props.remaining)} kcal`;
  const intakeText = props.intake === undefined ? "暂不可用" : `${Math.round(props.intake)} kcal`;
  const goalText = props.goal === undefined ? "暂不可用" : `${Math.round(props.goal)} kcal`;
  return <Surface className="today-calorie-hero"><div className="today-hero-copy"><span className="today-kicker">TODAY · ENERGY BUDGET</span><h2>还可以吃</h2><strong className="today-remaining-value">{remainingText}</strong><p className="today-muted">剩余预算 · 基于今天已记录的摄入</p><div className="today-budget-context"><span>已摄入 <b>{intakeText}</b></span><span>目标 <b>{goalText}</b></span></div>{props.progress === null ? <p className="today-muted">目标数据暂不可用，暂不展示完成比例。</p> : <><div className="today-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={props.progress} aria-label={`今日热量完成 ${props.progress}%`}><span style={{ width: `${props.progress}%` }} /></div><span className="today-progress-label">已完成 {props.progress}%</span></>}</div><div className="today-hero-ring" aria-hidden="true"><span>{props.progress === null ? "—" : `${props.progress}%`}</span></div></Surface>;
}

function MacroOverview({ dashboard }: { dashboard: Dashboard }) {
  const metrics = [
    { label: "蛋白质", value: dashboard.intake.proteinG, goal: dashboard.goal?.proteinG, tone: "coral" },
    { label: "脂肪", value: dashboard.intake.fatG, goal: dashboard.goal?.fatG, tone: "sunflower" },
    { label: "碳水", value: dashboard.intake.carbG, goal: dashboard.goal?.carbG, tone: "mint" },
  ];
  return <section className="today-macro-overview" aria-label="营养概览">{metrics.map((metric) => <div className={`today-macro-row today-macro-${metric.tone}`} key={metric.label}><Metric label={metric.label} value={Math.round(metric.value)} unit="g" /><div className="today-macro-track" aria-hidden="true"><span style={{ width: metric.goal ? `${Math.min(100, (metric.value / metric.goal) * 100)}%` : "0%" }} /></div><span className="today-macro-goal">{metric.goal === null || metric.goal === undefined ? "目标暂不可用" : `目标 ${Math.round(metric.goal)} g`}</span></div>)}</section>;
}

function MealGrid(props: TodayPageProps) {
  return <section className="today-meals" aria-labelledby="today-meals-title"><div className="today-section-heading"><div><span className="today-kicker">MEAL PLAN</span><h2 id="today-meals-title">今天吃了什么</h2></div><Button variant="secondary" onClick={() => void props.onCopyDay()} busy={props.busyEntry === "copy-day"}>复制昨天整天</Button></div><div className="today-meal-grid">{meals.map((meal) => <MealGroup key={meal.key} {...props} meal={meal} />)}</div></section>;
}

function MealGroup(props: TodayPageProps & { meal: { key: MealKey; label: string } }) {
  const slot = props.diary?.mealSlots.find((item) => item.key === props.meal.key);
  const entries = props.diary?.entries.filter((entry) => entry.mealSlotId === slot?.id) ?? [];
  const kcal = props.dashboard?.meals.find((item) => item.key === props.meal.key)?.totals.kcal;
  return <article className="today-meal-group"><div className="today-meal-heading"><div><h3>{props.meal.label}</h3><span className="today-muted">{kcal === undefined ? "暂无数据" : `${Math.round(kcal)} kcal`}</span></div><Button variant="tertiary" onClick={() => void props.onCopyMeal(slot?.key ?? props.meal.key)} busy={props.busyEntry === `copy-meal:${slot?.key ?? props.meal.key}`}>复制昨日{props.meal.label}</Button></div>{entries.length === 0 ? <p className="today-empty-meal">还没有记录 · 从下方快速添加一项</p> : <div className="today-entry-list">{entries.map((entry) => <DiaryEntry key={entry.id} {...props} entry={{ id: entry.id, displayName: entry.displayNameSnapshot, amount: entry.amount, unit: entry.unit, mealSlotId: props.meal.key, version: entry.version }} />)}</div>}</article>;
}

function DiaryEntry(props: TodayPageProps & { entry: EditableEntry }) {
  const isEditing = props.editingEntry?.id === props.entry.id;
  const entryLabel = `${props.entry.displayName} · ${props.entry.amount}${props.entry.unit}`;
  return <div className="today-entry"><div><strong>{entryLabel}</strong></div><div className="today-entry-actions"><Button variant="tertiary" aria-label={`编辑${props.entry.displayName}`} onClick={() => props.onEdit(props.entry)}>编辑</Button><Button variant="destructive" aria-label={`删除${props.entry.displayName}`} onClick={() => void props.onDelete(props.entry)} disabled={props.busyEntry === props.entry.id}>删除</Button></div>{isEditing ? <form className="today-entry-edit" onSubmit={(event) => { event.preventDefault(); void props.onSave(props.editingEntry!); }}><label className="field"><span>份量（{props.entry.unit}）</span><input name={`edit-amount-${props.entry.id}`} type="number" min="1" step="0.1" value={props.editingEntry?.amount ?? props.entry.amount} onChange={(event) => props.onEdit({ ...props.editingEntry!, amount: Number(event.target.value) })} /></label><label className="field"><span>餐次</span><select aria-label={`编辑餐次-${props.entry.displayName}`} value={props.editingEntry?.mealSlotId ?? props.entry.mealSlotId} onChange={(event) => props.onEdit({ ...props.editingEntry!, mealSlotId: event.target.value })}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><div className="today-entry-actions"><Button type="submit" variant="primary" busy={props.busyEntry === props.entry.id}>保存修改</Button><Button type="button" variant="secondary" onClick={props.onCancelEdit}>取消</Button></div></form> : null}</div>;
}
