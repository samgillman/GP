import type { ComparisonOptions } from "./column-analysis.ts";
import { validGraphAxes, axesSettingsProblem } from "./axes.ts";
import type { GraphAxes } from "./axes.ts";
export type { AxisSettings, GraphAxes, AxisNumberFormat } from "./axes.ts";
export type TableType = "column" | "xy";
export type Analysis =
  | "descriptive"
  | "welch_t"
  | "paired_t"
  | "anova"
  | "t_test"
  | "one_way_anova"
  | "linear_regression"
  | "dose_response"
  | "nonlinear_regression";
export type GraphType = "scatter" | "bar" | "box" | "line";
export type ErrorType = "sd" | "sem" | "ci" | "none";
export type Column = { id?: string; name: string; values: string[] };
export type Graph = {
  type: GraphType;
  error: ErrorType;
  title: string;
  x_label: string;
  y_label: string;
  colors: string[];
  show_points: boolean;
  /** Optional XY line rule. Missing Y rows break the line when true. */
  gap_at_missing_y?: boolean;
  axes?: GraphAxes;
  // Brackets from the graph's linked t test or one-way ANOVA.
  pairwise?: { style: "asterisks" | "p"; show_ns: boolean };
};
export type Project = {
  version: 1;
  name: string;
  table_type: TableType;
  columns: Column[];
  analysis: Analysis;
  graph: Graph;
  regression_model?: string;
};
export const palette = [
  "#20867e",
  "#df9b51",
  "#7186b3",
  "#b57d9e",
  "#87a365",
  "#aa845a",
];
const graph: Graph = {
  type: "bar",
  error: "sem",
  title: "Treatment response",
  x_label: "Treatment",
  y_label: "Response (a.u.)",
  colors: [...palette],
  show_points: true,
};
export function sample(kind: TableType): Project {
  if (kind === "xy")
    return {
      version: 1,
      name: "Dose response study",
      table_type: "xy",
      analysis: "dose_response",
      columns: [
        {
          name: "Concentration (µM)",
          values: ["0.1", "0.3", "1", "3", "10", "30", "100"],
        },
        {
          name: "Compound A",
          values: ["3", "8", "22", "47", "76", "91", "97"],
        },
        {
          name: "Compound B",
          values: ["2", "4", "12", "30", "61", "82", "94"],
        },
      ],
      graph: {
        ...graph,
        colors: [...palette],
        type: "line",
        title: "Concentration–response",
        x_label: "Concentration (µM)",
        y_label: "Response (%)",
        error: "none",
      },
    };
  return {
    version: 1,
    name: "Treatment response study",
    table_type: "column",
    analysis: "descriptive",
    columns: [
      {
        name: "Control",
        values: ["42", "38", "45", "41", "39", "44", "40", "43"],
      },
      {
        name: "Treatment A",
        values: ["58", "62", "55", "64", "61", "59", "63", "57"],
      },
      {
        name: "Treatment B",
        values: ["72", "78", "75", "81", "73", "79", "76", "74"],
      },
    ],
    graph: { ...graph, colors: [...palette] },
  };
}
export function importedProject(
  columns: Column[],
  tableType: TableType,
  name: string,
): Project {
  return {
    version: 1,
    name,
    table_type: tableType,
    analysis: "descriptive",
    columns: columns.map((column) => ({
      name: column.name,
      values: [...column.values],
    })),
    graph: {
      type: tableType === "xy" ? "line" : "bar",
      error: tableType === "xy" ? "none" : "sem",
      title: name,
      x_label: tableType === "xy" ? (columns[0]?.name ?? "X") : "Groups",
      y_label: "Value",
      colors: [...palette],
      show_points: true,
    },
  };
}
export const MAX_NUMERIC_MAGNITUDE = 1e100;
export function numeric(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
    throw new Error(`“${value}” is not a valid number.`);
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > MAX_NUMERIC_MAGNITUDE)
    throw new Error(`“${value}” is outside the supported range: −1e100 to 1e100.`);
  return n;
}
export function requestData(project: Project, options?: ComparisonOptions) {
  return {
    table_type: project.table_type,
    analysis: project.analysis,
    confidence: 0.95,
    ...(options ? { options } : {}),
    regression_model: project.regression_model ?? "one_phase_decay",
    columns: project.columns.map((c) => ({
      name: c.name,
      values: c.values.map((value, i) => {
        try {
          return numeric(value);
        } catch (error) {
          throw new Error(
            `${c.name}, row ${i + 1}: ${(error as Error).message} Enter a finite number, or leave the cell empty for missing data.`,
          );
        }
      }),
    })),
  };
}
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"' && !field && !closed) {
      quoted = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      closed = false;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closed = false;
      continue;
    }
    if (closed) {
      if (c === " " || c === "\t") continue;
      throw new Error("Unexpected text after a quoted field.");
    }
    if (c === '"')
      throw new Error(
        "Quotes inside a field must be escaped and the field quoted.",
      );
    field += c;
  }
  if (quoted) throw new Error("The file contains an unclosed quoted field.");
  if (field || row.length || closed) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
