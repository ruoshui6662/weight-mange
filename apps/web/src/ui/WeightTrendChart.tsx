import type { WeightTrend } from "../api";

export type WeightTrendChartProps = {
  points: WeightTrend["points"];
  rangeDays?: number;
  ariaLabel?: string;
};

/**
 * Shared evidence-first chart for observed weight trend points.
 * The caller owns the data window and must not pass synthetic zero points.
 */
export function WeightTrendChart({ points, rangeDays = 7, ariaLabel }: WeightTrendChartProps) {
  if (points.length === 0) return null;
  const values = points.map((point) => point.trendWeightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.1);
  const line = points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${100 - ((point.trendWeightKg - min) / spread) * 72 - 14}`).join(" ");
  const label = ariaLabel ?? `${rangeDays} 天体重趋势图`;

  return <div className="weight-chart" aria-label={label}>
    <div className="weight-chart-scale"><span>最高 {max.toFixed(1)} kg</span><span>最低 {min.toFixed(1)} kg</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${rangeDays} 天趋势，${points.length} 个真实记录点`}>
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {points.map((point, index) => <circle key={`${point.localDate}-${index}`} data-trend-point={point.localDate} cx={(index / Math.max(points.length - 1, 1)) * 100} cy={100 - ((point.trendWeightKg - min) / spread) * 72 - 14} r="2" fill="currentColor"><title>{`${point.localDate}: ${point.trendWeightKg.toFixed(1)} kg`}</title></circle>)}
    </svg>
    <div className="weight-chart-dates"><span>{points[0]!.localDate}</span><span>{points.at(-1)!.localDate}</span></div>
    <p className="dg-muted">趋势方法：服务端平滑值 · 观察到 {points.length} 个记录点</p>
  </div>;
}
