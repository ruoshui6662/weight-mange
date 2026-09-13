import { useRef, type FormEvent, type ReactNode } from "react";
import type { Dashboard, Diary } from "../api";
import type { FoodSearchStatus } from "../search-state";
import { Button, IconButton, StatusMessage, Surface } from "./Primitives";

export type DiaryEntryForPage = { id: string; displayName: string; amount: number; unit: string; mealSlotId: string; version: number };
export type MealEntryGroupForPage = { mealSlot: { key: string; displayName: string }; entries: DiaryEntryForPage[] };
type FoodResult = { id: string; name: string; summary: { energyKcal: number | null } };

export type DiaryPageProps = {
  today: string;
  dashboard: Dashboard | null;
  diary: Diary | null;
  query: string;
  setQuery: (value: string) => void;
  results: FoodResult[];
  selected: string | null;
  setSelected: (value: string | null) => void;
  amount: string;
  setAmount: (value: string) => void;
  meal: string;
  setMeal: (value: string) => void;
  busy: boolean;
  searchStatus: FoodSearchStatus;
  searchError: string | undefined;
  showImportGuide: boolean;
  setShowImportGuide: (value: boolean) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAddEntry: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStartMealAdd: (mealSlotId: string) => void;
  mealEntries: Map<string, MealEntryGroupForPage>;
  editingEntry: DiaryEntryForPage | null;
  busyEntry: string | null;
  onEdit: (entry: DiaryEntryForPage) => void;
  onDelete: (entry: DiaryEntryForPage) => Promise<void>;
  onSave: (entry: DiaryEntryForPage) => Promise<void>;
  onCancelEdit: () => void;
  onCopyDay: () => Promise<void>;
};

const mealLabels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };

export function DiaryPage(props: DiaryPageProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const startMealAdd = (mealSlotId: string) => {
    props.onStartMealAdd(mealSlotId);
    searchInputRef.current?.focus();
  };
  return <div className="dg-page diary-page" data-diary-layout="workspace">
    <div className="diary-workspace">
      <Surface className="diary-search-panel">
        <div className="diary-panel-heading"><div><span className="dg-eyebrow">饮食 · {props.today}</span><h2>记录一餐</h2><p className="dg-muted">从本地食物目录选择食物，确认份量后保存到今天。</p></div><span className="dg-status-chip">本地食物目录</span></div>
        <form className="diary-search-form" onSubmit={(event) => void props.onSearch(event)}>
          <label className="diary-search-field"><span>搜索食物</span><input ref={searchInputRef} aria-label="搜索食物" placeholder="搜索馒头、鸡蛋…" value={props.query} onChange={(event) => props.setQuery(event.target.value)} /></label>
          <Button type="submit" variant="secondary" busy={props.searchStatus === "loading"}>搜索食物</Button>
        </form>
        <p className="diary-active-meal" data-active-meal={props.meal}>当前添加到：{mealLabels[props.meal] ?? props.meal}</p>
        <SearchState {...props} />
        {props.searchStatus === "success" ? <div className="diary-results" aria-label="食物搜索结果">{props.results.map((food) => <button type="button" className={`diary-result-row ${props.selected === food.id ? "selected" : ""}`} data-food-result={food.id} aria-label={`选择${food.name} · ${food.summary.energyKcal ?? "—"} kcal`} aria-pressed={props.selected === food.id} key={food.id} onClick={() => props.setSelected(food.id)}><span><strong>{food.name}</strong><small>本地目录 · 每 100g</small></span><span className="diary-result-kcal">{food.summary.energyKcal ?? "—"} kcal</span></button>)}</div> : null}
        {props.selected ? <QuantityConfirmation {...props} /> : null}
      </Surface>
      <SummaryPanel {...props} onStartMealAdd={startMealAdd} />
    </div>
  </div>;
}

function SearchState(props: DiaryPageProps) {
  if (props.searchStatus === "loading") return <>{<StatusMessage kind="loading" title="正在搜索本地食物目录…" />}{props.searchError ? <StatusMessage kind="error" title="搜索未完成" description={props.searchError} /> : null}</>;
  if (props.searchStatus === "error") return <StatusMessage kind="error" title="搜索未完成" description={props.searchError ?? "请求未完成，请检查服务状态后重试。"} action={<Button variant="secondary" type="button" onClick={() => void props.onSearch(new Event("submit") as unknown as FormEvent<HTMLFormElement>)}>重试搜索</Button>} />;
  if (props.searchStatus === "empty") return <div className="diary-empty-catalog" role="status"><strong>没有找到匹配食物</strong><p>当前只搜索本地食物目录。如果目录尚未导入，请先完成受控离线导入。</p><Button variant="tertiary" type="button" onClick={() => props.setShowImportGuide(!props.showImportGuide)}>{props.showImportGuide ? "收起导入说明" : "查看导入说明"}</Button>{props.showImportGuide ? <div className="diary-import-guide" role="note"><strong>本地目录导入</strong><p>请在服务端使用仓库中的 <code>tools/food-import</code> 导入受控 JSON 数据，然后重新搜索；浏览器不会连接外部食品库。</p></div> : null}</div>;
  return null;
}

