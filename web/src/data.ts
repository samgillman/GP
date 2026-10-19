export type TableType = "column" | "xy";
export type Analysis =
  | "descriptive"
  | "welch_t"
  | "paired_t"
  | "anova"
  | "linear_regression"
  | "dose_response"
  | "nonlinear_regression";
export type GraphType = "scatter" | "bar" | "box" | "line";
export type ErrorType = "sd" | "sem" | "ci" | "none";
export type Column = { name: string; values: string[] };
export type Graph = {
  type: GraphType;
  error: ErrorType;
  title: string;
  x_label: string;
  y_label: string;
  colors: string[];
  show_points: boolean;
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
export function numeric(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
    throw new Error(`“${value}” is not a valid number.`);
  const n = Number(value);
  if (!Number.isFinite(n))
    throw new Error(`“${value}” is outside the supported number range.`);
  return n;
}
export function requestData(project: Project) {
  return {
    table_type: project.table_type,
    analysis: project.analysis,
    confidence: 0.95,
    regression_model: project.regression_model ?? "one_phase_decay",
    columns: project.columns.map((c) => ({
      name: c.name,
      values: c.values.map((value, i) => {
        try {
          return numeric(value);
        } catch {
          throw new Error(
            `${c.name}, row ${i + 1}: “${value}” is not a finite number. Use an empty cell for missing data.`,
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
  while (rows.length && rows[rows.length - 1].every((c) => c === ""))
    rows.pop();
  return rows;
}
export function importCsv(text: string): Column[] {
  const rows = parseDelimited(text);
  if (rows.length < 2)
    throw new Error("CSV needs a header row and at least one data row.");
  const headers = rows[0];
  if (headers.length > 30 || rows.length > 10001)
    throw new Error("Use up to 30 columns and 10,000 rows.");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length > headers.length)
      throw new Error(`Row ${i + 1} has more fields than the header.`);
    rows[i].forEach(numeric);
  }
  return headers.map((h, c) => ({
    name: h.trim() || `Series ${c + 1}`,
    values: rows.slice(1).map((row) => row[c] ?? ""),
  }));
}
export function exportCsv(columns: Column[]): string {
  const quote = (v: string) =>
    /[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  return [
    columns.map((c) => quote(c.name)).join(","),
    ...Array.from(
      { length: Math.max(0, ...columns.map((c) => c.values.length)) },
      (_, i) => columns.map((c) => quote(c.values[i] ?? "")).join(","),
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
    !Array.isArray(g.colors) ||
    !g.colors.every(
      (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
    )
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
  return n == null
    ? "—"
    : Math.abs(n) > 0 && Math.abs(n) < 0.001
      ? n.toExponential(3)
      : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(n);
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
export type Response = {
  analysis: string;
  summary: Summary[];
  results: { label: string; value: number | string | null }[];
  warnings: string[];
  fit: {
    series: string;
    points: { x: number; y: number }[];
    parameters: Record<string, unknown>;
  }[];
};
