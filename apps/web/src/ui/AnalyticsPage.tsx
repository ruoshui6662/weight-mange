import type { AnalyticsOverview, TdeeEstimate } from "../api";
import { Button, Metric, StatusMessage, Surface } from "./Primitives";

export type AnalyticsPageProps = {
  overview: AnalyticsOverview | null;
  tdee: TdeeEstimate | null;
  periodDays: 7 | 30 | 90;
  onPeriodChange: (days: 7 | 30 | 90) => void;
  loading: boolean;
  error: string;
  onRetry: () => Promise<void>;
};

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function kcal(value: number | null) { return value === null ? "未记录" : `${number.format(Math.round(value))} kcal`; }
function grams(value: number | null) { return value === null ? "未记录" : `${decimal.format(value)} g`; }
function kg(value: number | null) { return value === null ? "未记录" : `${value > 0 ? "+" : ""}${decimal.format(value)} kg`; }

export function AnalyticsPage(props: AnalyticsPageProps) {
  return <div className="dg-page analytics-page" data-analytics-layout="evidence-first">
    <div className="analytics-page-main">
      <Surface className="analytics-hero">
        <div><span className="dg-eyebrow">ANALYSIS · EVIDENCE FIRST</span><h2>把记录变成可读证据</h2><p className="dg-muted">先看真实记录，再理解服务端给出的估算。分析页只读，不会自动修改你的目标。</p></div>
        <div className="analytics-period"><span className="analytics-control-label">查看周期</span><div className="analytics-period-tabs" role="tablist" aria-label="分析周期">{([7, 30, 90] as const).map((days) => <button key={days} type="button" role="tab" aria-selected={props.periodDays === days} className={props.periodDays === days ? "active" : ""} onClick={() => props.onPeriodChange(days)}>{days} 天</button>)}</div></div>
      </Surface>
      {props.loading ? <StatusMessage kind="loading" title="正在加载分析" description="正在读取这一周期的服务端记录。" /> : null}
      {props.error ? <StatusMessage kind="error" title="分析服务暂时不可用" description={props.error} action={<Button variant="secondary" onClick={() => void props.onRetry()}>重试</Button>} /> : null}
      {!props.loading && !props.error && props.overview ? <><FactSummary overview={props.overview} /><TrendSection overview={props.overview} /></> : null}
      {!props.loading && !props.error ? <EstimateSummary tdee={props.tdee} onRetry={props.onRetry} /> : null}
    </div>
    <aside className="analytics-context-rail" aria-label="分析辅助信息"><Surface className="analytics-quality-card"><span className="dg-eyebrow">DATA QUALITY</span><h2>先理解数据</h2><p className="dg-muted">事实来自记录和服务端快照；估算会标明方法与置信度。缺少数据时保持“数据不足”，不会用零值填充。</p>{props.overview ? <p className="analytics-source-note">周期：{props.overview.period.from} 至 {props.overview.period.to}</p> : null}</Surface><Surface className="analytics-readonly-card"><span className="dg-status-chip">只读</span><h2>目标由你决定</h2><p className="dg-muted">分析不会自动改动每日热量目标。需要调整时，请前往“我的”完成明确操作。</p></Surface></aside>
  </div>;
}

