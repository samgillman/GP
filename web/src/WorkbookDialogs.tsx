import { useState } from "react";
import type { Analysis, Graph, Project, TableType } from "./data";
import type { GraphSheet, ResultSheet } from "./workbook";
import { dataIndices } from "./workbook";
export const analysisLabels: Record<Analysis, string> = {
  descriptive: "Descriptive statistics",
  welch_t: "Unpaired t test (Welch)",
  paired_t: "Paired t test",
  anova: "One-way ANOVA",
  linear_regression: "Linear regression",
  dose_response: "Dose–response (4PL)",
  nonlinear_regression: "Nonlinear regression",
};
export function NewTableDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (type: TableType, name: string) => void;
}) {
  const [type, setType] = useState<TableType>("column"),
    [name, setName] = useState("New data table");
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-table-title"
      >
        <h2 id="new-table-title">New Data Table and Graph</h2>
        <p>Create a linked data table and graph in this workbook.</p>
        <label>
          Kind of table
          <select
            aria-label="New table type"
            value={type}
            onChange={(e) => setType(e.target.value as TableType)}
          >
            <option value="column">Column</option>
            <option value="xy">XY</option>
          </select>
        </label>
        <label>
          Table name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>
          Grouped and survival workflows are available in their separate
          analysis workspace.
        </p>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!name.trim()}
            onClick={() => onCreate(type, name.trim())}
          >
            Create table and graph
          </button>
        </div>
      </section>
    </div>
  );
}
export function AnalyzeDialog({
  project,
  onClose,
  onRun,
}: {
  project: Project;
  onClose: () => void;
  onRun: (analysis: Analysis, indices: number[], prefix: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [analysis, setAnalysis] = useState(project.analysis),
    [selected, setSelected] = useState(dataIndices(project)),
    [prefix, setPrefix] = useState("");
  const eligible = Object.entries(analysisLabels).filter(([key]) =>
    project.table_type === "xy"
      ? [
          "descriptive",
          "linear_regression",
          "dose_response",
          "nonlinear_regression",
        ].includes(key)
      : ![
          "linear_regression",
          "dose_response",
          "nonlinear_regression",
        ].includes(key),
  );
  return (
    <div className="modal-backdrop">
      <section
        className="modal analyze-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analyze-title"
      >
        <h2 id="analyze-title">Analyze Data</h2>
        <p>Table: {project.name}. Create a separate linked result sheet.</p>
        <div className="analysis-chooser">
          <div>
            <h3>Which analysis?</h3>
            <input
              aria-label="Search analyses"
              placeholder="Search analyses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="method-list">
              {eligible
                .filter(([, label]) =>
                  label.toLowerCase().includes(search.toLowerCase()),
                )
                .map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="radio"
                      name="analysis-choice"
                      checked={analysis === key}
                      onChange={() => setAnalysis(key as Analysis)}
                    />
                    {label}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <h3>Analyze which data sets?</h3>
            <div className="selection-actions">
              <button onClick={() => setSelected(dataIndices(project))}>
                Select All
              </button>
              <button onClick={() => setSelected([])}>Deselect All</button>
            </div>
            {dataIndices(project).map((i) => (
              <label className="dataset-option" key={i}>
                <input
                  type="checkbox"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, i].sort((a, b) => a - b)
                        : old.filter((v) => v !== i),
                    )
                  }
                />
                {project.columns[i].name}
              </label>
            ))}
          </div>
        </div>
        {analysis === "nonlinear_regression" && (
          <p>
            Model: {project.regression_model ?? "one_phase_decay"}. Choose
            another model in the analysis toolbar before opening this dialog.
          </p>
        )}
        <label>
          Prefix sheet names with
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!selected.length}
            onClick={() => onRun(analysis, selected, prefix)}
          >
            Create analysis
          </button>
        </div>
      </section>
    </div>
  );
}
export function FormatGraphDialog({
  sheet,
  project,
  results,
  onClose,
  onApply,
}: {
  sheet: GraphSheet;
  project: Project;
  results: ResultSheet[];
  onClose: () => void;
  onApply: (next: GraphSheet) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(sheet)),
    [tab, setTab] = useState("Appearance");
  function g(p: Partial<Graph>) {
    setDraft((v) => ({ ...v, graph: { ...v.graph, ...p } }));
  }
  function move(i: number, d: number) {
    setDraft((v) => {
      const a = [...v.columnIndices];
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return { ...v, columnIndices: a };
    });
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal format-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="format-title"
      >
        <h2 id="format-title">Format Graph</h2>
        <div className="dialog-tabs">
          {["Appearance", "Data Sets on Graph", "Graph Settings"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "Appearance" ? (
          <div className="option-grid">
            <label>
              Graph type
              <select
                value={draft.graph.type}
                onChange={(e) => g({ type: e.target.value as Graph["type"] })}
              >
                {(project.table_type === "xy"
                  ? ["scatter", "line"]
                  : ["scatter", "bar", "box"]
                ).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Error bars
              <select
                disabled={
                  project.table_type === "xy" || draft.graph.type === "box"
                }
                value={draft.graph.error}
                onChange={(e) => g({ error: e.target.value as Graph["error"] })}
              >
                <option value="none">None</option>
                <option value="sd">SD</option>
                <option value="sem">SEM</option>
                <option value="ci">95% CI</option>
              </select>
            </label>
            <label>
              Title
              <input
                value={draft.graph.title}
                onChange={(e) => g({ title: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.graph.show_points}
                onChange={(e) => g({ show_points: e.target.checked })}
              />
              Show individual points
            </label>
            <label>
              X axis
              <input
                value={draft.graph.x_label}
                onChange={(e) => g({ x_label: e.target.value })}
              />
            </label>
            <label>
              Y axis
              <input
                value={draft.graph.y_label}
                onChange={(e) => g({ y_label: e.target.value })}
              />
            </label>
            {draft.columnIndices.map((i, pos) => (
              <label key={i}>
                {project.columns[i].name} color
                <input
                  type="color"
                  value={
                    draft.graph.colors[pos % draft.graph.colors.length] ??
                    "#20867e"
                  }
                  onChange={(e) => {
                    const colors = [...draft.graph.colors];
                    while (colors.length <= pos) colors.push("#20867e");
                    colors[pos] = e.target.value;
                    g({ colors });
                  }}
                />
              </label>
            ))}
          </div>
        ) : tab === "Data Sets on Graph" ? (
          <>
            <p>
              Selection and drawing order are saved separately for this graph.
            </p>
            {dataIndices(project).map((i) => (
              <label className="dataset-option" key={i}>
                <input
                  type="checkbox"
                  checked={draft.columnIndices.includes(i)}
                  onChange={(e) =>
                    setDraft((v) => ({
                      ...v,
                      columnIndices: e.target.checked
                        ? [...v.columnIndices, i]
                        : v.columnIndices.filter((n) => n !== i),
                    }))
                  }
                />
                {project.columns[i].name}
              </label>
            ))}
            <ol className="graph-dataset-order">
              {draft.columnIndices.map((i, pos) => (
                <li key={i}>
                  {project.columns[i].name}
                  <button
                    aria-label={`Move ${project.columns[i].name} up`}
                    disabled={pos === 0}
                    onClick={() => move(pos, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${project.columns[i].name} down`}
                    disabled={pos === draft.columnIndices.length - 1}
                    onClick={() => move(pos, 1)}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <label>
              Linked analysis result
              <select
                value={draft.resultId ?? ""}
                onChange={(e) =>
                  setDraft((v) => ({ ...v, resultId: e.target.value || null }))
                }
              >
                <option value="">None — raw observations</option>
                {results.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.status === "stale" ? " (needs recalculation)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p>
              A current linked result supplies fitted curves and confidence
              intervals. Editing source data clears linked outputs until you
              recalculate. This explicit recalculation behavior is GP's
              implementation.
            </p>
          </>
        )}
        <div className="modal-actions">
          <button className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button"
            disabled={!draft.columnIndices.length}
            onClick={() => onApply(draft)}
          >
            Apply
          </button>
          <button
            className="button primary"
            disabled={!draft.columnIndices.length}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            OK
          </button>
        </div>
        <p>
          Apply keeps this dialog open. Cancel discards changes since the last
          Apply.
        </p>
      </section>
    </div>
  );
}
