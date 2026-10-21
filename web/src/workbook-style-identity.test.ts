import { test } from "node:test";
import assert from "node:assert/strict";
import { sample, palette, requestData } from "./data.ts";
import { plottedDatasetStyles } from "./graph-style.ts";
import { addData, addGraph, datasetSelection, fromProject, parseWorkbook, updateData } from "./workbook.ts";
import type { DataSheet, GraphSheet, Workbook } from "./workbook.ts";
import { duplicateSheet } from "./workbook-actions.ts";
import { toggleSheetFrozen } from "./workbook-freeze.ts";
import { commitHistory, emptyHistory, moveHistory } from "./workbook-history.ts";

const data = (book: Workbook) => book.sheets.find(s => s.kind === "data") as DataSheet;
const graph = (book: Workbook) => book.sheets.find(s => s.kind === "graph") as GraphSheet;
const style = { symbol_shape: "diamond" as const, symbol_size: 9, symbol_color: "#c32191", fill: "#abcdef", error_width: 2 };
function styled(type: "column" | "xy" = "column") {
  const book = fromProject(sample(type)), source = data(book), sheet = graph(book);
  const index = type === "xy" ? 1 : 0, uid = source.project.columns[index].id!;
  source.project.graph.dataset_styles = { [uid]: { ...style } };
  sheet.graph.dataset_styles = { [uid]: { ...style } };
  return { book, source, sheet, uid, index };
}

