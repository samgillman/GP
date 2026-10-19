import { numeric, parseProject, sample } from "./data.ts";
import type { Analysis, Graph, Project, Response, TableType } from "./data.ts";
import { assertWorkbookDependencyIntegrity } from "./workbook-dependencies.ts";
export const WORKBOOK_STORAGE = "gp.workbook.v2";
/** Excluded observations by dataset ID, each listing row IDs in table order.
 * The entered text stays in the project; analyses and graphs treat it as missing.
 */
export type Exclusions = Record<string, string[]>;
export type DataSheet = {
  kind: "data";
  id: string;
  name: string;
  revision: number;
  rowIds: string[];
  project: Project;
  excluded?: Exclusions;
  frozen?: boolean;
};
export type ResultSheet = {
  kind: "results";
  id: string;
  name: string;
  dataId: string;
  analysis: Analysis;
  regression_model?: string;
  columnIndices: number[];
  datasetIds: string[];
  sourceRevision: number;
  status: "current" | "stale";
  result: Response | null;
  selectionInvalid?: boolean;
  frozen?: boolean;
  frozenSource?: DataSheet;
};
export type FrozenResultSnapshot = Omit<ResultSheet, "frozen" | "frozenSource">;
export type GraphSheet = {
  kind: "graph";
  id: string;
  name: string;
  dataId: string;
  graph: Graph;
  columnIndices: number[];
  datasetIds: string[];
  resultId: string | null;
  selectionInvalid?: boolean;
  frozen?: boolean;
  frozenSource?: DataSheet;
  frozenResult?: FrozenResultSnapshot;
};
export type Sheet = DataSheet | ResultSheet | GraphSheet;
export type Workbook = {
  version: 4;
  name: string;
  activeSheetId: string;
  sheets: Sheet[];
};
const id = () => crypto.randomUUID();
const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;

export function representedRowCount(project: Project): number {
  return project.columns.reduce(
    (count, column) => Math.max(count, column.values.length),
    0,
  );
}

export function newRowIds(count: number): string[] {
  if (!Number.isInteger(count) || count < 0 || count > 10000)
    throw new Error("Invalid represented row count.");
  return Array.from({ length: count }, id);
}

function excludable(value: string | undefined): boolean {
  try {
    return numeric(value ?? "") !== null;
  } catch {
    return false;
  }
}

/** Canonical exclusions: dataset order, row order, numeric cells only, and no
 * empty entries. With `previous`, a cell whose text changed loses its exclusion:
 * GP treats a newly entered value as a new observation. Row moves keep it.
 */
export function canonicalExclusions(
  project: Project,
  rowIds: string[],
  excluded: Exclusions | undefined,
  previous?: { project: Project; rowIds: string[] },
): Exclusions | undefined {
  if (!excluded) return undefined;
  const rows = new Map(rowIds.map((rowId, index) => [rowId, index]));
  const before =
    previous && new Map(previous.rowIds.map((rowId, index) => [rowId, index]));
  const result: Exclusions = {};
  for (const column of project.columns) {
    const wanted = column.id === undefined ? undefined : excluded[column.id];
    if (!Array.isArray(wanted) || !wanted.length) continue;
    const old = previous?.project.columns.find(
      (candidate) => candidate.id === column.id,
    );
    const kept = new Set<number>();
    for (const rowId of wanted) {
      const row = rows.get(rowId);
      if (row === undefined || !excludable(column.values[row])) continue;
      if (before) {
        const oldRow = before.get(rowId);
        if (
          !old ||
          oldRow === undefined ||
          old.values[oldRow] !== column.values[row]
        )
          continue;
      }
      kept.add(row);
    }
    if (kept.size)
      result[column.id!] = [...kept]
        .sort((a, b) => a - b)
        .map((row) => rowIds[row]);
  }
  return Object.keys(result).length ? result : undefined;
}

