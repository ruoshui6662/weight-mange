import { useMemo, useState } from "react";
import type { WeightRecord, WeightTrend } from "../api";
import { Button, Metric, StatusMessage, Surface } from "./Primitives";

export type WeightPageProps = {
  today?: string;
  records: WeightRecord[];
  trend: WeightTrend | null;
  loading: boolean;
  error: string;
  onRetry: () => Promise<void>;
  onAdd: (input: { measuredAt: string; weightKg: number; note?: string }) => Promise<void>;
};

export type WeightInput = { measuredAt: string; weightKg: number; note?: string };
export const weightSaveErrorMessage = "保存未完成，请检查服务状态后重试。输入内容已保留。";
export const weightSaveSuccessMessage = "保存成功：已记录这次体重。";

export async function persistWeightRecord(onAdd: (input: WeightInput) => Promise<void>, input: WeightInput) {
  await onAdd(input);
}

type Range = 7 | 30;

export function WeightPage(props: WeightPageProps) {
  const [range, setRange] = useState<Range>(7);
  const [date, setDate] = useState(props.today ?? "");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const orderedRecords = useMemo(() => props.records.slice().sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)), [props.records]);
  const latest = orderedRecords[0];
  const points = props.trend?.points.slice(-range) ?? [];
  const trendLatest = points.at(-1)?.trendWeightKg ?? latest?.weightKg;
  const currentWeight = latest?.weightKg ?? trendLatest;
  const trendDelta = points.length > 1 ? points.at(-1)!.trendWeightKg - points[0]!.trendWeightKg : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");
    const parsed = Number(weight);
    if (!date) { setFormError("请选择记录日期。"); return; }
    if (!Number.isFinite(parsed) || parsed <= 0) { setFormError("请输入大于 0 的体重。"); return; }
    setBusy(true);
    try {
      const input = { measuredAt: new Date(`${date}T12:00:00`).toISOString(), weightKg: parsed, ...(note.trim() ? { note: note.trim() } : {}) };
      await persistWeightRecord(props.onAdd, input);
      setWeight(""); setNote(""); setFormSuccess(weightSaveSuccessMessage);
    } catch {
      setFormError(weightSaveErrorMessage);
    } finally { setBusy(false); }
  }

  return <div className="dg-page weight-page" data-weight-layout="trend-first">
    <div className="weight-page-main">
      <Surface className="weight-hero">
        <div><span className="dg-eyebrow">BODY · CURRENT WEIGHT</span><h2>当前体重</h2>{currentWeight !== undefined ? <><strong className="weight-hero-value">{currentWeight.toFixed(1)} kg</strong><p className="dg-muted">{latest ? `记录于 ${latest.localDate} · ${latest.source === "manual" ? "手动记录" : latest.source}` : "来自当前趋势观察点"}</p></> : <StatusMessage kind="empty" title="尚无足够记录" description="暂无体重记录" />}</div>
        <div className="weight-hero-badge" aria-label={trendLatest === undefined ? "趋势暂不可用" : `趋势体重 ${trendLatest.toFixed(1)} kg`}>{trendLatest === undefined ? "—" : `趋势 ${trendLatest.toFixed(1)} kg`}<span>趋势值</span></div>
      </Surface>
      <Surface className="weight-trend-surface">
        <div className="weight-section-heading"><div><span className="dg-eyebrow">OBSERVED TREND</span><h2>体重趋势</h2><p className="dg-muted">只展示服务端返回的真实记录，不用缺失日期补零。</p></div><div className="weight-range-tabs" role="tablist" aria-label="趋势范围">{([7, 30] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={range === value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value} 天趋势</button>)}</div></div>
        {props.loading ? <StatusMessage kind="loading" title="正在加载体重趋势" /> : null}
        {props.error ? <StatusMessage kind="error" title="体重服务暂时不可用" description={props.error} action={<Button variant="secondary" onClick={() => void props.onRetry()}>重试</Button>} /> : null}
        {!props.loading && !props.error && points.length === 0 ? <StatusMessage kind="empty" title="数据不足" description="当前范围内尚无足够记录。先记录体重，趋势会随着真实数据逐步形成。" action={<a className="dg-button dg-button-secondary" href="#record-weight">记录体重</a>} /> : null}
        {!props.loading && !props.error && points.length > 0 ? <TrendChart points={points} range={range} /> : null}
      </Surface>
      <div className="weight-summary-grid" aria-label="体重摘要">{currentWeight !== undefined ? <Metric label="最新记录" value={currentWeight.toFixed(1)} unit="kg" /> : <Metric label="最新记录" value="—" />}<Metric label={`${range} 天记录`} value={points.length} unit="次" />{trendDelta === null ? <Metric label={`${range} 天变化`} value="—" /> : <Metric label={`${range} 天变化`} value={`${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(1)}`} unit="kg" />}</div>
      <Surface className="weight-records"><div className="weight-section-heading"><div><span className="dg-eyebrow">RECENT RECORDS</span><h2>最近记录</h2></div><span className="dg-status-chip">{orderedRecords.length} 条</span></div>{orderedRecords.length === 0 ? <p className="dg-muted">记录后会在这里保留历史事实。</p> : <div className="weight-record-list">{orderedRecords.slice(0, 8).map((record) => <div className="weight-record-row" key={record.id}><span><strong>{record.localDate}</strong><small>{record.note || (record.source === "manual" ? "手动记录" : record.source)}</small></span><strong>记录 {record.weightKg.toFixed(1)} kg</strong></div>)}</div>}</Surface>
    </div>
    <aside className="weight-context-rail" aria-label="体重辅助信息"><Surface className="weight-record-form" id="record-weight"><span className="dg-eyebrow">QUICK RECORD</span><h2>记录体重</h2><p className="dg-muted">记录真实测量值，系统会保留日期和来源。</p><form onSubmit={(event) => void submit(event)}><label className="field"><span>日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>体重（kg）</span><input name="weightKg" type="number" min="0.1" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="例如 68.4" required /></label><label className="field"><span>备注（可选）</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="例如：晨起、运动后" /></label>{formError ? <p className="error" role="alert">{formError}</p> : null}{formSuccess ? <p className="success" role="status" aria-live="polite">{formSuccess}</p> : null}<Button type="submit" variant="primary" aria-label="添加体重" busy={busy}>记录体重</Button></form></Surface><Surface className="weight-context-note"><span className="dg-eyebrow">DATA QUALITY</span><h2>数据说明</h2><p className="dg-muted">趋势值由服务端计算；数据不足时保持空状态，不用估算或零点填充。</p></Surface></aside>
  </div>;
}

