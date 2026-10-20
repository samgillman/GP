import { numeric, palette } from "./data.ts";
import type { Project, Response } from "./data.ts";
import { axesSettingsProblem, defaultGraphAxes } from "./axes.ts";
import type { AxisSettings } from "./axes.ts";

export const DENSE_POINT_THRESHOLD = 5_000;
export const plotFrame = {
  width: 680,
  height: 420,
  left: 72,
  right: 28,
  top: 35,
  bottom: 78,
};
export type PlotFrame = typeof plotFrame;
export type PlotPoint = { x: number; y: number; row: number };
export type PlotSeries = {
  name: string;
  points: PlotPoint[];
  linePoints: PlotPoint[];
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
  const delta = values[Math.ceil(i)] - values[lo];
  return Number.isFinite(delta) ? values[lo] + delta * (i - lo) : values[lo] * (1 - (i - lo)) + values[Math.ceil(i)] * (i - lo);
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
  for (let j = 0; j <= high - low && j < 20; j++) {
    const tick = Number(((low + j) * step).toFixed(decimals));
    if (!ticks.length || tick > ticks[ticks.length - 1]) ticks.push(tick);
  }
  if (ticks.length < 2) return { min, max, ticks: [min, max] };
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
    let y = -Infinity;
    for (let i = item.lo; i <= item.hi; i++) if (Number.isFinite(tops[i])) y = Math.max(y, tops[i]);
    if (!Number.isFinite(y)) continue;
    y += step * 0.6;
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

/** Zero-anchored major ticks; reject excessive or unrepresentable spacing before looping. */
export function configuredTicks(min: number, max: number, log: boolean, axis: AxisSettings, name: string) {
  if (axis.majorInterval === null) return log ? logarithmicTicks(min, max) : linearTicks(min, max).ticks.filter(v => v >= min && v <= max);
  const step = axis.majorInterval, first = Math.ceil(min / step), last = Math.floor(max / step);
  const count = last - first + 1;
  if (!Number.isFinite(count) || count > 200) throw new Error(`${name} major tick interval produces more than 200 ticks.`);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) throw new Error(`${name} major tick interval is too small to represent at this range.`);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    const value = Number(((first + i) * step).toPrecision(15));
    if (ticks.length && value <= ticks[ticks.length - 1]) throw new Error(`${name} major tick interval is too small to represent at this range.`);
    if (value >= min && value <= max) ticks.push(value);
  }
  return ticks;
}
export function buildPlotGeometry(project: Project, result: Response | null, annotations: PlotAnnotation[] = []) {
  const { graph, columns } = project;
  const xy = project.table_type === "xy", axes = graph.axes ?? defaultGraphAxes();
  const problem = axesSettingsProblem(axes, xy, result?.analysis === "dose_response");
  if (problem) throw new Error(problem);
  const logX = xy && (axes.x.scale === "log10" || (axes.x.scale === "auto" && result?.analysis === "dose_response"));
  const logY = axes.y.scale === "log10";
  const validX = (v: number) => Number.isFinite(v) && (!logX || v > 0);
  const validY = (v: number) => Number.isFinite(v) && (!logY || v > 0);
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, count = 0, totalCount = 0, logOmittedCount = 0;
  const includeY = (v: number) => { if (validY(v)) { minY = Math.min(minY, v); maxY = Math.max(maxY, v); } };
  const include = (x: number, y: number) => {
    if (validX(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    includeY(y);
  };
  const series: PlotSeries[] = columns.slice(xy ? 1 : 0).map((column, index) => {
    const points: PlotPoint[] = [], linePoints: PlotPoint[] = [], values: number[] = [];
    let mean = 0, sumSquares = 0, min = Infinity, max = -Infinity;
    for (let row = 0; row < column.values.length; row++) {
      const y = safe(column.values[row]), x = xy ? safe(columns[0].values[row] ?? "") : index + 1;
      if (y === null || x === null) {
        // Preserve a missing Y position with a numeric X in a connected XY
        // graph. NaN breaks the drawable path but never enters statistics,
        // bounds, hits, or visible point arrays.
        if (xy && graph.gap_at_missing_y && x !== null)
          linePoints.push({x, y: Number.NaN, row});
        continue;
      }
      values.push(y); totalCount++; linePoints.push({x, y, row});
      min = Math.min(min, y); max = Math.max(max, y);
      const delta = y - mean;
      mean = Number.isFinite(delta) ? mean + delta / values.length : mean * (1 - 1 / values.length) + y / values.length; sumSquares += delta * (y - mean);
      if (!validX(x) || !validY(y)) { logOmittedCount++; continue; }
      points.push({ x, y, row }); count++; include(x, y);
    }
    const n = values.length, sd = n > 1 ? Math.sqrt(Math.max(0, sumSquares / (n - 1))) : 0;
    let lo = mean, hi = mean;
    if (graph.error === "sd") { lo -= sd; hi += sd; }
    if (graph.error === "sem") { lo -= sd / Math.sqrt(n || 1); hi += sd / Math.sqrt(n || 1); }
    const summary = (result?.graph_summary ?? result?.summary)?.find(s => s.name === column.name);
    if (graph.error === "ci" && summary?.ci_low != null && summary?.ci_high != null) { lo = summary.ci_low; hi = summary.ci_high; }
    if (n && !xy && graph.type !== "box") { includeY(lo); includeY(hi); includeY(mean); }
    let quartiles: PlotSeries["quartiles"] = null;
    if (n && !xy && graph.type === "box") {
      const ordered = values.slice().sort((a, b) => a - b);
      quartiles = [sortedQuantile(ordered, .25), sortedQuantile(ordered, .5), sortedQuantile(ordered, .75)];
    }
    return { name: column.name, points, linePoints, values, mean, lo, hi, min, max, quartiles, color: graph.colors[index % graph.colors.length] || palette[index % palette.length] };
  });
  // Keep invalid log coordinates as explicit gaps in line paths, while point layers omit them.
  const fits = (result?.fit ?? []).map(fit => ({ ...fit, linePoints: fit.points, points: fit.points.filter(p => validX(p.x) && validY(p.y)) }));
  for (const fit of fits) for (const point of fit.points) include(point.x, point.y);
  if (!totalCount) return null;
  const emptyY = !Number.isFinite(minY), emptyX = !Number.isFinite(minX);
  if (emptyY) { minY = logY ? 1 : 0; maxY = logY ? 10 : 1; }
  if (emptyX) { minX = logX ? 1 : 0; maxX = logX ? 10 : 1; }
  const bar = graph.type === "bar";
  if (bar && !logY) { minY = Math.min(0, minY); maxY = Math.max(0, maxY); }
  let brackets: PlotBracket[] = [];
  if (!xy && annotations.length) {
    const step = (maxY - minY || Math.abs(maxY) * .2 || 1) * .09;
    brackets = bracketLevels(annotations, series.map(s => Math.max(s.max, s.hi, s.mean)), step).filter(b => validY(b.y));
    for (const bracket of brackets) maxY = Math.max(maxY, bracket.y + step * .5);
  }
  let autoYTicks: number[] = [], autoXTicks: number[] = [];
  if (logY && emptyY) { /* No positive observations: retain the explicit fallback 1..10. */ }
  else if (logY) {
    if (minY === maxY) { minY /= 10; maxY *= 10; }
    const low = Math.log10(minY), high = Math.log10(maxY), range = high - low;
    minY = 10 ** (low - range * .05); maxY = 10 ** (high + range * .15);
  } else {
    const range = maxY - minY || Math.abs(maxY) * .2 || 1;
    if (!bar || maxY !== 0) maxY += range * .15;
    if (!bar || minY !== 0) minY -= range * .05;
    if (minY === maxY) maxY = minY + range;
    const nice = linearTicks(minY, maxY); minY = nice.min; maxY = nice.max; autoYTicks = nice.ticks;
  }
  if (!xy) { minX = .4; maxX = series.length + .6; }
  else if (!(logX && emptyX)) {
    if (minX === maxX) {
      if (logX) { minX /= 10; maxX *= 10; }
      else { const pad = Math.max(1, Math.abs(minX) * .1); minX -= pad; maxX += pad; }
    }
    if (logX) { const low = Math.log10(minX), high = Math.log10(maxX), pad = (high - low) * .07 || .1; minX = 10 ** (low - pad); maxX = 10 ** (high + pad); }
    else { const pad = (maxX - minX) * .07, nice = linearTicks(minX - pad, maxX + pad); minX = nice.min; maxX = nice.max; autoXTicks = nice.ticks; }
  }
  minX = axes.x.minimum ?? minX; maxX = axes.x.maximum ?? maxX;
  minY = axes.y.minimum ?? minY; maxY = axes.y.maximum ?? maxY;
  for (const [name, min, max, log] of [["X", minX, maxX, logX], ["Y", minY, maxY, logY]] as const)
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max) || (log && min <= 0)) throw new Error(`${name} axis has no finite, ordered display range. Set both limits explicitly.`);
  const automatic = (axis: AxisSettings) => axis.minimum === null && axis.maximum === null && axis.majorInterval === null;
  const xTicks = xy ? !logX && automatic(axes.x) ? autoXTicks : configuredTicks(minX, maxX, logX, axes.x, "X") : [];
  const yTicks = !logY && automatic(axes.y) ? autoYTicks : configuredTicks(minY, maxY, logY, axes.y, "Y");
  const logOmittedSummary = logY && !xy && series.some(s => s.values.length > 0 && (
    graph.type === "box" ? [s.min, s.max, ...(s.quartiles ?? [])].some(v => v <= 0) :
    (graph.type === "bar" && s.mean <= 0) || (graph.error !== "none" && [s.mean, s.lo, s.hi].some(v => v <= 0))));
  return { series, fits, count, totalCount, logOmittedCount, logOmittedSummary, xy, logX, logY, axes, minX, maxX, minY, maxY, xTicks, yTicks, brackets, frame: plotFrame, ...plotProjection({ minX, maxX, minY, maxY, logX, logY, axes }, plotFrame) };
}
export type PlotGeometry = NonNullable<ReturnType<typeof buildPlotGeometry>>;
/** Reproject the already-computed series; label layout must not rescan large tables. */
export function reframePlotGeometry(geometry: PlotGeometry, frame: PlotFrame): PlotGeometry {
  return { ...geometry, frame, ...plotProjection(geometry, frame) };
}
function plotProjection(domain: {
  minX: number; maxX: number; minY: number; maxY: number;
  logX: boolean; logY: boolean; axes: { x: AxisSettings; y: AxisSettings };
}, frame: PlotFrame) {
  const { minX, maxX, minY, maxY, logX, logY, axes } = domain;
  const validX = (value: number) => Number.isFinite(value) && (!logX || value > 0);
  const validY = (value: number) => Number.isFinite(value) && (!logY || value > 0);
  const { width, height, left, right, top, bottom } = frame, pw = width - left - right, ph = height - top - bottom;
  const tx = (v: number) => logX ? Math.log10(v) : v, ty = (v: number) => logY ? Math.log10(v) : v;
  const x = (v: number) => { const f = (tx(v) - tx(minX)) / (tx(maxX) - tx(minX)); return left + (axes.x.reverse ? 1 - f : f) * pw; };
  const y = (v: number) => { const f = (ty(v) - ty(minY)) / (ty(maxY) - ty(minY)); return top + (axes.y.reverse ? f : 1 - f) * ph; };
  const visible = (p: {x:number;y:number}) => validX(p.x) && validY(p.y) && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  const boundedY = (v: number) => y(Math.max(minY, Math.min(maxY, v)));
  /** Clip segments in transformed data space before creating SVG coordinates. */
  const linePath = (points: {x:number;y:number}[]) => {
    let path = "";
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (!validX(a.x) || !validX(b.x) || !validY(a.y) || !validY(b.y)) continue;
      const ax = tx(a.x), ay = ty(a.y), bx = tx(b.x), by = ty(b.y);
      const xmin = tx(minX), xmax = tx(maxX), ymin = ty(minY), ymax = ty(maxY);
      const sx = Math.max(Math.abs(ax), Math.abs(bx)) || 1, sy = Math.max(Math.abs(ay), Math.abs(by)) || 1;
      const dx = bx / sx - ax / sx, dy = by / sy - ay / sy;
      // Force each intersection onto its exact boundary. Parameter-only clipping
      // loses a narrow viewport when both endpoint parameters round to 0.5.
      const yAtX = (v: number) => dy === 0 ? ay : ((dy / dx) * (v / sx) + ((ay / sy) * (bx / sx) - (by / sy) * (ax / sx)) / dx) * sy;
      const xAtY = (v: number) => dx === 0 ? ax : ((dx / dy) * (v / sy) + ((ax / sx) * (by / sy) - (bx / sx) * (ay / sy)) / dy) * sx;
      const code = (xx: number, yy: number) => (xx < xmin ? 1 : xx > xmax ? 2 : 0) | (yy < ymin ? 4 : yy > ymax ? 8 : 0);
      let x1 = ax, y1 = ay, x2 = bx, y2 = by;
      for (let attempt = 0; attempt < 9; attempt++) {
        const c1 = code(x1, y1), c2 = code(x2, y2);
        if (!(c1 | c2)) {
          const pixel = (xx: number, yy: number) => `${x(logX ? 10 ** xx : xx)},${y(logY ? 10 ** yy : yy)}`;
          path += `M${pixel(x1, y1)}L${pixel(x2, y2)}`;
          break;
        }
        if (c1 & c2) break;
        const outside = c1 || c2;
        let xx: number, yy: number;
        if (outside & 8) { yy = ymax; xx = xAtY(yy); }
        else if (outside & 4) { yy = ymin; xx = xAtY(yy); }
        else if (outside & 2) { xx = xmax; yy = yAtX(xx); }
        else { xx = xmin; yy = yAtX(xx); }
        if (!Number.isFinite(xx) || !Number.isFinite(yy)) break;
        if (outside === c1) { x1 = xx; y1 = yy; } else { x2 = xx; y2 = yy; }
      }
    }
    return path;
  };
  return { x, y, validY, visible, boundedY, linePath };
}

