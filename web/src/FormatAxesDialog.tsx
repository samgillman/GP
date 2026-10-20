import { useState } from "react";
import type { AxisSettings, AxisNumberFormat, Graph, GraphAxes, Project, Response } from "./data";
import { numeric, fmt } from "./data";
import { axesSettingsProblem, defaultGraphAxes, defaultAxisNumberFormat, validAxisNumberFormat } from "./axes";
import { formatAxisTick } from "./axis-number-format";
import { buildPlotGeometry } from "./plot-geometry";
import { DesktopDialog } from "./WorkbookDialogs";
import "./axes-dialog.css";

type DraftAxis = Omit<AxisSettings, "minimum" | "maximum" | "majorInterval"> & {
  minimum: string; maximum: string; majorInterval: string;
};
function draftAxis(axis: AxisSettings): DraftAxis {
  return { ...axis, minimum: String(axis.minimum ?? ""), maximum: String(axis.maximum ?? ""),
    majorInterval: String(axis.majorInterval ?? "") };
}
export default function FormatAxesDialog({ project, result, initialAxis, onApply, onClose }: {
  project: Project;
  result: Response | null;
  initialAxis: "x" | "y";
  onApply(graph: Graph): boolean;
  onClose(): void;
}) {
  const [axis, setAxis] = useState(initialAxis);
  const [draft, setDraft] = useState(() => {
    const axes = project.graph.axes ?? defaultGraphAxes();
    return { x: draftAxis(axes.x), y: draftAxis(axes.y) };
  });
  const [titles, setTitles] = useState({ x_label: project.graph.x_label, y_label: project.graph.y_label });
  const [applyError, setApplyError] = useState("");
  const xy = project.table_type === "xy";
  const autoLogX = result?.analysis === "dose_response";
  const current = draft[axis];
  const categorical = axis === "x" && !xy;
  const logarithmic = current.scale === "log10" ||
    (axis === "x" && autoLogX && current.scale === "auto");
  let axes: GraphAxes | null = null, problem = "";
  try {
    const parse = (value: DraftAxis): AxisSettings => ({
      ...value, minimum: numeric(value.minimum), maximum: numeric(value.maximum),
      majorInterval: numeric(value.majorInterval),
    });
    axes = { x: parse(draft.x), y: parse(draft.y) };
    problem = axesSettingsProblem(axes, xy, autoLogX) ?? "";
  } catch (error) { problem = (error as Error).message; }
  function change(patch: Partial<DraftAxis>) {
    setApplyError("");
    setDraft(previous => {
      const next = { ...previous[axis], ...patch };
      if (next.numberFormat === undefined) delete next.numberFormat;
      return { ...previous, [axis]: next };
    });
  }
  function changeNumberFormat(patch: Partial<AxisNumberFormat>) {
    change({ numberFormat: { ...(current.numberFormat ?? defaultAxisNumberFormat()), ...patch } });
  }
  function automatic(enabled: boolean) {
    if (enabled) { change({ minimum: "", maximum: "", majorInterval: "" }); return; }
    try {
      const geometry = buildPlotGeometry(project, result);
      change({ minimum: String(axis === "x" ? geometry?.minX ?? 0 : geometry?.minY ?? 0),
        maximum: String(axis === "x" ? geometry?.maxX ?? 1 : geometry?.maxY ?? 1) });
    } catch { change({ minimum: logarithmic ? "1" : "0", maximum: logarithmic ? "10" : "1" }); }
  }
  function apply(close: boolean) {
    if (!axes || problem) return;
    const graph: Graph = { ...project.graph, ...titles, axes };
    try {
      // Resolve automatic limits as well: very small intervals and one-sided
      // ranges must not get saved merely because their individual fields parse.
      buildPlotGeometry({ ...project, graph }, result);
      if (!onApply(graph)) { setApplyError("The axis settings could not be saved. Review the workbook warning and try again."); return; }
      setApplyError("");
      if (close) onClose();
    } catch (error) { setApplyError((error as Error).message); }
  }
  return <DesktopDialog title="Format Axes" titleId="format-axes-title" className="axes-dialog" onClose={onClose}>
    <div className="desktop-dialog-body">
      <div role="tablist" aria-label="Axes" className="axes-tabs">
        {(["x", "y"] as const).map(key => <button key={key} role="tab"
          id={`axis-tab-${key}`} aria-controls={`axis-panel-${key}`}
          aria-selected={axis === key} onClick={() => setAxis(key)}
          onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); const next = key === "x" ? "y" : "x"; setAxis(next);
            document.getElementById(`axis-tab-${next}`)?.focus();
          } }} tabIndex={axis === key ? 0 : -1}>
          {key === "x" ? "X axis" : "Left Y axis"}
        </button>)}
      </div>
      <div role="tabpanel" id={`axis-panel-${axis}`} aria-labelledby={`axis-tab-${axis}`}>
        <fieldset><legend>Scale and range</legend>
          {categorical ? <p>The X axis shows dataset titles. Its positions follow the datasets on this graph.</p> : <>
            <label className="desktop-form-row"><span>Scale</span>
              <select aria-label="Axis scale" value={current.scale} onChange={e => change({
                scale: e.target.value as AxisSettings["scale"],
                ...(e.target.value === "log10" ? { majorInterval: "" } : {}),
              })}>
                <option value="auto">Automatic{axis === "x" && autoLogX ? " (Log 10 for this fit)" : " (Linear)"}</option>
                <option value="linear">Linear</option><option value="log10">Log 10</option>
              </select>
            </label>
            <label className="desktop-checkbox-label"><input type="checkbox"
              checked={!current.minimum && !current.maximum && !current.majorInterval}
              onChange={e => automatic(e.target.checked)} />Automatic range and interval</label>
            {(["minimum", "maximum", "majorInterval"] as const).map(key => <label key={key} className="desktop-form-row">
              <span>{key === "minimum" ? "Minimum" : key === "maximum" ? "Maximum" : "Major tick interval"}</span>
              <input aria-label={key === "minimum" ? "Axis minimum" : key === "maximum" ? "Axis maximum" : "Major tick interval"}
                inputMode="decimal" type="text" placeholder="Automatic" value={current[key]}
                disabled={key === "majorInterval" && logarithmic} onChange={e => change({ [key]: e.target.value })} />
            </label>)}
            <p className="axes-hint">Leave a limit blank for automatic range. Log scales display positive values only; the data and analyses stay unchanged.</p>
          </>}
          <label className="desktop-form-row"><span>Direction</span><select aria-label="Axis direction"
            value={current.reverse ? "reverse" : "standard"} onChange={e => change({ reverse: e.target.value === "reverse" })}>
            <option value="standard">Standard</option><option value="reverse">Reverse</option>
          </select></label>
        </fieldset>
        {!categorical && <fieldset><legend>Numbering</legend>
          <label className="desktop-form-row"><span>Number format</span>
            <select aria-label="Tick number format" value={current.numberFormat ? "decimal" : "auto"}
              onChange={e => change({ numberFormat: e.target.value === "auto" ? undefined : defaultAxisNumberFormat() })}>
              <option value="auto">Automatic</option><option value="decimal">Decimal</option>
            </select>
          </label>
          {current.numberFormat && <>
            <label className="desktop-form-row"><span>Decimal places</span>
              <select aria-label="Tick decimal places" value={current.numberFormat.decimals}
                onChange={e => changeNumberFormat({ decimals: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => <option value={i} key={i}>{i}</option>)}
              </select>
            </label>
            <label className="desktop-form-row"><span>Decimal separator</span>
              <select aria-label="Tick decimal separator" value={current.numberFormat.decimalSeparator}
                onChange={e => changeNumberFormat({ decimalSeparator: e.target.value as AxisNumberFormat["decimalSeparator"] })}>
                <option value=".">1.23</option><option value=",">1,23</option><option value="·">1·23</option>
              </select>
            </label>
            <label className="desktop-form-row"><span>Thousands separator</span>
              <select aria-label="Tick thousands separator" value={current.numberFormat.thousandsSeparator}
                onChange={e => changeNumberFormat({ thousandsSeparator: e.target.value as AxisNumberFormat["thousandsSeparator"] })}>
                <option value="">100000</option><option value=",">100,000</option>
                <option value=" ">100 000</option><option value="'">100&apos;000</option>
              </select>
            </label>
            <label className="desktop-form-row"><span>Prefix</span><input aria-label="Tick prefix" maxLength={64}
              value={current.numberFormat.prefix} onChange={e => changeNumberFormat({ prefix: e.target.value })} /></label>
            <label className="desktop-form-row"><span>Suffix</span><input aria-label="Tick suffix" maxLength={64}
              value={current.numberFormat.suffix} onChange={e => changeNumberFormat({ suffix: e.target.value })} /></label>
          </>}
          <p className="axes-hint">Example: <output aria-label="Tick label example">{current.numberFormat
            ? validAxisNumberFormat(current.numberFormat) ? formatAxisTick(1234.5678, current.numberFormat) : "Check format settings"
            : fmt(1234.5678)}</output></p>
        </fieldset>}
        <fieldset><legend>Appearance</legend>
          <label className="desktop-checkbox-label"><input type="checkbox" checked={current.showAxis}
            onChange={e => change({ showAxis: e.target.checked })} />Show axis line, ticks and tick labels</label>
          <label className="desktop-checkbox-label"><input type="checkbox" checked={current.showGrid}
            onChange={e => change({ showGrid: e.target.checked })} />Show major grid lines</label>
          <label className="desktop-form-row"><span>Axis title</span><input aria-label="Axis title" maxLength={100}
            value={axis === "x" ? titles.x_label : titles.y_label}
            onChange={e => setTitles(previous => ({ ...previous, [axis === "x" ? "x_label" : "y_label"]: e.target.value }))} /></label>
          <p className="axes-hint">The title remains independent of axis visibility. Clear the title to hide it.</p>
        </fieldset>
      </div>
      <div className="axes-error" role={problem || applyError ? "alert" : undefined}>{problem || applyError}</div>
    </div>
    <footer className="desktop-dialog-actions">
      <button onClick={onClose}>Cancel</button>
      <button disabled={!!problem || !axes} onClick={() => apply(false)}>Apply</button>
      <button className="primary" disabled={!!problem || !axes} onClick={() => apply(true)}>OK</button>
    </footer>
  </DesktopDialog>;
}
