import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { download, parseDelimited } from "./data";
import "./advanced.css";

type Mode = "survival" | "factorial";
type CurveRow = {
  time: number;
  at_risk: number;
  events: number;
  censored: number;
  survival: number;
  ci_lower: number | null;
  ci_upper: number | null;
};
type Curve = {
  n: number;
  events: number;
  censored: number;
  median: number | null;
  median_ci_lower: number | null;
  median_ci_upper: number | null;
  confidence: number;
  ci_method: string;
  table: CurveRow[];
  warnings: string[];
};
type SurvivalResult = {
  curves: Record<string, Curve>;
  logrank: null | {
    statistic: number | null;
    df: number;
    p_value: number | null;
    observed: Record<string, number>;
    expected: Record<string, number>;
    warnings: string[];
  };
  warnings: string[];
};
type FactorialResult = {
  anova_table: {
    term: string;
    label: string;
    ss: number;
    df: number;
    ms: number | null;
    f: number | null;
    p: number | null;
    variation_percent: number | null;
  }[];
  means: {
    grand: number;
    cells: {
      row_level: string;
      column_level: string;
      n: number;
      mean: number;
    }[];
  };
  design: { replicates_per_cell: number; observations: number };
  warnings: string[];
};
type Result =
  | { mode: "survival"; data: SurvivalResult }
  | { mode: "factorial"; data: FactorialResult };
const examples: Record<Mode, string> = {
  survival:
    "Time,Event,Group\n2,1,Control\n3,1,Control\n4,0,Control\n5,1,Control\n7,1,Control\n9,0,Control\n4,1,Treatment\n6,0,Treatment\n7,1,Treatment\n9,1,Treatment\n11,0,Treatment\n12,1,Treatment",
  factorial:
    "Treatment,Sex,Response\nControl,Female,8\nControl,Female,10\nControl,Female,9\nControl,Male,10\nControl,Male,12\nControl,Male,11\nDrug,Female,14\nDrug,Female,16\nDrug,Female,15\nDrug,Male,17\nDrug,Male,20\nDrug,Male,18",
};
const colors = [
  "#237d74",
  "#c75539",
  "#6765ad",
  "#b9821b",
  "#2b78ac",
  "#ae4d86",
  "#648336",
  "#535b64",
];
type InputDocument = {
  format: "gp-grouped-input";
  version: 1;
  mode: Mode;
  inputs: Record<Mode, string>;
  mappings: Record<Mode, number[]>;
  delimiters: Record<Mode, string>;
};
const INPUT_STORAGE = "gp.grouped-input.v1";
// Keep this tab's draft across navigation even if browser storage is full.
let sessionDraft: InputDocument | null = null;
function parseInputDocument(text: string): InputDocument {
  if (text.length > 32 * 1024 * 1024)
    throw new Error("The analysis input document must be smaller than 32 MB.");
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null)
    throw new Error("Choose a GP grouped-analysis input JSON document.");
  const doc = value as Record<string, unknown>;
  if (
    doc.format !== "gp-grouped-input" ||
    doc.version !== 1 ||
    (doc.mode !== "survival" && doc.mode !== "factorial")
  )
    throw new Error(
      "Choose a supported GP grouped-analysis input document (version 1).",
    );
  for (const field of ["inputs", "mappings", "delimiters"])
    if (
      typeof doc[field] !== "object" ||
      doc[field] === null ||
      Array.isArray(doc[field])
    )
      throw new Error(`The document is missing valid ${field}.`);
  const inputs = doc.inputs as Record<Mode, unknown>;
  const mappings = doc.mappings as Record<Mode, unknown>;
  const delimiters = doc.delimiters as Record<Mode, unknown>;
  for (const key of ["survival", "factorial"] as const) {
    if (typeof inputs[key] !== "string" || inputs[key].length > 8 * 1024 * 1024)
      throw new Error("Each input table must be text of at most 8 MB.");
    const mapping = mappings[key];
    if (
      !Array.isArray(mapping) ||
      mapping.length !== 3 ||
      mapping.some(
        (index) => !Number.isInteger(index) || index < 0 || index > 99,
      )
    )
      throw new Error(
        "Each analysis needs three column mappings between 0 and 99.",
      );
    if (![",", "\t", ";"].includes(delimiters[key] as string))
      throw new Error("Choose comma, tab or semicolon separators.");
  }
  return {
    format: "gp-grouped-input",
    version: 1,
    mode: doc.mode,
    inputs: {
      survival: inputs.survival as string,
      factorial: inputs.factorial as string,
    },
    mappings: {
      survival: [...(mappings.survival as number[])],
      factorial: [...(mappings.factorial as number[])],
    },
    delimiters: {
      survival: delimiters.survival as string,
      factorial: delimiters.factorial as string,
    },
  };
}
function initialInputDocument(): { draft: InputDocument; warning: string } {
  const defaults: InputDocument = {
    format: "gp-grouped-input",
    version: 1,
    mode: "survival",
    inputs: { ...examples },
    mappings: { survival: [0, 1, 2], factorial: [0, 1, 2] },
    delimiters: { survival: ",", factorial: "," },
  };
  if (sessionDraft) return { draft: sessionDraft, warning: "" };
  try {
    const stored = localStorage.getItem(INPUT_STORAGE);
    return {
      draft: stored ? parseInputDocument(stored) : defaults,
      warning: "",
    };
  } catch {
    return {
      draft: defaults,
      warning:
        "The previous browser draft could not be restored. Open a saved analysis input JSON to recover your data.",
    };
  }
}