/** Every observation is drawn, in the same series/row order as the SVG mode. */
export function drawDensePoints(
  context: CanvasRenderingContext2D,
  geometry: PlotGeometry,
) {
  clipCanvas(context, geometry.frame);
  for (const series of geometry.series) {
    context.fillStyle = series.color;
    context.strokeStyle = "white";
    context.lineWidth = 1.1;
    for (let j = 0; j < series.points.length; j++) {
      const point = series.points[j];
      if (!geometry.visible(point)) continue;
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
  context.restore();
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
      if (!geometry.visible(point)) return;
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
    if (px < geometry.frame.left || px > geometry.frame.width - geometry.frame.right || py < geometry.frame.top || py > geometry.frame.height - geometry.frame.bottom) return null;
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
  clipCanvas(context, geometry.frame);
  context.strokeStyle = "#0866db";
  context.lineWidth = 2.5;
  let count = 0;
  for (const [index, spans] of bySeries) {
    const series = geometry.series[index];
    if (!series) continue;
    for (let j = 0; j < series.points.length; j++) {
      const point = series.points[j];
      if (!geometry.visible(point)) continue;
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
  context.restore();
  return count;
}

function clipCanvas(context: CanvasRenderingContext2D, frame: PlotFrame) {
  context.save(); context.beginPath();
  context.rect(frame.left, frame.top, frame.width - frame.left - frame.right, frame.height - frame.top - frame.bottom);
  context.clip();
}