function csvDelimiter(text: string): "," | ";" {
  // Count separators outside quoted fields in the first two logical records.
  // A numeric data row resolves headers containing an unquoted other separator.
  const records: { comma: number; semicolon: number }[] = [];
  let counts = { comma: 0, semicolon: 0 };
  let quoted = false;
  for (let i = 0; i < text.length && records.length < 2; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === ",") counts.comma++;
      if (c === ";") counts.semicolon++;
      if (c === "\r" || c === "\n") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        records.push(counts);
        counts = { comma: 0, semicolon: 0 };
      }
    }
  }
  if (records.length < 2) records.push(counts);
  const [header, data] = records;
  if (header.semicolon && !header.comma) return ";";
  if (header.semicolon && data?.semicolon && !data.comma) return ";";
  return ",";
}
function readCsv(
  text: string,
  delimiter: "," | ";" | undefined,
  excludedMarks: boolean,
) {
  const rows = parseDelimited(text, delimiter ?? csvDelimiter(text));
  if (rows.length < 2)
    throw new Error("CSV needs a header row and at least one data row.");
  const headers = rows[0];
  if (headers.length > 30 || rows.length > 10001)
    throw new Error("Use up to 30 columns and 10,000 rows.");
  const excluded: { column: number; row: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length > headers.length)
      throw new Error(`Row ${i + 1} has more fields than the header.`);
    rows[i].forEach((value, c) => {
      const marked = excludedMarks ? /^\s*(\S+?)\s*\*\s*$/.exec(value) : null;
      if (marked) {
        try {
          if (numeric(marked[1]) !== null) {
            rows[i][c] = marked[1];
            excluded.push({ column: c, row: i - 1 });
            return;
          }
        } catch {
          // Not a number followed by an asterisk: report the original text below.
        }
      }
      try {
        numeric(value);
      } catch (error) {
        throw new Error(`CSV row ${i + 1}, column ${c + 1}: ${(error as Error).message}`);
      }
    });
  }
  return {
    columns: headers.map((h, c) => ({
      name: h.trim() ? h : `Series ${c + 1}`,
      values: rows.slice(1).map((row) => row[c] ?? ""),
    })),
    excluded,
  };
}
export function importCsv(text: string, delimiter?: "," | ";"): Column[] {
  return readCsv(text, delimiter, false).columns;
}
/** Like importCsv, but a number followed by an asterisk (GP's asterisk export
 * and Prism's documented excluded-value notation) imports as an excluded value.
 */
export function importCsvWithExclusions(text: string, delimiter?: "," | ";") {
  return readCsv(text, delimiter, true);
}
/** How excluded values are written: as plain numbers, followed by an asterisk,
 * or as blanks. These are the three choices the Prism guide documents.
 */