function precise(value: number | null | undefined) {
  return value == null ? "—" : Number(value.toPrecision(7)).toString();
}
function timeTick(value: number) {
  return Number(value.toPrecision(4)).toString();
}
function quote(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function saveCsv(rows: unknown[][], name: string) {
  download(
    new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    name,
  );
}
function readTable(text: string, delimiter: string) {
  if (text.length > 8 * 1024 * 1024)
    throw new Error("Use a table smaller than 8 MB.");
  const rows = parseDelimited(text, delimiter);
  const headers = rows.shift()?.map((value) => value.trim()) ?? [];
  if (headers.length < 3 || headers.length > 100)
    throw new Error("Provide a header row with 3 to 100 named columns.");
  if (headers.some((name) => !name) || new Set(headers).size !== headers.length)
    throw new Error("Give each column a unique, nonempty header.");
  if (!rows.length || rows.length > 100000)
    throw new Error(
      "Provide between 1 and 100,000 observations below the header.",
    );
  rows.forEach((row, index) => {
    if (row.length !== headers.length)
      throw new Error(
        `Row ${index + 2} has ${row.length} fields; expected ${headers.length}. Empty or incomplete rows must be resolved.`,
      );
  });
  return { headers, rows };
}
function numericCell(value: string, row: number, field: string) {
  const trimmed = value.trim();
  if (!trimmed || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed))
    throw new Error(
      `Row ${row}: ${field} must contain a number; missing values are not omitted.`,
    );
  const number = Number(trimmed);
  if (!Number.isFinite(number) || Math.abs(number) > 1e100)
    throw new Error(
      `Row ${row}: ${field} must be finite, with magnitude at most 1e100.`,
    );
  return number;
}
function level(value: string, row: number) {
  const name = value.trim();
  if (!name || name.length > 100)
    throw new Error(
      `Row ${row}: group and factor labels need 1 to 100 characters.`,
    );
  return name;
}
function requestBody(
  mode: Mode,
  table: ReturnType<typeof readTable>,
  mapping: number[],
) {
  if (
    new Set(mapping).size !== 3 ||
    mapping.some((index) => !table.headers[index])
  )
    throw new Error("Map three different columns before running the analysis.");
  if (mode === "survival") {
    const groups: Record<string, { times: number[]; events: number[] }> =
      Object.create(null);
    table.rows.forEach((row, index) => {
      const time = numericCell(row[mapping[0]], index + 2, "Time");
      const event = numericCell(row[mapping[1]], index + 2, "Event");
      const group = level(row[mapping[2]], index + 2);
      if (time < 0)
        throw new Error(`Row ${index + 2}: time must be nonnegative.`);
      if (event !== 0 && event !== 1)
        throw new Error(
          `Row ${index + 2}: event must be 1 (event) or 0 (right censoring).`,
        );
      groups[group] ??= { times: [], events: [] };
      groups[group].times.push(time);
      groups[group].events.push(event);
    });
    if (Object.keys(groups).length > 32)
      throw new Error("A survival analysis supports at most 32 groups.");
    return { groups, confidence: 0.95 };
  }
  const rows = new Set<string>();
  const columns = new Set<string>();
  const cells = new Map<
    string,
    { row_level: string; column_level: string; values: number[] }
  >();
  table.rows.forEach((record, index) => {
    const row = level(record[mapping[0]], index + 2);
    const column = level(record[mapping[1]], index + 2);
    const response = numericCell(record[mapping[2]], index + 2, "Response");
    rows.add(row);
    columns.add(column);
    const key = JSON.stringify([row, column]);
    if (!cells.has(key))
      cells.set(key, { row_level: row, column_level: column, values: [] });
    cells.get(key)!.values.push(response);
  });
  if (rows.size < 2 || columns.size < 2 || rows.size > 32 || columns.size > 32)
    throw new Error("Each factor must have between 2 and 32 levels.");
  if (cells.size !== rows.size * columns.size)
    throw new Error(
      "Every factor combination needs observations. Missing cells are unsupported.",
    );
  const counts = [...cells.values()].map((cell) => cell.values.length);
  if (counts[0] < 2 || new Set(counts).size !== 1)
    throw new Error(
      "Use the same number of independent replicates in every factor combination, with at least two per combination.",
    );
  return {
    analysis: "two_way_anova",
    design: "ordinary",
    row_factor_name: table.headers[mapping[0]],
    column_factor_name: table.headers[mapping[1]],
    row_levels: [...rows],
    column_levels: [...columns],
    cells: [...cells.values()],
  };
}

