import test from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { fromProject, sourceSheet, updateData } from "./workbook.ts";
import {
  materializeSelection,
  selectionFromRange,
  selectedGraphPoint,
  selectedGraphRanges,
  sourceCellForPoint,
} from "./workbook-selection.ts";

test("graph range highlights follow dataset/row identities through reorder and insertion", () => {
  let book = fromProject(sample("column"));
  const before = sourceSheet(book, book.sheets[0]);
  const selection = selectionFromRange(before, {
    startColumn: 1,
    endColumn: 2,
    startRow: 1,
    endRow: 2,
  });
  const order = [2, 0, 1, 3, 4, 5, 6, 7];
  book = updateData(
    book,
    before.id,
    {
      ...before.project,
      columns: [
        before.project.columns[2],
        before.project.columns[0],
        before.project.columns[1],
      ].map((column) => ({
        ...column,
        values: order.map((row) => column.values[row]),
      })),
    },
    { rowIds: order.map((row) => before.rowIds[row]) },
  );
  const after = sourceSheet(book, book.sheets[0]);
  assert.deepEqual(selectedGraphRanges(after, [2, 0, 1], selection), [
    { seriesIndex: 0, startRow: 0, endRow: 0 },
    { seriesIndex: 0, startRow: 2, endRow: 2 },
    { seriesIndex: 1, startRow: 0, endRow: 0 },
    { seriesIndex: 1, startRow: 2, endRow: 2 },
  ]);
  assert.equal(selectedGraphPoint(after, [2, 0, 1], selection), null);
});

test("snapshot point navigation finds the live cell by identities and never targets its replacement", () => {
  let book = fromProject(sample("column"));
  const snapshot = structuredClone(sourceSheet(book, book.sheets[0]));
  const selected = selectionFromRange(snapshot, {
    startColumn: 2,
    endColumn: 2,
    startRow: 1,
    endRow: 1,
  });
  book = updateData(book, snapshot.id, {
    ...snapshot.project,
    columns: [snapshot.project.columns[2], snapshot.project.columns[0]],
  });
  const live = sourceSheet(book, book.sheets[0]);
  assert.deepEqual(sourceCellForPoint(snapshot, live, 2, 1), {
    column: 0,
    row: 1,
  });
  assert.deepEqual(selectedGraphPoint(live, [1, 0], selected), {
    seriesIndex: 1,
    row: 1,
  });
  const deleted = updateData(
    book,
    live.id,
    {
      ...live.project,
      columns: live.project.columns.map((column) => ({
        ...column,
        values: column.values.filter((_, row) => row !== 1),
      })),
    },
    { rowIds: live.rowIds.filter((_, row) => row !== 1) },
  );
  const after = sourceSheet(deleted, deleted.sheets[0]);
  assert.equal(sourceCellForPoint(snapshot, after, 2, 1), null);
  assert.deepEqual(selectedGraphRanges(after, [0], selected), []);
});

test("virtual blank selections acquire identities after entry without replacing established identities", () => {
  let book = fromProject(sample("column"));
  const before = sourceSheet(book, book.sheets[0]);
  const selection = selectionFromRange(before, {
    startColumn: 3,
    endColumn: 3,
    startRow: 8,
    endRow: 8,
  });
  book = updateData(book, before.id, {
    ...before.project,
    columns: [
      ...before.project.columns,
      { name: "New", values: Array(9).fill("7") },
    ],
  });
  const after = sourceSheet(book, book.sheets[0]);
  const materialized = materializeSelection(after, selection);
  assert.deepEqual(selectedGraphPoint(after, [3], materialized), {
    seriesIndex: 0,
    row: 8,
  });
  assert.equal(materializeSelection(after, materialized), materialized);
});
