import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { fromProject, parseWorkbook, updateData, datasetSelection, addGraph } from "./workbook.ts";
import type { Workbook, DataSheet, GraphSheet } from "./workbook.ts";
import { duplicateSheet } from "./workbook-actions.ts";
import { toggleSheetFrozen } from "./workbook-freeze.ts";
import { seedDatasetColors, colorsForDatasetIds } from "./graph-dataset-order.ts";
import { normalizeGraphDatasetColors } from "./workbook-graph-colors.ts";
import { emptyHistory, commitHistory, moveHistory } from "./workbook-history.ts";

const colors = ["#A10011", "#22B233", "#3344C3"];
function data(book: Workbook) { return book.sheets.find(s => s.kind === "data") as DataSheet; }
function graph(book: Workbook) { return book.sheets.find(s => s.kind === "graph") as GraphSheet; }
function fixture(type: "column" | "xy" = "column") {
  const book = fromProject(sample(type)), source = data(book), sheet = graph(book);
  sheet.graph.colors = colors.slice(0, sheet.columnIndices.length);
  sheet.datasetColors = seedDatasetColors(source.project, sheet.columnIndices, sheet.graph.colors);
  return book;
}
function membership(book: Workbook, indices: number[]) {
  const source = data(book), previous = graph(book);
  const remembered = seedDatasetColors(source.project, previous.columnIndices, previous.graph.colors, previous.datasetColors);
  const next = colorsForDatasetIds(source.project, indices, remembered);
  return { ...book, sheets: book.sheets.map(s => s.id !== previous.id ? s : {
    ...previous, ...datasetSelection(source, indices), datasetColors: next.datasetColors,
    graph: { ...previous.graph, colors: next.colors },
  }) };
}
const reopen = (book: Workbook) => parseWorkbook(JSON.stringify(book));

for (const type of ["column", "xy"] as const) {
  test(`${type}: hidden colors survive JSON reopen and membership reordering`, () => {
    let book = fixture(type);
    const original = structuredClone(graph(book)), source = data(book);
    const [first, ...rest] = original.columnIndices;
    book = reopen(membership(book, rest));
    assert.equal(graph(book).datasetColors![source.project.columns[first].id!], colors[0]);
    book = reopen(membership(book, [...rest, first]));
    assert.deepEqual(graph(book).graph.colors, [...original.graph.colors.slice(1), colors[0]]);
    assert.deepEqual(graph(book).datasetIds, [...original.datasetIds.slice(1), original.datasetIds[0]]);
    assert.deepEqual(graph(book).datasetColors, original.datasetColors);
  });
}

test("legacy absence is preserved; first edit seeds existing positional and cyclic colors", () => {
  const book = fromProject(sample("column"));
  graph(book).graph.colors = [colors[0], colors[1]];
  assert.equal(reopen(book).sheets.some(s => "datasetColors" in s), false);
  const legacy = { ...structuredClone(book), version: 2 };
  for (const sheet of legacy.sheets) {
    if (sheet.kind === "data") {
      for (const column of sheet.project.columns) delete column.id;
      delete (sheet as Partial<DataSheet>).rowIds;
    } else delete (sheet as Partial<GraphSheet>).datasetIds;
  }
  const migrated = parseWorkbook(JSON.stringify(legacy));
  assert.equal(graph(migrated).datasetColors, undefined);
  const edited = membership(migrated, [2, 0]);
  assert.deepEqual(graph(edited).graph.colors, [colors[0], colors[0]]);
  assert.equal(graph(edited).datasetColors![data(edited).project.columns[1].id!], colors[1]);
});

test("visible positional colors win stale redundant map values without discarding hidden memory", () => {
  let book = membership(fixture(), [1, 2]);
  const hiddenId = data(book).project.columns[0].id!;
  graph(book).graph.colors[0] = "#123456";
  book = reopen(book);
  assert.equal(graph(book).datasetColors![graph(book).datasetIds[0]], "#123456");
  assert.equal(graph(book).datasetColors![hiddenId], colors[0]);
  assert.equal(normalizeGraphDatasetColors(data(book).project, graph(book)).graph, graph(book).graph);
});

test("source rename/reorder preserves stable colors; deletion prunes active and omitted IDs", () => {
  let book = fixture();
  const original = data(book), ids = original.project.columns.map(c => c.id!);
  const next = { ...original.project, columns: [original.project.columns[2], { ...original.project.columns[0], name: "Renamed" }, original.project.columns[1]] };
  book = updateData(book, original.id, next);
  assert.deepEqual(graph(book).columnIndices, [1, 2, 0]);
  assert.deepEqual(graph(book).graph.colors, colors);
  book = membership(book, [1, 0]); // omit the original middle dataset
  book = updateData(book, original.id, { ...data(book).project, columns: data(book).project.columns.filter(c => c.id !== ids[1]) });
  assert.equal(Object.hasOwn(graph(book).datasetColors!, ids[1]), false);
  assert.deepEqual(graph(book).graph.colors, [colors[0], colors[2]]);
  book = updateData(book, original.id, { ...data(book).project, columns: data(book).project.columns.filter(c => c.id !== ids[0]) });
  assert.deepEqual(graph(book).graph.colors, [colors[2]]);
  assert.deepEqual(Object.keys(graph(book).datasetColors!), [ids[2]]);
  assert.deepEqual(reopen(book), book);
});

test("deleting a legacy middle column preserves remaining positional colors", () => {
  let book = fromProject(sample("column"));
  const source = data(book);
  graph(book).graph.colors = [...colors];
  book = updateData(book, source.id, { ...source.project, columns: [source.project.columns[0], source.project.columns[2]] });
  assert.deepEqual(graph(book).graph.colors, [colors[0], colors[2]]);
  assert.deepEqual(reopen(book), book);
});