function QuantityConfirmation(props: DiaryPageProps) {
  const value = Number(props.amount) || 0;
  const updateAmount = (next: number) => props.setAmount(String(Math.max(1, Math.round(next))));
  return <form className="diary-confirmation" onSubmit={(event) => void props.onAddEntry(event)}>
    <div className="diary-confirmation-heading"><div><span className="dg-eyebrow">已选择</span><h3>{props.results.find((food) => food.id === props.selected)?.name ?? "食物"}</h3></div><span className="dg-status-chip">确认后记录</span></div>
    <div className="diary-confirmation-grid">
      <div className="diary-quantity"><span className="diary-field-label">份量（g）</span><div className="quantity-control"><IconButton type="button" label="减少份量" onClick={() => updateAmount(value - 10)}>−</IconButton><input aria-label="份量（g）" name="amount" type="number" min="1" step="1" value={props.amount} onChange={(event) => props.setAmount(event.target.value)} /><IconButton type="button" label="增加份量" onClick={() => updateAmount(value + 10)}>＋</IconButton></div></div>
      <label className="diary-meal-field"><span className="diary-field-label">餐次</span><select aria-label="添加到餐次" value={props.meal} onChange={(event) => props.setMeal(event.target.value)}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label>
    </div>
    <Button type="submit" variant="primary" aria-label="加入记录" busy={props.busy}>加入饮食记录</Button>
  </form>;
}

function SummaryPanel(props: DiaryPageProps) {
  return <Surface className="diary-summary" aria-label="今日摘要" data-mobile-sheet-label="今日摘要"><div className="diary-summary-heading"><div><span className="dg-eyebrow">今天 · {props.today}</span><h2>今天吃了什么</h2></div><Button variant="secondary" type="button" busy={props.busyEntry === "copy-day"} onClick={() => void props.onCopyDay()}>{props.busyEntry === "copy-day" ? "复制中…" : "复制昨日整天"}</Button></div><p className="diary-mobile-sheet-hint">移动端将在搜索后显示今日摘要</p><div className="diary-meal-groups">{["breakfast", "lunch", "dinner", "snack"].map((key) => <MealGroup key={key} {...props} mealKey={key} />)}</div></Surface>;
}

function MealGroup(props: DiaryPageProps & { mealKey: string }) {
  const group = props.mealEntries.get(props.mealKey);
  const label = group?.mealSlot.displayName ?? mealLabels[props.mealKey] ?? props.mealKey;
  const total = props.dashboard?.meals.find((meal) => meal.key === props.mealKey)?.totals.kcal;
  return <section className="diary-meal-group"><div className="diary-meal-heading"><div><h3>{label}</h3><span>{total === undefined ? "暂无数据" : `${Math.round(total)} kcal`}</span></div><div className="diary-meal-actions"><Button variant="secondary" type="button" data-meal-add={props.mealKey} aria-label={`添加${label}食物`} onClick={() => props.onStartMealAdd(props.mealKey)}>添加食物</Button></div></div>{group?.entries.length ? <div className="diary-entry-list">{group.entries.map((entry) => <DiaryEntry key={entry.id} {...props} entry={entry} />)}</div> : <p className="diary-empty-meal">还没有记录</p>}</section>;
}

function DiaryEntry(props: DiaryPageProps & { entry: DiaryEntryForPage }) {
  const editing = props.editingEntry?.id === props.entry.id;
  const entryLabel = `${props.entry.displayName} · ${props.entry.amount}${props.entry.unit}`;
  return <div className="diary-entry"><div className="diary-entry-main"><strong>{entryLabel}</strong></div><div className="diary-entry-actions"><Button variant="tertiary" type="button" aria-label={`编辑${props.entry.displayName}`} onClick={() => props.onEdit(props.entry)}>编辑</Button><Button variant="destructive" type="button" aria-label={`删除${props.entry.displayName}`} busy={props.busyEntry === props.entry.id} onClick={() => void props.onDelete(props.entry)}>删除</Button></div>{editing ? <form className="diary-edit-form" onSubmit={(event) => { event.preventDefault(); void props.onSave(props.editingEntry!); }}><label><span>份量（g）</span><input name={`edit-amount-${props.entry.id}`} type="number" min="1" value={props.editingEntry!.amount} onChange={(event) => props.onEdit({ ...props.editingEntry!, amount: Number(event.target.value) })} /></label><label><span>餐次</span><select aria-label={`编辑餐次-${props.entry.displayName}`} value={props.editingEntry!.mealSlotId} onChange={(event) => props.onEdit({ ...props.editingEntry!, mealSlotId: event.target.value })}><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner">晚餐</option><option value="snack">加餐</option></select></label><div><Button type="submit" variant="primary" busy={props.busyEntry === props.entry.id}>保存修改</Button><Button type="button" variant="secondary" onClick={props.onCancelEdit}>取消</Button></div></form> : null}</div>;
}

export function DiaryPageError({ children }: { children: ReactNode }) { return <p className="diary-page-error" role="alert">{children}</p>; }
