import { parseProject, sample } from "./data.ts";
import type { Analysis, Graph, Project, Response, TableType } from "./data.ts";
export const WORKBOOK_STORAGE = "gp.workbook.v2";
export type DataSheet = {
  kind: "data";
  id: string;
  name: string;
  revision: number;
  project: Project;
};
export type ResultSheet = {
  kind: "results";
  id: string;
  name: string;
  dataId: string;
  analysis: Analysis;
  regression_model?: string;
  columnIndices: number[];
  sourceRevision: number;
  status: "current" | "stale";
  result: Response | null;
  selectionInvalid?: boolean;
};
export type GraphSheet = {
  kind: "graph";
  id: string;
  name: string;
  dataId: string;
  graph: Graph;
  columnIndices: number[];
  resultId: string | null;
};
export type Sheet = DataSheet | ResultSheet | GraphSheet;
export type Workbook = {
  version: 2;
  name: string;
  activeSheetId: string;
  sheets: Sheet[];
};
const id = () => crypto.randomUUID();
export function dataIndices(p: Project) {
  return p.columns
    .map((_, i) => i)
    .filter((i) => p.table_type !== "xy" || i !== 0);
}
export function fromProject(project: Project): Workbook {
  const dataId = id(),
    graphId = id();
  return {
    version: 2,
    name: project.name,
    activeSheetId: dataId,
    sheets: [
      { kind: "data", id: dataId, name: project.name, revision: 0, project },
      {
        kind: "graph",
        id: graphId,
        name: `${project.name} graph`,
        dataId,
        graph: structuredClone(project.graph),
        columnIndices: dataIndices(project),
        resultId: null,
      },
    ],
  };
}
export function sourceSheet(book: Workbook, sheet: Sheet): DataSheet {
  const data =
    sheet.kind === "data"
      ? sheet
      : book.sheets.find((s) => s.id === sheet.dataId);
  if (!data || data.kind !== "data")
    throw new Error("The source data table is missing.");
  return data;
}
export function selectedProject(data: DataSheet, indices: number[]): Project {
  return {
    ...data.project,
    columns: [
      ...(data.project.table_type === "xy" ? [data.project.columns[0]] : []),
      ...indices.map((i) => data.project.columns[i]).filter(Boolean),
    ],
  };
}
export function addData(book: Workbook, project: Project): Workbook {
  const fresh = fromProject(project);
  return {
    ...book,
    activeSheetId: fresh.activeSheetId,
    sheets: [...book.sheets, ...fresh.sheets],
  };
}
export function blankProject(type: TableType, name: string): Project {
  const p = sample(type);
  return {
    ...p,
    name,
    analysis: "descriptive",
    columns: (type === "xy" ? ["X", "Y"] : ["A", "B"]).map((name) => ({
      name,
      values: Array(8).fill(""),
    })),
    graph: {
      ...p.graph,
      title: name,
      x_label: type === "xy" ? "X" : "Group",
      y_label: "Y",
    },
  };
}
export function updateData(
  book: Workbook,
  dataId: string,
  next: Project,
): Workbook {
  const source = book.sheets.find((s) => s.id === dataId);
  if (!source || source.kind !== "data")
    throw new Error("Missing source table.");
  const changed =
    source.project.table_type !== next.table_type ||
    JSON.stringify(source.project.columns) !== JSON.stringify(next.columns);
  const structureChanged =
    source.project.table_type !== next.table_type ||
    source.project.columns.length !== next.columns.length;
  const remap = (indices: number[]) =>
    indices
      .map((i) => {
        if (!structureChanged) return i;
        const column = source.project.columns[i];
        const identity = next.columns.indexOf(column);
        if (identity >= 0) return identity;
        const matches = next.columns
          .map((c, j) => (c.name === column?.name ? j : -1))
          .filter((j) => j >= 0);
        return matches.length === 1 ? matches[0] : -1;
      })
      .filter(
        (i) =>
          i >= 0 &&
          i < next.columns.length &&
          (next.table_type !== "xy" || i !== 0),
      );
  return {
    ...book,
    sheets: book.sheets.map((s) => {
      if (s.id === dataId)
        return {
          ...source,
          project: next,
          name: next.name,
          revision: source.revision + (changed ? 1 : 0),
        };
      if (!changed || s.kind === "data" || s.dataId !== dataId) return s;
      const indices = remap(s.columnIndices);
      if (s.kind === "results")
        return {
          ...s,
          columnIndices: indices,
          selectionInvalid:
            s.selectionInvalid ||
            indices.length !== s.columnIndices.length ||
            source.project.table_type !== next.table_type,
          status: "stale" as const,
          result: null,
        };
      return {
        ...s,
        columnIndices: indices,
        graph: {
          ...s.graph,
          type:
            next.table_type === "xy"
              ? s.graph.type === "line"
                ? ("line" as const)
                : ("scatter" as const)
              : s.graph.type === "line"
                ? ("bar" as const)
                : s.graph.type,
        },
      };
    }),
  };
}
export function recordResult(
  book: Workbook,
  input: Omit<ResultSheet, "id" | "kind" | "status">,
  existingId?: string,
): Workbook {
  const data = book.sheets.find((s) => s.id === input.dataId);
  if (!data || data.kind !== "data" || data.revision !== input.sourceRevision)
    return book;
  const result: ResultSheet = {
    ...input,
    kind: "results",
    id: existingId ?? id(),
    status: "current",
  };
  return {
    ...book,
    activeSheetId: result.id,
    sheets: existingId
      ? book.sheets.map((s) => (s.id === existingId ? result : s))
      : [...book.sheets, result],
  };
}
export function addGraph(
  book: Workbook,
  dataId: string,
  resultId: string | null = null,
): Workbook {
  const source = book.sheets.find((s) => s.id === dataId) as DataSheet;
  const result = book.sheets.find((s) => s.id === resultId);
  const graph: GraphSheet = {
    id: id(),
    kind: "graph",
    name: `${source.name} graph ${book.sheets.filter((s) => s.kind === "graph" && s.dataId === dataId).length + 1}`,
    dataId,
    graph: structuredClone(source.project.graph),
    columnIndices:
      result?.kind === "results"
        ? [...result.columnIndices]
        : dataIndices(source.project),
    resultId,
  };
  return { ...book, activeSheetId: graph.id, sheets: [...book.sheets, graph] };
}
function responseValid(r: unknown): r is Response {
  if (!r || typeof r !== "object") return false;
  const v = r as Response;
  return (
    typeof v.analysis === "string" &&
    Array.isArray(v.summary) &&
    v.summary.length <= 30 &&
    v.summary.every(
      (s) =>
        s &&
        typeof s.name === "string" &&
        Number.isInteger(s.n) &&
        s.n >= 0 &&
        s.n <= 10000 &&
        Object.entries(s).every(([key, value]) =>
          key === "name" || key === "n"
            ? true
            : key === "undefined_reasons"
              ? value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                Object.entries(value).length <= 100 &&
                Object.values(value).every(
                  (v) => typeof v === "string" && v.length <= 10000,
                )
              : value === null ||
                (typeof value === "number" && Number.isFinite(value)),
        ) &&
        [
          "mean",
          "sd",
          "sem",
          "median",
          "min",
          "max",
          "ci_low",
          "ci_high",
        ].every((k) => {
          const n = (s as unknown as Record<string, unknown>)[k];
          return n === null || (typeof n === "number" && Number.isFinite(n));
        }),
    ) &&
    Array.isArray(v.results) &&
    v.results.length <= 1000 &&
    v.results.every(
      (s) =>
        s &&
        typeof s.label === "string" &&
        (s.value === null ||
          typeof s.value === "string" ||
          (typeof s.value === "number" && Number.isFinite(s.value))),
    ) &&
    Array.isArray(v.warnings) &&
    v.warnings.length <= 1000 &&
    v.warnings.every((s) => typeof s === "string") &&
    Array.isArray(v.fit) &&
    v.fit.length <= 30 &&
    v.fit.every(
      (f) =>
        f &&
        typeof f.series === "string" &&
        Array.isArray(f.points) &&
        f.points.length <= 10000 &&
        f.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
        f.parameters &&
        typeof f.parameters === "object" &&
        !Array.isArray(f.parameters) &&
        Object.entries(f.parameters).length <= 100 &&
        Object.values(f.parameters).every(
          (p) => typeof p === "number" && Number.isFinite(p),
        ),
    )
  );
}
function validateDraftProject(project: Project) {
  if (!project || !Array.isArray(project.columns))
    throw new Error("Invalid project table.");
  for (const c of project.columns) {
    if (
      !c ||
      !Array.isArray(c.values) ||
      c.values.length > 10000 ||
      !c.values.every((v) => typeof v === "string" && v.length <= 1000)
    )
      throw new Error("Invalid draft values.");
  }
  parseProject(
    JSON.stringify({
      ...project,
      columns: project.columns.map((c) => ({
        ...c,
        values: c.values.map(() => ""),
      })),
    }),
  );
}
export function parseWorkbook(text: string): Workbook {
  const raw = JSON.parse(text);
  if (raw?.version === 1) return fromProject(parseProject(text));
  if (
    !raw ||
    raw.version !== 2 ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.sheets) ||
    !raw.sheets.length ||
    raw.sheets.length > 500 ||
    typeof raw.activeSheetId !== "string"
  )
    throw new Error("This is not a supported GP workbook.");
  const book = raw as Workbook,
    ids = new Set<string>();
  for (const s of book.sheets) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      !["data", "graph", "results"].includes(s.kind)
    )
      throw new Error("Invalid or duplicate workbook sheet.");
    ids.add(s.id);
    if (s.kind === "data") {
      validateDraftProject(s.project);
      if (!Number.isInteger(s.revision) || s.revision < 0)
        throw new Error("Invalid data revision.");
    }
  }
  if (
    !book.sheets.some((s) => s.kind === "data") ||
    !ids.has(book.activeSheetId)
  )
    throw new Error("The workbook has no valid active sheet.");
  for (const s of book.sheets) {
    if (s.kind === "data") continue;
    const source = sourceSheet(book, s);
    if (
      !Array.isArray(s.columnIndices) ||
      s.columnIndices.some(
        (i) =>
          !Number.isInteger(i) ||
          i < 0 ||
          i >= source.project.columns.length ||
          (source.project.table_type === "xy" && i === 0),
      ) ||
      new Set(s.columnIndices).size !== s.columnIndices.length
    )
      throw new Error("Invalid dataset selection.");
    if (s.kind === "graph") {
      validateDraftProject({ ...source.project, graph: s.graph });
      if (s.resultId !== null) {
        const linked = book.sheets.find((r) => r.id === s.resultId);
        if (!linked || linked.kind !== "results" || linked.dataId !== s.dataId)
          throw new Error("Invalid graph result link.");
      }
    } else {
      validateDraftProject({
        ...source.project,
        analysis: s.analysis,
        regression_model: s.regression_model,
      });
      if (
        !Number.isInteger(s.sourceRevision) ||
        s.sourceRevision < 0 ||
        !["current", "stale"].includes(s.status) ||
        (s.selectionInvalid !== undefined &&
          typeof s.selectionInvalid !== "boolean") ||
        (s.result !== null &&
          (!responseValid(s.result) || s.result.analysis !== s.analysis))
      )
        throw new Error("Invalid saved analysis result.");
      if (s.sourceRevision !== source.revision || s.status === "stale") {
        s.status = "stale";
        s.result = null;
      } else if (!s.result) throw new Error("Current result has no output.");
    }
  }
  return book;
}
