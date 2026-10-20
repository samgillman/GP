import { numeric, palette } from "./data.ts";
import type { Project, Response } from "./data.ts";

export const DENSE_POINT_THRESHOLD = 5_000;
export const plotFrame = {
  width: 680,
  height: 420,
  left: 72,
  right: 28,
  top: 35,
  bottom: 78,
};
export type PlotPoint = { x: number; y: number; row: number };
export type PlotSeries = {
  name: string;
  points: PlotPoint[];
  values: number[];
  mean: number;
  lo: number;
  hi: number;
  min: number;
  max: number;
  color: string;
  quartiles: [number, number, number] | null;
};
function safe(value: string): number | null {
  try {
    return numeric(value);
  } catch {
    return null;
  }
}
function sortedQuantile(values: number[], p: number) {
  const i = (values.length - 1) * p,
    lo = Math.floor(i);
  return values[lo] + (values[Math.ceil(i)] - values[lo]) * (i - lo);
}
/** A short decimal step and bounded loop, independent of observation count. */
export function linearTicks(min: number, max: number, target = 5) {
  const raw = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  if (!Number.isFinite(raw) || !(power > 0))
    return { min, max, ticks: [min, max] };
  const fraction = raw / power;
  const step =
    (fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 2.5
          ? 2.5
          : fraction <= 5
            ? 5
            : 10) * power;
  const low = Math.floor(min / step),
    high = Math.ceil(max / step);
  const ticks: number[] = [];
  const decimals = Math.min(
    100,
    Math.max(0, -Math.floor(Math.log10(step)) + 1),
  );
  for (let i = low; i <= high && ticks.length < 20; i++)
    ticks.push(Number((i * step).toFixed(decimals)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}
export function logarithmicTicks(min: number, max: number) {
  const low = Math.floor(Math.log10(min)),
    high = Math.ceil(Math.log10(max));
  const ticks: number[] = [];
  const stride = Math.max(1, Math.ceil((high - low) / 6));
  for (let exponent = low; exponent <= high; exponent += stride) {
    for (const factor of high - low <= 2 ? [1, 2, 5] : [1]) {
      const value = factor * 10 ** exponent;
      if (value >= min && value <= max) ticks.push(value);
    }
  }
  return ticks;
}
/** A significance bracket between two column-graph series (0-based positions). */
export type PlotAnnotation = { a: number; b: number; label: string };
export type PlotBracket = { x1: number; x2: number; y: number; label: string };

/** Shorter spans sit lowest; overlapping brackets stack one step higher. */
export function bracketLevels(
  annotations: PlotAnnotation[],
  tops: number[],
  step: number,
): PlotBracket[] {
  const placed: { lo: number; hi: number; y: number; label: string }[] = [];
  const ordered = annotations
    .filter(
      (a) => a.a !== a.b && tops[a.a] !== undefined && tops[a.b] !== undefined,
    )
    .map((a) => ({
      lo: Math.min(a.a, a.b),
      hi: Math.max(a.a, a.b),
      label: a.label,
    }))
    .sort((p, q) => p.hi - p.lo - (q.hi - q.lo) || p.lo - q.lo);
  for (const item of ordered) {
    let y =
      Math.max(...tops.slice(item.lo, item.hi + 1).filter(Number.isFinite)) +
      step * 0.6;
    for (const other of placed)
      if (other.lo <= item.hi && other.hi >= item.lo)
        y = Math.max(y, other.y + step);
    placed.push({ ...item, y });
  }
  return placed.map(({ lo, hi, y, label }) => ({
    x1: lo + 1,
    x2: hi + 1,
    y,
    label,
  }));
}

export function buildPlotGeometry(
  project: Project,
  result: Response | null,
  annotations: PlotAnnotation[] = [],
) {
  const { graph, columns } = project;
  const xy = project.table_type === "xy";
  const logX = xy && result?.analysis === "dose_response";
  let minY = Infinity,
    maxY = -Infinity,
    minX = Infinity,
    maxX = -Infinity,
    count = 0;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const series: PlotSeries[] = columns
    .slice(xy ? 1 : 0)
    .map((column, index) => {
      const points: PlotPoint[] = [],
        values: number[] = [];
      let mean = 0,
        sumSquares = 0,
        min = Infinity,
        max = -Infinity;
      for (let row = 0; row < column.values.length; row++) {
        const y = safe(column.values[row]),
          x = xy ? safe(columns[0].values[row] ?? "") : index + 1;
        // Zero-dose observations remain in the data/analysis, but have no log coordinate.
        if (y === null || x === null || (logX && x <= 0)) continue;
        points.push({ x, y, row });
        values.push(y);
        count++;
        include(x, y);
        min = Math.min(min, y);
        max = Math.max(max, y);
        const delta = y - mean;
        mean += delta / values.length;
        sumSquares += delta * (y - mean);
      }
      const n = values.length,
        sd = n > 1 ? Math.sqrt(Math.max(0, sumSquares / (n - 1))) : 0;
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
      const summary = (result?.graph_summary ?? result?.summary)?.find((s) => s.name === column.name);
      if (
        graph.error === "ci" &&
        summary?.ci_low != null &&
        summary?.ci_high != null
      ) {
        lo = summary.ci_low;
        hi = summary.ci_high;
      }
      if (n && !xy && graph.type !== "box") {
        minY = Math.min(minY, lo);
        maxY = Math.max(maxY, hi);
      }
      let quartiles: PlotSeries["quartiles"] = null;
      if (n && !xy && graph.type === "box") {
        const ordered = values.slice().sort((a, b) => a - b);
        quartiles = [
          sortedQuantile(ordered, 0.25),
          sortedQuantile(ordered, 0.5),
          sortedQuantile(ordered, 0.75),
        ];
      }
      return {
        name: column.name,
        points,
        values,
        mean,
        lo,
        hi,
        min,
        max,
        quartiles,
        color:
          graph.colors[index % graph.colors.length] ||
          palette[index % palette.length],
      };
    });
  const fits = (result?.fit ?? []).map((fit) => ({
    ...fit,
    points: fit.points.filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!logX || p.x > 0),
    ),
  }));
  for (const fit of fits)
    for (const point of fit.points) include(point.x, point.y);
  if (!count) return null;
  const bar = graph.type === "bar";
  if (bar) {
    minY = Math.min(0, minY);
    maxY = Math.max(0, maxY);
  }
  let brackets: PlotBracket[] = [];
  if (!xy && annotations.length) {
    const step = (maxY - minY || Math.abs(maxY) * 0.2 || 1) * 0.09;
    const tops = series.map((s) =>
      Math.max(s.max ?? -Infinity, s.hi ?? -Infinity, s.mean ?? -Infinity),
    );
    brackets = bracketLevels(annotations, tops, step);
    for (const bracket of brackets)
      maxY = Math.max(maxY, bracket.y + step * 0.5);
  }
  const range = maxY - minY || Math.abs(maxY) * 0.2 || 1;
  // Preserve the zero baseline for wholly positive/negative bars.
  if (!bar || maxY !== 0) maxY += range * 0.15;
  if (!bar || minY !== 0) minY -= range * 0.05;
  if (minY === maxY) maxY = minY + range;
  const yAxis = linearTicks(minY, maxY);
  minY = yAxis.min;
  maxY = yAxis.max;
  let xTicks: number[] = [];
  if (!xy) {
    minX = 0.4;
    maxX = series.length + 0.6;
  } else {
    if (minX === maxX) {
      if (logX) {
        minX /= 10;
        maxX *= 10;
      } else {
        const pad = Math.max(1, Math.abs(minX) * 0.1);
        minX -= pad;
        maxX += pad;
      }
    }
    if (logX) {
      const low = Math.log10(minX),
        high = Math.log10(maxX),
        pad = (high - low) * 0.07 || 0.1;
      minX = 10 ** (low - pad);
      maxX = 10 ** (high + pad);
      xTicks = logarithmicTicks(minX, maxX);
    } else {
      const pad = (maxX - minX) * 0.07;
      const axis = linearTicks(minX - pad, maxX + pad);
      minX = axis.min;
      maxX = axis.max;
      xTicks = axis.ticks;
    }
  }
  const { width, height, left, right, top, bottom } = plotFrame;
  const pw = width - left - right,
    ph = height - top - bottom;
  const x = (value: number) =>
    left +
    (logX
      ? (Math.log10(value) - Math.log10(minX)) /
        (Math.log10(maxX) - Math.log10(minX))
      : (value - minX) / (maxX - minX)) *
      pw;
  const y = (value: number) => top + ((maxY - value) / (maxY - minY)) * ph;
  return {
    series,
    fits,
    count,
    xy,
    logX,
    minX,
    maxX,
    minY,
    maxY,
    xTicks,
    yTicks: yAxis.ticks,
    brackets,
    x,
    y,
  };
}
export type PlotGeometry = NonNullable<ReturnType<typeof buildPlotGeometry>>;
/** Every observation is drawn, in the same series/row order as the SVG mode. */
export function drawDensePoints(
  context: CanvasRenderingContext2D,
  geometry: PlotGeometry,
) {
  for (const series of geometry.series) {
    context.fillStyle = series.color;
    context.strokeStyle = "white";
    context.lineWidth = 1.1;
    for (let j = 0; j < series.points.length; j++) {
      const point = series.points[j];
      const cx =
        geometry.x(point.x) + (!geometry.xy ? (((j * 17) % 11) - 5) * 2.1 : 0);
      context.beginPath();
      context.arc(
        cx,
        geometry.y(point.y),
        geometry.xy ? 4 : 3.6,
        0,
        2 * Math.PI,
      );
      context.fill();
      context.stroke();
    }
  }
}