function TrendChart({ points, range }: { points: WeightTrend["points"]; range: Range }) {
  const values = points.map((point) => point.trendWeightKg);
  const min = Math.min(...values); const max = Math.max(...values); const spread = Math.max(max - min, 0.1);
  const line = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${100 - ((point.trendWeightKg - min) / spread) * 72 - 14}`).join(" ");
  return <div className="weight-chart" aria-label={`${range} 天体重趋势图`}><div className="weight-chart-scale"><span>最高 {max.toFixed(1)} kg</span><span>最低 {min.toFixed(1)} kg</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${range} 天趋势，${points.length} 个真实记录点`}><polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />{points.map((point, index) => <circle key={`${point.localDate}-${index}`} data-trend-point={point.localDate} cx={(index / Math.max(points.length - 1, 1)) * 100} cy={100 - ((point.trendWeightKg - min) / spread) * 72 - 14} r="2" fill="currentColor"><title>{`${point.localDate}: ${point.trendWeightKg.toFixed(1)} kg`}</title></circle>)}</svg><div className="weight-chart-dates"><span>{points[0]!.localDate}</span><span>{points.at(-1)!.localDate}</span></div><p className="dg-muted">趋势方法：{points.length > 0 ? "服务端平滑值" : "—"} · 观察到 {points.length} 个记录点</p></div>;
}