function SurvivalChart({
  data,
  chartRef,
}: {
  data: SurvivalResult;
  chartRef: React.RefObject<SVGSVGElement | null>;
}) {
  const entries = Object.entries(data.curves);
  const largest = Math.max(
    ...entries.map(([, curve]) => curve.table.at(-1)!.time),
  );
  const xmax = largest || 1;
  const height = 425 + entries.length * 23;
  const x = (time: number) => 78 + (time / xmax) * 620;
  const y = (survival: number) => 350 - survival * 300;
  return (
    <svg
      ref={chartRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 760 ${height}`}
      role="img"
      aria-label="Kaplan–Meier survival curves with censor marks"
      style={{
        width: "100%",
        background: "white",
        fontFamily: "Arial, sans-serif",
        color: "#293d40",
      }}
    >
      <title>Kaplan–Meier survival curves</title>
      <rect width="760" height={height} fill="white" />
      <text x="380" y="24" textAnchor="middle" fontSize="17" fill="#293d40">
        Kaplan–Meier survival
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((value) => (
        <g key={value}>
          <line x1="78" x2="698" y1={y(value)} y2={y(value)} stroke="#e8ece9" />
          <text
            x="65"
            y={y(value) + 4}
            textAnchor="end"
            fontSize="12"
            fill="#293d40"
          >
            {value * 100}
          </text>
        </g>
      ))}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((value) => (
        <g key={value}>
          <line
            x1={x(value * xmax)}
            x2={x(value * xmax)}
            y1="350"
            y2="356"
            stroke="#293d40"
          />
          <text
            x={x(value * xmax)}
            y="374"
            textAnchor="middle"
            fontSize="12"
            fill="#293d40"
          >
            {timeTick(value * xmax)}
          </text>
        </g>
      ))}
      <path d="M78 50V350H698" fill="none" stroke="#293d40" strokeWidth="1.5" />
      <text x="388" y="402" textAnchor="middle" fontSize="13" fill="#293d40">
        Time (input units)
      </text>
      <text
        transform="translate(22 200) rotate(-90)"
        textAnchor="middle"
        fontSize="13"
        fill="#293d40"
      >
        Survival (%)
      </text>
      {entries.map(([name, curve], index) => {
        const color = colors[index % colors.length];
        const dash =
          index >= colors.length
            ? `${(Math.floor(index / colors.length) + 1) * 3} 3`
            : undefined;
        const path =
          `M${x(0)} ${y(1)} ` +
          curve.table
            .map((row) => `H${x(row.time)}V${y(row.survival)}`)
            .join(" ");
        return (
          <g key={name}>
            <path
              d={path}
              stroke={color}
              strokeWidth="2.5"
              fill="none"
              strokeDasharray={dash}
            />
            {curve.table
              .filter((row) => row.censored > 0)
              .map((row) => (
                <path
                  key={row.time}
                  d={`M${x(row.time) - 4} ${y(row.survival)}h8M${x(row.time)} ${y(row.survival) - 5}v10`}
                  stroke={color}
                  strokeWidth="1.6"
                >
                  <title>
                    {name}: {row.censored} censored at time {row.time}
                  </title>
                </path>
              ))}
            <line
              x1="82"
              x2="111"
              y1={430 + index * 23}
              y2={430 + index * 23}
              stroke={color}
              strokeWidth="2.5"
              strokeDasharray={dash}
            />
            <text x="122" y={434 + index * 23} fontSize="12" fill="#293d40">
              {name.length > 72 ? `${name.slice(0, 69)}…` : name} (n = {curve.n}
              )
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AdvancedAnalyses({ onBack }: { onBack: () => void }) {
  const [initial] = useState(initialInputDocument);
  const [mode, setMode] = useState<Mode>(initial.draft.mode);
  const [inputs, setInputs] = useState(initial.draft.inputs);
  const [mappings, setMappings] = useState(initial.draft.mappings);
  const [delimiters, setDelimiters] = useState(initial.draft.delimiters);
  const [saved, setSaved] = useState(true);
  const [restoreWarning, setRestoreWarning] = useState(initial.warning);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const draft: InputDocument = {
      format: "gp-grouped-input",
      version: 1,
      mode,
      inputs,
      mappings,
      delimiters,
    };
    sessionDraft = draft;
    try {
      localStorage.setItem(INPUT_STORAGE, JSON.stringify(draft));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [mode, inputs, mappings, delimiters]);
  const parsed = useMemo(() => {
    try {
      return { table: readTable(inputs[mode], delimiters[mode]), error: "" };
    } catch (problem) {
      return { table: null, error: (problem as Error).message };
    }
  }, [inputs, mode, delimiters]);
  function invalidate() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setResult(null);
    setError("");
  }
  async function run() {
    invalidate();
    const ctrl = new AbortController();
    controller.current = ctrl;
    try {
      if (!parsed.table) throw new Error(parsed.error);
      const payload = requestBody(mode, parsed.table, mappings[mode]);
      setBusy(true);
      const response = await apiFetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const body = await response.json();
      if (!response.ok) {
        const detail = body.detail ?? body.error;
        throw new Error(
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((item: { msg?: string }) => item.msg ?? "Invalid input")
                  .join("; ")
              : "The analysis could not be completed.",
        );
      }
      if (controller.current === ctrl)
        setResult(
          mode === "survival"
            ? { mode, data: body as SurvivalResult }
            : { mode, data: body as FactorialResult },
        );
    } catch (problem) {
      if (
        controller.current === ctrl &&
        (problem as Error).name !== "AbortError"
      )
        setError((problem as Error).message);
    } finally {
      if (controller.current === ctrl) setBusy(false);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    invalidate();
    if (file.size > 8 * 1024 * 1024) {
      setError("Use a CSV or TSV file smaller than 8 MB.");
      return;
    }
    try {
      const text = await file.text();
      setInputs((old) => ({ ...old, [mode]: text }));
      setDelimiters((old) => ({
        ...old,
        [mode]: /\.tsv$/i.test(file.name) ? "\t" : ",",
      }));
      setMappings((old) => ({ ...old, [mode]: [0, 1, 2] }));
    } catch {
      setError("The selected file could not be read.");
    }
  }
  async function openInput(file: File | undefined) {
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) {
      setError("The analysis input document must be smaller than 32 MB.");
      return;
    }
    try {
      const document = parseInputDocument(await file.text());
      invalidate();
      setMode(document.mode);
      setInputs(document.inputs);
      setMappings(document.mappings);
      setDelimiters(document.delimiters);
      setRestoreWarning("");
    } catch (problem) {
      setError((problem as Error).message);
    }
  }
  function saveInput() {
    const document: InputDocument = {
      format: "gp-grouped-input",
      version: 1,
      mode,
      inputs,
      mappings,
      delimiters,
    };
    download(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      }),
      "gp-grouped-input.json",
    );
  }
  function resultCsv() {
    if (!result) return;
    if (result.mode === "survival") {
      saveCsv(
        [
          [
            "Group",
            "Time",
            "At risk",
            "Events",
            "Censored",
            "Survival",
            "95% CI lower",
            "95% CI upper",
          ],
          ...Object.entries(result.data.curves).flatMap(([name, curve]) =>
            curve.table.map((row) => [
              name,
              row.time,
              row.at_risk,
              row.events,
              row.censored,
              row.survival,
              row.ci_lower,
              row.ci_upper,
            ]),
          ),
        ],
        "gp-survival-results.csv",
      );
    } else {
      saveCsv(
        [
          ["Source", "SS", "df", "MS", "F", "P value", "% of total variation"],
          ...result.data.anova_table.map((row) => [
            row.label,
            row.ss,
            row.df,
            row.ms,
            row.f,
            row.p,
            row.variation_percent,
          ]),
        ],
        "gp-two-way-anova.csv",
      );
    }
  }
  const labels =
    mode === "survival"
      ? ["Time column", "Event column", "Group column"]
      : ["Factor A column", "Factor B column", "Response column"];
  const warnings = result
    ? result.mode === "survival"
      ? [
          ...result.data.warnings,
          ...(result.data.logrank?.warnings ?? []),
          ...Object.entries(result.data.curves).flatMap(([name, curve]) =>
            curve.warnings.map((warning) => `${name}: ${warning}`),
          ),
        ]
      : result.data.warnings
    : [];

  return (
    <main className="advanced-page">
      <header className="advanced-header">
        <button className="advanced-back" onClick={onBack}>
          ← Back to project
        </button>
        <div>
          <p className="advanced-eyebrow">GP · Grouped analyses</p>
          <h1>Survival & two-way ANOVA</h1>
          <p>One observation per row, with explicit groups and factors.</p>
        </div>
      </header>
      <div className="advanced-toolbar advanced-input-files">
        <button onClick={saveInput}>Save analysis input JSON</button>
        <button onClick={() => inputFileRef.current?.click()}>
          Open analysis input JSON
        </button>
        <input
          ref={inputFileRef}
          type="file"
          hidden
          accept=".json,application/json"
          aria-label="Open grouped analysis input file"
          onChange={(event) => {
            void openInput(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span role="status" className="advanced-note">
          {saved
            ? "Inputs saved in this browser."
            : "Browser storage is unavailable or full. Inputs remain in this tab; save JSON before closing or reloading."}
        </span>
      </div>
      {restoreWarning && (
        <p className="advanced-input-error" role="alert">
          {restoreWarning}
        </p>
      )}
      <div className="advanced-tabs" role="tablist" aria-label="Analysis type">
        {(["survival", "factorial"] as const).map((value) => (
          <button
            key={value}
            id={`advanced-tab-${value}`}
            role="tab"
            aria-selected={mode === value}
            aria-controls="advanced-workspace"
            onClick={() => {
              invalidate();
              setMode(value);
            }}
          >
            {value === "survival" ? "Survival analysis" : "Two-way ANOVA"}
          </button>
        ))}
      </div>
      <div
        id="advanced-workspace"
        role="tabpanel"
        aria-labelledby={`advanced-tab-${mode}`}
      >
        <section className="advanced-card">
          <h2>
            {mode === "survival"
              ? "Follow each subject over time"
              : "Compare two experimental factors"}
          </h2>
          <p>
            {mode === "survival"
              ? "Each row represents one subject. Time is measured from study entry; event = 1 means the event occurred, and event = 0 means the subject was right censored. Use a single consistent time unit."
              : "Each row represents one independent measurement. Map the two categorical factors and the numerical response. All factor combinations must have the same number of replicates, with at least two per combination."}
          </p>
          <p className="advanced-note">
            {mode === "survival"
              ? "Kaplan–Meier estimates with 95% log-log Greenwood intervals and an overall Mantel–Cox logrank comparison when there are multiple groups. Delayed entry, competing risks and paired comparisons are not supported."
              : "Ordinary, balanced, fixed-effects ANOVA includes the interaction. Repeated measures, missing cells, unbalanced designs and post-hoc comparisons are not supported."}
          </p>
          <div className="advanced-toolbar">
            <button onClick={() => fileRef.current?.click()}>
              Import CSV / TSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              aria-label="Import grouped data file"
              hidden
              onChange={(event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              onClick={() => {
                invalidate();
                setInputs((old) => ({ ...old, [mode]: examples[mode] }));
                setMappings((old) => ({ ...old, [mode]: [0, 1, 2] }));
                setDelimiters((old) => ({ ...old, [mode]: "," }));
              }}
            >
              Load example
            </button>
            <button
              disabled={!parsed.table}
              onClick={() =>
                parsed.table &&
                saveCsv(
                  [parsed.table.headers, ...parsed.table.rows],
                  `gp-${mode}-data.csv`,
                )
              }
            >
              Save data CSV
            </button>
            <label>
              Separator
              <select
                aria-label="Data separator"
                value={delimiters[mode]}
                onChange={(event) => {
                  invalidate();
                  setDelimiters((old) => ({
                    ...old,
                    [mode]: event.target.value,
                  }));
                }}
              >
                <option value=",">Comma</option>
                <option value={"\t"}>Tab</option>
                <option value=";">Semicolon</option>
              </select>
            </label>
          </div>
          <label className="advanced-editor-label" htmlFor="advanced-csv">
            Edit or paste data, including the header row
          </label>
          <textarea
            id="advanced-csv"
            spellCheck={false}
            rows={10}
            value={inputs[mode]}
            onChange={(event) => {
              invalidate();
              setInputs((old) => ({ ...old, [mode]: event.target.value }));
            }}
          />
          {parsed.error && (
            <p className="advanced-input-error">{parsed.error}</p>
          )}
          <div className="advanced-mappings">
            {labels.map((label, index) => (
              <label key={label}>
                {label}
                <select
                  aria-label={label}
                  value={mappings[mode][index]}
                  onChange={(event) => {
                    invalidate();
                    setMappings((old) => ({
                      ...old,
                      [mode]: old[mode].map((value, position) =>
                        position === index ? Number(event.target.value) : value,
                      ),
                    }));
                  }}
                >
                  {(parsed.table?.headers ?? []).map((name, position) => (
                    <option key={position} value={position}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {parsed.table && (
            <details className="advanced-preview">
              <summary>
                Preview {parsed.table.rows.length.toLocaleString()} observations
              </summary>
              <div className="advanced-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {parsed.table.headers.map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.table.rows.slice(0, 12).map((row, index) => (
                      <tr key={index}>
                        {row.map((value, column) => (
                          <td key={column}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.table.rows.length > 12 && (
                <p>
                  Showing the first 12 rows. Every row is included in the
                  analysis.
                </p>
              )}
            </details>
          )}
          <div className="advanced-run">
            <button
              className="advanced-primary"
              disabled={busy || !parsed.table}
              onClick={() => void run()}
            >
              {busy ? "Calculating…" : "Run grouped analysis"}
            </button>
            <span role="status">
              {busy
                ? "Preparing the analysis. The first browser calculation may take longer."
                : "Missing values are rejected. No observations are silently removed."}
            </span>
          </div>
          {error && (
            <p className="advanced-error" role="alert">
              {error}
            </p>
          )}
        </section>
        {result && (
          <section
            className="advanced-card advanced-results"
            aria-label="Grouped analysis results"
          >
            <div className="advanced-result-heading">
              <h2>Results</h2>
              <div className="advanced-toolbar">
                <button onClick={resultCsv}>Download results CSV</button>
                <button
                  onClick={() =>
                    download(
                      new Blob([JSON.stringify(result.data, null, 2)], {
                        type: "application/json",
                      }),
                      `gp-${result.mode}-results.json`,
                    )
                  }
                >
                  Download results JSON
                </button>
              </div>
            </div>
            {result.mode === "survival" ? (
              <>
                <div className="advanced-chart">
                  <SurvivalChart data={result.data} chartRef={chartRef} />
                </div>
                <p className="advanced-note">
                  Steps show survival after each event. A + marks one or more
                  censored subjects at that time. Curves end at the last
                  observed time; confidence intervals are listed below.
                </p>
                <button
                  className="advanced-download"
                  onClick={() => {
                    if (chartRef.current)
                      download(
                        new Blob(
                          [
                            new XMLSerializer().serializeToString(
                              chartRef.current,
                            ),
                          ],
                          { type: "image/svg+xml" },
                        ),
                        "gp-survival.svg",
                      );
                  }}
                >
                  Download survival SVG
                </button>
                <h3>Group summaries</h3>
                <div className="advanced-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Group</th>
                        <th>Subjects</th>
                        <th>Events</th>
                        <th>Censored</th>
                        <th>Median time</th>
                        <th>Median 95% CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.data.curves).map(
                        ([name, curve]) => (
                          <tr key={name}>
                            <th scope="row">{name}</th>
                            <td>{curve.n}</td>
                            <td>{curve.events}</td>
                            <td>{curve.censored}</td>
                            <td>
                              {curve.median == null
                                ? "Not reached"
                                : precise(curve.median)}
                            </td>
                            <td>
                              {precise(curve.median_ci_lower)} to{" "}
                              {precise(curve.median_ci_upper)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="advanced-note">
                  Median time is the first time estimated survival reaches 50%.
                  A dash means an interval bound could not be estimated.
                </p>
                {result.data.logrank && (
                  <>
                    <h3>Overall logrank comparison</h3>
                    <dl className="advanced-stats">
                      <div>
                        <dt>Chi-square</dt>
                        <dd>{precise(result.data.logrank.statistic)}</dd>
                      </div>
                      <div>
                        <dt>Degrees of freedom</dt>
                        <dd>{result.data.logrank.df}</dd>
                      </div>
                      <div>
                        <dt>P value</dt>
                        <dd>{precise(result.data.logrank.p_value)}</dd>
                      </div>
                    </dl>
                    <p>
                      Tests the null hypothesis that all groups have the same
                      survival distribution. This is one overall comparison; it
                      does not identify individual group differences.
                    </p>
                  </>
                )}
                {Object.entries(result.data.curves).map(([name, curve]) => (
                  <details className="advanced-detail" key={name}>
                    <summary>{name}: risk and survival table</summary>
                    <div className="advanced-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>At risk</th>
                            <th>Events</th>
                            <th>Censored</th>
                            <th>Survival (%)</th>
                            <th>95% CI (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {curve.table.slice(0, 500).map((row) => (
                            <tr key={row.time}>
                              <td>{precise(row.time)}</td>
                              <td>{row.at_risk}</td>
                              <td>{row.events}</td>
                              <td>{row.censored}</td>
                              <td>{precise(100 * row.survival)}</td>
                              <td>
                                {precise(
                                  row.ci_lower == null
                                    ? null
                                    : 100 * row.ci_lower,
                                )}{" "}
                                to{" "}
                                {precise(
                                  row.ci_upper == null
                                    ? null
                                    : 100 * row.ci_upper,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {curve.table.length > 500 && (
                      <p className="advanced-note">
                        Showing the first 500 time points. Download results CSV
                        or JSON for the complete table.
                      </p>
                    )}
                    <p className="advanced-note">
                      At risk is counted before events and censoring at the
                      listed time. Log-log confidence bounds are undefined at
                      survival 0% and 100% and are shown as a dash.
                    </p>
                  </details>
                ))}
              </>
            ) : (
              <>
                <p>
                  {result.data.design.observations} independent observations ·{" "}
                  {result.data.design.replicates_per_cell} replicates per factor
                  combination · interaction included
                </p>
                <div className="advanced-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>SS</th>
                        <th>df</th>
                        <th>MS</th>
                        <th>F</th>
                        <th>P value</th>
                        <th>% variation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.anova_table.map((row) => (
                        <tr key={row.term}>
                          <th scope="row">{row.label}</th>
                          <td>{precise(row.ss)}</td>
                          <td>{row.df}</td>
                          <td>{precise(row.ms)}</td>
                          <td>{precise(row.f)}</td>
                          <td>{precise(row.p)}</td>
                          <td>{precise(row.variation_percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="advanced-note">
                  SS is the sum of squares; MS is SS divided by its degrees of
                  freedom. Each F statistic compares a term’s MS with the
                  residual MS. The interaction asks whether one factor’s effect
                  depends on the other factor.
                </p>
                <h3>Means by factor combination</h3>
                <p>Grand mean: {precise(result.data.means.grand)}</p>
                <div className="advanced-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Factor A level</th>
                        <th>Factor B level</th>
                        <th>n</th>
                        <th>Mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.means.cells.map((cell) => (
                        <tr
                          key={JSON.stringify([
                            cell.row_level,
                            cell.column_level,
                          ])}
                        >
                          <th scope="row">{cell.row_level}</th>
                          <td>{cell.column_level}</td>
                          <td>{cell.n}</td>
                          <td>{precise(cell.mean)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {warnings.length > 0 && (
              <aside className="advanced-assumptions">
                <h3>Assumptions and interpretation</h3>
                <ul>
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </aside>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
