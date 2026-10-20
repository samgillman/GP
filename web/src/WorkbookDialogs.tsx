import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Analysis, Graph, Project, TableType } from "./data";
import type { GraphSheet, ResultSheet } from "./workbook";
import { dataIndices } from "./workbook";
import {
  comparisonChoices,
  comparisonDisclosures,
  comparisonOptionsProblem,
  methodLabels,
  normalizeComparisonOptions,
  pairwiseMethodDescription,
  testName,
} from "./column-analysis";
import type {
  ComparisonAnalysis,
  ComparisonMethod,
  ComparisonOptions,
} from "./column-analysis";
import "./dialog-desktop.css";
import "./graph-datasets-dialog.css";
import { colorsForDatasetIds, frontToBackDatasets, seedDatasetColors, reorderGraphDatasets, reorderColumnGraphDatasets } from "./graph-dataset-order";
import type { DatasetOrderAction } from "./graph-dataset-order";

function datasetLetter(index: number) {
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  return label;
}

export function DesktopDialog({
  title,
  titleId,
  className = "",
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current!;
    const focusable = () =>
      [
        ...element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length > 0);
    (
      element.querySelector<HTMLElement>("[data-autofocus]") ??
      focusable()[0] ??
      element
    ).focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          event.preventDefault();
          element.focus();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function containFocus(event: FocusEvent) {
      if (event.target instanceof Node && !element.contains(event.target))
        (focusable()[0] ?? element).focus();
    }
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="desktop-dialog-backdrop">
      <section
        ref={panel}
        className={`desktop-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="desktop-dialog-titlebar">
          <button
            className="desktop-dialog-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            ×
          </button>
          <h2 id={titleId}>{title}</h2>
        </header>
        {children}
      </section>
    </div>
  );
}
export const analysisLabels: Record<Analysis, string> = {
  descriptive: "Descriptive statistics",
  welch_t: "Unpaired t test (Welch)",
  paired_t: "Paired t test",
  anova: "One-way ANOVA",
  t_test: "t tests (and nonparametric tests)",
  one_way_anova: "One-way ANOVA (and nonparametric tests)",
  linear_regression: "Linear regression",
  dose_response: "Dose–response (4PL)",
  nonlinear_regression: "Nonlinear regression",
};
export const regressionModels = [
  ["one_phase_decay", "One-phase decay"],
  ["one_phase_association", "One-phase association"],
  ["two_phase_decay", "Two-phase decay"],
  ["michaelis_menten", "Michaelis–Menten"],
  ["gaussian", "Gaussian"],
  ["straight_line", "Straight line"],
  ["log_dose_stimulation", "Log-dose stimulation"],
  ["log_dose_inhibition", "Log-dose inhibition"],
  ["normalized_dose_inhibition", "Normalized inhibition (concentration)"],
  ["normalized_log_dose_inhibition", "Normalized inhibition (log concentration)"],
] as const;
/** Change > Format Data Table…: only the table kind GP currently supports. */
export function FormatDataTableDialog({
  tableType,
  onClose,
  onApply,
}: {
  tableType: TableType;
  onClose: () => void;
  onApply: (type: TableType) => void;
}) {
  const [type, setType] = useState(tableType);
  return (
    <DesktopDialog
      title="Format Data Table"
      titleId="format-table-title"
      className="desktop-format-table"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        <fieldset>
          <legend>Kind of table</legend>
          {(
            [
              ["xy", "XY"],
              ["column", "Column"],
            ] as const
          ).map(([value, label]) => (
            <label className="desktop-choice" key={value}>
              <input
                type="radio"
                name="format-table-kind"
                data-autofocus={type === value || undefined}
                checked={type === value}
                onChange={() => setType(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="desktop-help-text">
          Switching between Column and XY keeps every entered value; the first
          column becomes or stops being X. Other table kinds are not yet
          available.
        </p>
      </div>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" onClick={() => onApply(type)}>
          OK
        </button>
      </footer>
    </DesktopDialog>
  );
}
const graphTypeChoices = {
  column: [
    ["scatter", true, "Scatter dot plot"],
    ["bar", true, "Bars with individual points"],
    ["bar", false, "Bars"],
    ["box", false, "Box and whiskers"],
  ],
  xy: [
    ["scatter", true, "Points only"],
    ["line", true, "Points and connecting line"],
  ],
} as const satisfies Record<TableType, readonly (readonly [Graph["type"], boolean, string])[]>;
/** Change > Change Graph Type…: GP's subset of the graph families. */
export function ChangeGraphTypeDialog({
  tableType,
  graph,
  onClose,
  onApply,
}: {
  tableType: TableType;
  graph: Graph;
  onClose: () => void;
  onApply: (type: Graph["type"], showPoints: boolean) => void;
}) {
  const choices = graphTypeChoices[tableType];
  const current = Math.max(
    0,
    choices.findIndex(
      ([type, points]) =>
        type === graph.type &&
        (type === "scatter" || type === "box" || points === graph.show_points),
    ),
  );
  const [choice, setChoice] = useState(current);
  return (
    <DesktopDialog
      title="Change Graph Type"
      titleId="graph-type-title"
      className="desktop-format-table"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        <fieldset>
          <legend>{tableType === "xy" ? "XY" : "Column"}</legend>
          {choices.map(([type, points, label], index) => (
            <label className="desktop-choice" key={label}>
              <input
                type="radio"
                name="graph-type-choice"
                data-autofocus={index === choice || undefined}
                checked={index === choice}
                onChange={() => setChoice(index)}
              />
              <span
                aria-hidden="true"
                className={`desktop-graph-icon ${type}${points ? " points" : ""}`}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="desktop-help-text">
          Data sets, colors and titles are kept when the graph type changes.
        </p>
      </div>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={() => onApply(choices[choice][0], choices[choice][1])}
        >
          OK
        </button>
      </footer>
    </DesktopDialog>
  );
}
export function NewTableDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (type: TableType, name: string, sampleData: boolean) => void;
}) {
  const [type, setType] = useState<TableType>("column"),
    [name, setName] = useState("New data table"),
    [sampleData, setSampleData] = useState(false);
  return (
    <DesktopDialog
      title="New Data Table and Graph"
      titleId="new-table-title"
      className="desktop-new-table"
      onClose={onClose}
    >
      <div className="desktop-new-content">
        <nav className="desktop-family-list" aria-label="Table families">
          <h3>New table & graph</h3>
          {(
            [
              ["xy", "XY"],
              ["column", "Column"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={type === value}
              className={type === value ? "selected" : ""}
              onClick={() => setType(value)}
            >
              <span
                aria-hidden="true"
                className={`desktop-table-icon ${value}`}
              />
              {label}
            </button>
          ))}
          {[
            "Grouped",
            "Contingency",
            "Survival",
            "Parts of whole",
            "Multiple variables",
            "Nested",
          ].map((label) => (
            <button
              disabled
              key={label}
              title="Not available in this workbook editor"
            >
              <span aria-hidden="true" className="desktop-table-icon" />
              {label}
            </button>
          ))}
          <p>Additional table families are not yet available in this editor.</p>
        </nav>
        <div className="desktop-new-settings">
          <h3>{type === "column" ? "Column" : "XY"} data table</h3>
          <p>
            {type === "column"
              ? "Enter each group in a separate column. Stack independent or matched observations down the rows."
              : "Enter X values in the first column, with each Y data set in a separate column."}
          </p>
          <fieldset>
            <legend>Data table</legend>
            <label className="desktop-choice">
              <input
                type="radio"
                name="new-table-data"
                checked={!sampleData}
                onChange={() => setSampleData(false)}
              />
              Enter or import data into a new table
            </label>
            <label className="desktop-choice">
              <input
                type="radio"
                name="new-table-data"
                checked={sampleData}
                onChange={() => setSampleData(true)}
              />
              Start with sample data
            </label>
            <label className="desktop-form-row">
              <span>Kind of table:</span>
              <select
                aria-label="New table type"
                value={type}
                onChange={(e) => setType(e.target.value as TableType)}
              >
                <option value="column">Column</option>
                <option value="xy">XY</option>
              </select>
            </label>
            {!sampleData && (
              <label className="desktop-form-row">
                <span>Table name</span>
                <input
                  data-autofocus
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>Data entry</legend>
            <p>
              {type === "xy"
                ? "Enter and plot a single Y value for each point."
                : "Enter replicate values, stacked into columns."}
            </p>
            <p className="desktop-help-text">
              You can paste a spreadsheet or import CSV after creating the
              table.
            </p>
          </fieldset>
          <div
            className="desktop-table-preview"
            aria-label={`${type === "xy" ? "XY" : "Column"} table preview`}
          >
            <table>
              <thead>
                <tr>
                  <th></th>
                  {(type === "xy"
                    ? ["X", "A: Y1", "B: Y2"]
                    : ["A: Group A", "B: Group B"]
                  ).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    <th>{row}</th>
                    {Array.from(
                      { length: type === "xy" ? 3 : 2 },
                      (_, index) => (
                        <td key={index} />
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="desktop-help-text">
            Creates a data sheet and a linked graph in this workbook.
          </p>
        </div>
      </div>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!sampleData && !name.trim()}
          onClick={() => onCreate(type, name.trim(), sampleData)}
        >
          Create table and graph
        </button>
      </footer>
    </DesktopDialog>
  );
}
export function AnalyzeDialog({
  project,
  onClose,
  onRun,
}: {
  project: Project;
  onClose: () => void;
  onRun: (
    analysis: Analysis,
    indices: number[],
    prefix: string,
    regressionModel: string,
  ) => void;
}) {
  // The single-test entries remain readable in saved results but new analyses
  // use the Prism families with their parameter dialogs.
  const offered: Analysis[] =
    project.table_type === "xy"
      ? ["descriptive", "linear_regression", "dose_response", "nonlinear_regression"]
      : ["descriptive", "t_test", "one_way_anova"];
  const [search, setSearch] = useState(""),
    [analysis, setAnalysis] = useState<Analysis>(
      offered.includes(project.analysis) ? project.analysis : offered[0],
    ),
    [model, setModel] = useState(
      project.regression_model ?? "one_phase_decay",
    ),
    [selected, setSelected] = useState(dataIndices(project)),
    [prefix, setPrefix] = useState("");
  const eligible = offered.map((key) => [key, analysisLabels[key]] as const);
  return (
    <DesktopDialog
      title="Analyze Data"
      titleId="analyze-title"
      className="desktop-analyze"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        <label className="desktop-form-row desktop-source-table">
          <span>Table:</span>
          <input value={project.name} readOnly />
        </label>
        <div className="desktop-analysis-chooser">
          <div>
            <h3>Which analysis?</h3>
            <input
              data-autofocus
              className="desktop-search"
              aria-label="Search analyses"
              placeholder="Search analyses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              className="desktop-method-list"
              role="radiogroup"
              aria-label="Available analyses"
            >
              <div className="desktop-analysis-category">
                <span aria-hidden="true">▾</span>{" "}
                {project.table_type === "xy"
                  ? "XY analyses"
                  : "Column analyses"}
              </div>
              {eligible
                .filter(([, label]) =>
                  label.toLowerCase().includes(search.toLowerCase()),
                )
                .map(([key, label]) => (
                  <label
                    key={key}
                    className={analysis === key ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="analysis-choice"
                      checked={analysis === key}
                      onChange={() => setAnalysis(key as Analysis)}
                    />
                    {label}
                  </label>
                ))}
              {!eligible.some(([, label]) =>
                label.toLowerCase().includes(search.toLowerCase()),
              ) && <p className="desktop-empty">No matching items found</p>}
            </div>
            <p className="desktop-help-text">
              Only analyses supported for this table are listed.
            </p>
          </div>
          <div>
            <h3>Analyze which data sets?</h3>
            <div className="desktop-dataset-list">
              {dataIndices(project).map((i, position) => (
                <label className="desktop-dataset-option" key={i}>
                  <input
                    type="checkbox"
                    aria-label={project.columns[i].name}
                    checked={selected.includes(i)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, i].sort((a, b) => a - b)
                          : old.filter((v) => v !== i),
                      )
                    }
                  />
                  <span aria-hidden="true" className="desktop-dataset-letter">
                    {datasetLetter(position)}:
                  </span>{" "}
                  {project.columns[i].name}
                </label>
              ))}
            </div>
            <div className="selection-actions">
              <button onClick={() => setSelected(dataIndices(project))}>
                Select All
              </button>
              <button onClick={() => setSelected([])}>Deselect All</button>
            </div>
            <p className="desktop-help-text">
              {selected.length} of {dataIndices(project).length} data sets
              selected
              {project.table_type === "xy"
                ? ". X values are included automatically."
                : "."}
            </p>
          </div>
        </div>
        <div className="desktop-analysis-description">
          <strong>{analysisLabels[analysis]}</strong>
          <p>
            {
              (
                {
                  descriptive:
                    "Summarize the selected data sets with sample size, mean, SD, SEM and confidence intervals.",
                  welch_t:
                    "Compare two independent groups without assuming equal variances.",
                  paired_t:
                    "Compare two matched groups. Matching follows the rows of the data table.",
                  anova:
                    "Compare the means of two or more independent groups using ordinary one-way ANOVA.",
                  t_test:
                    "Compare two data sets: unpaired or paired t tests, Welch's test, Mann-Whitney or Wilcoxon. Choose the test on the next screen.",
                  one_way_anova:
                    "Compare three or more data sets: ordinary, Welch or repeated-measures ANOVA, Kruskal-Wallis or Friedman, with multiple comparisons. Choose on the next screen.",
                  linear_regression:
                    "Fit a straight line to each selected Y data set against X.",
                  dose_response:
                    "Fit a four-parameter dose–response curve to positive X values.",
                  nonlinear_regression:
                    "Fit the selected nonlinear model to each Y data set.",
                } satisfies Record<Analysis, string>
              )[analysis]
            }
          </p>
        </div>
        {analysis === "nonlinear_regression" && (
          <label className="desktop-form-row">
            <span>Model</span>
            <select
              aria-label="Regression model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {regressionModels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="desktop-form-row desktop-prefix">
          <span>Prefix sheet names with</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </label>
      </div>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!selected.length}
          onClick={() => onRun(analysis, selected, prefix, model)}
        >
          Create analysis
        </button>
      </footer>
    </DesktopDialog>
  );
}
function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="desktop-choice">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/** The parameters dialog shown after choosing t tests or one-way ANOVA. */
export function ParametersDialog({
  analysis,
  names,
  initial,
  onClose,
  onApply,
}: {
  analysis: ComparisonAnalysis;
  names: string[];
  initial: ComparisonOptions;
  onClose: () => void;
  onApply: (options: ComparisonOptions) => void;
}) {
  const tTest = analysis === "t_test";
  const tabs = tTest
    ? ["Experimental Design", "Options"]
    : ["Experimental Design", "Multiple Comparisons", "Options"];
  const [tab, setTab] = useState(tabs[0]),
    [draft, setDraft] = useState(() =>
      normalizeComparisonOptions(initial, names.length),
    );
  const set = (patch: Partial<ComparisonOptions>) =>
    setDraft((old) => normalizeComparisonOptions({ ...old, ...patch }, names.length));
  const choices = comparisonChoices(draft);
  const [a, b] = names;
  const problem = comparisonOptionsProblem(analysis, draft, names.length);
  const disclosures = comparisonDisclosures(analysis, draft);
  return (
    <DesktopDialog
      title={`Parameters: ${analysisLabels[analysis]}`}
      titleId="parameters-title"
      className="desktop-parameters"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        <div
          className="desktop-dialog-tabs"
          role="tablist"
          aria-label="Parameter pages"
        >
          {tabs.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tab}>
        {tab === "Experimental Design" && (
          <>
            <fieldset>
              <legend>Experimental design</legend>
              <Choice name="design" checked={!draft.paired} onChange={() => set({ paired: false })}>
                {tTest ? "Unpaired" : "No matching or pairing"}
              </Choice>
              <Choice name="design" checked={draft.paired} onChange={() => set({ paired: true })}>
                {tTest ? "Paired" : "Each row represents matched, or repeated measures, data"}
              </Choice>
            </fieldset>
            <fieldset>
              <legend>
                {tTest ? "Assume Gaussian distribution?" : "Assume Gaussian distribution of residuals?"}
              </legend>
              <Choice name="gaussian" checked={draft.gaussian} onChange={() => set({ gaussian: true })}>
                {tTest ? "Yes. Use parametric test." : "Yes. Use ANOVA."}
              </Choice>
              <Choice name="gaussian" checked={!draft.gaussian} onChange={() => set({ gaussian: false })}>
                No. Use nonparametric test.
              </Choice>
            </fieldset>
            {draft.gaussian && !draft.paired && (
              <fieldset>
                <legend>{tTest ? "Choose test" : "Assume equal SDs?"}</legend>
                <Choice name="sd" checked={draft.equal_sd} onChange={() => set({ equal_sd: true })}>
                  {tTest
                    ? "Unpaired t test. Assume both populations have the same SD."
                    : "Yes. Use ordinary ANOVA test."}
                </Choice>
                <Choice name="sd" checked={!draft.equal_sd} onChange={() => set({ equal_sd: false })}>
                  {tTest
                    ? "Unpaired t test with Welch's correction. Do not assume equal SDs."
                    : "No. Use Brown-Forsythe and Welch ANOVA tests."}
                </Choice>
              </fieldset>
            )}
            {!tTest && draft.gaussian && draft.paired && (
              <fieldset>
                <legend>Assume sphericity (equal variability of differences)?</legend>
                <Choice
                  name="sphericity"
                  checked={draft.sphericity === "geisser_greenhouse"}
                  onChange={() => set({ sphericity: "geisser_greenhouse" })}
                >
                  No. Use the Geisser-Greenhouse correction. Recommended.
                </Choice>
                <Choice
                  name="sphericity"
                  checked={draft.sphericity === "assume"}
                  onChange={() => set({ sphericity: "assume" })}
                >
                  Yes. No correction.
                </Choice>
              </fieldset>
            )}
            <p className="desktop-help-text">
              Test: <strong>{testName(analysis, draft)}</strong>
              {tTest && !draft.gaussian
                ? draft.paired
                  ? " — compares the ranks of paired differences."
                  : " — compares ranks."
                : ""}
            </p>
          </>
        )}
        {tab === "Multiple Comparisons" && (
          <fieldset>
            <legend>Follow-up tests</legend>
            <Choice name="comparisons" checked={draft.comparisons === "none"} onChange={() => set({ comparisons: "none" })}>
              No multiple comparisons
            </Choice>
            {choices.all_pairs && (
              <Choice
                name="comparisons"
                checked={draft.comparisons === "all_pairs"}
                onChange={() => set({ comparisons: "all_pairs" })}
              >
                Compare the {draft.gaussian ? "mean" : "mean rank"} of each column with the{" "}
                {draft.gaussian ? "mean" : "mean rank"} of every other column
              </Choice>
            )}
            {choices.vs_control && (
              <Choice
                name="comparisons"
                checked={draft.comparisons === "vs_control"}
                onChange={() => set({ comparisons: "vs_control" })}
              >
                Compare the {draft.gaussian ? "mean" : "mean rank"} of each column with the{" "}
                {draft.gaussian ? "mean" : "mean rank"} of a control column
              </Choice>
            )}
            {draft.comparisons === "vs_control" && (
              <label className="desktop-form-row">
                <span>Control column</span>
                <select
                  aria-label="Control column"
                  value={draft.control}
                  onChange={(e) => set({ control: Number(e.target.value) })}
                >
                  {draft.control >= names.length && (
                    <option value={draft.control} disabled>Selected control is unavailable</option>
                  )}
                  {names.map((name, index) => (
                    <option key={index} value={index}>
                      {datasetLetter(index)}: {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!choices.vs_control && (
              <p className="desktop-help-text">
                With unequal SDs GP compares every pair (Games-Howell).
              </p>
            )}
          </fieldset>
        )}
        {tab === "Options" && (
          <>
            {!tTest && draft.comparisons !== "none" && (
              <fieldset>
                <legend>Multiple comparisons test</legend>
                <label className="desktop-form-row">
                  <span>Test</span>
                  <select
                    aria-label="Multiple comparisons test"
                    value={draft.method ?? ""}
                    onChange={(e) => set({ method: e.target.value as ComparisonMethod })}
                  >
                    {draft.method && !(choices[draft.comparisons] ?? []).includes(draft.method) && (
                      <option value={draft.method} disabled>
                        {methodLabels[draft.method]} — unsupported for this design
                      </option>
                    )}
                    {(choices[draft.comparisons] ?? []).map((method) => (
                      <option key={method} value={method}>
                        {methodLabels[method]}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
            )}
            {tTest && (
              <fieldset>
                <legend>Calculations</legend>
                <Choice name="tails" checked={draft.tails === 2} onChange={() => set({ tails: 2 })}>
                  Two-tailed P value (recommended)
                </Choice>
                <Choice name="tails" checked={draft.tails === 1} onChange={() => set({ tails: 1 })}>
                  One-tailed P value
                </Choice>
                {draft.tails === 1 && (
                  <label className="desktop-form-row">
                    <span>Prespecified directional hypothesis</span>
                    <select
                      aria-label="Prespecified directional hypothesis"
                      value={draft.alternative ?? ""}
                      onChange={(e) => set({ alternative: e.target.value as "a_greater" | "b_greater" })}
                    >
                      <option value="" disabled>Choose the direction specified before seeing the data</option>
                      <option value="a_greater">{a ?? "A"} &gt; {b ?? "B"}</option>
                      <option value="b_greater">{b ?? "B"} &gt; {a ?? "A"}</option>
                    </select>
                  </label>
                )}
                <label className="desktop-form-row">
                  <span>Report differences as</span>
                  <select
                    aria-label="Report differences as"
                    value={draft.reverse_difference ? "a-b" : "b-a"}
                    onChange={(e) => set({ reverse_difference: e.target.value === "a-b" })}
                  >
                    <option value="b-a">{b ?? "B"} − {a ?? "A"}</option>
                    <option value="a-b">{a ?? "A"} − {b ?? "B"}</option>
                  </select>
                </label>
              </fieldset>
            )}
            <fieldset>
              <legend>Significance</legend>
              <label className="desktop-form-row">
                <span>Significance level (alpha)</span>
                <select
                  aria-label="Significance level (alpha)"
                  value={draft.alpha}
                  onChange={(e) => set({ alpha: Number(e.target.value) })}
                >
                  {![0.1, 0.05, 0.01, 0.001].includes(draft.alpha) && (
                    <option value={draft.alpha}>{draft.alpha}</option>
                  )}
                  {[0.1, 0.05, 0.01, 0.001].map((alpha) => (
                    <option key={alpha} value={alpha}>
                      {alpha}
                    </option>
                  ))}
                </select>
              </label>
              <p className="desktop-help-text">
                P values use the GraphPad style: ns P &gt; 0.05, * P ≤ 0.05, ** P ≤
                0.01, *** P ≤ 0.001, **** P ≤ 0.0001. Confidence intervals are two-sided 95%.
              </p>
            </fieldset>
          </>
        )}
        {problem && <p className="result-warning" role="alert">{problem}</p>}
        </div>
        <section className="analysis-method-notes" aria-label="Method and limitations">
          <h3>Method and limitations</h3>
          <ul>{disclosures.map((note) => <li key={note}>{note}</li>)}</ul>
        </section>
      </div>
      <footer className="desktop-dialog-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!!problem}
          onClick={() => onApply(draft)}
        >
          OK
        </button>
      </footer>
    </DesktopDialog>
  );
}
/** Change → Add Pairwise Comparisons…: brackets from a t test or one-way ANOVA. */
export function PairwiseDialog({
  analyses,
  initial,
  onClose,
  onApply,
}: {
  analyses: {
    id: string;
    name: string;
    analysis: ComparisonAnalysis;
    options: ComparisonOptions;
    datasets: number;
    historical: boolean;
  }[];
  initial: { resultId: string | null; style: "asterisks" | "p"; show_ns: boolean } | null;
  onClose: () => void;
  onApply: (
    choice: { resultId: string; style: "asterisks" | "p"; show_ns: boolean } | null,
  ) => void;
}) {
  const [resultId, setResultId] = useState(
    initial?.resultId && analyses.some((a) => a.id === initial.resultId)
      ? initial.resultId
      : (analyses[0]?.id ?? ""),
  );
  const [style, setStyle] = useState(initial?.style ?? "asterisks"),
    [showNs, setShowNs] = useState(initial?.show_ns ?? true);
  const selected = analyses.find((analysis) => analysis.id === resultId);
  return (
    <DesktopDialog
      title="Add Pairwise Comparisons"
      titleId="pairwise-title"
      className="desktop-format-table"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        {analyses.length ? (
          <>
            <label className="desktop-form-row">
              <span>Analysis</span>
              <select
                aria-label="Comparison analysis"
                value={resultId}
                onChange={(e) => setResultId(e.target.value)}
              >
                {analyses.map((analysis) => (
                  <option key={analysis.id} value={analysis.id}>
                    {analysis.name}
                  </option>
                ))}
              </select>
            </label>
            {selected && !selected.historical && (
              <p className="desktop-help-text" role="note">
                {pairwiseMethodDescription(selected.analysis, selected.options, selected.datasets)}
              </p>
            )}
            {selected?.historical && (
              <p className="result-warning" role="alert">
                Historical result from an earlier statistical engine. Unfreeze and recalculate before using the revised methods.
                Historical bracket visibility retains the earlier fixed star thresholds, which may differ from the selected alpha.
              </p>
            )}
            <fieldset>
              <legend>Show</legend>
              <Choice name="pairwise-style" checked={style === "asterisks"} onChange={() => setStyle("asterisks")}>
                Asterisks (ns, *, **, ***, ****)
              </Choice>
              <Choice name="pairwise-style" checked={style === "p"} onChange={() => setStyle("p")}>
                P values
              </Choice>
              <label className="desktop-choice">
                <input
                  type="checkbox"
                  checked={showNs}
                  onChange={(e) => setShowNs(e.target.checked)}
                />
                Show comparisons that do not meet the analysis alpha
              </label>
            </fieldset>
            <p className="desktop-help-text">
              Brackets follow the analysis: they update when it recalculates and
              disappear while it is out of date. Asterisks use fixed thresholds
              (0.05, 0.01, 0.001, 0.0001), regardless of alpha. State the test,
              comparison family and adjustment in the figure legend; bracket
              labels alone do not identify the method or establish Prism equivalence.
            </p>
          </>
        ) : (
          <p className="result-warning">
            Run a t test or one-way ANOVA on this graph's data table first
            (Analyze → t tests or One-way ANOVA).
          </p>
        )}
      </div>
      <footer className="desktop-dialog-actions">
        {initial && (
          <button className="button" onClick={() => onApply(null)}>
            Remove comparisons
          </button>
        )}
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!resultId}
          onClick={() => onApply({ resultId, style, show_ns: showNs })}
        >
          OK
        </button>
      </footer>
    </DesktopDialog>
  );
}
/** XY follows front-to-back stacking; Column follows left-to-right position. */
function GraphDatasetList({ project, indices, onChange }: {
  project: Project;
  indices: number[];
  onChange(indices: number[]): void;
}) {
  const id = useId();
  const isXY = project.table_type === "xy";
  const list = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const availableSelect = useRef<HTMLSelectElement>(null);
  const [selected, setSelected] = useState<number | null>(() => (isXY ? indices.at(-1) : indices[0]) ?? null);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const displayed = isXY ? frontToBackDatasets(indices) : [...indices];
  const available = dataIndices(project).filter(index => !indices.includes(index));
  const position = selected === null ? -1 : displayed.indexOf(selected);
  useEffect(() => {
    if (selected === null || !indices.includes(selected)) setSelected((isXY ? indices.at(-1) : indices[0]) ?? null);
  }, [indices, selected]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [indices, selected]);
  useEffect(() => {
    if (adding) availableSelect.current?.focus();
  }, [adding]);
  function focusList() {
    requestAnimationFrame(() => list.current?.focus());
  }
  function reorder(action: DatasetOrderAction) {
    onChange(isXY ? reorderGraphDatasets(indices, selected, action)
      : reorderColumnGraphDatasets(indices, selected, action));
  }
  function remove() {
    if (selected === null || position < 0) return;
    const remaining = indices.filter(index => index !== selected);
    const nextDisplayed = isXY ? frontToBackDatasets(remaining) : remaining;
    onChange(remaining);
    setSelected(nextDisplayed[Math.min(position, nextDisplayed.length - 1)] ?? null);
    focusList();
  }
  function openAdd() {
    if (!available.length) return;
    setChoice(available[0]);
    setAdding(true);
  }
  function add() {
    if (choice === null || !available.includes(choice)) return;
    // XY addition appears in front; Column addition appears at the right edge.
    onChange([...indices, choice]);
    setSelected(choice);
    setAdding(false);
    focusList();
  }
  return <div className="xy-dataset-manager">
    <h3 id={`${id}-heading`}>Data sets plotted <span className="desktop-dataset-order-hint">({isXY ? "front to back" : "left to right"})</span></h3>
    <div className="xy-dataset-editor">
      <div ref={list} role="listbox" aria-label="Data sets plotted"
        aria-describedby={`${id}-order-help`} className="xy-dataset-list" tabIndex={0}
        aria-activedescendant={position >= 0 ? `${id}-dataset-${selected}` : undefined}
        onKeyDown={event => {
          if (event.key === "Delete") { event.preventDefault(); remove(); return; }
          if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key) || !displayed.length) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? displayed.length - 1 :
            Math.max(0, Math.min(displayed.length - 1, position + (event.key === "ArrowDown" ? 1 : -1)));
          setSelected(displayed[next]);
        }}>
        {displayed.map(index => <div key={index} id={`${id}-dataset-${index}`}
          role="option" aria-selected={selected === index} data-source-index={index}
          className="xy-dataset-option" title={project.columns[index].name}
          onClick={() => { setSelected(index); list.current?.focus(); }}>
          {project.columns[index].name}
        </div>)}
        {!displayed.length && <p className="xy-dataset-empty">No data sets on this graph.</p>}
      </div>
      <div className="xy-dataset-actions" role="group" aria-label="Data set actions">
        <button ref={addButton} disabled={!available.length || adding} onClick={openAdd}>Add…</button>
        <button disabled={position < 0} onClick={remove}>Remove</button>
        <button className="xy-dataset-action-divider" disabled={position <= 0} onClick={() => reorder("top")}>Top</button>
        <button disabled={position <= 0} onClick={() => reorder("up")}>Up</button>
        <button disabled={indices.length < 2} onClick={() => reorder("reverse")}>Reverse</button>
        <button disabled={position < 0 || position >= displayed.length - 1} onClick={() => reorder("down")}>Down</button>
        <button disabled={position < 0 || position >= displayed.length - 1} onClick={() => reorder("bottom")}>Bottom</button>
      </div>
    </div>
    {!indices.length && <p className="xy-dataset-required" role="alert">Add at least one data set before applying.</p>}
    {adding && <div className="xy-dataset-add" role="group" aria-label="Add data set from this table">
      <label htmlFor={`${id}-available`}>Available data sets from this data table</label>
      <select ref={availableSelect} id={`${id}-available`} aria-label="Available data sets"
        size={Math.min(6, Math.max(2, available.length))} value={choice ?? ""}
        onChange={event => setChoice(Number(event.target.value))}>
        {available.map(index => <option key={index} value={index}>{project.columns[index].name}</option>)}
      </select>
      <div className="xy-dataset-add-actions">
        <button aria-label="Cancel adding data set" onClick={() => {
          setAdding(false); requestAnimationFrame(() => addButton.current?.focus());
        }}>Cancel</button>
        <button disabled={choice === null || !available.includes(choice)} onClick={add}>Add data set</button>
      </div>
    </div>}
    <p id={`${id}-order-help`} className="desktop-help-text">
      {isXY
        ? "Top data sets draw their observations in front. Fitted curves and other graph elements keep their own drawing order."
        : "Column data sets run from left to right. The first item is the leftmost column on the graph."}
    </p>
    <p className="desktop-help-text">Selection and drawing order are saved for this graph without changing the data table.</p>
  </div>;
}

export function FormatGraphDialog({
  sheet,
  project,
  results,
  initialAppearanceDataset,
  onClose,
  onApply,
}: {
  sheet: GraphSheet;
  project: Project;
  results: ResultSheet[];
  initialAppearanceDataset?: number | null;
  onClose: () => void;
  onApply: (next: GraphSheet) => void;
}) {
  const [draft, setGraphDraft] = useState(() => ({
    ...structuredClone(sheet),
    datasetColors: seedDatasetColors(project, sheet.columnIndices, sheet.graph.colors, sheet.datasetColors),
  }));
  const [tab, setTab] = useState("Appearance");
  // Keep the Appearance selection attached to the source column, even when the
  // Data Sets tab changes the graph's drawing order or membership.
  const [selectedAppearanceDataset, setSelectedAppearanceDataset] = useState<number | null>(
    initialAppearanceDataset !== null && initialAppearanceDataset !== undefined &&
      sheet.columnIndices.includes(initialAppearanceDataset)
      ? initialAppearanceDataset
      : (sheet.columnIndices[0] ?? null),
  );
  const appearanceIndex =
    selectedAppearanceDataset !== null &&
    draft.columnIndices.includes(selectedAppearanceDataset)
      ? selectedAppearanceDataset
      : (draft.columnIndices[0] ?? null);
  const appearancePosition = appearanceIndex === null
    ? -1
    : draft.columnIndices.indexOf(appearanceIndex);

  function setDraft(update: (previous: GraphSheet) => GraphSheet) {
    setGraphDraft(previous => {
      const next = update(previous);
      const remembered = seedDatasetColors(
        project, previous.columnIndices, previous.graph.colors, previous.datasetColors,
      );
      const reordered = next.columnIndices.length !== previous.columnIndices.length ||
        next.columnIndices.some((source, i) => source !== previous.columnIndices[i]);
      if (reordered) {
        const result = colorsForDatasetIds(project, next.columnIndices, remembered);
        return {
          ...next,
          graph: { ...next.graph, colors: result.colors },
          datasetColors: result.datasetColors,
        };
      }
      return {
        ...next,
        datasetColors: seedDatasetColors(project, next.columnIndices, next.graph.colors, remembered),
      };
    });
  }
  function g(p: Partial<Graph>) {
    setDraft((v) => ({ ...v, graph: { ...v.graph, ...p } }));
  }
  // Dataset membership and ordering are handled by GraphDatasetList.
  return (
    <DesktopDialog
      title="Format Graph"
      titleId="format-title"
      className="desktop-format"
      onClose={onClose}
    >
      <div className="desktop-dialog-body">
        <div
          className="desktop-dialog-tabs"
          role="tablist"
          aria-label="Graph format options"
        >
          {["Appearance", "Data Sets on Graph", "Graph Settings"].map((t) => (
            <button
              data-autofocus={t === "Appearance" ? true : undefined}
              role="tab"
              id={`graph-format-tab-${t.replaceAll(" ", "-")}`}
              aria-selected={tab === t}
              aria-controls="graph-format-panel"
              tabIndex={tab === t ? 0 : -1}
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
              onKeyDown={(event) => {
                const tabs = [
                  "Appearance",
                  "Data Sets on Graph",
                  "Graph Settings",
                ];
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : (tabs.indexOf(t) +
                          (event.key === "ArrowRight" ? 1 : 2)) %
                        3;
                setTab(tabs[index]);
                document
                  .getElementById(
                    `graph-format-tab-${tabs[index].replaceAll(" ", "-")}`,
                  )
                  ?.focus();
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div
          id="graph-format-panel"
          className="desktop-format-panel"
          role="tabpanel"
          aria-labelledby={`graph-format-tab-${tab.replaceAll(" ", "-")}`}
        >
          {tab === "Appearance" ? (
            <div className="desktop-appearance-options">
              <fieldset>
                <legend>Plot</legend>
                <label className="desktop-form-row">
                  <span>Graph type</span>
                  <select
                    value={draft.graph.type}
                    onChange={(e) =>
                      g({ type: e.target.value as Graph["type"] })
                    }
                  >
                    {(project.table_type === "xy"
                      ? ["scatter", "line"]
                      : ["scatter", "bar", "box"]
                    ).map((t) => (
                      <option key={t} value={t}>
                        {
                          (
                            {
                              scatter: "Scatter",
                              line: "Connecting lines",
                              bar: "Bars",
                              box: "Box and whiskers",
                            } as Record<string, string>
                          )[t]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label className="desktop-form-row">
                  <span>Error bars</span>
                  <select
                    disabled={
                      project.table_type === "xy" || draft.graph.type === "box"
                    }
                    value={draft.graph.error}
                    onChange={(e) =>
                      g({ error: e.target.value as Graph["error"] })
                    }
                  >
                    <option value="none">None</option>
                    <option value="sd">SD</option>
                    <option value="sem">SEM</option>
                    <option value="ci">95% CI</option>
                  </select>
                </label>
                <label className="desktop-checkbox-label">
                  <input
                    type="checkbox"
                    checked={draft.graph.show_points}
                    onChange={(e) => g({ show_points: e.target.checked })}
                  />
                  Show individual points
                </label>
                {(project.table_type === "xy" ||
                  draft.graph.type === "box") && (
                  <p className="desktop-help-text">
                    {draft.graph.type === "box"
                      ? "Box plots display their distribution; separate error bars do not apply."
                      : "Error bars are not available for single-value XY observations."}
                  </p>
                )}
              </fieldset>
              <fieldset>
                <legend>Titles and axis labels</legend>
                <label className="desktop-form-row">
                  <span>Title</span>
                  <input
                    value={draft.graph.title}
                    onChange={(e) => g({ title: e.target.value })}
                  />
                </label>
                <label className="desktop-form-row">
                  <span>X axis</span>
                  <input
                    value={draft.graph.x_label}
                    onChange={(e) => g({ x_label: e.target.value })}
                  />
                </label>
                <label className="desktop-form-row">
                  <span>Y axis</span>
                  <input
                    value={draft.graph.y_label}
                    onChange={(e) => g({ y_label: e.target.value })}
                  />
                </label>
              </fieldset>
              <fieldset className="desktop-colors">
                <legend>Data set appearance</legend>
                {appearanceIndex === null ? (
                  <p className="desktop-help-text">Include a data set to edit its appearance.</p>
                ) : (
                  <>
                    <div className="desktop-appearance-dataset-selector">
                      <label htmlFor="graph-appearance-dataset">Data set</label>
                      <select
                        id="graph-appearance-dataset"
                        aria-label="Appearance data set"
                        value={appearanceIndex}
                        onChange={(event) =>
                          setSelectedAppearanceDataset(Number(event.target.value))
                        }
                      >
                        {draft.columnIndices.map(index => (
                          <option key={project.columns[index].id ?? index} value={index}>
                            {project.columns[index].name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Previous appearance data set"
                        disabled={appearancePosition <= 0}
                        onClick={() =>
                          setSelectedAppearanceDataset(draft.columnIndices[appearancePosition - 1] ?? null)
                        }
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next appearance data set"
                        disabled={appearancePosition >= draft.columnIndices.length - 1}
                        onClick={() =>
                          setSelectedAppearanceDataset(draft.columnIndices[appearancePosition + 1] ?? null)
                        }
                      >
                        ›
                      </button>
                    </div>
                    <label className="desktop-form-row">
                      <span>Color</span>
                      <input
                        type="color"
                        aria-label={`${project.columns[appearanceIndex].name} color`}
                        value={
                          draft.graph.colors[appearancePosition % draft.graph.colors.length] ??
                          "#20867e"
                        }
                        onChange={(event) => {
                          const colors = [...draft.graph.colors];
                          while (colors.length <= appearancePosition) colors.push("#20867e");
                          colors[appearancePosition] = event.target.value;
                          g({ colors });
                        }}
                      />
                    </label>
                    <p className="desktop-help-text">
                      The selected color belongs to this data set. Plot and title options
                      above apply to the whole graph.
                    </p>
                  </>
                )}
              </fieldset>
            </div>
          ) : tab === "Data Sets on Graph" ? (
            <GraphDatasetList
              project={project}
              indices={draft.columnIndices}
              onChange={columnIndices => setDraft(previous => ({ ...previous, columnIndices }))}
            />
          ) : (
            <>
              <fieldset>
                <legend>Analysis results on graph</legend>
                <label className="desktop-form-row">
                  <span>Linked analysis result</span>
                  <select
                    value={draft.resultId ?? ""}
                    onChange={(e) =>
                      setDraft((v) => ({
                        ...v,
                        resultId: e.target.value || null,
                      }))
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
                  intervals. After editing source data, recalculate the linked
                  result to update its curves and intervals.
                </p>
              </fieldset>
            </>
          )}
        </div>
        <p className="desktop-help-text desktop-apply-help">
          Apply updates the graph without closing this dialog. Cancel discards
          changes since the last Apply.
        </p>
      </div>
      <footer className="desktop-dialog-actions">
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
      </footer>
    </DesktopDialog>
  );
}
