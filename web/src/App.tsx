import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Check,
  FileText,
  FilePlus2,
  Copy,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  FolderOpen,
  Grid2X2,
  Play,
  Plus,
  Save,
  Undo2,
  Redo2,
  Settings2,
  Table2,
  X,
} from "lucide-react";
import {
  download,
  exportCsv,
  fmt,
  importCsv,
  numeric,
  palette,
  parseDelimited,
  requestData,
  sample,
} from "./data";
import type { Analysis, Graph, Project, Response, TableType } from "./data";
import Plot from "./Plot";
import AdvancedAnalyses from "./AdvancedAnalyses";
import { apiFetch, browserOnly } from "./api";
import {
  WORKBOOK_STORAGE,
  addData,
  addGraph,
  blankProject,
  dataIndices,
  fromProject,
  parseWorkbook,
  recordResult,
  selectedProject,
  sourceSheet,
  updateData,
} from "./workbook";
import type { Workbook, Sheet, GraphSheet, ResultSheet } from "./workbook";
import {
  NewTableDialog,
  AnalyzeDialog,
  FormatGraphDialog,
} from "./WorkbookDialogs";
const extendedMetrics = [
  ["sum", "Sum"],
  ["range", "Range"],
  ["cv_percent", "Coefficient of variation (%)"],
  ["q1", "25th percentile (Q1)"],
  ["q3", "75th percentile (Q3)"],
  ["p10", "10th percentile"],
  ["p90", "90th percentile"],
  ["skewness", "Skewness"],
  ["excess_kurtosis", "Excess kurtosis"],
  ["geometric_mean", "Geometric mean"],
  ["geometric_sd_factor", "Geometric SD factor"],
  ["geometric_ci_low", "Geometric mean 95% CI lower"],
  ["geometric_ci_high", "Geometric mean 95% CI upper"],
  ["qc_mean_minus_1sd", "Mean − 1 SD"],
  ["qc_mean_plus_1sd", "Mean + 1 SD"],
  ["qc_mean_minus_2sd", "Mean − 2 SD"],
  ["qc_mean_plus_2sd", "Mean + 2 SD"],
  ["qc_mean_minus_3sd", "Mean − 3 SD"],
  ["qc_mean_plus_3sd", "Mean + 3 SD"],
] as const;
const analysisLabels: Record<Analysis, string> = {
  descriptive: "Descriptive statistics",
  welch_t: "Unpaired t test (Welch)",
  paired_t: "Paired t test",
  anova: "One-way ANOVA",
  linear_regression: "Linear regression",
  dose_response: "Dose–response (4PL)",
  nonlinear_regression: "Nonlinear regression",
};
type Imported = {
  id: string;
  title: string;
  table_type: TableType;
  columns: { name: string; values: (number | null)[] }[];
};
import {
  restoreWorkbook,
  persistWorkbook,
  workbookLimitError,
} from "./workbook-storage";
import {
  emptyHistory,
  commitHistory,
  moveHistory,
  breakHistoryGroup,
  shouldHandleHistoryShortcut,
} from "./workbook-history";
import type { HistoryOptions } from "./workbook-history";
function DesktopMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) {
        if (menu.current) menu.current.open = false;
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details
      ref={menu}
      name="workbook-menu"
      className="desktop-menu"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button"))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.currentTarget.open = false;
      }}
    >
      <summary>{label}</summary>
      <div role="menu" aria-label={`${label} menu`}>
        {children}
      </div>
    </details>
  );
}
export default function App() {
  const [advanced, setAdvanced] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [restoration] = useState(() =>
    restoreWorkbook((key) => localStorage.getItem(key)),
  );
  const [recovery, setRecovery] = useState(restoration.recovery);
  const [workbook, setWorkbookState] = useState<Workbook>(restoration.workbook),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [saved, setSaved] = useState(true),
    [imported, setImported] = useState<Imported[]>([]),
    [importWarnings, setImportWarnings] = useState<string[]>([]),
    [selectedImport, setSelectedImport] = useState(0);
  const workbookRef = useRef(workbook);
  const historyRef = useRef(emptyHistory());
  const [history, setHistory] = useState(historyRef.current);
  function editOptions(label: string): HistoryOptions {
    const focused = document.activeElement;
    const field =
      focused instanceof HTMLInputElement &&
      ["text", "number"].includes(focused.type)
        ? focused.getAttribute("aria-label")
        : null;
    return {
      label,
      coalesceKey: field
        ? `${workbookRef.current.activeSheetId}:${field}`
        : undefined,
    };
  }
  function inferEditLabel(before: Workbook, next: Workbook): string {
    if (before.name !== next.name) return "Rename workbook";
    const created = next.sheets.filter(
      (s) => !before.sheets.some((p) => p.id === s.id),
    );
    if (created.some((s) => s.kind === "data"))
      return "Create data table and graph";
    if (created.some((s) => s.kind === "results")) return "Run analysis";
    if (created.some((s) => s.kind === "graph")) return "Create graph";
    if (
      next.sheets.some(
        (s) => before.sheets.find((p) => p.id === s.id)?.name !== s.name,
      )
    )
      return "Rename sheet";
    if (
      next.sheets.some(
        (s) =>
          s.kind === "graph" &&
          JSON.stringify(before.sheets.find((p) => p.id === s.id)) !==
            JSON.stringify(s),
      )
    )
      return "Format graph";
    return "Edit workbook";
  }
  function setWorkbook(
    update: Workbook | ((previous: Workbook) => Workbook),
    options: HistoryOptions = {},
  ): boolean {
    try {
      const next =
        typeof update === "function" ? update(workbookRef.current) : update;
      const limitError = workbookLimitError(next);
      if (limitError) {
        setError(limitError);
        return false;
      }
      const previous = workbookRef.current;
      const edited =
        previous.name !== next.name ||
        JSON.stringify(previous.sheets) !== JSON.stringify(next.sheets);
      historyRef.current = commitHistory(historyRef.current, previous, next, {
        label: inferEditLabel(previous, next),
        ...options,
      });
      setHistory(historyRef.current);
      if (edited || options.reset) {
        controller.current?.abort();
        revision.current++;
        setBusy(false);
      }
      workbookRef.current = next;
      setWorkbookState(next);
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The workbook change could not be applied.",
      );
      return false;
    }
  }
  const [newTable, setNewTable] = useState(false),
    [analyzeDialog, setAnalyzeDialog] = useState(false),
    [formatDialog, setFormatDialog] = useState(false),
    [sheetSearch, setSheetSearch] = useState("");
  const selectedSheet = workbook.sheets.find(
    (s) => s.id === workbook.activeSheetId,
  )!;
  const source = sourceSheet(workbook, selectedSheet);
  const graphSheet =
    selectedSheet.kind === "graph"
      ? selectedSheet
      : (workbook.sheets.find(
          (s) => s.kind === "graph" && s.dataId === source.id,
        ) as GraphSheet | undefined);
  const linkedResult =
    selectedSheet.kind === "results"
      ? selectedSheet
      : graphSheet?.resultId
        ? (workbook.sheets.find((s) => s.id === graphSheet.resultId) as
            ResultSheet | undefined)
        : undefined;
  const result =
    linkedResult?.status === "current" ? linkedResult.result : null;
  const active =
    selectedSheet.kind === "results"
      ? "results"
      : selectedSheet.kind === "graph"
        ? "graph"
        : "data";
  const project: Project = {
    ...source.project,
    analysis:
      selectedSheet.kind === "results"
        ? selectedSheet.analysis
        : source.project.analysis,
    regression_model:
      selectedSheet.kind === "results"
        ? selectedSheet.regression_model
        : source.project.regression_model,
    graph: graphSheet?.graph ?? source.project.graph,
  };
  const plotProject = graphSheet
    ? {
        ...selectedProject(source, graphSheet.columnIndices),
        graph: graphSheet.graph,
      }
    : project;
  const plotNames = new Set(
    plotProject.columns
      .slice(project.table_type === "xy" ? 1 : 0)
      .map((c) => c.name),
  );
  const plotResult = result
    ? {
        ...result,
        summary: result.summary.filter((s) => plotNames.has(s.name)),
        fit: result.fit.filter((f) => plotNames.has(f.series)),
      }
    : null;
  function selectSheet(id: string) {
    controller.current?.abort();
    revision.current++;
    setBusy(false);
    setError("");
    setNotice("");
    setWorkbook((w) => ({ ...w, activeSheetId: id }));
  }
  function setActive(view: string) {
    if (view === "data") {
      selectSheet(source.id);
      return;
    }
    const target = workbook.sheets.find(
      (s) =>
        s.kind === (view === "results" ? "results" : "graph") &&
        s.dataId === source.id,
    );
    if (target) selectSheet(target.id);
    else if (view === "results") setAnalyzeDialog(true);
    else setWorkbook((w) => addGraph(w, source.id));
  }
  function renameSheet(name: string) {
    setWorkbook(
      (w) => ({
        ...w,
        sheets: w.sheets.map((s) =>
          s.id === selectedSheet.id
            ? s.kind === "data"
              ? { ...s, name, project: { ...s.project, name } }
              : { ...s, name }
            : s,
        ),
      }),
      editOptions("Rename sheet"),
    );
  }
  const fileRef = useRef<HTMLInputElement>(null),
    projectRef = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    revision = useRef(0);
  useEffect(() => {
    try {
      setSaved(
        persistWorkbook(
          (key, value) => localStorage.setItem(key, value),
          workbook,
          recovery,
        ),
      );
    } catch {
      setSaved(false);
    }
  }, [workbook, recovery]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    revision.current++;
    setBusy(false);
  }, [workbook.activeSheetId]);
  function applyHistory(direction: "undo" | "redo") {
    const moved = moveHistory(
      historyRef.current,
      workbookRef.current,
      direction,
    );
    if (!moved) return;
    const limitError = workbookLimitError(moved.workbook);
    if (limitError) {
      setError(limitError);
      return;
    }
    controller.current?.abort();
    revision.current++;
    setBusy(false);
    historyRef.current = moved.history;
    setHistory(moved.history);
    workbookRef.current = moved.workbook;
    setWorkbookState(moved.workbook);
    setError("");
    setNotice(`${direction === "undo" ? "Undid" : "Redid"}: ${moved.label}.`);
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        Boolean(
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
          ),
        );
      const direction = shouldHandleHistoryShortcut(
        event,
        editing,
        advanced ||
          newTable ||
          analyzeDialog ||
          formatDialog ||
          imported.length > 0,
      );
      if (
        !direction ||
        !(
          direction === "undo"
            ? historyRef.current.past
            : historyRef.current.future
        ).length
      )
        return;
      event.preventDefault();
      applyHistory(direction);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanced, newTable, analyzeDialog, formatDialog, imported.length]);
  function change(next: Project | ((p: Project) => Project), _data = true) {
    const updated = typeof next === "function" ? next(project) : next;
    controller.current?.abort();
    revision.current++;
    setBusy(false);
    setError("");
    setNotice("");
    setWorkbook((w) => {
      let changed = updateData(w, source.id, {
        ...updated,
        graph: source.project.graph,
      });
      if (
        JSON.stringify(updated.graph) !== JSON.stringify(project.graph) &&
        graphSheet
      )
        changed = {
          ...changed,
          sheets: changed.sheets.map((s) =>
            s.id === graphSheet.id
              ? { ...graphSheet, graph: updated.graph }
              : s,
          ),
        };
      if (
        selectedSheet.kind === "results" &&
        (updated.analysis !== selectedSheet.analysis ||
          updated.regression_model !== selectedSheet.regression_model)
      )
        changed = {
          ...changed,
          sheets: changed.sheets.map((s) =>
            s.id === selectedSheet.id
              ? {
                  ...selectedSheet,
                  analysis: updated.analysis,
                  regression_model: updated.regression_model,
                  status: "stale",
                  result: null,
                }
              : s,
          ),
        };
      return changed;
    }, editOptions("Edit data or analysis"));
  }
  function graph(p: Partial<Graph>) {
    if (graphSheet)
      setWorkbook((w) => ({
        ...w,
        sheets: w.sheets.map((s) =>
          s.id === graphSheet.id
            ? { ...graphSheet, graph: { ...graphSheet.graph, ...p } }
            : s,
        ),
      }));
  }
  const rows = Math.max(1, ...project.columns.map((c) => c.values.length)),
    xy = project.table_type === "xy",
    count = project.columns
      .slice(xy ? 1 : 0)
      .reduce((n, c) => n + c.values.filter((v) => v.trim()).length, 0);
  const displayedRows = Math.max(rows, 32);
  const displayedColumns = Array.from(
    { length: Math.max(project.columns.length, 8) },
    (_, i) => project.columns[i] ?? { name: `Series ${i + 1}`, values: [] },
  );
  function expandColumns(p: Project, col: number) {
    const columns = [...p.columns];
    while (columns.length <= col)
      columns.push({
        name: `Series ${columns.length + 1}`,
        values: Array(rows).fill(""),
      });
    return columns;
  }
  function updateCell(col: number, row: number, value: string) {
    change((p) => ({
      ...p,
      columns: expandColumns(p, col).map((c, i) =>
        i !== col
          ? c
          : {
              ...c,
              values: Array.from({ length: Math.max(rows, row + 1) }, (_, r) =>
                r === row ? value : (c.values[r] ?? ""),
              ),
            },
      ),
    }));
  }
  function paste(
    e: React.ClipboardEvent<HTMLInputElement>,
    col: number,
    row: number,
  ) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n\r]/.test(text)) return;
    e.preventDefault();
    try {
      const cells = parseDelimited(text, "\t");
      if (
        row + cells.length > 10000 ||
        col + Math.max(...cells.map((r) => r.length)) > 30
      )
        throw new Error(
          "Paste exceeds the limit of 10,000 rows or 30 columns.",
        );
      cells.forEach((r) => r.forEach(numeric));
      const cols = project.columns.map((c) => ({
        ...c,
        values: [...c.values],
      }));
      cells.forEach((r, ri) =>
        r.forEach((v, ci) => {
          const idx = col + ci;
          while (cols.length <= idx)
            cols.push({
              name: `Series ${cols.length + 1}`,
              values: Array(rows).fill(""),
            });
          while (cols[idx].values.length <= row + ri) cols[idx].values.push("");
          cols[idx].values[row + ri] = v;
        }),
      );
      change({ ...project, columns: cols });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function run(
    analysis: Analysis = project.analysis,
    indices: number[] = selectedSheet.kind === "results"
      ? selectedSheet.columnIndices
      : dataIndices(source.project),
    prefix = "",
    forceNew = false,
  ) {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const rev = revision.current;
    setError("");
    setBusy(true);
    try {
      if (
        selectedSheet.kind === "results" &&
        selectedSheet.selectionInvalid &&
        !forceNew
      )
        throw new Error(
          "The source table structure changed. Use Analyze Data to review the dataset selection and create a replacement analysis.",
        );
      if (!indices.length) throw new Error("Select at least one data set.");
      const data = requestData({
        ...selectedProject(source, indices),
        analysis,
        regression_model: project.regression_model,
      });
      const response = await apiFetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: ctrl.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(message(body));
      if (rev === revision.current) {
        setWorkbook((w) =>
          recordResult(
            w,
            {
              name:
                selectedSheet.kind === "results" && !forceNew
                  ? selectedSheet.name
                  : `${prefix}${analysisLabels[analysis]} — ${source.name}`,
              dataId: source.id,
              analysis,
              regression_model: project.regression_model,
              columnIndices: indices,
              sourceRevision: source.revision,
              result: body,
            },
            selectedSheet.kind === "results" && !forceNew
              ? selectedSheet.id
              : undefined,
          ),
        );
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (rev === revision.current) setBusy(false);
    }
  }
  function message(body: unknown) {
    if (typeof body === "object" && body !== null) {
      const b = body as Record<string, unknown>;
      if (typeof b.detail === "string") return b.detail;
      if (typeof b.error === "string") return b.error;
      if (Array.isArray(b.detail))
        return b.detail
          .map((v: { msg?: string }) => v.msg ?? "Invalid data")
          .join("; ");
    }
    return "The request could not be completed. Check your data and try again.";
  }
  async function exportGraph(format: "svg" | "png" | "pdf") {
    setError("");
    setExporting(true);
    try {
      if (
        project.graph.error === "ci" &&
        !result &&
        !xy &&
        project.graph.type !== "box"
      )
        throw new Error(
          "Run analysis before exporting to include the 95% confidence intervals shown on your graph.",
        );
      if (
        graphSheet &&
        linkedResult &&
        result &&
        (result.fit.length > 0 || project.graph.error === "ci") &&
        graphSheet.columnIndices.some(
          (i) => !linkedResult.columnIndices.includes(i),
        )
      )
        throw new Error(
          "This graph includes datasets outside its linked analysis. Use Format Graph to select analyzed datasets or change the linked result before exporting.",
        );
      const response = await apiFetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: requestData({
            ...plotProject,
            analysis:
              result?.fit.length && linkedResult
                ? linkedResult.analysis
                : "descriptive",
            regression_model: linkedResult?.regression_model,
          }),
          graph: project.graph,
          format,
        }),
      });
      if (!response.ok) throw new Error(message(await response.json()));
      download(await response.blob(), `GP-graph.${format}`);
      setNotice(`${format.toUpperCase()} graph exported.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  async function openFile(file: File | undefined, isProject = false) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 20_000_000)
        throw new Error("Please use a file smaller than 20 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isZip =
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        bytes[2] === 3 &&
        bytes[3] === 4;
      if (!isProject && isZip) {
        if (file.size > 16 * 1024 * 1024)
          throw new Error("Prism ZIP import is limited to 16 MiB.");
        let binary = "";
        for (let start = 0; start < bytes.length; start += 32768)
          binary += String.fromCharCode(
            ...bytes.subarray(start, start + 32768),
          );
        const response = await apiFetch("/api/import-prism-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_base64: btoa(binary) }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(message(body));
        if (!body.tables?.length)
          throw new Error(
            (body.warnings ?? ["No supported raw tables found."]).join(" "),
          );
        setImported(body.tables);
        setImportWarnings(body.warnings ?? []);
        setSelectedImport(0);
        return;
      }
      const text = new TextDecoder().decode(bytes);
      if (isProject) {
        controller.current?.abort();
        revision.current++;
        setBusy(false);
        if (!setWorkbook(parseWorkbook(text), { reset: true })) return;
        setRecovery(null);
        setNotice(
          "Workbook opened. Legacy single-table projects are migrated automatically.",
        );
        return;
      }
      if (
        /\.(xml|pzfx)$/i.test(file.name) ||
        (/\.(pzt|pzf|prism|prismt)$/i.test(file.name) &&
          text.trimStart().startsWith("<"))
      ) {
        const response = await apiFetch("/api/import-prism", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(message(body));
        if (!body.tables?.length)
          throw new Error("No supported data tables were found.");
        setImported(body.tables);
        setImportWarnings(body.warnings ?? []);
        setSelectedImport(0);
        return;
      }
      if (!/\.csv$/i.test(file.name))
        throw new Error(
          "Choose CSV, Prism XML, or a supported Prism ZIP project. Legacy PCFFGRA4 binary projects are not yet supported.",
        );
      const columns = importCsv(text);
      const accepted = setWorkbook((w) =>
        addData(w, {
          ...project,
          name: file.name.replace(/\.csv$/i, ""),
          columns,
        }),
      );
      if (!accepted) return;
      setNotice(
        "CSV imported. Use the table type selector if the first column contains X values.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function applyImport() {
    const t = imported[selectedImport];
    const accepted = setWorkbook((w) =>
      addData(w, {
        ...project,
        name: t.title,
        table_type: t.table_type,
        columns: t.columns.map((c) => ({
          name: c.name,
          values: c.values.map((v) => (v == null ? "" : String(v))),
        })),
        analysis: "descriptive",
        graph: {
          ...project.graph,
          type: t.table_type === "xy" ? "scatter" : "bar",
          title: t.title,
          x_label:
            t.table_type === "xy" ? (t.columns[0]?.name ?? "X") : "Group",
        },
      }),
    );
    setImported([]);
    if (!accepted) return;
    setNotice(
      "Data table imported. Graphs, analyses, and original project formatting are not imported.",
    );
  }
  function replaceSample(type: TableType) {
    if (
      window.confirm(
        "Replace this table with the sample dataset? Save your project first to keep the current data.",
      )
    )
      change(sample(type));
  }
  function saveWorkbook() {
    download(
      new Blob([JSON.stringify(workbook)], { type: "application/json" }),
      `${workbook.name.replace(/[^a-zA-Z0-9_-]/g, "-")}.gp.json`,
    );
    setNotice("Workbook downloaded with data, linked results, and graphs.");
  }
  function exportData() {
    download(
      new Blob([exportCsv(project.columns)], { type: "text/csv" }),
      "GP-data.csv",
    );
  }
  function createLinkedGraph() {
    setWorkbook((w) =>
      addGraph(
        w,
        source.id,
        selectedSheet.kind === "results" ? selectedSheet.id : null,
      ),
    );
  }
  function focusSheetName() {
    document
      .querySelector<HTMLInputElement>('[aria-label="Sheet name"]')
      ?.focus();
  }
  async function copyData() {
    try {
      await navigator.clipboard.writeText(exportCsv(project.columns));
      setNotice("Data table copied as CSV.");
    } catch {
      setError(
        "Clipboard access is unavailable. Use Export CSV to save the table.",
      );
    }
  }
  if (advanced) return <AdvancedAnalyses onBack={() => setAdvanced(false)} />;
  return (
    <div
      className="app"
      onBlurCapture={() => {
        historyRef.current = breakHistoryGroup(historyRef.current);
      }}
    >
      <header className="desktop-chrome">
        <div className="desktop-titlebar">
          <span className="desktop-app-name">
            <FileText size={13} />
            GP
          </span>
          <input
            aria-label="Workbook name"
            className="workbook-name"
            value={workbook.name}
            onChange={(e) =>
              setWorkbook(
                (w) => ({ ...w, name: e.target.value }),
                editOptions("Rename workbook"),
              )
            }
          />
          <span className="document-state">
            {recovery
              ? "Autosave paused"
              : saved
                ? "Saved"
                : "Not saved in browser"}
          </span>
        </div>
        <nav className="desktop-menubar" aria-label="Application menu">
          <DesktopMenu label="File">
            <button role="menuitem" onClick={() => setNewTable(true)}>
              New Data Table and Graph…
            </button>
            <button role="menuitem" onClick={() => projectRef.current?.click()}>
              Open workbook…
            </button>
            <button role="menuitem" onClick={saveWorkbook}>
              Save workbook
            </button>
            <hr />
            <button role="menuitem" onClick={() => fileRef.current?.click()}>
              Import data…
            </button>
            <button role="menuitem" onClick={exportData}>
              Export data as CSV…
            </button>
          </DesktopMenu>
          <DesktopMenu label="Edit">
            <button
              role="menuitem"
              disabled={!history.past.length}
              onClick={() => applyHistory("undo")}
            >
              Undo <kbd>⌘Z / Ctrl+Z</kbd>
            </button>
            <button
              role="menuitem"
              disabled={!history.future.length}
              onClick={() => applyHistory("redo")}
            >
              Redo <kbd>⇧⌘Z / Ctrl+Y</kbd>
            </button>
            <hr />
            <button role="menuitem" onClick={focusSheetName}>
              Rename sheet
            </button>
            <button role="menuitem" onClick={() => void copyData()}>
              Copy table as CSV
            </button>
          </DesktopMenu>
          <DesktopMenu label="View">
            <button role="menuitem" onClick={() => setActive("data")}>
              Data table
            </button>
            <button role="menuitem" onClick={() => setActive("results")}>
              Tabular results
            </button>
            <button role="menuitem" onClick={() => setActive("graph")}>
              Graph
            </button>
            <hr />
            <button
              role="menuitem"
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>(
                    '[aria-label="Search sheets"]',
                  )
                  ?.focus()
              }
            >
              Search navigator
            </button>
          </DesktopMenu>
          <DesktopMenu label="Insert">
            <button role="menuitem" onClick={() => setNewTable(true)}>
              New Data Table and Graph…
            </button>
            <button role="menuitem" onClick={createLinkedGraph}>
              New graph of existing data
            </button>
          </DesktopMenu>
          <DesktopMenu label="Analyze">
            <button role="menuitem" onClick={() => setAnalyzeDialog(true)}>
              Analyze Data…
            </button>
            <button role="menuitem" disabled={busy} onClick={() => void run()}>
              {selectedSheet.kind === "results"
                ? "Recalculate analysis"
                : "Run selected analysis"}
            </button>
            <hr />
            <button role="menuitem" onClick={() => setAdvanced(true)}>
              Grouped and survival analyses…
            </button>
          </DesktopMenu>
          <DesktopMenu label="Change">
            <button role="menuitem" onClick={focusSheetName}>
              Sheet name…
            </button>
            <button
              role="menuitem"
              disabled={active !== "graph"}
              onClick={() => setFormatDialog(true)}
            >
              Format Graph…
            </button>
          </DesktopMenu>
          <DesktopMenu label="Family">
            <button role="menuitem" onClick={() => selectSheet(source.id)}>
              Source data table
            </button>
            {workbook.sheets
              .filter((s) => s.kind !== "data" && s.dataId === source.id)
              .map((s) => (
                <button
                  role="menuitem"
                  key={s.id}
                  onClick={() => selectSheet(s.id)}
                >
                  {s.name}
                </button>
              ))}
          </DesktopMenu>
        </nav>
        <div className="desktop-toolbar" aria-label="Workbook toolbar">
          <div className="desktop-tool-group">
            <span>File</span>
            <div>
              <button
                aria-label="Open workbook"
                title="Open workbook"
                onClick={() => projectRef.current?.click()}
              >
                <FolderOpen />
                <small>Open</small>
              </button>
              <button
                aria-label="Save workbook"
                title="Save workbook"
                onClick={saveWorkbook}
              >
                <Save />
                <small>Save</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Sheet</span>
            <div>
              <button
                aria-label="New Data Table and Graph"
                title="New Data Table and Graph"
                onClick={() => setNewTable(true)}
              >
                <FilePlus2 />
                <small>New</small>
              </button>
              <button title="Rename current sheet" onClick={focusSheetName}>
                <FileText />
                <small>Rename</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Undo</span>
            <div>
              <button
                aria-label="Undo"
                disabled={!history.past.length}
                title={
                  history.past.length
                    ? `Undo: ${history.past.at(-1)!.label}`
                    : "Nothing to undo"
                }
                onClick={() => applyHistory("undo")}
              >
                <Undo2 />
                <small>Undo</small>
              </button>
              <button
                aria-label="Redo"
                disabled={!history.future.length}
                title={
                  history.future.length
                    ? `Redo: ${history.future.at(-1)!.label}`
                    : "Nothing to redo"
                }
                onClick={() => applyHistory("redo")}
              >
                <Redo2 />
                <small>Redo</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Clipboard</span>
            <div>
              <button
                aria-label="Copy data as CSV"
                onClick={() => void copyData()}
              >
                <Copy />
                <small>Copy CSV</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Analysis</span>
            <div>
              <button
                aria-label="Analyze Data…"
                title="Choose an analysis and datasets"
                onClick={() => setAnalyzeDialog(true)}
              >
                <FlaskConical />
                <small>Analyze…</small>
              </button>
              <button
                aria-label="Grouped & survival"
                title="Grouped and survival analyses"
                onClick={() => setAdvanced(true)}
              >
                <Grid2X2 />
                <small>Grouped / survival</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Change</span>
            <div>
              <button
                aria-label="New graph of existing data"
                onClick={createLinkedGraph}
              >
                <BarChart3 />
                <small>New graph</small>
              </button>
              <button
                aria-label="Format Graph…"
                disabled={active !== "graph"}
                onClick={() => setFormatDialog(true)}
              >
                <Settings2 />
                <small>Format…</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Import</span>
            <div>
              <button
                aria-label="Import data"
                title="Import CSV or supported Prism raw data"
                onClick={() => fileRef.current?.click()}
              >
                <ArrowUpFromLine />
                <small>Import…</small>
              </button>
            </div>
          </div>
          <div className="desktop-tool-group">
            <span>Export</span>
            <div>
              <button
                aria-label="CSV"
                title="Export data as CSV"
                onClick={exportData}
              >
                <ArrowDownToLine />
                <small>CSV</small>
              </button>
              {active === "graph" && (
                <button
                  disabled={exporting}
                  title="Export current figure as PDF"
                  aria-label="Export graph as PDF"
                  onClick={() => void exportGraph("pdf")}
                >
                  <FileText />
                  <small>PDF</small>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <input
          className="navigator-search"
          aria-label="Search sheets"
          placeholder="Search sheets"
          value={sheetSearch}
          onChange={(e) => setSheetSearch(e.target.value)}
        />
        <div className="sheet-navigator" aria-label="Workbook sheets">
          {(
            [
              ["data", "Data Tables"],
              ["results", "Results"],
              ["graph", "Graphs"],
            ] as const
          ).map(([kind, label]) => (
            <section className="navigator-section" key={kind}>
              <h2>
                <button
                  aria-expanded={!collapsedSections[kind]}
                  onClick={() =>
                    setCollapsedSections((v) => ({ ...v, [kind]: !v[kind] }))
                  }
                >
                  <ChevronRight
                    size={12}
                    className={collapsedSections[kind] ? "" : "expanded"}
                  />
                  {label}
                </button>
                <span>
                  {workbook.sheets.filter((s) => s.kind === kind).length}
                </span>
              </h2>
              {workbook.sheets
                .filter(
                  (s) =>
                    s.kind === kind &&
                    !collapsedSections[kind] &&
                    s.name.toLowerCase().includes(sheetSearch.toLowerCase()),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    className={`sheet-link ${s.id === selectedSheet.id ? "selected" : ""}`}
                    aria-current={
                      s.id === selectedSheet.id ? "page" : undefined
                    }
                    onClick={() => selectSheet(s.id)}
                    title={s.name}
                  >
                    {kind === "data" ? (
                      <Table2 size={14} />
                    ) : kind === "graph" ? (
                      <BarChart3 size={14} />
                    ) : (
                      <FlaskConical size={14} />
                    )}
                    <span>{s.name}</span>
                    {s.kind === "results" && s.status === "stale" && (
                      <span className="stale-dot" title="Needs recalculation">
                        •
                      </span>
                    )}
                  </button>
                ))}
              {!collapsedSections[kind] && (
                <button
                  className="navigator-new"
                  onClick={() =>
                    kind === "data"
                      ? setNewTable(true)
                      : kind === "results"
                        ? setAnalyzeDialog(true)
                        : createLinkedGraph()
                  }
                >
                  <Plus size={12} />
                  {kind === "data"
                    ? "New Data Table…"
                    : kind === "results"
                      ? "New Analysis…"
                      : "New Graph…"}
                </button>
              )}
            </section>
          ))}
        </div>
        <section
          className="family-navigator"
          aria-label="Family of linked sheets"
        >
          <h2>
            Family <small>Linked sheets</small>
          </h2>
          {workbook.sheets
            .filter(
              (s) =>
                s.id === source.id ||
                (s.kind !== "data" && s.dataId === source.id),
            )
            .map((s) => (
              <button
                key={s.id}
                onClick={() => selectSheet(s.id)}
                className={s.id === selectedSheet.id ? "selected" : ""}
              >
                <span>
                  {s.kind === "data" ? "▦" : s.kind === "graph" ? "◷" : "ƒ"}
                </span>
                {s.name}
              </button>
            ))}
        </section>
      </aside>
      <main>
        <div className="main-content">
          <div className="desktop-sheet-strip">
            <span className="sheet-kind-icon">
              {active === "data" ? (
                <Table2 size={15} />
              ) : active === "graph" ? (
                <BarChart3 size={15} />
              ) : (
                <FileText size={15} />
              )}
            </span>
            <input
              className="project-title"
              aria-label="Sheet name"
              value={selectedSheet.name}
              onChange={(e) => renameSheet(e.target.value)}
            />
            <span className="desktop-sheet-type">
              {active === "data"
                ? xy
                  ? "XY table"
                  : "Column table"
                : active === "graph"
                  ? "Graph"
                  : "Tabular results"}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".csv,.pzfx,.xml,.prism,.prismt,.pzt,.pzf"
            onChange={(e) => {
              void openFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={projectRef}
            type="file"
            hidden
            accept=".json"
            onChange={(e) => {
              void openFile(e.target.files?.[0], true);
              e.target.value = "";
            }}
          />
          {recovery && (
            <section
              className="recovery-notice"
              role="alert"
              aria-label="Workbook recovery"
            >
              <strong>Workbook recovery</strong>
              <p>
                {recovery.message} Open a valid workbook to resume, or
                explicitly start fresh. The sample shown below has not replaced
                your saved work.
              </p>
              <div>
                {recovery.original !== null && (
                  <button
                    className="button"
                    onClick={() =>
                      download(
                        new Blob([recovery.original!], {
                          type: "application/json",
                        }),
                        "GP-original-workbook-recovery.json",
                      )
                    }
                  >
                    Download original saved workbook
                  </button>
                )}
                <button
                  className="button"
                  onClick={() => projectRef.current?.click()}
                >
                  Open a valid workbook
                </button>
                <button
                  className="button"
                  onClick={() => {
                    controller.current?.abort();
                    revision.current++;
                    setBusy(false);
                    setWorkbook(fromProject(sample("column")), { reset: true });
                    setRecovery(null);
                    setError("");
                    setNotice(
                      "Started a fresh workbook. Autosave has resumed if browser storage is available.",
                    );
                  }}
                >
                  Start fresh workbook
                </button>
              </div>
            </section>
          )}
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert notice" role="status">
              <span>{notice}</span>
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {active === "graph" && linkedResult?.status === "stale" && (
            <div className="alert notice" role="status">
              This graph's linked analysis needs recalculation. Select its
              result sheet in Family and choose Recalculate analysis. Raw data
              remains visible.
            </div>
          )}
          {selectedSheet.kind === "graph" &&
            !selectedSheet.columnIndices.length && (
              <div className="alert notice" role="status">
                No datasets remain selected for this graph. Open Format Graph to
                choose datasets.
              </div>
            )}
          {selectedSheet.kind === "results" &&
            selectedSheet.status === "stale" && (
              <div className="alert notice" role="status">
                Source data or parameters changed. This linked result needs
                recalculation. Run analysis to update this sheet.
              </div>
            )}
          <div className="analysis-bar">
            <div className="analysis-icon">
              <FlaskConical size={19} />
            </div>
            <div>
              <label htmlFor="analysis">ANALYSIS</label>
              <select
                id="analysis"
                value={project.analysis}
                onChange={(e) =>
                  change((p) => ({
                    ...p,
                    analysis: e.target.value as Analysis,
                  }))
                }
              >
                {Object.entries(analysisLabels)
                  .filter(([key]) =>
                    xy
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
                  )
                  .map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            {project.analysis === "nonlinear_regression" && (
              <label className="model-choice">
                Model
                <select
                  aria-label="Regression model"
                  value={project.regression_model ?? "one_phase_decay"}
                  onChange={(e) =>
                    change((p) => ({ ...p, regression_model: e.target.value }))
                  }
                >
                  <option value="one_phase_decay">One-phase decay</option>
                  <option value="one_phase_association">
                    One-phase association
                  </option>
                  <option value="two_phase_decay">Two-phase decay</option>
                  <option value="michaelis_menten">Michaelis–Menten</option>
                  <option value="gaussian">Gaussian</option>
                  <option value="straight_line">Straight line</option>
                  <option value="log_dose_stimulation">
                    Log-dose stimulation
                  </option>
                  <option value="log_dose_inhibition">
                    Log-dose inhibition
                  </option>
                  <option value="normalized_dose_inhibition">
                    Normalized inhibition (concentration)
                  </option>
                  <option value="normalized_log_dose_inhibition">
                    Normalized inhibition (log concentration)
                  </option>
                </select>
              </label>
            )}
            <span className="analysis-hint">
              {project.analysis === "descriptive"
                ? "Summary statistics · 95% confidence intervals"
                : project.analysis === "welch_t"
                  ? "Two independent groups · unequal variances"
                  : project.analysis === "paired_t"
                    ? "Two groups · paired by row"
                    : project.analysis === "anova"
                      ? "Independent groups · equal-variance model"
                      : project.analysis === "dose_response"
                        ? "Four-parameter logistic · positive X values"
                        : project.analysis === "nonlinear_regression"
                          ? project.regression_model ===
                            "normalized_log_dose_inhibition"
                            ? "X is log10(concentration) · fixed 0–100 response"
                            : project.regression_model ===
                                "normalized_dose_inhibition"
                              ? "Positive concentrations · fixed 0–100 response"
                              : project.regression_model?.startsWith("log_dose")
                                ? "X must be log10(concentration)"
                                : "Independent unweighted fits"
                          : "Ordinary least squares · separate Y series"}
            </span>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void run()}
            >
              <Play size={15} fill="currentColor" />
              {busy
                ? browserOnly
                  ? "Loading / analyzing…"
                  : "Analyzing…"
                : selectedSheet.kind === "results"
                  ? "Recalculate analysis"
                  : "Run analysis"}
            </button>
          </div>
          {active !== "results" ? (
            <div className={`workspace-grid sheet-${active}-view`}>
              <section className="card data-card">
                <div className="card-heading">
                  <div>
                    <span className="card-icon">
                      <Table2 size={17} />
                    </span>
                    <h2>Data table</h2>
                    <span className="subtle-count">{count} values</span>
                  </div>
                  <select
                    aria-label="Table type"
                    className="small-select"
                    value={project.table_type}
                    onChange={(e) => {
                      const type = e.target.value as TableType;
                      change((p) => ({
                        ...p,
                        table_type: type,
                        analysis: "descriptive",
                        graph: {
                          ...p.graph,
                          type: type === "xy" ? "scatter" : "bar",
                          x_label: type === "xy" ? p.columns[0].name : "Group",
                        },
                      }));
                    }}
                  >
                    <option value="column">Column</option>
                    <option value="xy">XY</option>
                  </select>
                </div>
                <div className="data-tools">
                  <span className="table-indicator" />
                  <span>
                    {xy ? "X values + Y series" : "Replicates in columns"}
                  </span>
                  <div className="sample-select">
                    <select
                      aria-label="Load a sample dataset"
                      value=""
                      onChange={(e) => {
                        replaceSample(e.target.value as TableType);
                      }}
                    >
                      <option value="" disabled>
                        Sample datasets
                      </option>
                      <option value="column">Treatment response</option>
                      <option value="xy">Dose response</option>
                    </select>
                  </div>
                </div>
                <div className="sheet-wrap">
                  <table className="sheet">
                    <thead>
                      <tr>
                        <th className="row-number">#</th>
                        {displayedColumns.map((c, i) => (
                          <th key={i}>
                            <div className="column-letter">
                              {xy && i === 0
                                ? "X"
                                : `Group ${String.fromCharCode(65 + i - (xy ? 1 : 0))}`}
                              <button
                                title={`Remove ${c.name}`}
                                aria-label={`Remove column ${c.name}`}
                                disabled={
                                  project.columns.length <= 1 ||
                                  i >= project.columns.length
                                }
                                onClick={() =>
                                  change((p) => ({
                                    ...p,
                                    columns: p.columns.filter(
                                      (_, j) => j !== i,
                                    ),
                                  }))
                                }
                              >
                                <X size={11} />
                              </button>
                            </div>
                            <input
                              aria-label={`Column ${i + 1} name`}
                              value={i < project.columns.length ? c.name : ""}
                              placeholder="Title"
                              onChange={(e) =>
                                change((p) => ({
                                  ...p,
                                  columns: expandColumns(p, i).map((v, j) =>
                                    j === i
                                      ? { ...v, name: e.target.value }
                                      : v,
                                  ),
                                }))
                              }
                            />
                            <span className="column-entry-kind">
                              {xy && i === 0 ? "X" : "Y"}
                            </span>
                            <span
                              className="column-line"
                              style={{
                                background:
                                  xy && i === 0
                                    ? "#b9c6c5"
                                    : project.graph.colors[
                                        (i - (xy ? 1 : 0)) %
                                          project.graph.colors.length
                                      ] || palette[i % palette.length],
                              }}
                            />
                          </th>
                        ))}
                        <th className="add-column">
                          <button
                            aria-label="Add column"
                            disabled={project.columns.length >= 30}
                            onClick={() =>
                              change((p) => ({
                                ...p,
                                columns: [
                                  ...p.columns,
                                  {
                                    name: `Series ${p.columns.length + 1}`,
                                    values: Array(rows).fill(""),
                                  },
                                ],
                              }))
                            }
                          >
                            <Plus size={16} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: displayedRows }, (_, r) => (
                        <tr key={r}>
                          <th className="row-number">
                            <span>{r + 1}</span>
                            <button
                              aria-label={`Remove row ${r + 1}`}
                              title={`Remove row ${r + 1}`}
                              disabled={r >= rows}
                              onClick={() =>
                                change((p) => ({
                                  ...p,
                                  columns: p.columns.map((c) => ({
                                    ...c,
                                    values: c.values.filter((_, i) => i !== r),
                                  })),
                                }))
                              }
                            >
                              <X size={11} />
                            </button>
                          </th>
                          {displayedColumns.map((c, col) => {
                            let valid = true;
                            try {
                              numeric(c.values[r] ?? "");
                            } catch {
                              valid = false;
                            }
                            return (
                              <td key={col}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className={valid ? "" : "invalid-cell"}
                                  aria-label={`${c.name}, row ${r + 1}`}
                                  aria-invalid={!valid}
                                  value={c.values[r] ?? ""}
                                  onChange={(e) =>
                                    updateCell(col, r, e.target.value)
                                  }
                                  onPaste={(e) => paste(e, col, r)}
                                />
                              </td>
                            );
                          })}
                          <td className="blank-cell" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sheet-footer">
                  <button
                    className="text-button"
                    disabled={rows >= 10000}
                    onClick={() =>
                      change((p) => ({
                        ...p,
                        columns: p.columns.map((c) => ({
                          ...c,
                          values: [
                            ...Array.from(
                              { length: rows },
                              (_, i) => c.values[i] ?? "",
                            ),
                            "",
                          ],
                        })),
                      }))
                    }
                  >
                    <Plus size={14} />
                    Add row
                  </button>
                  <span>
                    {rows} rows · {project.columns.length} columns
                  </span>
                </div>
                <div className="table-tip">
                  Paste cells from a spreadsheet. Leave missing values blank.
                </div>
              </section>
              <section className="card graph-card">
                <div className="card-heading">
                  <div>
                    <span className="card-icon">
                      <BarChart3 size={17} />
                    </span>
                    <h2>{graphSheet?.name ?? "Graph"}</h2>
                  </div>
                </div>
                <div className="graph-types">
                  {(["scatter", "bar", "box", "line"] as const).map((t) => (
                    <button
                      key={t}
                      disabled={xy ? t === "bar" || t === "box" : t === "line"}
                      className={project.graph.type === t ? "selected" : ""}
                      onClick={() => graph({ type: t })}
                    >
                      {t === "scatter"
                        ? "Scatter"
                        : t === "bar"
                          ? "Bar"
                          : t === "box"
                            ? "Box plot"
                            : "Line"}
                    </button>
                  ))}
                </div>
                <div className="chart-title">{project.graph.title}</div>
                <Plot project={plotProject} result={plotResult} />
                <div className="legend">
                  {plotProject.columns.slice(xy ? 1 : 0).map((c, i) => (
                    <span key={i}>
                      <i
                        style={{
                          background:
                            project.graph.colors[
                              i % project.graph.colors.length
                            ] || palette[i % palette.length],
                        }}
                      />
                      {c.name}
                    </span>
                  ))}
                </div>
                <div className="graph-caption">
                  {xy
                    ? "X and Y observations"
                    : project.graph.type === "box"
                      ? "Median, interquartile range; whiskers show min–max"
                      : `Mean${project.graph.error === "none" ? "" : ` ± ${project.graph.error === "ci" ? "95% CI" : project.graph.error.toUpperCase()}`}`}
                  {project.graph.error === "ci" && !result && !xy
                    ? " · Run analysis to show confidence intervals"
                    : ""}
                </div>
                <div className="export-row">
                  <span>
                    <ArrowDownToLine size={14} />
                    Export figure
                  </span>
                  <div>
                    {(["svg", "png", "pdf"] as const).map((f) => (
                      <button
                        key={f}
                        disabled={exporting}
                        onClick={() => void exportGraph(f)}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <section className="card results-card">
              <div className="card-heading">
                <div>
                  <FlaskConical size={18} />
                  <h2>
                    {result
                      ? analysisLabels[project.analysis]
                      : "Analysis results"}
                  </h2>
                </div>
                {result && (
                  <span className="complete-badge">
                    <Check size={13} />
                    Complete
                  </span>
                )}
              </div>
              {!result ? (
                <div className="empty-results">
                  <div>
                    <FlaskConical size={30} />
                  </div>
                  <h3>No current results</h3>
                  <p>
                    Choose an analysis above and run it to see your results.
                    <br />
                    Linked results need recalculation whenever their source data
                    or parameters change.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void run()}
                  >
                    <Play size={14} />
                    {busy
                      ? browserOnly
                        ? "Loading / analyzing…"
                        : "Analyzing…"
                      : selectedSheet.kind === "results"
                        ? "Recalculate analysis"
                        : "Run analysis"}
                  </button>
                </div>
              ) : (
                <div className="results-content">
                  {result.warnings.map((w, i) => (
                    <div className="result-warning" key={i}>
                      {w}
                    </div>
                  ))}
                  <table className="analysis-output">
                    <thead>
                      <tr>
                        <th className="output-row-number" />
                        <th colSpan={2}>{analysisLabels[project.analysis]}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th className="output-row-number">1</th>
                        <th>Table analyzed</th>
                        <td>{source.name}</td>
                      </tr>
                      {result.results.map((r, i) => (
                        <tr key={i}>
                          <th className="output-row-number">{i + 2}</th>
                          <th>{r.label}</th>
                          <td>
                            {typeof r.value === "number"
                              ? fmt(r.value)
                              : (r.value ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3>Summary statistics</h3>
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Statistic</th>
                          {result.summary.map((c) => (
                            <th key={c.name}>{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["n", "Number of values"],
                            ["mean", "Mean"],
                            ["sd", "Standard deviation"],
                            ["sem", "Std. error of mean"],
                            ["median", "Median"],
                            ["min", "Minimum"],
                            ["max", "Maximum"],
                            ["ci_low", "Lower 95% CI"],
                            ["ci_high", "Upper 95% CI"],
                          ] as const
                        ).map(([key, label]) => (
                          <tr key={key}>
                            <th>{label}</th>
                            {result.summary.map((c) => (
                              <td key={c.name}>{fmt(c[key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.analysis === "descriptive" && (
                    <details className="extended-summary">
                      <summary>Additional descriptive statistics</summary>
                      <div className="results-table-wrap">
                        <table className="results-table">
                          <thead>
                            <tr>
                              <th>Statistic</th>
                              {result.summary.map((s) => (
                                <th key={s.name}>{s.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {extendedMetrics.map(([key, label]) => (
                              <tr key={key}>
                                <th>{label}</th>
                                {result.summary.map((s) => (
                                  <td
                                    key={s.name}
                                    title={s.undefined_reasons?.[key]}
                                  >
                                    {fmt(s[key])}
                                    {s.undefined_reasons?.[key] && (
                                      <small className="undefined-stat">
                                        {s.undefined_reasons[key]}
                                      </small>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                  <p className="result-footnote">
                    Missing values are excluded where appropriate. Review
                    warnings and model assumptions before interpreting results.
                  </p>
                  <button className="button" onClick={() => setActive("data")}>
                    <BarChart3 size={16} />
                    Back to data & graph
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="desktop-statusbar">
            <div className="status-view-buttons">
              <button
                aria-label="Show data table"
                className={active === "data" ? "selected" : ""}
                onClick={() => setActive("data")}
                title="Data table"
              >
                <Table2 size={15} />
              </button>
              <button
                aria-label="Show results"
                className={active === "results" ? "selected" : ""}
                onClick={() => setActive("results")}
                title="Results"
              >
                <FileText size={15} />
              </button>
              <button
                aria-label="Show graph"
                className={active === "graph" ? "selected" : ""}
                onClick={() => setActive("graph")}
                title="Graph"
              >
                <BarChart3 size={15} />
              </button>
            </div>
            <select
              aria-label="Current sheet"
              value={selectedSheet.id}
              onChange={(e) => selectSheet(e.target.value)}
            >
              {workbook.sheets.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name}
                </option>
              ))}
            </select>
            <span>
              {active === "data"
                ? `${rows} rows · ${project.columns.length} columns · ${count} values`
                : active === "results"
                  ? "Tabular results"
                  : "Graph sheet"}
            </span>
            <span className="status-save">
              {busy
                ? "Analyzing…"
                : recovery
                  ? "Autosave paused"
                  : saved
                    ? "Saved in browser"
                    : "Browser storage unavailable"}
            </span>
          </footer>
        </div>
      </main>
      {newTable && (
        <NewTableDialog
          onClose={() => setNewTable(false)}
          onCreate={(type, name) => {
            setWorkbook((w) => addData(w, blankProject(type, name)));
            setNewTable(false);
          }}
        />
      )}
      {analyzeDialog && (
        <AnalyzeDialog
          project={project}
          onClose={() => setAnalyzeDialog(false)}
          onRun={(analysis, indices, prefix) => {
            setAnalyzeDialog(false);
            void run(analysis, indices, prefix, true);
          }}
        />
      )}
      {formatDialog && graphSheet && (
        <FormatGraphDialog
          sheet={graphSheet}
          project={source.project}
          results={workbook.sheets.filter(
            (s): s is ResultSheet =>
              s.kind === "results" && s.dataId === source.id,
          )}
          onClose={() => setFormatDialog(false)}
          onApply={(next) =>
            setWorkbook((w) => ({
              ...w,
              sheets: w.sheets.map((s) => (s.id === next.id ? next : s)),
            }))
          }
        />
      )}
      {imported.length > 0 && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <div className="modal-heading">
              <h2 id="import-title">Import a Prism data table</h2>
              <button
                aria-label="Cancel import"
                onClick={() => setImported([])}
              >
                <X size={18} />
              </button>
            </div>
            <p>
              Imports supported raw Column and XY data from Prism XML or ZIP
              projects. Original graphs, results, formatting, replicate layouts,
              and legacy binary files are not imported.
            </p>
            <label>
              Choose a table
              <select
                value={selectedImport}
                onChange={(e) => setSelectedImport(Number(e.target.value))}
              >
                {imported.map((t, i) => (
                  <option key={i} value={i}>
                    {t.title} · {t.table_type} · {t.columns.length} columns
                  </option>
                ))}
              </select>
            </label>
            {importWarnings.map((w, i) => (
              <p className="result-warning" key={i}>
                {w}
              </p>
            ))}
            <p>
              This adds a new data table and graph to your current workbook.
            </p>
            <div className="modal-actions">
              <button className="button" onClick={() => setImported([])}>
                Cancel
              </button>
              <button className="button primary" onClick={applyImport}>
                Import table
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