export type PointReference = { seriesIndex: number; row: number };
export type PointHit = PointReference & {
  pointIndex: number;
  x: number;
  y: number;
  px: number;
  py: number;
};
/** Spatial bins keep pointer movement proportional to nearby marks, not all table rows. */
export function pointHitIndex(geometry: PlotGeometry) {
  const size = 16;
  const bins = new Map<string, PointHit[]>();
  geometry.series.forEach((series, seriesIndex) => {
    series.points.forEach((point, pointIndex) => {
      const px =
        geometry.x(point.x) +
        (!geometry.xy ? (((pointIndex * 17) % 11) - 5) * 2.1 : 0);
      const py = geometry.y(point.y);
      const key = `${Math.floor(px / size)},${Math.floor(py / size)}`;
      const bin = bins.get(key) ?? [];
      bin.push({
        seriesIndex,
        pointIndex,
        row: point.row,
        x: point.x,
        y: point.y,
        px,
        py,
      });
      if (!bins.has(key)) bins.set(key, bin);
    });
  });
  return (px: number, py: number, radius = 12): PointHit | null => {
    let best: PointHit | null = null,
      distance = radius * radius;
    for (
      let bx = Math.floor((px - radius) / size);
      bx <= Math.floor((px + radius) / size);
      bx++
    ) {
      for (
        let by = Math.floor((py - radius) / size);
        by <= Math.floor((py + radius) / size);
        by++
      ) {
        const bin = bins.get(`${bx},${by}`);
        if (!bin) continue;
        for (const point of bin) {
          const d = (point.px - px) ** 2 + (point.py - py) ** 2;
          // Equal-distance overlapping marks select the last drawn observation.
          if (
            d < distance ||
            (d === distance &&
              (!best ||
                point.seriesIndex > best.seriesIndex ||
                (point.seriesIndex === best.seriesIndex &&
                  point.pointIndex > best.pointIndex)))
          ) {
            distance = d;
            best = point;
          }
        }
      }
    }
    return best;
  };
}

