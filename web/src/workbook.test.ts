import { test } from "node:test";
import assert from "node:assert/strict";
import { sample, parseProject } from "./data.ts";
import type { Response, Summary } from "./data.ts";
import {
  addData,
  addGraph,
  fromProject,
  parseWorkbook,
  recordResult,
  responseValid,
  sourceSheet,
  selectedProject,
  updateData,
  datasetSelection,
  newRowIds,
} from "./workbook.ts";
const response: Response = {
  analysis: "descriptive",
  summary: [],
  results: [],
  warnings: [],
  fit: [],
};
test("legacy project migration creates linked persistent data and graph identities", () => {
  const b = parseWorkbook(JSON.stringify(sample("xy")));
  assert.equal(b.sheets.length, 2);
  assert.equal(sourceSheet(b, b.sheets[1]).id, b.sheets[0].id);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("multiple analyses persist; only changed source dependencies become stale", () => {
  let b = fromProject(sample("column"));
  const first = b.sheets[0];
  b = recordResult(b, {
    name: "First analysis",
    dataId: first.id,
    analysis: "descriptive",
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: response,
  });
  const resultId = b.activeSheetId;
  b = addGraph(b, first.id, resultId);
  b = addData(b, sample("xy"));
  const otherId = b.activeSheetId;
  b = recordResult(b, {
    name: "Other table",
    dataId: otherId,
    analysis: "descriptive",
    columnIndices: [1],
    sourceRevision: 0,
    result: response,
  });
  const otherResult = b.activeSheetId;
  const updated = structuredClone(sourceSheet(b, first).project);
  updated.columns[0].values[0] = "999";
  b = updateData(b, first.id, updated);
  const stale = b.sheets.find((s) => s.id === resultId);
  assert.equal(stale?.kind === "results" && stale.status, "stale");
  assert.equal(stale?.kind === "results" && stale.result, null);
  const other = b.sheets.find((s) => s.id === otherResult);
  assert.equal(other?.kind === "results" && other.status, "current");
  assert.equal(b.sheets.filter((s) => s.kind === "graph").length, 3);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("rename preserves results and late responses cannot overwrite changed input", () => {
  let b = fromProject(sample("column"));
  const data = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: data.id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: response,
  });
  b = updateData(b, data.id, { ...sourceSheet(b, data).project, name: "Renamed" });
  assert.equal(b.sheets[2].kind === "results" && b.sheets[2].status, "current");
  const p = structuredClone(sourceSheet(b, data).project);
  p.columns[0].values[0] = "12";
  b = updateData(b, data.id, p);
  const same = recordResult(b, {
    name: "Late",
    dataId: data.id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: response,
  });
  assert.equal(same, b);
});
test("workbook import rejects broken dependencies and malformed results", () => {
  const b = fromProject(sample("column"));
  (b.sheets[1] as { dataId: string }).dataId = "missing";
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
  const valid = fromProject(sample("column"));
  valid.sheets.push({ ...valid.sheets[0] });
  assert.throws(() => parseWorkbook(JSON.stringify(valid)));
});

test("draft numeric edits persist and dataset removal cannot silently retarget a result", () => {
  let b = fromProject(sample("column"));
  const source = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: source.id,
    analysis: "descriptive",
    columnIndices: [1],
    sourceRevision: 0,
    result: response,
  });
  const p = structuredClone(sourceSheet(b, source).project);
  p.columns.splice(1, 1);
  p.columns[0].values[0] = "-";
  b = updateData(b, source.id, p);
  const r = b.sheets[2];
  assert.equal(r.kind === "results" && r.selectionInvalid, true);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});