/** Column index → excluded row indices, for display and export. */
export function exclusionPositions(data: DataSheet): Map<number, Set<number>> {
  const positions = new Map<number, Set<number>>();
  if (!data.excluded) return positions;
  const rows = new Map(data.rowIds.map((rowId, index) => [rowId, index]));
  data.project.columns.forEach((column, index) => {
    const excluded = data.excluded![column.id ?? ""];
    if (!excluded?.length) return;
    positions.set(
      index,
      new Set(
        excluded
          .map((rowId) => rows.get(rowId)!)
          .filter((row) => row !== undefined),
      ),
    );
  });
  return positions;
}

export function excludedCount(data: DataSheet, datasetIds?: string[]): number {
  if (!data.excluded) return 0;
  return (datasetIds ?? Object.keys(data.excluded)).reduce(
    (count, uid) => count + (data.excluded![uid]?.length ?? 0),
    0,
  );
}

/** The analysis and graph view of a table: excluded cells become missing. */
export function includedProject(data: DataSheet): Project {
  const positions = exclusionPositions(data);
  if (!positions.size) return data.project;
  return {
    ...data.project,
    columns: data.project.columns.map((column, index) => {
      const rows = positions.get(index);
      return rows
        ? {
            ...column,
            values: column.values.map((value, row) =>
              rows.has(row) ? "" : value,
            ),
          }
        : column;
    }),
  };
}

/** Whether a captured snapshot holds exactly the live table's scientific input.
 * Revisions alone are insufficient: undo and document replacement reuse them.
 */
export function sameSourceData(captured: DataSheet, live: DataSheet): boolean {
  return (
    captured.revision === live.revision &&
    captured.project.table_type === live.project.table_type &&
    JSON.stringify(captured.project.columns) ===
      JSON.stringify(live.project.columns) &&
    JSON.stringify(captured.rowIds) === JSON.stringify(live.rowIds) &&
    JSON.stringify(captured.excluded ?? null) ===
      JSON.stringify(live.excluded ?? null)
  );
}

function withExclusions(
  sheet: DataSheet,
  excluded: Exclusions | undefined,
): DataSheet {
  const next = { ...sheet };
  delete next.excluded;
  return excluded ? { ...next, excluded } : next;
}

/** IDs are authoritative; column indices are a derived compatibility view. */
export function datasetSelection(data: DataSheet | Project, indices: number[]) {
  const project = "project" in data ? data.project : data;
  if (
    !Array.isArray(indices) ||
    new Set(indices).size !== indices.length ||
    indices.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= project.columns.length ||
        (project.table_type === "xy" && index === 0),
    )
  )
    throw new Error("Invalid dataset selection.");
  const datasetIds = indices.map((index) => project.columns[index].id);
  if (
    !datasetIds.every(validIdentity) ||
    new Set(datasetIds).size !== datasetIds.length
  )
    throw new Error("Selected datasets have missing or duplicate stable IDs.");
  return { columnIndices: [...indices], datasetIds };
}

function existingIdentities(book: Workbook): Set<string> {
  return new Set(
    book.sheets.flatMap((sheet) =>
      sheet.kind === "data"
        ? [
            sheet.id,
            ...sheet.rowIds,
            ...sheet.project.columns.map((column) => column.id!),
          ]
        : [sheet.id],
    ),
  );
}