export type SelectedPointRange = {
  seriesIndex: number;
  startRow: number;
  endRow: number;
};
/** Selection is drawn to a bitmap even when a table selection covers every row. */
export function drawSelectedPoints(
  context: CanvasRenderingContext2D,
  geometry: PlotGeometry,
  ranges: SelectedPointRange[],
) {
  const bySeries = new Map<number, SelectedPointRange[]>();
  for (const range of ranges) {
    const list = bySeries.get(range.seriesIndex) ?? [];
    list.push(range);
    bySeries.set(range.seriesIndex, list);
  }
  context.strokeStyle = "#0866db";
  context.lineWidth = 2.5;
  let count = 0;
  for (const [index, spans] of bySeries) {
    const series = geometry.series[index];
    if (!series) continue;
    for (let j = 0; j < series.points.length; j++) {
      const point = series.points[j];
      if (
        !spans.some(
          (span) =>
            point.row >= Math.min(span.startRow, span.endRow) &&
            point.row <= Math.max(span.startRow, span.endRow),
        )
      )
        continue;
      const px =
        geometry.x(point.x) + (!geometry.xy ? (((j * 17) % 11) - 5) * 2.1 : 0);
      context.beginPath();
      context.arc(px, geometry.y(point.y), 7, 0, 2 * Math.PI);
      context.stroke();
      count++;
    }
  }
  return count;
}
