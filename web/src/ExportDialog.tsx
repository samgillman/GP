import { useState } from "react";
import { DesktopDialog } from "./WorkbookDialogs";
import {
  DEFAULT_EXPORT,
  EXPORT_FORMATS,
  EXPORT_RESOLUTIONS,
  MAX_WIDTH,
  MIN_WIDTH,
  exportAbilities,
  exportFileName,
  exportPixels,
  exportProblem,
  exportRequest,
  loadExportDefaults,
  saveExportDefaults,
  withExtension,
} from "./export-options";
import type { ExportFormat, ExportOptions, ExportResolution } from "./export-options";

export type GraphExportRequest = ReturnType<typeof exportRequest>;

/** File > Export for a graph sheet, laid out like Prism for Mac's Export
 * sheet: name, file format, resolution, size and background. */
export default function ExportDialog({
  sheetName,
  onClose,
  onExport,
}: {
  sheetName: string;
  onClose: () => void;
  onExport: (fileName: string, request: GraphExportRequest) => void;
}) {
  const [options, setOptions] = useState<ExportOptions>(() => loadExportDefaults());
  const [name, setName] = useState(() => exportFileName(sheetName, options.format));
  const [widthText, setWidthText] = useState(String(options.width));
  const [makeDefault, setMakeDefault] = useState(false);
  const can = exportAbilities(options.format);
  const pixels = exportPixels(options);
  const problem = exportProblem(options, name);
  const update = (patch: Partial<ExportOptions>) => setOptions((old) => ({ ...old, ...patch }));
  function chooseFormat(format: ExportFormat) {
    update({ format });
    setName((old) => withExtension(old.trim() || exportFileName(sheetName, format), format));
  }
  function restoreDefaults() {
    saveExportDefaults(null);
    setMakeDefault(false);
    setOptions(DEFAULT_EXPORT);
    setWidthText(String(DEFAULT_EXPORT.width));
    setName((old) => withExtension(old, DEFAULT_EXPORT.format));
  }
  function submit() {
    if (problem) return;
    if (makeDefault) saveExportDefaults(options);
    onExport(name.trim(), exportRequest(options));
  }
  return (
    <DesktopDialog
      title="Export"
      titleId="export-title"
      className="prism-export"
      onClose={onClose}
    >
      <form
        className="desktop-dialog-body export-body"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="export-field">
          <span>Export As:</span>
          <input
            data-autofocus
            aria-label="Export As:"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <hr />
        <label className="export-field">
          <span>File Format:</span>
          <select
            aria-label="File Format:"
            value={options.format}
            onChange={(e) => chooseFormat(e.target.value as ExportFormat)}
          >
            {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((format) => (
              <option key={format} value={format}>
                {EXPORT_FORMATS[format].label}
              </option>
            ))}
          </select>
        </label>
        <p className="export-format-note">{EXPORT_FORMATS[options.format].description}</p>
        <hr />
        <div className="export-options">
          <div className="export-resolution">
            <label className={can.resolution ? "" : "is-disabled"}>
              <span>Resolution:</span>
              <select
                aria-label="Resolution"
                value={options.dpi}
                disabled={!can.resolution}
                title={can.resolution ? undefined : "Vector formats have no resolution"}
                onChange={(e) => update({ dpi: Number(e.target.value) as ExportResolution })}
              >
                {EXPORT_RESOLUTIONS.map((dpi) => (
                  <option key={dpi} value={dpi}>
                    {dpi}
                  </option>
                ))}
              </select>
              <span>dpi</span>
            </label>
            {pixels && (
              <p className="export-pixels" aria-live="polite">
                {pixels[0].toLocaleString()} × {pixels[1].toLocaleString()} pixels
              </p>
            )}
          </div>
          <div className="export-choices">
            <div className="export-choice-row" role="radiogroup" aria-label="Size">
              <span className="export-choice-label">Size:</span>
              <label>
                <input
                  type="radio"
                  name="export-size"
                  checked={options.size === "actual" || !can.resize}
                  onChange={() => update({ size: "actual" })}
                />
                Actual
              </label>
              <label
                className={can.resize ? "" : "is-disabled"}
                title={can.resize ? undefined : "PDF exports at the graph's actual size in GP"}
              >
                <input
                  type="radio"
                  name="export-size"
                  checked={can.resize && options.size === "width"}
                  disabled={!can.resize}
                  onChange={() => update({ size: "width" })}
                />
                Enlarge/shrink to make width
              </label>
              <input
                className="export-width"
                type="number"
                aria-label="Width in inches"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={0.1}
                value={widthText}
                disabled={!can.resize || options.size !== "width"}
                onChange={(e) => {
                  setWidthText(e.target.value);
                  update({ width: e.target.value.trim() ? Number(e.target.value) : Number.NaN });
                }}
              />
              <span>inches</span>
            </div>
            <div className="export-choice-row" role="radiogroup" aria-label="Background Color">
              <span className="export-choice-label">Background Color:</span>
              <label>
                <input
                  type="radio"
                  name="export-background"
                  checked={options.background === "white" || !can.clear}
                  onChange={() => update({ background: "white" })}
                />
                White
              </label>
              <label
                className={can.clear ? "" : "is-disabled"}
                title={can.clear ? undefined : "JPEG cannot store a clear background"}
              >
                <input
                  type="radio"
                  name="export-background"
                  checked={can.clear && options.background === "clear"}
                  disabled={!can.clear}
                  onChange={() => update({ background: "clear" })}
                />
                Clear
              </label>
            </div>
          </div>
        </div>
        <hr />
        <div className="export-defaults">
          <label>
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={(e) => setMakeDefault(e.target.checked)}
            />
            Make these options become the default
          </label>
          <button type="button" onClick={restoreDefaults}>
            Restore the original defaults
          </button>
        </div>
        {problem && name.trim() && (
          <p className="export-problem" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" disabled={Boolean(problem)} onClick={submit}>
          Export
        </button>
      </footer>
    </DesktopDialog>
  );
}