for (const type of ["column", "xy"] as const) test(`${type}: standalone import remaps styles with newly created source IDs`, () => {
  const project = sample(type), index = type === "xy" ? 1 : 0;
  project.columns.forEach((column, i) => { column.id = `original-${i}`; });
  project.graph.dataset_styles = { [project.columns[index].id!]: { ...style } };
  const original = structuredClone(project), book = parseWorkbook(JSON.stringify(project));
  const source = data(book), sheet = graph(book), uid = source.project.columns[index].id!;
  assert.notEqual(uid, project.columns[index].id);
  assert.deepEqual(source.project.graph.dataset_styles, { [uid]: style });
  assert.deepEqual(sheet.graph.dataset_styles, { [uid]: style });
  assert.notEqual(source.project.graph.dataset_styles, sheet.graph.dataset_styles);
  const drawn = plottedDatasetStyles(sheet.graph, source.project.columns, type === "xy", palette);
  assert.equal(drawn[0].symbol_shape, "diamond");
  assert.equal(drawn[0].symbol_size, 9);
  assert.deepEqual(requestData(source.project), requestData(project));
  assert.deepEqual(project, original);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("duplicated data defaults keep appearance on new identities and own their values", () => {
  const f = styled(), duplicated = duplicateSheet(f.book, f.source.id);
  const copy = duplicated.sheets.at(-1) as DataSheet, uid = copy.project.columns[0].id!;
  assert.notEqual(uid, f.uid);
  assert.deepEqual(copy.project.graph.dataset_styles, { [uid]: style });
  const withGraph = addGraph(duplicated, copy.id), created = withGraph.sheets.at(-1) as GraphSheet;
  assert.deepEqual(created.graph.dataset_styles, { [uid]: style });
  copy.project.graph.dataset_styles![uid].symbol_size = 2;
  assert.equal(f.source.project.graph.dataset_styles![f.uid].symbol_size, 9);
  assert.equal(created.graph.dataset_styles![uid].symbol_size, 9);
  assert.deepEqual(parseWorkbook(JSON.stringify(withGraph)), withGraph);
});

test("adding the same styled project creates separate style identity namespaces", () => {
  const f = styled("xy");
  const next = addData(f.book, structuredClone(f.source.project));
  const copy = next.sheets.at(-2) as DataSheet, copyGraph = next.sheets.at(-1) as GraphSheet;
  const uid = copy.project.columns[1].id!;
  assert.notEqual(uid, f.uid);
  assert.deepEqual(copyGraph.graph.dataset_styles, { [uid]: style });
  assert.deepEqual(f.sheet.graph.dataset_styles, { [f.uid]: style });
  assert.deepEqual(parseWorkbook(JSON.stringify(next)), next);
});

test("source deletion prunes style keys while graph removal keeps omitted source styles", () => {
  const f = styled(), omitted = { ...f.sheet, ...datasetSelection(f.source, [1, 2]) };
  const book = { ...f.book, sheets: [f.source, omitted] };
  const reopened = parseWorkbook(JSON.stringify(book));
  assert.deepEqual(graph(reopened).graph.dataset_styles, { [f.uid]: style });
  const project = structuredClone(f.source.project);
  project.columns = project.columns.slice(1);
  let deleted = updateData(reopened, f.source.id, project);
  assert.deepEqual(data(deleted).project.graph.dataset_styles, {});
  assert.deepEqual(graph(deleted).graph.dataset_styles, {});
  const replacement = structuredClone(data(deleted).project);
  replacement.columns.push({ name: f.source.project.columns[0].name, values: ["1", "2", "3"] });
  deleted = updateData(deleted, f.source.id, replacement);
  assert.deepEqual(graph(deleted).graph.dataset_styles, {});
  assert.deepEqual(parseWorkbook(JSON.stringify(deleted)), deleted);
});

test("reorder, rename and XY X/Y role changes preserve styles of surviving identities", () => {
  const f = styled();
  let project = structuredClone(f.source.project);
  project.columns = [project.columns[1], project.columns[0], project.columns[2]];
  project.columns[1].name = "Renamed";
  let book = updateData(f.book, f.source.id, project);
  assert.deepEqual(graph(book).graph.dataset_styles, { [f.uid]: style });
  project = structuredClone(data(book).project);
  project.columns = [project.columns[1], project.columns[0], project.columns[2]];
  project.table_type = "xy"; project.graph.type = "scatter";
  book = updateData(book, f.source.id, project);
  assert.equal(data(book).project.columns[0].id, f.uid);
  assert.deepEqual(graph(book).graph.dataset_styles, { [f.uid]: style });
  project = structuredClone(data(book).project); project.table_type = "column";
  book = updateData(book, f.source.id, project);
  assert.deepEqual(graph(book).graph.dataset_styles, { [f.uid]: style });
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("frozen styles validate against captured source and prune only when thawed", () => {
  const f = styled(), frozen = toggleSheetFrozen(f.book, f.sheet.id);
  const project = structuredClone(f.source.project); project.columns = project.columns.slice(1);
  const changed = updateData(frozen, f.source.id, project);
  assert.deepEqual(graph(changed).graph.dataset_styles, { [f.uid]: style });
  const reopened = parseWorkbook(JSON.stringify(changed));
  assert.deepEqual(graph(reopened).graph.dataset_styles, { [f.uid]: style });
  assert.deepEqual(graph(reopened).frozenSource!.project.graph.dataset_styles, { [f.uid]: style });
  const thawed = toggleSheetFrozen(reopened, f.sheet.id);
  assert.deepEqual(graph(thawed).graph.dataset_styles, {});
  assert.deepEqual(data(thawed).project.graph.dataset_styles, {});
  assert.deepEqual(parseWorkbook(JSON.stringify(thawed)), thawed);
});

test("reopening older v4 files cleans only dangling style keys and still rejects invalid fields", () => {
  const f = styled();
  f.source.project.graph.dataset_styles!.deleted = { symbol_size: 4 };
  f.sheet.graph.dataset_styles!.deleted = { symbol_size: 4 };
  const reopened = parseWorkbook(JSON.stringify(f.book));
  assert.deepEqual(data(reopened).project.graph.dataset_styles, { [f.uid]: style });
  assert.deepEqual(graph(reopened).graph.dataset_styles, { [f.uid]: style });
  const bad = structuredClone(f.book);
  (graph(bad).graph.dataset_styles![f.uid] as Record<string, unknown>).symbol_size = "9";
  assert.throws(() => parseWorkbook(JSON.stringify(bad)), /graph settings/);
});

test("deleting the last plotted dataset preserves an empty reviewable graph", () => {
  const f = styled();
  f.sheet = { ...f.sheet, ...datasetSelection(f.source, [0]) };
  f.book.sheets[1] = f.sheet;
  const project = structuredClone(f.source.project); project.columns = project.columns.slice(1);
  const next = updateData(f.book, f.source.id, project);
  assert.equal(graph(next).selectionInvalid, true);
  assert.deepEqual(graph(next).datasetIds, []);
  assert.deepEqual(graph(next).graph.dataset_styles, {});
  assert.deepEqual(parseWorkbook(JSON.stringify(next)), next);
});

test("style remapping handles prototype-like source IDs without changing input objects", () => {
  const project = sample("column");
  project.columns[0].id = "__proto__";
  project.columns[1].id = "constructor";
  project.graph.dataset_styles = Object.fromEntries([["__proto__", style], ["constructor", { symbol_shape: "square" }]]);
  const book = fromProject(project), source = data(book);
  assert.deepEqual(graph(book).graph.dataset_styles, {
    [source.project.columns[0].id!]: style,
    [source.project.columns[1].id!]: { symbol_shape: "square" },
  });
  assert.equal(Object.hasOwn(project.graph.dataset_styles!, "__proto__"), true);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("graph duplication and history retain independent same-source styles", () => {
  const f = styled(), copied = duplicateSheet(f.book, f.sheet.id);
  const copy = copied.sheets.at(-1) as GraphSheet;
  copy.graph.dataset_styles![f.uid].symbol_size = 2;
  assert.equal(f.sheet.graph.dataset_styles![f.uid].symbol_size, 9);
  const project = structuredClone(f.source.project); project.columns = project.columns.slice(1);
  const deleted = updateData(f.book, f.source.id, project);
  const history = commitHistory(emptyHistory(), f.book, deleted, { label: "Delete dataset" });
  const undo = moveHistory(history, deleted, "undo")!;
  assert.deepEqual(graph(undo.workbook).graph.dataset_styles, { [f.uid]: style });
  const redo = moveHistory(undo.history, undo.workbook, "redo")!;
  assert.deepEqual(graph(redo.workbook).graph.dataset_styles, {});
});

test("styled standalone imports reject ambiguous duplicate IDs instead of choosing a dataset", () => {
  const project = sample("column");
  project.columns[0].id = project.columns[1].id = "duplicate";
  project.graph.dataset_styles = { duplicate: { ...style } };
  assert.throws(() => fromProject(project), /unique IDs/);
});
