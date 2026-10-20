import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmt, palette } from "./data";
import { formatAxisTick } from "./axis-number-format";
import { columnPageLayout, plotLabelLayout } from "./plot-label-layout";
import { plottedDatasetStyles, ptToPx, symbolPath, symbolRadius } from "./graph-style";
import type { ResolvedDatasetStyle } from "./graph-style";
import {
  buildPlotGeometry,
  DENSE_POINT_THRESHOLD,
  drawDensePoints,
  drawSelectedPoints,
  pointHitIndex,
  reframePlotGeometry,
} from "./plot-geometry";
import type {
  PlotAnnotation,
  PlotGeometry,
  PointHit,
  PointReference,
  SelectedPointRange,
} from "./plot-geometry";
import type { Project, Response } from "./data";
import { canvasPixelRatio, clampGraphZoom } from "./plot-view";
function DensePoints({
  geometry,
  zoom,
  selection,
}: {
  geometry: PlotGeometry;
  zoom: number;
  selection?: SelectedPointRange[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = canvasPixelRatio(zoom, window.devicePixelRatio);
    canvas.width = geometry.frame.width * ratio;
    canvas.height = geometry.frame.height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    if (selection) drawSelectedPoints(context, geometry, selection);
    else drawDensePoints(context, geometry);
  }, [geometry, zoom, selection]);
  return (
    <foreignObject
      x="0"
      y="0"
      width={geometry.frame.width}
      height={geometry.frame.height}
      pointerEvents="none"
    >
      <canvas
        ref={ref}
        style={{
          width: geometry.frame.width,
          height: geometry.frame.height,
          display: "block",
        }}
        aria-label={
          selection
            ? "Selected observations from the data table"
            : `${geometry.count.toLocaleString()} observations rendered in full. Overlapping observations may cover one another.`
        }
      />
    </foreignObject>
  );
}
/** A US letter page at 100% zoom (8.5 × 11 in at 72 px per inch), as on a
 * Prism graph sheet; the graph sits one inch below the top edge. */
const PAGE_WIDTH = 612, PAGE_HEIGHT = 792, PAGE_TOP = 72;
/** Jitter for column-graph points; shared by symbols and the selection ring. */
const jitter = (index: number) => (((index * 17) % 11) - 5) * 2.1;

function DatasetSymbol({
  style,
  cx,
  cy,
  children,
}: {
  style: ResolvedDatasetStyle;
  cx: number;
  cy: number;
  children?: React.ReactNode;
}) {
  const radius = symbolRadius(style.symbol_size);
  // Circles stay <circle> elements so existing point lookups keep working.
  return style.symbol_shape === "circle" ? (
    <circle cx={cx} cy={cy} r={radius} fill={style.symbol_color}>
      {children}
    </circle>
  ) : (
    <path
      d={symbolPath(style.symbol_shape, radius)}
      transform={`translate(${cx} ${cy})`}
      fill={style.symbol_color}
      data-symbol={style.symbol_shape}
    >
      {children}
    </path>
  );
}