test("graph dataset order survives save and XY keeps X first", () => {
  let b = fromProject(sample("xy"));
  const source = sourceSheet(b, b.sheets[0]);
  assert.deepEqual(
    selectedProject(source, [2, 1]).columns.map((c) => c.name),
    ["Concentration (µM)", "Compound B", "Compound A"],
  );
});
test("dataset rename preserves identity through subsequent middle column deletion", () => {
  let b = fromProject(sample("column"));
  const source = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: source.id,
    analysis: "descriptive",
    columnIndices: [2],
    sourceRevision: 0,
    result: response,
  });
  let p = structuredClone(sourceSheet(b, source).project);
  p.columns[2].name = "Renamed B";
  b = updateData(b, source.id, p);
  let r = b.sheets[2];
  assert.deepEqual(r.kind === "results" && r.columnIndices, [2]);
  assert.equal(r.kind === "results" && r.selectionInvalid, false);
  p = { ...p, columns: p.columns.filter((_, i) => i !== 1) };
  b = updateData(b, source.id, p);
  r = b.sheets[2];
  assert.deepEqual(r.kind === "results" && r.columnIndices, [1]);
  assert.equal(r.kind === "results" && r.selectionInvalid, false);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("saved output must match its analysis record and optional summary fields must be numeric", () => {
  let b = fromProject(sample("column"));
  b = recordResult(b, {
    name: "Wrong analysis",
    dataId: b.sheets[0].id,
    analysis: "welch_t",
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: response,
  });
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
});

test("malformed optional statistical values are rejected on workbook open", () => {
  let b = fromProject(sample("column"));
  const output = {
    ...response,
    summary: [
      {
        name: "Control",
        n: 2,
        mean: 1,
        sd: 0,
        sem: 0,
        median: 1,
        min: 1,
        max: 1,
        ci_low: 1,
        ci_high: 1,
        geometric_mean: { unexpected: "object" },
      },
    ],
  };
  b = recordResult(b, {
    name: "Result",
    dataId: b.sheets[0].id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: output as unknown as Response,
  });
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
});

test("matched and graph summaries persist separately and both reject malformed statistics", async () => {
  const { defaultComparisonOptions } = await import("./column-analysis.ts");
  const project = sample("column");
  project.columns = [
    { name: "A", values: ["1", "2", "100"] },
    { name: "B", values: ["2", "4", ""] },
  ];
  const matched: Summary[] = ["A", "B"].map((name, i) => ({
    name, n: 2, mean: 1.5 * (i + 1), sd: null, sem: null,
    median: 1.5 * (i + 1), min: i + 1, max: 2 * (i + 1),
    ci_low: null, ci_high: null,
  }));
  const output: Response = {
    ...response, analysis: "t_test", analysis_revision: 2,
    summary: matched,
    graph_summary: [{ ...matched[0], n: 3, mean: 103 / 3, median: 2, max: 100 }, matched[1]],
  };
  assert.equal(responseValid(output), true);
  let workbook = fromProject(project);
  workbook = recordResult(workbook, {
    name: "Paired result", dataId: workbook.sheets[0].id,
    analysis: "t_test", columnIndices: [0, 1], sourceRevision: 0,
    options: { ...defaultComparisonOptions, paired: true }, result: output,
  });
  const reopened = parseWorkbook(JSON.stringify(workbook));
  assert.deepEqual(reopened, workbook);
  const result = reopened.sheets.find((sheet) => sheet.kind === "results");
  assert.equal(result?.kind === "results" && result.result?.summary[0].n, 2);
  assert.equal(result?.kind === "results" && result.result?.graph_summary?.[0].n, 3);
  for (const malformed of [
    null, {}, ["A"], [],
    [{ ...matched[0], ci_low: NaN }, matched[1]],
    [{ ...matched[0], n: 1.5 }, matched[1]],
    [{ ...matched[0], geometric_mean: { invalid: 1 } }, matched[1]],
    [{ ...matched[0], name: "Wrong population" }, matched[1]],
  ])
    assert.equal(responseValid({ ...output, graph_summary: malformed }), false);
  assert.equal(responseValid({ ...output, summary: [{ ...matched[0], mean: Infinity }, matched[1]] }), false);
});