function FactSummary({ overview }: { overview: AnalyticsOverview }) {
  const coverage = `${number.format(Math.round(overview.recordCoverage.ratio * 100))}%`;
  return <section className="analytics-facts" aria-labelledby="analytics-facts-title"><div className="analytics-section-heading"><div><span className="dg-eyebrow">OBSERVED FACTS</span><h2 id="analytics-facts-title">事实数据</h2><p className="dg-muted">来自本周期的实际记录，不代表系统补全后的估算。</p></div><span className="dg-status-chip">{overview.recordCoverage.recordedDays}/{overview.recordCoverage.totalDays} 天有记录</span></div><div className="analytics-metric-grid"><Metric label="平均摄入" value={kcal(overview.averages.intakeKcal)} /><Metric label="平均蛋白质" value={grams(overview.averages.proteinG)} /><Metric label="平均脂肪" value={grams(overview.averages.fatG)} /><Metric label="平均碳水" value={grams(overview.averages.carbG)} /></div><div className="analytics-evidence-grid"><div><span>记录覆盖</span><strong>{coverage}</strong><small>{overview.recordCoverage.recordedDays} / {overview.recordCoverage.totalDays} 天</small></div><div><span>体重变化</span><strong>{kg(overview.weight.deltaKg)}</strong><small>{overview.weight.observedDays} 个观察日</small></div><div><span>目标差值</span><strong>{kcal(overview.goal.averageDifferenceKcal)}</strong><small>{overview.goal.days} 天有目标记录</small></div></div></section>;
}

function EstimateSummary({ tdee, onRetry }: { tdee: TdeeEstimate | null; onRetry: () => Promise<void> }) {
  const estimated = tdee?.status === "estimated" && tdee.estimatedTdeeKcal !== null;
  const throttled = tdee?.status === "throttled";
  return <section className="analytics-estimate" aria-labelledby="analytics-estimate-title"><div className="analytics-section-heading"><div><span className="dg-eyebrow">SERVER ESTIMATE</span><h2 id="analytics-estimate-title">服务端估算 · Adaptive TDEE</h2><p className="dg-muted">这是服务端基于现有数据返回的估算，不是客户端重新计算的目标。</p></div><span className="dg-status-chip">{estimated ? "估算" : throttled ? "服务暂时不可用" : "数据不足"}</span></div>{estimated ? <div className="analytics-estimate-result"><strong>{number.format(Math.round(tdee.estimatedTdeeKcal!))} kcal</strong><span>估算维持热量</span><small>方法 {tdee.methodVersion} · 置信度 {number.format(Math.round(tdee.confidence * 100))}%</small></div> : throttled ? <StatusMessage kind="error" title="服务暂时不可用" description="Adaptive TDEE 暂时无法生成，请稍后重试。" action={<Button variant="secondary" onClick={() => void onRetry()}>重试</Button>} /> : <StatusMessage kind="empty" title="数据不足" description={tdee?.reason ? `当前周期暂不能生成 Adaptive TDEE（${tdee.reason}）。继续记录真实饮食和体重后再查看。` : "当前周期暂不能生成 Adaptive TDEE。不会伪造估算。"} />}</section>;
}

function TrendSection({ overview }: { overview: AnalyticsOverview }) {
  const start = overview.weight.startKg;
  const end = overview.weight.endKg;
  const hasTrend = start !== null && end !== null && overview.weight.observedDays > 0;
  return <section className="analytics-trend" data-analytics-trend="weight" aria-labelledby="analytics-trend-title"><div className="analytics-section-heading"><div><span className="dg-eyebrow">OBSERVED TREND</span><h2 id="analytics-trend-title">体重趋势</h2><p className="dg-muted">仅展示服务端返回的观察起点和终点，周期 {overview.period.days} 天，单位 kg。</p></div><span className="dg-status-chip">{overview.weight.observedDays} 个观察日</span></div>{hasTrend ? <div className="analytics-trend-chart" role="img" aria-label={`${overview.period.days} 天体重趋势，从 ${start.toFixed(1)} kg 到 ${end.toFixed(1)} kg`}><svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><polyline points={`0,${start === end ? 26 : end > start ? 40 : 12} 100,${start === end ? 26 : end > start ? 12 : 40}`} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div><strong>{start.toFixed(1)} kg</strong><span>起点</span><strong>{end.toFixed(1)} kg</strong><span>终点</span></div></div> : <StatusMessage kind="empty" title="体重趋势数据不足" description="当前周期没有足够的真实体重观察点，不会用零值填充。" />}</section>;
}
