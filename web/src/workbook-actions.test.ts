import test from "node:test";
import assert from "node:assert/strict";
import { addData, fromProject, parseWorkbook } from "./workbook.ts";
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
    columnIndices: [0],
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
});
