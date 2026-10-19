import { fmt, numeric, palette } from "./data";
import type { Project, Response } from "./data";
function quantile(v: number[], p: number) {
  const a = [...v].sort((a, b) => a - b),
    i = (a.length - 1) * p,
    l = Math.floor(i);
  return a[l] + (a[Math.ceil(i)] - a[l]) * (i - l);
}
export default function Plot({
  project,
  result,
}: {
  project: Project;
  result: Response | null;
}) {
  const { graph, columns, table_type } = project,
    xy = table_type === "xy",
    logX = xy && result?.analysis === "dose_response";
  const safe = (s: string) => {
    try {
      return numeric(s);
    } catch {
      return null;
    }
  };
  const series = columns.slice(xy ? 1 : 0).map((c, i) => {
    const points = c.values.flatMap((s, row) => {
      const y = safe(s),
        x = xy ? safe(columns[0].values[row] ?? "") : i + 1;
      return y === null || x === null ? [] : [{ x, y, row }];
    });
    const values = points.map((p) => p.y),
      n = values.length,
      mean = n ? values.reduce((a, b) => a + b, 0) / n : 0,
      sd =
        n > 1
          ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
          : 0;
    const summary = result?.summary.find((s) => s.name === c.name);
    let lo = mean,
      hi = mean;
    if (graph.error === "sd") {
      lo -= sd;
      hi += sd;
    }
    if (graph.error === "sem") {
      lo -= sd / Math.sqrt(n || 1);
      hi += sd / Math.sqrt(n || 1);
    }
    if (
      graph.error === "ci" &&
      summary?.ci_low != null &&
      summary?.ci_high != null
    ) {
      lo = summary.ci_low;
      hi = summary.ci_high;
    }
    return {
      name: c.name,
      points,
      values,
      mean,
      lo,
      hi,
      color:
        graph.colors[i % graph.colors.length] || palette[i % palette.length],
    };
  });
  const all = series.flatMap((s) => s.points),
    fits = result?.fit ?? [];
  if (!all.length)
    return (
      <div className="empty-chart">Enter numeric data to create a graph.</div>
    );
  const ys = [
    ...all.map((p) => p.y),
    ...(!xy && graph.type !== "box" ? series.flatMap((s) => [s.lo, s.hi]) : []),
    ...fits.flatMap((f) => f.points.map((p) => p.y)),
  ];
  let minY = Math.min(...ys),
    maxY = Math.max(...ys);
  if (graph.type === "bar") {
    minY = Math.min(0, minY);
    maxY = Math.max(0, maxY);
  }
  const range = maxY - minY || Math.abs(maxY) * 0.2 || 1;
  maxY += range * 0.15;
  minY -= range * 0.05;
  const xValues = [
    ...all.map((p) => p.x),
    ...fits.flatMap((f) => f.points.map((p) => p.x)),
  ];
  let minX = xy ? Math.min(...xValues) : 0.4,
    maxX = xy ? Math.max(...xValues) : series.length + 0.6;
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (xy && !logX) {
    const pad = (maxX - minX) * 0.07;
    minX -= pad;
    maxX += pad;
  }
  if (logX) {
    const lo = Math.log10(minX),
      hi = Math.log10(maxX),
      pad = (hi - lo) * 0.07 || 0.1;
    minX = 10 ** (lo - pad);
    maxX = 10 ** (hi + pad);
  }
  const W = 680,
    H = 420,
    left = 72,
    right = 28,
    top = 35,
    bottom = 78,
    pw = W - left - right,
    ph = H - top - bottom;
  const x = (v: number) =>
      left +
      (logX
        ? (Math.log10(v) - Math.log10(minX)) /
          (Math.log10(maxX) - Math.log10(minX))
        : (v - minX) / (maxX - minX)) *
        pw,
    y = (v: number) => top + ((maxY - v) / (maxY - minY)) * ph;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="plot"
      role="img"
      aria-label={`${graph.title}. ${graph.type} graph of ${series.map((s) => s.name).join(", ")}.`}
    >
      <title>{graph.title}</title>
      <rect width={W} height={H} fill="white" />
      {Array.from({ length: 5 }, (_, i) => {
        const v = minY + ((maxY - minY) * i) / 4;
        return (
          <g key={i}>
            <line
              x1={left}
              x2={W - right}
              y1={y(v)}
              y2={y(v)}
              stroke="#e9eded"
              strokeDasharray="3 5"
            />
            <text x={left - 12} y={y(v) + 4} textAnchor="end" className="tick">
              {fmt(v)}
            </text>
          </g>
        );
      })}
      <path
        d={`M${left},${top}V${H - bottom}H${W - right}`}
        fill="none"
        stroke="#919f9f"
      />
      {xy
        ? Array.from({ length: 5 }, (_, i) => {
            const v = logX
              ? 10 **
                (Math.log10(minX) +
                  ((Math.log10(maxX) - Math.log10(minX)) * i) / 4)
              : minX + ((maxX - minX) * i) / 4;
            return (
              <text
                key={i}
                x={x(v)}
                y={H - bottom + 25}
                textAnchor="middle"
                className="tick"
              >
                {fmt(v)}
              </text>
            );
          })
        : series.map((s, i) => (
            <text
              key={i}
              x={x(i + 1)}
              y={H - bottom + 26}
              textAnchor="middle"
              className="tick"
            >
              {s.name.length > 20 ? s.name.slice(0, 19) + "…" : s.name}
            </text>
          ))}
      <text
        x={left + pw / 2}
        y={H - 18}
        textAnchor="middle"
        className="axis-label"
      >
        {graph.x_label}
      </text>
      <text
        transform={`translate(18 ${top + ph / 2}) rotate(-90)`}
        textAnchor="middle"
        className="axis-label"
      >
        {graph.y_label}
      </text>
      {series.map((s, i) => {
        const cx = x(i + 1),
          bw = Math.min(72, (pw / series.length) * 0.46),
          v = s.values,
          points = [...s.points].sort((a, b) => a.x - b.x);
        return (
          <g key={i}>
            {!xy && graph.type === "bar" && v.length > 0 && (
              <rect
                x={cx - bw / 2}
                y={Math.min(y(s.mean), y(0))}
                width={bw}
                height={Math.abs(y(0) - y(s.mean))}
                rx="2"
                fill={s.color}
                fillOpacity=".72"
              />
            )}
            {!xy && graph.type === "box" && v.length > 0 && (
              <g stroke={s.color} strokeWidth="2">
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(Math.min(...v))}
                  y2={y(Math.max(...v))}
                />
                <line
                  x1={cx - bw / 4}
                  x2={cx + bw / 4}
                  y1={y(Math.min(...v))}
                  y2={y(Math.min(...v))}
                />
                <line
                  x1={cx - bw / 4}
                  x2={cx + bw / 4}
                  y1={y(Math.max(...v))}
                  y2={y(Math.max(...v))}
                />
                <rect
                  x={cx - bw / 2}
                  y={y(quantile(v, 0.75))}
                  width={bw}
                  height={Math.max(
                    1,
                    y(quantile(v, 0.25)) - y(quantile(v, 0.75)),
                  )}
                  fill={s.color}
                  fillOpacity=".16"
                />
                <line
                  x1={cx - bw / 2}
                  x2={cx + bw / 2}
                  y1={y(quantile(v, 0.5))}
                  y2={y(quantile(v, 0.5))}
                />
              </g>
            )}
            {graph.type === "line" && xy && (
              <polyline
                points={points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
              />
            )}
            {!xy &&
              graph.error !== "none" &&
              graph.type !== "box" &&
              v.length > 0 && (
                <g stroke={s.color} strokeWidth="2">
                  <line x1={cx} x2={cx} y1={y(s.lo)} y2={y(s.hi)} />
                  <line x1={cx - 7} x2={cx + 7} y1={y(s.lo)} y2={y(s.lo)} />
                  <line x1={cx - 7} x2={cx + 7} y1={y(s.hi)} y2={y(s.hi)} />
                  <line
                    x1={cx - 13}
                    x2={cx + 13}
                    y1={y(s.mean)}
                    y2={y(s.mean)}
                  />
                </g>
              )}
            {(graph.show_points || graph.type === "scatter") &&
              s.points.map((p, j) => (
                <circle
                  key={j}
                  cx={x(p.x) + (!xy ? (((j * 17) % 11) - 5) * 2.1 : 0)}
                  cy={y(p.y)}
                  r={xy ? 4 : 3.6}
                  fill={s.color}
                  stroke="white"
                  strokeWidth="1.1"
                >
                  <title>
                    {s.name}, row {p.row + 1}: {fmt(p.y)}
                  </title>
                </circle>
              ))}
          </g>
        );
      })}
      {fits.map((f, i) => (
        <polyline
          key={i}
          points={f.points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}
          fill="none"
          stroke={
            series.find((s) => s.name === f.series)?.color ??
            palette[i % palette.length]
          }
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      ))}
    </svg>
  );
}