export type ExcludedExport = "value" | "asterisk" | "blank";
export function exportCsv(
  columns: Column[],
  excluded?: ReadonlyMap<number, ReadonlySet<number>>,
  mode: ExcludedExport = "value",
): string {
  const quote = (v: string) =>
    !v || /[";,\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  const cell = (column: number, row: number) => {
    const value = columns[column].values[row] ?? "";
    if (!value || !excluded?.get(column)?.has(row)) return value;
    return mode === "blank" ? "" : mode === "asterisk" ? `${value}*` : value;
  };
  return [
    columns.map((c) => quote(c.name)).join(","),
    ...Array.from(
      { length: Math.max(0, ...columns.map((c) => c.values.length)) },
      (_, i) => columns.map((_, c) => quote(cell(c, i))).join(","),
    ),
  ].join("\r\n");
}
export function parseProject(text: string): Project {
  const p = JSON.parse(text);
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    !["column", "xy"].includes(p.table_type) ||
    !Array.isArray(p.columns) ||
    p.columns.length < 1 ||
    p.columns.length > 30
  )
    throw new Error("This is not a supported GP project.");
  if (
    ![
      "descriptive",
      "welch_t",
      "paired_t",
      "anova",
      "t_test",
      "one_way_anova",
      "linear_regression",
      "dose_response",
      "nonlinear_regression",
    ].includes(p.analysis)
  )
    throw new Error("Unsupported project analysis.");
  for (const c of p.columns) {
    if (
      !c ||
      typeof c.name !== "string" ||
      (c.id !== undefined && (typeof c.id !== "string" || !c.id || c.id.length > 200)) ||
      !Array.isArray(c.values) ||
      c.values.length > 10000 ||
      !c.values.every((v: unknown) => typeof v === "string")
    )
      throw new Error("Invalid project table.");
    c.values.forEach(numeric);
  }
  if (
    p.regression_model !== undefined &&
    typeof p.regression_model !== "string"
  )
    throw new Error("Invalid regression model.");
  const g = p.graph;
  if (
    !g ||
    !["scatter", "bar", "box", "line"].includes(g.type) ||
    !["sd", "sem", "ci", "none"].includes(g.error) ||
    !["title", "x_label", "y_label"].every((k) => typeof g[k] === "string") ||
    typeof g.show_points !== "boolean" ||
    (g.gap_at_missing_y !== undefined && typeof g.gap_at_missing_y !== "boolean") ||
    (g.axes !== undefined && (!validGraphAxes(g.axes) ||
      axesSettingsProblem(g.axes, p.table_type === "xy") !== null)) ||
    !Array.isArray(g.colors) ||
    !g.colors.every(
      (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
    ) ||
    (g.pairwise !== undefined &&
      (!g.pairwise ||
        typeof g.pairwise !== "object" ||
        !["asterisks", "p"].includes(g.pairwise.style) ||
        typeof g.pairwise.show_ns !== "boolean" ||
        Object.keys(g.pairwise).length !== 2))
  )
    throw new Error("Invalid project graph settings.");
  return p as Project;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const magnitude = Math.abs(n);
  if (magnitude >= 1e6 || (magnitude > 0 && magnitude < 0.001))
    return n.toExponential(3);
  const rounded = Number(n.toFixed(3));
  if (!Number.isInteger(n) && Number.isInteger(rounded)) {
    // Preserve near-integer distinctions, especially R² values just below 1.
    const precise = Number(n.toPrecision(8));
    return precise === rounded
      ? String(n)
      : new Intl.NumberFormat("en", { maximumSignificantDigits: 8 }).format(n);
  }
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(n);
}
export type Summary = {
  name: string;
  n: number;
  mean: number | null;
  sd: number | null;
  sem: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  ci_low: number | null;
  ci_high: number | null;
  sum?: number | null;
  range?: number | null;
  cv_percent?: number | null;
  skewness?: number | null;
  excess_kurtosis?: number | null;
  q1?: number | null;
  q3?: number | null;
  p10?: number | null;
  p90?: number | null;
  geometric_mean?: number | null;
  geometric_sd_factor?: number | null;
  geometric_ci_low?: number | null;
  geometric_ci_high?: number | null;
  qc_mean_minus_1sd?: number | null;
  qc_mean_plus_1sd?: number | null;
  qc_mean_minus_2sd?: number | null;
  qc_mean_plus_2sd?: number | null;
  qc_mean_minus_3sd?: number | null;
  qc_mean_plus_3sd?: number | null;
  undefined_reasons?: Record<string, string>;
};
/** A Prism-style results page. Two-column tables are label/value rows where a
 * one-cell row is a section heading and an empty row is a spacer. */
export type ResultTable = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
};
/** Indices refer to the analyzed data sets in request order. */
export type PairwiseComparison = { a: number; b: number; p: number; summary: string };
export type Response = {
  analysis_revision?: number;
  analysis: string;
  summary: Summary[];
  // Graph points use observed cells. Matched analyses may summarize a smaller
  // complete-case population in `summary`; these CIs match the plotted cells.
  graph_summary?: Summary[];
  results: { label: string; value: number | string | null }[];
  tables?: ResultTable[];
  comparisons?: PairwiseComparison[];
  warnings: string[];
  fit: {
    series: string;
    points: { x: number; y: number }[];
    parameters: Record<string, unknown>;
  }[];
};