function validateUpdatedIdentities(
  values: string[],
  previous: string[],
  existing: Set<string>,
  label: string,
) {
  const allowed = new Set(previous);
  if (
    !values.every(validIdentity) ||
    new Set(values).size !== values.length ||
    values.some((value) => existing.has(value) && !allowed.has(value))
  )
    throw new Error(`Invalid or duplicate ${label} IDs.`);
}
export function dataIndices(p: Project) {
  return p.columns
    .map((_, i) => i)
    .filter((i) => p.table_type !== "xy" || i !== 0);
}
export type CellPosition = { column: number; row: number };
export function fromProject(
  project: Project,
  excludedCells: CellPosition[] = [],
): Workbook {
  const dataId = id(),
    graphId = id();
  const identified = {
    ...project,
    columns: project.columns.map((column) => ({
      ...column,
      id: id(),
      values: [...column.values],
    })),
    graph: structuredClone(project.graph),
  };
  const rowIds = newRowIds(representedRowCount(identified));
  const requested: Exclusions = {};
  for (const { column, row } of excludedCells) {
    const dataset = identified.columns[column];
    if (
      !dataset ||
      rowIds[row] === undefined ||
      !excludable(dataset.values[row])
    )
      throw new Error("Excluded cells must contain numeric values.");
    (requested[dataset.id] ??= []).push(rowIds[row]);
  }
  const data: DataSheet = withExclusions(
    {
      kind: "data",
      id: dataId,
      name: project.name,
      revision: 0,
      project: identified,
      rowIds,
    },
    canonicalExclusions(identified, rowIds, requested),
  );
  return {
    version: 4,
    name: project.name,
    activeSheetId: dataId,
    sheets: [
      data,
      {
        kind: "graph",
        id: graphId,
        name: `${project.name} graph`,
        dataId,
        graph: structuredClone(project.graph),
        ...datasetSelection(identified, dataIndices(identified)),
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
/** Selected datasets as analyses and graphs see them, with exclusions applied. */
export function selectedProject(data: DataSheet, indices: number[]): Project {
  const included = includedProject(data);
  return {
    ...included,
    columns: [
      ...(included.table_type === "xy" ? [included.columns[0]] : []),
      ...indices.map((i) => included.columns[i]).filter(Boolean),
    ],
  };
}
export function addData(
  book: Workbook,
  project: Project,
  excludedCells: CellPosition[] = [],
): Workbook {
  const fresh = fromProject(project, excludedCells);
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
/** `excluded` replaces the table's exclusions; otherwise existing exclusions
 * follow their dataset/row identities and are dropped for removed or edited cells.
 */
export function updateData(
  book: Workbook,
  dataId: string,
  next: Project,
  options: { rowIds?: string[]; excluded?: Exclusions } = {},
): Workbook {
  const source = book.sheets.find((s) => s.id === dataId);
  if (!source || source.kind !== "data")
    throw new Error("Missing source table.");
  const columns = next.columns.map((column) =>
    column.id === undefined ? { ...column, id: id() } : column,
  );
  next = { ...next, columns };
  const count = representedRowCount(next);
  if (count < source.rowIds.length && options.rowIds === undefined)
    throw new Error("Row deletions require an explicit row ID mapping.");
  const rowIds =
    options.rowIds === undefined
      ? [...source.rowIds, ...newRowIds(count - source.rowIds.length)]
      : [...options.rowIds];
  if (rowIds.length !== count || count > 10000)
    throw new Error("Row IDs must match the represented rows.");
  const existing = existingIdentities(book);
  validateUpdatedIdentities(
    columns.map((column) => column.id!),
    source.project.columns.map((column) => column.id!),
    existing,
    "dataset",
  );
  validateUpdatedIdentities(rowIds, source.rowIds, existing, "row");
  if (columns.some((column) => rowIds.includes(column.id!)))
    throw new Error("Dataset and row IDs must be distinct.");
  const excluded = canonicalExclusions(
    next,
    rowIds,
    options.excluded ?? source.excluded,
    source,
  );
  const exclusionsChanged =
    JSON.stringify(source.excluded ?? null) !==
    JSON.stringify(excluded ?? null);
  const changed =
    source.project.table_type !== next.table_type ||
    JSON.stringify(source.project.columns) !== JSON.stringify(next.columns) ||
    rowIds.some((row, index) => row !== source.rowIds[index]) ||
    rowIds.length !== source.rowIds.length ||
    exclusionsChanged;
  // GP's bounded freeze permits labels/view metadata but protects numeric data,
  // exclusions and row/dataset structure. It does not reproduce Prism's editing
  // exceptions.
  const protectedChange =
    source.project.table_type !== next.table_type ||
    JSON.stringify(
      source.project.columns.map(({ id, values }) => ({ id, values })),
    ) !==
      JSON.stringify(next.columns.map(({ id, values }) => ({ id, values }))) ||
    JSON.stringify(rowIds) !== JSON.stringify(source.rowIds) ||
    exclusionsChanged;
  if (source.frozen && protectedChange)
    throw new Error(
      "Unfreeze the data sheet before changing values, exclusions or table structure.",
    );
  const xChanged =
    source.project.table_type === "xy" &&
    next.table_type === "xy" &&
    source.project.columns[0]?.id !== next.columns[0]?.id;
  const remap = (datasetIds: string[]) =>
    datasetSelection(
      next,
      datasetIds
        .map((uid) => next.columns.findIndex((column) => column.id === uid))
        .filter(
          (index) => index >= 0 && (next.table_type !== "xy" || index !== 0),
        ),
    );
  return {
    ...book,
    sheets: book.sheets.map((s) => {
      if (s.id === dataId)
        return withExclusions(
          {
            ...source,
            project: next,
            rowIds,
            name: next.name,
            revision: source.revision + (changed ? 1 : 0),
          },
          excluded,
        );
      if (!changed || s.kind === "data" || s.dataId !== dataId || s.frozen)
        return s;
      const selection = remap(s.datasetIds);
      if (s.kind === "results")
        return {
          ...s,
          ...selection,
          selectionInvalid:
            s.selectionInvalid ||
            selection.datasetIds.length !== s.datasetIds.length ||
            xChanged ||
            source.project.table_type !== next.table_type,
          status: "stale" as const,
          result: null,
        };
      return {
        ...s,
        ...selection,
        selectionInvalid:
          s.selectionInvalid ||
          selection.datasetIds.length !== s.datasetIds.length ||
          xChanged ||
          source.project.table_type !== next.table_type,
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
export type CellRange = {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
};

/** One Exclude Values command over a selected rectangle. If every numeric
 * selected value is already excluded it restores them; otherwise it excludes all
 * of them. Blank and non-numeric draft cells are never excluded. This toggle rule
 * is GP's choice; Prism's native `excludeValues:` handler has not been traced.
 */
export function toggleExcludedValues(
  book: Workbook,
  dataId: string,
  range: CellRange,
): { book: Workbook; excluded: boolean; count: number } {
  const source = book.sheets.find((s) => s.id === dataId);
  if (!source || source.kind !== "data")
    throw new Error("Select values in a data table to exclude them.");
  if (source.frozen)
    throw new Error(
      "Unfreeze this data table before excluding or including values.",
    );
  const current = exclusionPositions(source);
  const cells: CellPosition[] = [];
  const lastColumn = Math.min(
    range.endColumn,
    source.project.columns.length - 1,
  );
  const lastRow = Math.min(range.endRow, source.rowIds.length - 1);
  for (
    let column = Math.max(0, range.startColumn);
    column <= lastColumn;
    column++
  )
    for (let row = Math.max(0, range.startRow); row <= lastRow; row++)
      if (excludable(source.project.columns[column].values[row]))
        cells.push({ column, row });
  if (!cells.length)
    throw new Error("Select one or more numeric values to exclude or include.");
  const exclude = cells.some(
    ({ column, row }) => !current.get(column)?.has(row),
  );
  const next: Exclusions = structuredClone(source.excluded ?? {});
  const changed = new Map<string, Set<string>>();
  for (const { column, row } of cells) {
    const uid = source.project.columns[column].id!;
    if (!changed.has(uid)) changed.set(uid, new Set());
    changed.get(uid)!.add(source.rowIds[row]);
  }
  for (const [uid, rows] of changed)
    next[uid] = exclude
      ? [...(next[uid] ?? []), ...rows]
      : (next[uid] ?? []).filter((rowId) => !rows.has(rowId));
  return {
    book: updateData(book, dataId, source.project, {
      rowIds: source.rowIds,
      excluded: next,
    }),
    excluded: exclude,
    count: exclude
      ? cells.filter(({ column, row }) => !current.get(column)?.has(row)).length
      : cells.length,
  };
}

export function recordResult(
  book: Workbook,
  input: Omit<ResultSheet, "id" | "kind" | "status" | "datasetIds"> & {
    datasetIds?: string[];
  },
  existingId?: string,
): Workbook {
  const data = book.sheets.find((s) => s.id === input.dataId);
  if (!data || data.kind !== "data" || data.revision !== input.sourceRevision)
    return book;
  if (existingId !== undefined) {
    const previous = book.sheets.find((sheet) => sheet.id === existingId);
    if (!previous || previous.kind !== "results" || previous.dataId !== data.id)
      throw new Error(
        "The existing result does not belong to this source table.",
      );
    if (previous.frozen)
      throw new Error(
        "Unfreeze the results sheet before replacing its analysis.",
      );
  }
  const selection = datasetSelection(data, input.columnIndices);
  if (
    input.datasetIds !== undefined &&
    JSON.stringify(input.datasetIds) !== JSON.stringify(selection.datasetIds)
  )
    throw new Error("Analysis dataset IDs do not match their indices.");
  const result: ResultSheet = {
    ...input,
    ...selection,
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
  if (!source || source.kind !== "data")
    throw new Error("Missing source table.");
  if (
    resultId !== null &&
    (!result || result.kind !== "results" || result.dataId !== dataId)
  )
    throw new Error("Invalid graph result link.");
  if (
    result?.kind === "results" &&
    (JSON.stringify(
      datasetSelection(source, result.columnIndices).datasetIds,
    ) !== JSON.stringify(result.datasetIds) ||
      (result.frozen &&
        (result.sourceRevision !== source.revision ||
          !result.frozenSource ||
          !sameSourceData(result.frozenSource, source))))
  )
    throw new Error(
      "This result uses historical source data. Unfreeze and recalculate it before creating a new live graph.",
    );
  const graph: GraphSheet = {
    id: id(),
    kind: "graph",
    name: `${source.name} graph ${book.sheets.filter((s) => s.kind === "graph" && s.dataId === dataId).length + 1}`,
    dataId,
    graph: structuredClone(source.project.graph),
    ...datasetSelection(
      source,
      result?.kind === "results"
        ? [...result.columnIndices]
        : dataIndices(source.project),
    ),
    resultId,
  };
  return { ...book, activeSheetId: graph.id, sheets: [...book.sheets, graph] };
}
export function responseValid(r: unknown): r is Response {
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

/** Rejects dangling, duplicate, blank or non-numeric exclusions rather than
 * dropping them, which would silently return excluded values to analyses.
 */
function validateExclusions(sheet: DataSheet) {
  if (sheet.excluded === undefined) return;
  const excluded = sheet.excluded as unknown;
  if (!excluded || typeof excluded !== "object" || Array.isArray(excluded))
    throw new Error("Invalid excluded values.");
  const datasets = new Set(sheet.project.columns.map((column) => column.id));
  const rows = new Set(sheet.rowIds);
  let count = 0;
  for (const [uid, rowIds] of Object.entries(excluded)) {
    if (
      !datasets.has(uid) ||
      !Array.isArray(rowIds) ||
      !rowIds.length ||
      new Set(rowIds).size !== rowIds.length ||
      !rowIds.every((rowId) => typeof rowId === "string" && rows.has(rowId))
    )
      throw new Error(
        "Excluded values refer to missing, duplicate or dangling identities.",
      );
    count += rowIds.length;
  }
  const canonical = canonicalExclusions(
    sheet.project,
    sheet.rowIds,
    sheet.excluded,
  );
  if (excludedCount({ ...sheet, excluded: canonical }) !== count)
    throw new Error("Only numeric values can be excluded.");
  if (canonical) sheet.excluded = canonical;
  else delete sheet.excluded;
}

// Historical snapshots have their own identity namespace: their IDs intentionally
// overlap live tables, and may refer to rows/datasets that have since been removed.
function validateFrozenSource(source: DataSheet, dataId: string) {
  if (
    !source ||
    source.kind !== "data" ||
    source.id !== dataId ||
    typeof source.name !== "string" ||
    !Number.isInteger(source.revision) ||
    source.revision < 0 ||
    "frozen" in source ||
    "frozenSource" in source ||
    "frozenResult" in source
  )
    throw new Error("Invalid frozen source snapshot.");
  validateDraftProject(source.project);
  if (
    !Array.isArray(source.rowIds) ||
    source.rowIds.length !== representedRowCount(source.project)
  )
    throw new Error("Invalid frozen source row identities.");
  const ids = [
    source.id,
    ...source.rowIds,
    ...source.project.columns.map((column) => column.id),
  ];
  if (!ids.every(validIdentity) || new Set(ids).size !== ids.length)
    throw new Error("Invalid or duplicate frozen source identities.");
  validateExclusions(source);
}

function validateSavedSelection(
  source: DataSheet,
  sheet: ResultSheet | GraphSheet | FrozenResultSnapshot,
) {
  const selection = datasetSelection(source, sheet.columnIndices);
  if (
    !Array.isArray(sheet.datasetIds) ||
    sheet.datasetIds.length !== selection.datasetIds.length ||
    sheet.datasetIds.some(
      (uid, index) =>
        !validIdentity(uid) || uid !== selection.datasetIds[index],
    ) ||
    (sheet.selectionInvalid !== undefined &&
      typeof sheet.selectionInvalid !== "boolean")
  )
    throw new Error(
      "Dataset IDs are missing, dangling, or inconsistent with their indices.",
    );
}

function validateSavedResult(
  source: DataSheet,
  result: ResultSheet | FrozenResultSnapshot,
  frozen: boolean,
) {
  validateDraftProject({
    ...source.project,
    analysis: result.analysis,
    regression_model: result.regression_model,
  });
  if (
    !Number.isInteger(result.sourceRevision) ||
    result.sourceRevision < 0 ||
    !["current", "stale"].includes(result.status) ||
    (result.selectionInvalid !== undefined &&
      typeof result.selectionInvalid !== "boolean") ||
    (result.result !== null &&
      (!responseValid(result.result) ||
        result.result.analysis !== result.analysis))
  )
    throw new Error("Invalid saved analysis result.");
  if (
    frozen &&
    (result.status !== "current" ||
      result.sourceRevision !== source.revision ||
      result.selectionInvalid ||
      !result.result ||
      !result.datasetIds.length)
  )
    throw new Error(
      "Frozen results must contain current output for their captured source.",
    );
  if (
    !frozen &&
    (result.sourceRevision !== source.revision || result.status === "stale")
  ) {
    result.status = "stale";
    result.result = null;
  } else if (!result.result) throw new Error("Current result has no output.");
}

export function parseWorkbook(text: string): Workbook {
  const raw = JSON.parse(text);
  if (raw?.version === 1) {
    validateDraftProject(raw);
    return fromProject(raw);
  }
  if (
    !raw ||
    ![2, 3, 4].includes(raw.version) ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.sheets) ||
    !raw.sheets.length ||
    raw.sheets.length > 500 ||
    typeof raw.activeSheetId !== "string"
  )
    throw new Error("This is not a supported GP workbook.");
  const book = raw as Workbook,
    ids = new Set<string>();
  const migrating = raw.version === 2;
  const legacy = raw.version < 4;
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
    if (
      (s.frozen !== undefined && typeof s.frozen !== "boolean") ||
      (s.kind === "data" && ("frozenSource" in s || "frozenResult" in s)) ||
      (s.kind === "results" && "frozenResult" in s) ||
      (!s.frozen && ("frozenSource" in s || "frozenResult" in s)) ||
      (migrating && s.frozen)
    )
      throw new Error("Invalid or unsupported frozen sheet state.");
    if (
      legacy &&
      ("excluded" in s ||
        (s.kind !== "data" &&
          typeof s.frozenSource === "object" &&
          s.frozenSource !== null &&
          "excluded" in s.frozenSource))
    )
      throw new Error("Excluded values require GP workbook version 4.");
    ids.add(s.id);
    if (s.kind === "data") {
      validateDraftProject(s.project);
      if (!Number.isInteger(s.revision) || s.revision < 0)
        throw new Error("Invalid data revision.");
      if (migrating) {
        s.project = {
          ...s.project,
          columns: s.project.columns.map((column) => ({ ...column, id: id() })),
        };
        s.rowIds = newRowIds(representedRowCount(s.project));
      }
    }
  }
  if (
    !book.sheets.some((s) => s.kind === "data") ||
    !ids.has(book.activeSheetId)
  )
    throw new Error("The workbook has no valid active sheet.");
  const stableIds = new Set(ids);
  for (const sheet of book.sheets) {
    if (sheet.kind !== "data") continue;
    if (
      !Array.isArray(sheet.rowIds) ||
      sheet.rowIds.length !== representedRowCount(sheet.project)
    )
      throw new Error("Row IDs must match the represented rows.");
    for (const uid of [
      ...sheet.project.columns.map((column) => column.id),
      ...sheet.rowIds,
    ]) {
      if (!validIdentity(uid) || stableIds.has(uid))
        throw new Error("Missing, invalid, or duplicate dataset/row IDs.");
      stableIds.add(uid);
    }
    validateExclusions(sheet);
  }
  for (const s of book.sheets) {
    if (s.kind === "data") continue;
    const liveSource = sourceSheet(book, s);
    if (s.frozen) validateFrozenSource(s.frozenSource!, s.dataId);
    const source = s.frozen ? s.frozenSource! : liveSource;
    const selection = datasetSelection(source, s.columnIndices);
    if (migrating) s.datasetIds = selection.datasetIds;
    validateSavedSelection(source, s);
    if (s.kind === "graph") {
      validateDraftProject({ ...source.project, graph: s.graph });
      if (s.frozen && (s.selectionInvalid || !s.datasetIds.length))
        throw new Error(
          "Frozen graphs must have a valid captured dataset selection.",
        );
      if (s.resultId !== null && !validIdentity(s.resultId))
        throw new Error("Invalid graph result link.");
      if (s.frozen && "frozenResult" in s) {
        const result = s.frozenResult!;
        if (
          !result ||
          result.kind !== "results" ||
          !validIdentity(result.id) ||
          result.id === s.id ||
          typeof result.name !== "string" ||
          result.dataId !== s.dataId ||
          "frozen" in result ||
          "frozenSource" in result ||
          "frozenResult" in result ||
          (s.resultId !== null && result.id !== s.resultId)
        )
          throw new Error("Invalid frozen graph result snapshot.");
        validateSavedSelection(source, result);
        validateSavedResult(source, result, true);
      } else if (s.frozen && s.resultId !== null) {
        throw new Error(
          "The frozen graph is missing its linked output snapshot.",
        );
      } else if (s.resultId !== null) {
        const linked = book.sheets.find((r) => r.id === s.resultId);
        if (!linked || linked.kind !== "results" || linked.dataId !== s.dataId)
          throw new Error("Invalid graph result link.");
      }
    } else {
      validateSavedResult(source, s, Boolean(s.frozen));
    }
  }
  book.version = 4;
  assertWorkbookDependencyIntegrity(book);
  return book;
}