test("v3 assigns one identity per dataset and represented row, not virtual cells", () => {
  const project = sample("column");
  project.columns = [{ name: "A", values: ["1", "", "-"] }, { name: "B", values: ["2"] }];
  const book = fromProject(project);
  const data = sourceSheet(book, book.sheets[0]);
  assert.equal(book.version, 4);
  assert.equal(data.rowIds.length, 3);
  assert.equal(new Set([...data.rowIds, ...data.project.columns.map((column) => column.id)]).size, 5);
  assert.equal(project.columns[0].id, undefined);
  assert.deepEqual(book.sheets[1].kind === "graph" && book.sheets[1].datasetIds, data.project.columns.map((column) => column.id));
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("v1 workbook migration preserves draft strings while standalone project import remains strict", () => {
  const legacy = sample("column");
  legacy.columns[0].values = ["-", "", "1e", "1e101"];
  const migrated = parseWorkbook(JSON.stringify(legacy));
  assert.equal(migrated.version, 4);
  assert.throws(() => parseProject(JSON.stringify(legacy)), /not a valid number/);
  assert.deepEqual(sourceSheet(migrated, migrated.sheets[0]).project.columns[0].values, legacy.columns[0].values);
  assert.deepEqual(parseWorkbook(JSON.stringify(migrated)), migrated);
});

test("v2 migration preserves sheet links, ordered selections, valid results, drafts and graph settings", () => {
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  book = recordResult(book, { name: "Saved", dataId, analysis: "descriptive", columnIndices: [2, 0], sourceRevision: 0,
    result: { ...response, results: [{ label: "Saved value", value: 0.99997 }] } });
  book = addGraph(book, dataId, book.activeSheetId);
  const graphId = book.activeSheetId;
  book = addData(book, sample("xy"));
  const draft = sourceSheet(book, book.sheets.find((sheet) => sheet.id === book.activeSheetId)!);
  draft.project.columns[1].values[0] = "-";
  const legacy = JSON.parse(JSON.stringify(book));
  legacy.version = 2;
  for (const sheet of legacy.sheets) {
    delete sheet.datasetIds;
    if (sheet.kind === "data") {
      delete sheet.rowIds;
      for (const column of sheet.project.columns) delete column.id;
    }
  }
  const migrated = parseWorkbook(JSON.stringify(legacy));
  assert.equal(migrated.version, 4);
  assert.deepEqual(migrated.sheets.map((sheet) => sheet.id), book.sheets.map((sheet) => sheet.id));
  const originalResult = book.sheets.find((sheet) => sheet.kind === "results")!;
  const saved = migrated.sheets.find((sheet) => sheet.id === originalResult.id)!;
  assert.equal(saved.kind, "results");
  if (saved.kind !== "results" || originalResult.kind !== "results") throw new Error("result expected");
  assert.deepEqual(saved.result, originalResult.result);
  assert.deepEqual(saved.columnIndices, [2, 0]);
  assert.deepEqual(saved.datasetIds, datasetSelection(sourceSheet(migrated, saved), [2, 0]).datasetIds);
  const graph = migrated.sheets.find((sheet) => sheet.id === graphId)!;
  const originalGraph = book.sheets.find((sheet) => sheet.id === graphId)!;
  if (graph.kind !== "graph" || originalGraph.kind !== "graph") throw new Error("graph expected");
  assert.equal(graph.kind === "graph" && graph.resultId, saved.id);
  assert.deepEqual(graph.graph, originalGraph.graph);
  assert.equal(sourceSheet(migrated, migrated.sheets.find((sheet) => sheet.id === draft.id)!).project.columns[1].values[0], "-");
  assert.deepEqual(parseWorkbook(JSON.stringify(migrated)), migrated);
});

test("dataset reorder and rename retain authoritative references even with duplicate names", () => {
  let book = fromProject(sample("column"));
  const source = sourceSheet(book, book.sheets[0]);
  book = recordResult(book, { name: "Selection", dataId: source.id, analysis: "descriptive", columnIndices: [2, 0], sourceRevision: 0, result: response });
  const selectedIds = datasetSelection(source, [2, 0]).datasetIds;
  const columns = [source.project.columns[2], source.project.columns[0], source.project.columns[1]]
    .map((column) => ({ ...column, name: "Same name" }));
  book = updateData(book, source.id, { ...source.project, columns });
  const result = book.sheets.find((sheet) => sheet.kind === "results")!;
  if (result.kind !== "results") throw new Error("result expected");
  assert.deepEqual(result.datasetIds, selectedIds);
  assert.deepEqual(result.columnIndices, [0, 1]);
  assert.equal(result.selectionInvalid, false);
  assert.deepEqual(sourceSheet(book, result).rowIds, source.rowIds);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("new dataset with the same name cannot inherit the removed dataset's selection", () => {
  let book = fromProject(sample("column"));
  const source = sourceSheet(book, book.sheets[0]);
  book = recordResult(book, { name: "Selection", dataId: source.id, analysis: "descriptive", columnIndices: [1], sourceRevision: 0, result: response });
  const replacement = { name: source.project.columns[1].name, values: [...source.project.columns[1].values] };
  const columns = [source.project.columns[0], replacement, source.project.columns[2]];
  book = updateData(book, source.id, { ...source.project, columns });
  const result = book.sheets.find((sheet) => sheet.kind === "results")!;
  if (result.kind !== "results") throw new Error("result expected");
  assert.equal(result.selectionInvalid, true);
  assert.deepEqual(result.datasetIds, []);
  assert.deepEqual(result.columnIndices, []);
  assert.notEqual(sourceSheet(book, result).project.columns[1].id, source.project.columns[1].id);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("inserting a dataset remaps indices without redirecting graph or result identities", () => {
  let book = fromProject(sample("column"));
  const source = sourceSheet(book, book.sheets[0]);
  book = recordResult(book, { name: "Selection", dataId: source.id, analysis: "descriptive", columnIndices: [1], sourceRevision: 0, result: response });
  const original = book.sheets.find((sheet) => sheet.kind === "results")!;
  book = updateData(book, source.id, { ...source.project, columns: [{ name: "Inserted", values: ["9"] }, ...source.project.columns] });
  const result = book.sheets.find((sheet) => sheet.id === original.id)!;
  if (result.kind !== "results" || original.kind !== "results") throw new Error("result expected");
  assert.deepEqual(result.datasetIds, original.datasetIds);
  assert.deepEqual(result.columnIndices, [2]);
  assert.equal(result.selectionInvalid, false);
  assert.deepEqual(book.sheets[1].kind === "graph" && book.sheets[1].columnIndices, [1, 2, 3]);
});

test("row insert/reorder/delete identities survive roundtrip and shrink needs explicit mapping", () => {
  const project = sample("column");
  project.columns = [{ name: "A", values: ["1", "2", "3"] }];
  let book = fromProject(project);
  const source = sourceSheet(book, book.sheets[0]);
  const inserted = newRowIds(1)[0];
  book = updateData(book, source.id, { ...source.project, columns: source.project.columns.map((column) => ({ ...column, values: ["9", ...column.values] })) },
    { rowIds: [inserted, ...source.rowIds] });
  let current = sourceSheet(book, book.sheets[0]);
  assert.deepEqual(current.rowIds, [inserted, ...source.rowIds]);
  const reordered = { ...current.project, columns: current.project.columns.map((column) => ({ ...column, values: [column.values[3], ...column.values.slice(0, 3)] })) };
  book = updateData(book, source.id, reordered, { rowIds: [current.rowIds[3], ...current.rowIds.slice(0, 3)] });
  current = sourceSheet(book, book.sheets[0]);
  assert.equal(current.rowIds[0], source.rowIds[2]);
  const shortened = { ...current.project, columns: current.project.columns.map((column) => ({ ...column, values: column.values.slice(1) })) };
  assert.throws(() => updateData(book, source.id, shortened), /explicit row ID mapping/);
  book = updateData(book, source.id, shortened, { rowIds: current.rowIds.slice(1) });
  assert.deepEqual(sourceSheet(book, book.sheets[0]).rowIds, [inserted, source.rowIds[0], source.rowIds[1]]);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("ordinary growth appends row identities and row-only permutation invalidates cached output", () => {
  let book = fromProject(sample("column"));
  const source = sourceSheet(book, book.sheets[0]);
  book = recordResult(book, { name: "Result", dataId: source.id, analysis: "descriptive", columnIndices: [0], sourceRevision: 0, result: response });
  const extended = { ...source.project, columns: source.project.columns.map((column) => ({ ...column, values: [...column.values, ""] })) };
  book = updateData(book, source.id, extended);
  const current = sourceSheet(book, book.sheets[0]);
  assert.deepEqual(current.rowIds.slice(0, -1), source.rowIds);
  assert.equal(current.rowIds.length, source.rowIds.length + 1);
  const swapped = [...current.rowIds];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  book = updateData(book, source.id, current.project, { rowIds: swapped });
  assert.equal(sourceSheet(book, book.sheets[0]).revision, current.revision + 1);
});

test("v3 rejects missing/duplicate/dangling identities and inconsistent compatibility indices", () => {
  const fresh = () => JSON.parse(JSON.stringify(fromProject(sample("column"))));
  const mutations = [
    (b: any) => { delete b.sheets[0].project.columns[0].id; },
    (b: any) => { delete b.sheets[0].rowIds; },
    (b: any) => { b.sheets[0].rowIds[1] = b.sheets[0].rowIds[0]; },
    (b: any) => { b.sheets[0].project.columns[1].id = b.sheets[0].project.columns[0].id; },
    (b: any) => { b.sheets[0].rowIds[0] = b.sheets[0].project.columns[0].id; },
    (b: any) => { b.sheets[0].rowIds.pop(); },
    (b: any) => { delete b.sheets[1].datasetIds; },
    (b: any) => { b.sheets[1].datasetIds[0] = "missing"; },
    (b: any) => { b.sheets[1].columnIndices.reverse(); },
  ];
  for (const mutate of mutations) {
    const book = fresh(); mutate(book);
    assert.throws(() => parseWorkbook(JSON.stringify(book)));
  }
  let duplicated = addData(fromProject(sample("column")), sample("column"));
  const data = duplicated.sheets.filter((sheet) => sheet.kind === "data");
  data[1].rowIds[0] = data[0].rowIds[0];
  assert.throws(() => parseWorkbook(JSON.stringify(duplicated)), /duplicate/);
});

test("updates reject identity collisions and XY X replacement requires review", () => {
  let book = fromProject(sample("xy"));
  const source = sourceSheet(book, book.sheets[0]);
  book = recordResult(book, { name: "Result", dataId: source.id, analysis: "descriptive", columnIndices: [2], sourceRevision: 0, result: response });
  assert.throws(() => updateData(book, source.id, { ...source.project, columns: [source.project.columns[0], source.project.columns[0]] }), /dataset IDs/);
  assert.throws(() => updateData(book, source.id, source.project, { rowIds: source.rowIds.map(() => source.rowIds[0]) }), /row IDs/);
  const replacement = { ...source.project, columns: [source.project.columns[1], source.project.columns[0], source.project.columns[2]] };
  book = updateData(book, source.id, replacement);
  assert.equal(book.sheets[2].kind === "results" && book.sheets[2].selectionInvalid, true);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("t test parameters persist with results, are validated, and drive recalculation", async () => {
  const { defaultComparisonOptions } = await import("./column-analysis.ts");
  const { recalculationTask } = await import("./workbook-recalculation.ts");
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  const options = { ...defaultComparisonOptions, equal_sd: false };
  book = recordResult(book, {
    name: "Welch's t test of data",
    dataId,
    analysis: "t_test",
    options,
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: { ...response, analysis: "t_test", analysis_revision: 2, summary: ["A", "B"].map((name) => ({ name, n: 8, mean: null, sd: null, sem: null, median: null, min: null, max: null, ci_low: null, ci_high: null })), comparisons: [{ a: 0, b: 1, p: 0.01, summary: "*" }], tables: [{ title: "T", columns: ["T", ""], rows: [["P value", "0.0100"], [], ["Section"]] }] },
  });
  const resultId = book.activeSheetId;
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
  const saved = JSON.parse(JSON.stringify(book));
  delete saved.sheets.find((s: { id: string }) => s.id === resultId).options;
  assert.throws(() => parseWorkbook(JSON.stringify(saved)), /parameters/);
  const descriptiveWithOptions = JSON.parse(JSON.stringify(book));
  const sheet = descriptiveWithOptions.sheets.find((s: { id: string }) => s.id === resultId);
  sheet.analysis = "descriptive";
  sheet.result.analysis = "descriptive";
  assert.throws(() => parseWorkbook(JSON.stringify(descriptiveWithOptions)), /parameters/);
  const badComparison = JSON.parse(JSON.stringify(book));
  badComparison.sheets.find((s: { id: string }) => s.id === resultId).result.comparisons[0].b = 9;
  assert.throws(() => parseWorkbook(JSON.stringify(badComparison)));
  const project = structuredClone(sourceSheet(book, book.sheets[0]).project);
  project.columns[0].values[0] = "41";
  book = updateData(book, dataId, project);
  const result = book.sheets.find((s) => s.id === resultId);
  if (result?.kind !== "results") throw new Error("result expected");
  const task = recalculationTask(book, result)!;
  assert.deepEqual(task.input?.options, options);
  const changed = { ...result, options: { ...options, tails: 1 as const } };
  assert.notEqual(recalculationTask(book, changed)!.key, task.key);
});