export default function Plot({
  project,
  result,
  zoom,
  onZoom,
  pan,
  onPan,
  onLabelLayout,
  onFormatAxes,
  onEditText,
  onSelectDataset,
  onFormatGraph,
  onEditTitle,
  dataTableName,
  onSelectPoint,
  onGoToCell,
  onExcludePoint,
  selectedPoint,
  selectedPointRanges,
  annotations,
  children,
}: {
  project: Project;
  result: Response | null;
  /** Percent of the graph page's natural size; owned by the window's zoom controls. */
  zoom: number;
  onZoom: (zoom: number) => void;
  /** Hand Pan tool; only then does dragging scroll the graph. */
  pan: boolean;
  onPan: (pan: boolean) => void;
  /** Reports whether category labels are slanted, for matching exports. */
  onLabelLayout?: (layout: { slanted: boolean }) => void;
  onFormatAxes?: (axis: "x" | "y") => void;
  onEditText?: (field: "x_label" | "y_label") => void;
  onSelectDataset?: (index: number) => void;
  /** Open graph-wide Format Graph when double-clicking the plotting background. */
  onFormatGraph?: () => void;
  /** Open the graph title's editor when double-clicking the title. */
  onEditTitle?: () => void;
  dataTableName?: string;
  onSelectPoint?: (seriesIndex: number, row: number) => void;
  onGoToCell?: (seriesIndex: number, row: number) => void;
  // Excludes the point's source value; omitted for frozen graph snapshots.
  onExcludePoint?: (seriesIndex: number, row: number) => void;
  selectedPoint?: PointReference | null;
  selectedPointRanges?: SelectedPointRange[];
  // Pairwise comparison brackets for column graphs.
  annotations?: PlotAnnotation[];
  /** Notes shown on the page below the graph. */
  children?: React.ReactNode;
}) {
  const [localSelection, setLocalSelection] = useState<PointReference | null>(
    null,
  );
  const [hover, setHover] = useState<{
    hit: PointHit;
    left: number;
    top: number;
    context: boolean;
  } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const anchor = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    ratio: number;
  } | null>(null);
  const zoomRef = useRef(zoom);
  const lastZoom = useRef(zoom);
  zoomRef.current = zoom;
  const { graph } = project;
  const xyTable = project.table_type === "xy";
  const clipId = useId().replace(/:/g, "");
  const styles = useMemo(
    () => plottedDatasetStyles(graph, project.columns, xyTable, palette),
    [graph, project.columns, xyTable],
  );
  const showLegend = graph.show_legend ?? xyTable;
  const computed = useMemo(() => {
    try { return { geometry: buildPlotGeometry(project, result, annotations), error: null }; }
    catch (error) { return { geometry: null, error: error instanceof Error ? error.message : "Invalid axis settings." }; }
  }, [project, result, annotations]);
  const [labelFonts, setLabelFonts] = useState({ tick: "700 14px Arial", title: "700 16px Arial", legend: "700 13px Arial", tickHeight: 14, titleHeight: 16 });
  useLayoutEffect(() => {
    const tick = svgRef.current?.querySelector(".tick"), title = svgRef.current?.querySelector(".axis-label");
    if (!tick || !title) return;
    const a = getComputedStyle(tick), b = getComputedStyle(title);
    const next = { tick: a.font, title: b.font, legend: labelFonts.legend, tickHeight: parseFloat(a.fontSize), titleHeight: parseFloat(b.fontSize) };
    setLabelFonts(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  }, [computed.geometry]);
  const plotted = useMemo(() => {
    const base = computed.geometry;
    if (!base) return null;
    const context = document.createElement("canvas").getContext("2d");
    const measure = (text: string, font = labelFonts.tick) => {
      if (!context) return text.length * 7;
      context.font = font;
      return context.measureText(text).width;
    };
    const xLabels = base.xy
      ? base.xTicks.map(value => base.axes.x.numberFormat ? formatAxisTick(value, base.axes.x.numberFormat) : fmt(value))
      : base.series.map(series => series.name.length > 20 ? series.name.slice(0, 19) + "…" : series.name);
    const yLabels = base.yTicks.map(value => base.axes.y.numberFormat ? formatAxisTick(value, base.axes.y.numberFormat) : fmt(value));
    const xWidths = xLabels.map(text => measure(text)), yWidths = yLabels.map(text => measure(text));
    const legendWidths = base.series.map(series => measure(series.name, labelFonts.legend));
    const legendWidth = showLegend ? Math.min(220, Math.max(0, ...legendWidths)) + 26 : 0;
    const shared = {
      yWidth: base.axes.y.showAxis ? Math.max(0, ...yWidths) : 0,
      tickHeight: labelFonts.tickHeight, titleHeight: labelFonts.titleHeight,
      hasYTitle: Boolean(graph.y_label),
    };
    let frame, yTitleX, yTickWidth, slanted = false, xTitleOffset = labelFonts.tickHeight + 32;
    if (base.xy) {
      const layout = plotLabelLayout({ ...shared, xWidth: base.axes.x.showAxis ? Math.max(0, ...xWidths) : 0 });
      frame = { ...layout.frame, width: layout.frame.width + (legendWidth ? legendWidth + 18 : 0), right: layout.frame.right + (legendWidth ? legendWidth + 18 : 0) };
      ({ yTitleX, yTickWidth } = layout);
      xTitleOffset = layout.frame.bottom - 18;
    } else {
      const layout = columnPageLayout({
        ...shared, count: base.series.length, xWidths: base.axes.x.showAxis ? xWidths : [],
        hasXTitle: Boolean(graph.x_label), legendWidth,
      });
      ({ frame, yTitleX, yTickWidth, slanted, xTitleOffset } = layout);
    }
    // The graph title sits above the plotting area on the same page.
    const titleBand = graph.title ? 94 : 14;
    frame = { ...frame, top: frame.top + titleBand, height: frame.height + titleBand };
    return { geometry: reframePlotGeometry(base, frame), yTitleX, yTickWidth, slanted, xTitleOffset, legendWidths, titleBand,
      xLabels, yLabels, xWidths, yWidths,
      xTitleWidth: measure(graph.x_label, labelFonts.title), yTitleWidth: measure(graph.y_label, labelFonts.title) };
  }, [computed.geometry, labelFonts, graph.x_label, graph.y_label, graph.title, showLegend]);
  const slanted = plotted?.slanted ?? false;
  useLayoutEffect(() => {
    onLabelLayout?.({ slanted });
  }, [slanted, onLabelLayout]);
  const geometry = plotted?.geometry ?? null;
  const findPoint = useMemo(
    () => (geometry ? pointHitIndex(geometry) : null),
    [geometry],
  );
  useLayoutEffect(() => {
    setHover(null);
    setLocalSelection(null);
  }, [geometry]);
  function hitAt(clientX: number, clientY: number) {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix || !findPoint || !styles.some(style => style.symbols)) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    const hit = findPoint(
      p.x,
      p.y,
      Math.min(30, Math.max(6, 12 / Math.hypot(matrix.a, matrix.b))),
    );
    // Points of a data set with hidden symbols cannot be hovered or selected.
    return hit && styles[hit.seriesIndex]?.symbols ? hit : null;
  }
  function showTooltip(
    hit: PointHit,
    clientX: number,
    clientY: number,
    context = false,
  ) {
    const rect = workspace.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      hit,
      context,
      left: Math.max(4, Math.min(rect.width - 240, clientX - rect.left + 12)),
      top: Math.max(4, clientY - rect.top + 12),
    });
  }
  function changeZoom(value: number, clientX?: number, clientY?: number) {
    const next = clampGraphZoom(value);
    const view = viewport.current;
    if (view) {
      const rect = view.getBoundingClientRect();
      const x =
        clientX === undefined ? view.clientWidth / 2 : clientX - rect.left;
      const y =
        clientY === undefined ? view.clientHeight / 2 : clientY - rect.top;
      anchor.current = {
        x,
        y,
        left: view.scrollLeft,
        top: view.scrollTop,
        ratio: next / zoomRef.current,
      };
    }
    zoomRef.current = next;
    onZoom(next);
    setHover(null);
  }
  useLayoutEffect(() => {
    const view = viewport.current;
    // Zoom changed from the window controls: keep the viewport center fixed.
    const pending = anchor.current ?? (view && lastZoom.current !== zoom
      ? { x: view.clientWidth / 2, y: view.clientHeight / 2, left: view.scrollLeft, top: view.scrollTop, ratio: zoom / lastZoom.current }
      : null);
    if (view && pending) {
      view.scrollLeft = (pending.left + pending.x) * pending.ratio - pending.x;
      view.scrollTop = (pending.top + pending.y) * pending.ratio - pending.y;
    }
    anchor.current = null;
    lastZoom.current = zoom;
    setHover(null);
  }, [zoom]);
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      changeZoom(
        zoomRef.current * Math.exp(-event.deltaY * 0.005),
        event.clientX,
        event.clientY,
      );
    };
    view.addEventListener("wheel", wheel, { passive: false });
    return () => view.removeEventListener("wheel", wheel);
  }, [!!geometry]);
  if (computed.error) return <div className="empty-chart" role="alert">Graph axis settings: {computed.error}</div>;
  if (!geometry || !plotted)
    return (
      <div className="empty-chart">Enter numeric data to create a graph.</div>
    );
  const { series, fits, xy, count, x, y, xTicks, yTicks } = geometry;
  const { width: W, height: H, left, right, top, bottom } = geometry.frame;
  const pw = W - left - right,
    ph = H - top - bottom;
  const plotRight = W - right, plotBottom = H - bottom;
  const editAxis = (axis: "x" | "y", event: React.MouseEvent) => { event.stopPropagation(); onFormatAxes?.(axis); };
  const dense = styles.some(style => style.symbols) && count > DENSE_POINT_THRESHOLD;
  const slot = series.length ? pw / (series.length + 0.2) : pw;
  // An explicit Column spacing sets the bar width as a share of its slot.
  const bw = !xy && graph.type === "bar" && graph.column_space_percent != null
    ? slot / (1 + graph.column_space_percent / 100)
    : Math.min(72, slot * 0.66);
  const axisWidth = 2;
  return (
    <div
      ref={workspace}
      className="plot-workspace"
      style={{ position: "relative" }}
      onPointerLeave={() => {
        if (!hover?.context) setHover(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHover(null);
          onPan(false);
          return;
        }
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          changeZoom(zoom + 25);
        }
        if (event.key === "-") {
          event.preventDefault();
          changeZoom(zoom - 25);
        }
        if (event.key === "0") {
          event.preventDefault();
          changeZoom(100);
        }
      }}
    >
      <div
        ref={viewport}
        role="region"
        aria-label="Graph viewport"
        tabIndex={0}
        className="plot-viewport"
        style={{
          cursor: pan ? "grab" : "auto",
          touchAction: pan ? "none" : "auto",
        }}
        onPointerDown={(e) => {
          e.currentTarget.focus({ preventScroll: true });
          // Pointer capture changes the effective event target: when disabled
          // it steals normal click/double-click gestures from graph elements.
          // Only the explicitly enabled Hand Pan tool captures the pointer.
          if (e.button !== 0 || !pan) return;
          if ((e.target as Element).tagName === "text") return;
          dragged.current = false;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          if (
            Math.abs(e.clientX - drag.current.x) +
              Math.abs(e.clientY - drag.current.y) >
            3
          ) {
            drag.current.moved = true;
            dragged.current = true;
            setHover(null);
          }
          e.currentTarget.scrollLeft =
            drag.current.left - (e.clientX - drag.current.x);
          e.currentTarget.scrollTop =
            drag.current.top - (e.clientY - drag.current.y);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <div
          className="graph-page"
          style={{
            width: (Math.max(PAGE_WIDTH, W + 48) * zoom) / 100,
            minHeight: (PAGE_HEIGHT * zoom) / 100,
            paddingTop: (PAGE_TOP * zoom) / 100,
          }}
        >
        <div className="graph-on-page" style={{ width: (W * zoom) / 100 }}>
          <svg
            ref={svgRef}
            onPointerMove={(event) => {
              if (drag.current || hover?.context) return;
              const hit = hitAt(event.clientX, event.clientY);
              if (hit) showTooltip(hit, event.clientX, event.clientY);
            }}
            onClick={(event) => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              const hit = hitAt(event.clientX, event.clientY);
              if (!hit) {
                setHover(null);
                return;
              }
              setLocalSelection({ seriesIndex: hit.seriesIndex, row: hit.row });
              onSelectPoint?.(hit.seriesIndex, hit.row);
              showTooltip(hit, event.clientX, event.clientY);
            }}
            onContextMenu={(event) => {
              const hit = hitAt(event.clientX, event.clientY);
              if (!hit) return;
              event.preventDefault();
              showTooltip(hit, event.clientX, event.clientY, true);
            }}
            viewBox={`0 0 ${W} ${H}`}
            className="plot"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              overflow: "visible",
            }}
            role="img"
            onDoubleClick={(event) => {
              // Axis gestures belong to Format Axes. Graph marks and the
              // plotting background belong to Format Graph.
              if ((event.target as Element).closest('[data-axis], .axis-label')) return;
              const hit = hitAt(event.clientX, event.clientY);
              if (hit && onSelectDataset) onSelectDataset(hit.seriesIndex);
              else onFormatGraph?.();
            }}
            aria-label={`${graph.title}. ${graph.type} graph of ${series.map((s) => s.name).join(", ")}.`}
          >
            <title>{graph.title}</title>
            <desc>
              {count.toLocaleString()} observations.{" "}
              {dense
                ? "Every point is drawn on a canvas layer; no observations are sampled or aggregated. Overlapping points may cover one another."
                : ""}
            </desc>
            <rect width={W} height={H} fill="white" />
            {graph.title && (
              <text
                x={left + pw / 2}
                y={top - plotted.titleBand + 46}
                textAnchor="middle"
                className="graph-title"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  (onEditTitle ?? onFormatGraph)?.();
                }}
              >
                {graph.title}
              </text>
            )}
            <defs>
              <clipPath id={clipId}><rect x={left} y={top} width={pw} height={ph} /></clipPath>
              {styles.map((style, i) => style.pattern && (
                <pattern key={i} id={`${clipId}-hatch-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke={style.color} strokeWidth="1.4" />
                </pattern>
              ))}
            </defs>
            {geometry.axes.y.showGrid && yTicks.map((v, i) => <line key={`yg-${i}`} x1={left} x2={plotRight} y1={y(v)} y2={y(v)} stroke="#ddd" />)}
            {geometry.axes.x.showGrid && (xy ? xTicks : series.map((_, i) => i + 1)).map((v, i) => <line key={`xg-${i}`} x1={x(v)} x2={x(v)} y1={top} y2={plotBottom} stroke="#ddd" />)}
            <g clipPath={`url(#${clipId})`}>
            {series.map((s, i) => {
              const style = styles[i];
              const cx = x(i + 1), v = s.values;
              const yy = geometry.boundedY;
              const stroke = { stroke: style.color, strokeWidth: ptToPx(style.border_width) };
              const fill = (props: React.SVGProps<SVGRectElement>) => <>
                <rect {...props} fill={style.fill} {...stroke} />
                {style.pattern && <rect {...props} fill={`url(#${clipId}-hatch-${i})`} stroke="none" />}
              </>;
              const cap = (value: number, half: number, key: string) => geometry.validY(value) && value >= geometry.minY && value <= geometry.maxY ? <line key={key} x1={cx - half} x2={cx + half} y1={y(value)} y2={y(value)} /> : null;
              const stem = (lo: number, hi: number) => Number.isFinite(lo) && Number.isFinite(hi) && hi >= geometry.minY && lo <= geometry.maxY ? <line x1={cx} x2={cx} y1={yy(lo)} y2={yy(hi)} /> : null;
              const baseline = geometry.logY ? geometry.minY : 0;
              const errorShown = !xy && graph.error !== "none" && graph.type !== "box" && v.length > 0 && style.error_bars;
              const up = style.error_direction !== "below", down = style.error_direction !== "above";
              const capHalf = style.error_cap === "T" ? 7 : 0;
              return <g key={i} data-dataset={s.name} onDoubleClick={event => { event.stopPropagation(); if (onSelectDataset) onSelectDataset(i); else onFormatGraph?.(); }}>
                {!xy && graph.type === "bar" && v.length > 0 && geometry.validY(s.mean) && Math.max(s.mean, baseline) >= geometry.minY && Math.min(s.mean, baseline) <= geometry.maxY && fill({ x: cx - bw / 2, y: Math.min(yy(s.mean), yy(baseline)), width: bw, height: Math.abs(yy(baseline) - yy(s.mean)) })}
                {!xy && graph.type === "box" && v.length > 0 && s.quartiles && <g {...stroke}>
                  {stem(s.min, s.quartiles[0])}{stem(s.quartiles[2], s.max)}{cap(s.min, bw / 4, "min")}{cap(s.max, bw / 4, "max")}
                  {s.quartiles[2] >= geometry.minY && s.quartiles[0] <= geometry.maxY && fill({ x: cx - bw / 2, y: Math.min(yy(s.quartiles[0]), yy(s.quartiles[2])), width: bw, height: Math.max(1, Math.abs(yy(s.quartiles[0]) - yy(s.quartiles[2]))) })}
                  {cap(s.quartiles[1], bw / 2, "median")}
                </g>}
                {graph.type === "line" && xy && <path d={geometry.linePath(s.linePoints.slice().sort((a, b) => a.x - b.x))} fill="none" stroke={style.color} strokeWidth={ptToPx(style.line_width)} />}
                {!xy && graph.type === "scatter" && v.length > 0 && <g stroke={style.error_color} strokeWidth="2">{cap(s.mean, 20, "mean")}</g>}
                {errorShown && <g stroke={style.error_color} strokeWidth={ptToPx(style.error_width)} data-error-bar={style.error_direction}>
                  {stem(down ? s.lo : s.mean, up ? s.hi : s.mean)}
                  {up && capHalf > 0 && cap(s.hi, capHalf, "hi")}
                  {down && capHalf > 0 && cap(s.lo, capHalf, "lo")}
                </g>}
                {style.symbols && !dense && s.points.map((p, j) => geometry.visible(p) ? <DatasetSymbol key={j} style={style} cx={x(p.x) + (!xy ? jitter(j) : 0)} cy={y(p.y)}><title>{s.name}, row {p.row + 1}: {fmt(p.y)}</title></DatasetSymbol> : null)}
              </g>;
            })}
            {dense && <DensePoints geometry={geometry} zoom={zoom} />}
            {!!selectedPointRanges?.length && (
              <DensePoints
                geometry={geometry}
                zoom={zoom}
                selection={selectedPointRanges}
              />
            )}
            {(() => {
              const selection =
                selectedPoint === undefined ? localSelection : selectedPoint;
              if (!selection) return null;
              const dataset = series[selection.seriesIndex];
              const index =
                dataset?.points.findIndex(
                  (point) => point.row === selection.row,
                ) ?? -1;
              if (index < 0) return null;
              const point = dataset.points[index];
              if (!geometry.visible(point)) return null;
              return (
                <circle
                  data-selected-point="true"
                  cx={x(point.x) + (!xy ? jitter(index) : 0)}
                  cy={y(point.y)}
                  r="7"
                  fill="none"
                  stroke="#0866db"
                  strokeWidth="2.5"
                  pointerEvents="none"
                />
              );
            })()}
            {geometry.brackets.map((bracket, i) => {
              if (!geometry.validY(bracket.y) || bracket.y < geometry.minY || bracket.y > geometry.maxY) return null;
              const x1 = Math.min(x(bracket.x1), x(bracket.x2)),
                x2 = Math.max(x(bracket.x1), x(bracket.x2)),
                level = y(bracket.y);
              return (
                <g key={`bracket-${i}`} className="pairwise-bracket">
                  <path
                    d={`M${x1},${level + 5.5}V${level}H${x2}V${level + 5.5}`}
                    fill="none"
                    stroke="#000"
                    strokeWidth="1.3"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={level - 4}
                    textAnchor="middle"
                    className="pairwise-label"
                  >
                    {bracket.label}
                  </text>
                </g>
              );
            })}
            {fits.map((f, i) => (
              <path
                key={i}
                d={geometry.linePath(f.linePoints)}
                fill="none"
                stroke={
                  series.find((s) => s.name === f.series)?.color ??
                  palette[i % palette.length]
                }
                strokeWidth="1.5"
              />
            ))}
            </g>
            {geometry.axes.y.showAxis && <g data-axis="y" onDoubleClick={event => editAxis("y", event)}>
              <path d={`M${left},${top}V${plotBottom}`} className="axis-line" strokeWidth={axisWidth} />
              <line x1={left} x2={left} y1={top} y2={plotBottom} stroke="transparent" strokeWidth="10" />
              {yTicks.map((v, i) => <g key={i}><line x1={left - 6} x2={left} y1={y(v)} y2={y(v)} className="axis-line" strokeWidth={axisWidth} /><text x={left - 11} y={y(v) + 5} textAnchor="end" className="tick" textLength={plotted.yWidths[i] > plotted.yTickWidth ? plotted.yTickWidth : undefined} lengthAdjust="spacingAndGlyphs">{plotted.yLabels[i]}</text></g>)}
            </g>}
            {geometry.axes.x.showAxis && <g data-axis="x" onDoubleClick={event => editAxis("x", event)}>
              <path d={`M${left},${plotBottom}H${plotRight}`} className="axis-line" strokeWidth={axisWidth} />
              <line x1={left} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="transparent" strokeWidth="10" />
              {xy
                ? xTicks.map((v, i) => <g key={i}><line x1={x(v)} x2={x(v)} y1={plotBottom} y2={plotBottom + 6} className="axis-line" strokeWidth={axisWidth} /><text x={x(v)} y={plotBottom + 22} textAnchor="middle" className="tick" textLength={plotted.xWidths[i] > 200 ? 200 : undefined} lengthAdjust="spacingAndGlyphs">{plotted.xLabels[i]}</text></g>)
                : series.map((_, i) => {
                    const cx = x(i + 1), label = plotted.xLabels[i];
                    return <g key={i}>
                      <line x1={cx} x2={cx} y1={plotBottom} y2={plotBottom + 6} className="axis-line" strokeWidth={axisWidth} />
                      {plotted.slanted
                        ? <text x={cx + 5} y={plotBottom + 20} transform={`rotate(-45 ${cx + 5} ${plotBottom + 20})`} textAnchor="end" className="tick" textLength={plotted.xWidths[i] > 160 ? 160 : undefined} lengthAdjust="spacingAndGlyphs">{label}</text>
                        : <text x={cx} y={plotBottom + 24} textAnchor="middle" className="tick">{label}</text>}
                    </g>;
                  })}
            </g>}
            <text
              x={left + pw / 2}
              y={plotBottom + plotted.xTitleOffset}
              textLength={plotted.xTitleWidth > pw + 40 ? pw + 40 : undefined}
              lengthAdjust="spacingAndGlyphs"
              textAnchor="middle"
              className="axis-label"
              onDoubleClick={() => onEditText?.("x_label")}
            >
              {graph.x_label}
            </text>
            <text
              transform={`translate(${plotted.yTitleX} ${top + ph / 2}) rotate(-90)`}
              textLength={plotted.yTitleWidth > ph + 40 ? ph + 40 : undefined}
              lengthAdjust="spacingAndGlyphs"
              textAnchor="middle"
              className="axis-label"
              onDoubleClick={() => onEditText?.("y_label")}
            >
              {graph.y_label}
            </text>
            {showLegend && (
              <g className="plot-legend" aria-label="Legend" transform={`translate(${plotRight + 18} ${top + 4})`}>
                {series.map((s, i) => {
                  const style = styles[i];
                  const filled = !xy && (graph.type === "bar" || graph.type === "box");
                  return <g key={i} transform={`translate(0 ${i * 20})`}>
                    {filled
                      ? <rect x="0" y="0" width="14" height="12" fill={style.fill} stroke={style.color} strokeWidth={ptToPx(style.border_width)} />
                      : <>
                          {xy && graph.type === "line" && <line x1="-1" x2="15" y1="6" y2="6" stroke={style.color} strokeWidth={ptToPx(style.line_width)} />}
                          {style.symbols && <path d={symbolPath(style.symbol_shape, symbolRadius(style.symbol_size))} transform="translate(7 6)" fill={style.symbol_color} />}
                        </>}
                    <text x="22" y="11" className="legend-label" textLength={plotted.legendWidths[i] > 220 ? 220 : undefined} lengthAdjust="spacingAndGlyphs">{s.name}</text>
                  </g>;
                })}
              </g>
            )}
          </svg>
        </div>
        <div className="graph-page-notes">
          {geometry.logOmittedCount > 0 && <p role="note" className="plot-note">{geometry.logOmittedCount.toLocaleString()} observations have nonpositive coordinates on a logarithmic axis and cannot be displayed. Data and statistical summaries still include these values.</p>}
          {geometry.logOmittedSummary && <p role="note" className="plot-note">Nonpositive summary marks and interval caps cannot be displayed on a logarithmic Y axis. Intervals crossing zero are clipped at the lower displayed limit; summaries still use all values.</p>}
          {geometry.logY && graph.type === "bar" && <p role="note" className="plot-note">Logarithmic bars start at the lower displayed Y limit, not zero. Nonpositive means and interval caps cannot be displayed.</p>}
          {dense && (
            <p className="plot-note">
              {count.toLocaleString()} valid-coordinate points · Canvas display. Only points within the axis limits are drawn; no sampling is used. Overlapping points may cover one another.
            </p>
          )}
          {children}
        </div>
        </div>
      </div>
      {hover && series[hover.hit.seriesIndex] && (
        <div
          role="group"
          aria-label="Point details"
          className="point-details"
          style={{ left: hover.left, top: hover.top }}
        >
          <button
            type="button"
            aria-label="Close point details"
            style={{ float: "right" }}
            onClick={() => setHover(null)}
          >
            ×
          </button>
          <strong>{dataTableName ?? project.name}</strong>
          <div>
            {series[hover.hit.seriesIndex].name} · Row {hover.hit.row + 1}
          </div>
          <div>
            {xy
              ? `X: ${hover.hit.x} · Y: ${hover.hit.y}`
              : `Value: ${hover.hit.y}`}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
            {onGoToCell && (
              <button
                type="button"
                onClick={() => {
                  onGoToCell(hover.hit.seriesIndex, hover.hit.row);
                  setHover(null);
                }}
              >
                Go to cell
              </button>
            )}
            {onExcludePoint && (
              <button
                type="button"
                title="Keep the value in the data table but leave it out of analyses and graphs"
                onClick={() => {
                  onExcludePoint(hover.hit.seriesIndex, hover.hit.row);
                  setHover(null);
                }}
              >
                Exclude Values
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