test("deleting the only active dataset leaves a valid empty selection and hidden color memory", () => {
  let book = membership(fixture(), [1]);
  const source = data(book), removed = source.project.columns[1].id!;
  book = updateData(book, source.id, { ...source.project, columns: [source.project.columns[0], source.project.columns[2]] });
  assert.deepEqual(graph(book).datasetIds, []);
  assert.deepEqual(graph(book).graph.colors, []);
  assert.equal(graph(book).selectionInvalid, true);
  assert.equal(Object.hasOwn(graph(book).datasetColors!, removed), false);
  assert.equal(Object.keys(graph(book).datasetColors!).length, 2);
  assert.deepEqual(reopen(book), book);
});

test("changing Column to XY retains Y colors and source-role color memory", () => {
  let book = fixture();
  const source = data(book), promoted = source.project.columns[0].id!;
  book = updateData(book, source.id, { ...source.project, table_type: "xy", analysis: "descriptive" });
  assert.deepEqual(graph(book).graph.colors, colors.slice(1));
  assert.equal(graph(book).datasetColors![promoted], colors[0]);
  assert.deepEqual(reopen(book), book);
});

test("frozen colors validate against their snapshot; thaw prunes deleted live IDs", () => {
  let book = fixture();
  const source = data(book), sheet = graph(book), removedId = source.project.columns[1].id!;
  book = toggleSheetFrozen(book, sheet.id);
  const captured = structuredClone(graph(book));
  book = updateData(book, source.id, { ...source.project, columns: [source.project.columns[0], source.project.columns[2]] });
  assert.deepEqual(graph(book), captured);
  assert.deepEqual(graph(reopen(book)), captured);
  book = toggleSheetFrozen(reopen(book), sheet.id);
  assert.equal(Object.hasOwn(graph(book).datasetColors!, removedId), false);
  assert.deepEqual(graph(book).graph.colors, [colors[0], colors[2]]);
  assert.deepEqual(reopen(book), book);
});

test("duplicated graphs own their map; duplicated/imported data uses new dataset IDs", () => {
  const book = membership(fixture(), [2]);
  const copied = duplicateSheet(book, graph(book).id);
  const copy = copied.sheets.at(-1) as GraphSheet;
  assert.deepEqual(copy.datasetColors, graph(book).datasetColors);
  assert.notEqual(copy.datasetColors, graph(book).datasetColors);
  copy.datasetColors![graph(book).datasetIds[0]] = "#000000";
  assert.notDeepEqual(copy.datasetColors, graph(book).datasetColors);
  const duplicatedData = duplicateSheet(book, data(book).id);
  const fresh = duplicatedData.sheets.at(-1) as DataSheet;
  const linked = addGraph(duplicatedData, fresh.id);
  const newGraph = linked.sheets.at(-1) as GraphSheet;
  assert.equal(newGraph.datasetColors, undefined);
  assert.equal(newGraph.datasetIds.some(id => data(book).project.columns.some(c => c.id === id)), false);
  const imported = fromProject(structuredClone(data(book).project));
  assert.equal(graph(imported).datasetColors, undefined);
  assert.equal(graph(imported).datasetIds.some(id => graph(book).datasetIds.includes(id)), false);
});

test("malformed maps are rejected before active entries can overwrite them", () => {
  const book = fixture(), id = graph(book).datasetIds[0];
  for (const invalid of [null, [], "red", { missing: colors[0] }, { [id]: "red" }, { [id]: 123 }, { [id]: "#12345678" }]) {
    const raw = structuredClone(book);
    (graph(raw) as unknown as { datasetColors: unknown }).datasetColors = invalid;
    assert.throws(() => reopen(raw), /graph dataset color|Graph dataset colors/);
  }
});

test("prototype-like stable IDs survive membership, JSON, pruning and invalid-value validation", () => {
  let book = fromProject(sample("column"));
  const source = data(book), ids = ["__proto__", "constructor", "toString"];
  source.project.columns.forEach((column, index) => { column.id = ids[index]; });
  const sheet = graph(book);
  sheet.datasetIds = [...ids];
  sheet.graph.colors = [...colors];
  sheet.datasetColors = seedDatasetColors(source.project, sheet.columnIndices, sheet.graph.colors);
  assert.deepEqual(Object.keys(sheet.datasetColors), ids);
  book = reopen(membership(book, [2]));
  book = reopen(membership(book, [1, 0, 2]));
  assert.deepEqual(graph(book).graph.colors, [colors[1], colors[0], colors[2]]);
  const invalid = structuredClone(book);
  Object.defineProperty(graph(invalid).datasetColors!, "__proto__", { value: { polluted: true }, enumerable: true });
  assert.throws(() => reopen(invalid), /Graph dataset colors/);
  const safe = updateData(book, source.id, { ...data(book).project, columns: data(book).project.columns.slice(1) });
  assert.equal(Object.hasOwn(graph(safe).datasetColors!, "__proto__"), false);
  assert.deepEqual(reopen(safe), safe);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("generic undo/redo snapshots retain omitted graph-local colors", () => {
  const before = fixture(), after = membership(before, [2]);
  const history = commitHistory(emptyHistory(), before, after, { label: "Format graph" });
  const undone = moveHistory(history, after, "undo")!;
  assert.deepEqual(undone.workbook, before);
  const redone = moveHistory(undone.history, undone.workbook, "redo")!;
  assert.deepEqual(redone.workbook, after);
  assert.deepEqual(reopen(redone.workbook), after);
});
