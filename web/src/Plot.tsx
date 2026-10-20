import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fmt, palette } from "./data";
import {
  buildPlotGeometry,
  DENSE_POINT_THRESHOLD,
  drawDensePoints,
  drawSelectedPoints,
  plotFrame,
  pointHitIndex,
} from "./plot-geometry";
import type {
  PlotAnnotation,
  PlotGeometry,
  PointHit,
  PointReference,
  SelectedPointRange,
} from "./plot-geometry";
import type { Project, Response } from "./data";
import {
  canvasPixelRatio,
  clampGraphZoom,
  GRAPH_ZOOM_PRESETS,
  MAX_GRAPH_ZOOM,
  MIN_GRAPH_ZOOM,
} from "./plot-view";
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
    canvas.width = plotFrame.width * ratio;
    canvas.height = plotFrame.height * ratio;
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
      width={plotFrame.width}
      height={plotFrame.height}
      pointerEvents="none"
    >
      <canvas
        ref={ref}
        style={{
          width: plotFrame.width,
          height: plotFrame.height,
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
export default function Plot({
  project,
  result,
  onFormatAxes,
  onEditText,
  onSelectDataset,
  dataTableName,
  onSelectPoint,
  onGoToCell,
  onExcludePoint,
  selectedPoint,
  selectedPointRanges,
  annotations,
}: {
  project: Project;
  result: Response | null;
  onFormatAxes?: (axis: "x" | "y") => void;
  onEditText?: (field: "x_label" | "y_label") => void;
  onSelectDataset?: (index: number) => void;
  dataTableName?: string;
  onSelectPoint?: (seriesIndex: number, row: number) => void;
  onGoToCell?: (seriesIndex: number, row: number) => void;
  // Excludes the point's source value; omitted for frozen graph snapshots.
  onExcludePoint?: (seriesIndex: number, row: number) => void;
  selectedPoint?: PointReference | null;
  selectedPointRanges?: SelectedPointRange[];
  // Pairwise comparison brackets for column graphs.
  annotations?: PlotAnnotation[];
}) {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState(false);
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
  zoomRef.current = zoom;
  const { graph } = project;
  const clipId = useId().replace(/:/g, "");
  const computed = useMemo(() => {
    try { return { geometry: buildPlotGeometry(project, result, annotations), error: null }; }
    catch (error) { return { geometry: null, error: error instanceof Error ? error.message : "Invalid axis settings." }; }
  }, [project, result, annotations]);
  const geometry = computed.geometry;
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
    if (
      !matrix ||
      !findPoint ||
      !(graph.show_points || graph.type === "scatter")
    )
      return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return findPoint(
      p.x,
      p.y,
      Math.min(30, Math.max(6, 12 / Math.hypot(matrix.a, matrix.b))),
    );
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
    setZoom(next);
    setHover(null);
  }
  useLayoutEffect(() => {
    const view = viewport.current,
      pending = anchor.current;
    if (view && pending) {
      view.scrollLeft = (pending.left + pending.x) * pending.ratio - pending.x;
      view.scrollTop = (pending.top + pending.y) * pending.ratio - pending.y;
    }
    anchor.current = null;
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
  if (!geometry)
    return (
      <div className="empty-chart">Enter numeric data to create a graph.</div>
    );
  const { series, fits, xy, count, x, y, xTicks, yTicks } = geometry;
  const { width: W, height: H, left, right, top, bottom } = plotFrame;
  const pw = W - left - right,
    ph = H - top - bottom;
  const editAxis = (axis: "x" | "y", event: React.MouseEvent) => { event.stopPropagation(); onFormatAxes?.(axis); };
  const showPoints = graph.show_points || graph.type === "scatter";
  const dense = showPoints && count > DENSE_POINT_THRESHOLD;
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
          setPan(false);
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
        style={{
          overflow: "auto",
          maxHeight: "65vh",
          cursor: pan ? "grab" : "auto",
          touchAction: pan ? "none" : "auto",
        }}
        onPointerDown={(e) => {
          e.currentTarget.focus({ preventScroll: true });
          if (e.button !== 0 || (!pan && hitAt(e.clientX, e.clientY))) return;
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
        <div style={{ width: `${zoom}%`, minWidth: 0 }}>
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
              maxHeight: "none",
              minHeight: 0,
              padding: 0,
              overflow: "visible",
            }}
            role="img"
            onDoubleClick={(event) => {
              if ((event.target as Element).tagName === "text") return;
              const hit = hitAt(event.clientX, event.clientY);
              if (hit) onSelectDataset?.(hit.seriesIndex);
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
            <defs><clipPath id={clipId}><rect x={left} y={top} width={pw} height={ph} /></clipPath></defs>
            {geometry.axes.y.showGrid && yTicks.map((v, i) => <line key={`yg-${i}`} x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#ddd" />)}
            {geometry.axes.x.showGrid && (xy ? xTicks : series.map((_, i) => i + 1)).map((v, i) => <line key={`xg-${i}`} x1={x(v)} x2={x(v)} y1={top} y2={H - bottom} stroke="#ddd" />)}
            {geometry.axes.y.showAxis && <g data-axis="y" onDoubleClick={event => editAxis("y", event)}>
              <line x1={left} x2={left} y1={top} y2={H - bottom} stroke="#000" strokeWidth="1.5" />
              <line x1={left} x2={left} y1={top} y2={H - bottom} stroke="transparent" strokeWidth="10" />
              {yTicks.map((v, i) => <g key={i}><line x1={left - 6} x2={left} y1={y(v)} y2={y(v)} stroke="#000" strokeWidth="1.5" /><text x={left - 10} y={y(v) + 4} textAnchor="end" className="tick">{fmt(v)}</text></g>)}
            </g>}
            {geometry.axes.x.showAxis && <g data-axis="x" onDoubleClick={event => editAxis("x", event)}>
              <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="#000" strokeWidth="1.5" />
              <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="transparent" strokeWidth="10" />
              {xy ? xTicks.map((v, i) => <g key={i}><line x1={x(v)} x2={x(v)} y1={H - bottom} y2={H - bottom + 6} stroke="#000" strokeWidth="1.5" /><text x={x(v)} y={H - bottom + 22} textAnchor="middle" className="tick">{fmt(v)}</text></g>) : series.map((s, i) => <text key={i} x={x(i + 1)} y={H - bottom + 26} textAnchor="middle" className="tick">{s.name.length > 20 ? s.name.slice(0, 19) + "…" : s.name}</text>)}
            </g>}
            <text
              x={left + pw / 2}
              y={H - 18}
              textAnchor="middle"
              className="axis-label"
              onDoubleClick={() => onEditText?.("x_label")}
            >
              {graph.x_label}
            </text>
            <text
              transform={`translate(18 ${top + ph / 2}) rotate(-90)`}
              textAnchor="middle"
              className="axis-label"
              onDoubleClick={() => onEditText?.("y_label")}
            >
              {graph.y_label}
            </text>
            <g clipPath={`url(#${clipId})`}>
            {series.map((s, i) => {
              const cx = x(i + 1), bw = Math.min(72, (pw / series.length) * .46), v = s.values;
              const yy = geometry.boundedY;
              const cap = (value: number, half: number, key: string) => geometry.validY(value) && value >= geometry.minY && value <= geometry.maxY ? <line key={key} x1={cx - half} x2={cx + half} y1={y(value)} y2={y(value)} /> : null;
              const stem = (lo: number, hi: number) => Number.isFinite(lo) && Number.isFinite(hi) && hi >= geometry.minY && lo <= geometry.maxY ? <line x1={cx} x2={cx} y1={yy(lo)} y2={yy(hi)} /> : null;
              const baseline = geometry.logY ? geometry.minY : 0;
              return <g key={i} onDoubleClick={event => { event.stopPropagation(); onSelectDataset?.(i); }}>
                {!xy && graph.type === "bar" && v.length > 0 && geometry.validY(s.mean) && Math.max(s.mean, baseline) >= geometry.minY && Math.min(s.mean, baseline) <= geometry.maxY && <rect x={cx - bw / 2} y={Math.min(yy(s.mean), yy(baseline))} width={bw} height={Math.abs(yy(baseline) - yy(s.mean))} fill={s.color} stroke="#000" strokeWidth="1.5" />}
                {!xy && graph.type === "box" && v.length > 0 && s.quartiles && <g stroke="#000" strokeWidth="1.5">
                  {stem(s.min, s.max)}{cap(s.min, bw / 4, "min")}{cap(s.max, bw / 4, "max")}
                  {s.quartiles[2] >= geometry.minY && s.quartiles[0] <= geometry.maxY && <rect x={cx - bw / 2} y={Math.min(yy(s.quartiles[0]), yy(s.quartiles[2]))} width={bw} height={Math.max(1, Math.abs(yy(s.quartiles[0]) - yy(s.quartiles[2])))} fill={s.color} fillOpacity=".35" />}
                  {cap(s.quartiles[1], bw / 2, "median")}
                </g>}
                {graph.type === "line" && xy && <path d={geometry.linePath(s.linePoints.slice().sort((a, b) => a.x - b.x))} fill="none" stroke={s.color} strokeWidth="1.5" />}
                {!xy && graph.error !== "none" && graph.type !== "box" && v.length > 0 && <g stroke="#000" strokeWidth="1.5">{stem(s.lo, s.hi)}{cap(s.lo, 7, "lo")}{cap(s.hi, 7, "hi")}<g strokeWidth="2">{cap(s.mean, 20, "mean")}</g></g>}
                {showPoints && !dense && s.points.map((p, j) => geometry.visible(p) ? <circle key={j} cx={x(p.x) + (!xy ? (((j * 17) % 11) - 5) * 2.1 : 0)} cy={y(p.y)} r={xy ? 4 : 3.6} fill={s.color} stroke="#000" strokeOpacity=".35" strokeWidth=".6"><title>{s.name}, row {p.row + 1}: {fmt(p.y)}</title></circle> : null)}
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
                  cx={x(point.x) + (!xy ? (((index * 17) % 11) - 5) * 2.1 : 0)}
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
              const x1 = Math.min(x(bracket.x1), x(bracket.x2)) + 4,
                x2 = Math.max(x(bracket.x1), x(bracket.x2)) - 4,
                level = y(bracket.y);
              return (
                <g key={`bracket-${i}`} className="pairwise-bracket">
                  <path
                    d={`M${x1},${level + 7}V${level}H${x2}V${level + 7}`}
                    fill="none"
                    stroke="#000"
                    strokeWidth="1.25"
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
          </svg>
        </div>
      </div>
      <div role="toolbar" aria-label="Graph view" className="graph-zoom-strip">
        <button
          type="button"
          aria-label="Zoom out graph"
          disabled={zoom <= MIN_GRAPH_ZOOM}
          onClick={() => changeZoom(zoom - 25)}
        >
          −
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Zoom
          <input
            type="range"
            aria-label="Graph zoom"
            min={MIN_GRAPH_ZOOM}
            max={MAX_GRAPH_ZOOM}
            step="1"
            value={zoom}
            style={{ width: 80 }}
            onChange={(e) => changeZoom(Number(e.target.value))}
          />
          <output style={{ minWidth: 38 }}>{zoom}%</output>
        </label>
        <button
          type="button"
          aria-label="Zoom in graph"
          disabled={zoom >= MAX_GRAPH_ZOOM}
          onClick={() => changeZoom(zoom + 25)}
        >
          +
        </button>
        <select
          aria-label="Graph zoom preset"
          value={GRAPH_ZOOM_PRESETS.some((value) => value === zoom) ? zoom : ""}
          onChange={(event) => changeZoom(Number(event.target.value))}
        >
          {!GRAPH_ZOOM_PRESETS.some((value) => value === zoom) && (
            <option value="" disabled>
              {zoom}% (custom)
            </option>
          )}
          {GRAPH_ZOOM_PRESETS.map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            changeZoom(100);
            anchor.current = null;
            viewport.current?.scrollTo(0, 0);
          }}
        >
          Fit
        </button>
        <button
          type="button"
          aria-pressed={pan}
          aria-label="Hand pan"
          title="Drag to pan the zoomed graph"
          onClick={() => setPan((v) => !v)}
        >
          Pan
        </button>
      </div>
      {hover && series[hover.hit.seriesIndex] && (
        <div
          role="group"
          aria-label="Point details"
          style={{
            position: "absolute",
            zIndex: 5,
            left: hover.left,
            top: hover.top,
            width: 228,
            padding: 10,
            background: "#fff",
            color: "#222",
            border: "1px solid #8d8d8d",
            borderRadius: 4,
            boxShadow: "0 3px 12px #0003",
            fontSize: 12,
          }}
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
      {geometry.logOmittedCount > 0 && <p role="note" style={{ fontSize: 11, margin: "4px 12px" }}>{geometry.logOmittedCount.toLocaleString()} observations have nonpositive coordinates on a logarithmic axis and cannot be displayed. Data and statistical summaries still include these values.</p>}
      {geometry.logOmittedSummary && <p role="note" style={{ fontSize: 11, margin: "4px 12px" }}>Nonpositive summary marks and interval caps cannot be displayed on a logarithmic Y axis. Intervals crossing zero are clipped at the lower displayed limit; summaries still use all values.</p>}
      {geometry.logY && graph.type === "bar" && <p role="note" style={{ fontSize: 11, margin: "4px 12px" }}>Logarithmic bars start at the lower displayed Y limit, not zero. Nonpositive means and interval caps cannot be displayed.</p>}
      {dense && (
        <p style={{ fontSize: 11, margin: "4px 12px" }}>
          {count.toLocaleString()} valid-coordinate points · Canvas display. Only points within the axis limits are drawn; no sampling is used. Overlapping points may cover one another.
        </p>
      )}
    </div>
  );
}
