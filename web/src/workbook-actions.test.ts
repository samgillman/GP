import test from "node:test";
import assert from "node:assert/strict";
import { addData, fromProject, parseWorkbook, sourceSheet, datasetSelection } from "./workbook.ts";
import { sample } from "./data.ts";
import { deleteSheet, duplicateSheet } from "./workbook-actions.ts";
import type { ResultSheet, GraphSheet } from "./workbook.ts";

test("deleting data removes its family, preserves other data and round-trips", () => {
  let book = fromProject(sample("column"));
  const first = book.activeSheetId;
  book = addData(book, sample("xy"));
  const removed = deleteSheet(book, first);
  assert.equal(removed.sheets.length, 2);
  assert.deepEqual(parseWorkbook(JSON.stringify(removed)), removed);
  assert.equal(book.sheets.length, 4);
  assert.throws(
    () => deleteSheet(removed, removed.activeSheetId),
    /at least one/,
  );
});
test("deleting a results sheet detaches linked graphs while keeping raw data", () => {
  const book = fromProject(sample("column"));
  const result: ResultSheet = {
    kind: "results",
    id: "r",
    name: "r",
    dataId: book.activeSheetId,
    analysis: "descriptive",
    ...datasetSelection(sourceSheet(book, book.sheets[0]), [0]),
    sourceRevision: 0,
    status: "stale",
    result: null,
  };
  const graph = book.sheets[1] as GraphSheet;
  const withResult = {
    ...book,
    activeSheetId: "r",
    sheets: [book.sheets[0], { ...graph, resultId: "r" }, result],
  };
  const removed = deleteSheet(withResult, "r");
  assert.equal((removed.sheets[1] as GraphSheet).resultId, null);
  assert.equal(removed.activeSheetId, book.activeSheetId);
  assert.deepEqual(parseWorkbook(JSON.stringify(removed)), removed);
});
test("duplicates are independent and uniquely named", () => {
  const book = fromProject(sample("column"));
  const once = duplicateSheet(book, book.activeSheetId);
  const twice = duplicateSheet(once, book.activeSheetId);
  assert.notEqual(once.activeSheetId, twice.activeSheetId);
  const copied = twice.sheets.at(-1)!;
  assert.match(copied.name, /copy 2$/);
  if (copied.kind !== "data") throw new Error("data expected");
  copied.project.columns[0].values[0] = "999";
  const original = book.sheets[0];
  if (original.kind !== "data") throw new Error("data expected");
  assert.notEqual(original.project.columns[0].values[0], "999");
  assert.equal(copied.rowIds.length, original.rowIds.length);
  assert.ok(copied.rowIds.every((id) => !original.rowIds.includes(id)));
  assert.ok(copied.project.columns.every((column) => !original.project.columns.some((old) => old.id === column.id)));
  assert.deepEqual(parseWorkbook(JSON.stringify(twice)), twice);
});

test("graph duplication keeps source identities but owns independent settings", () => {
  const book = fromProject(sample("column"));
  const graph = book.sheets[1];
  if (graph.kind !== "graph") throw new Error("graph expected");
  const duplicated = duplicateSheet(book, graph.id);
  const copy = duplicated.sheets.at(-1)!;
  if (copy.kind !== "graph") throw new Error("graph expected");
  assert.notEqual(copy.id, graph.id);
  assert.deepEqual(copy.datasetIds, graph.datasetIds);
  assert.equal(copy.dataId, graph.dataId);
  copy.graph.title = "Independent graph";
  assert.notEqual(copy.graph.title, graph.graph.title);
  assert.deepEqual(parseWorkbook(JSON.stringify(duplicated)), duplicated);
});
