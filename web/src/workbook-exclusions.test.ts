import { test } from "node:test";
import assert from "node:assert/strict";
import { requestData, sample } from "./data.ts";
import type { Response } from "./data.ts";
import {
  addData,
  addGraph,
  exclusionPositions,
  excludedCount,
  fromProject,
  includedProject,
  newRowIds,
  parseWorkbook,
  recordResult,
  selectedProject,
  sourceSheet,
  toggleExcludedValues,
  updateData,
} from "./workbook.ts";
import type { DataSheet, ResultSheet, Workbook } from "./workbook.ts";
import { duplicateSheet } from "./workbook-actions.ts";
import { effectiveSource, toggleSheetFrozen } from "./workbook-freeze.ts";
import { commitHistory, emptyHistory, moveHistory } from "./workbook-history.ts";
import { recalculationTask } from "./workbook-recalculation.ts";

const output: Response = {
  analysis: "descriptive",
  summary: [],
  results: [],
  warnings: [],
  fit: [],
};
const cell = (column: number, row: number) => ({
  startColumn: column,
  endColumn: column,
  startRow: row,
  endRow: row,
});
function data(book: Workbook, id = book.sheets[0].id): DataSheet {
  const sheet = book.sheets.find((s) => s.id === id);
  assert.ok(sheet?.kind === "data");
  return sheet;
}
function result(book: Workbook, id: string): ResultSheet {
  const sheet = book.sheets.find((s) => s.id === id);
  assert.ok(sheet?.kind === "results");
  return sheet;
}
function withResult() {
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  book = recordResult(book, {
    name: "Result",
    dataId,
    analysis: "descriptive",
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: output,
  });
  return { book, dataId, resultId: book.activeSheetId };
}

test("excluding keeps entered text, removes the value from analysis input and stales dependents", () => {
  const { book, dataId, resultId } = withResult();
  const { book: next, excluded, count } = toggleExcludedValues(book, dataId, cell(0, 1));
  assert.equal(excluded, true);
  assert.equal(count, 1);
  const sheet = data(next, dataId);
  assert.equal(sheet.project.columns[0].values[1], "38");
  assert.deepEqual(sheet.excluded, { [sheet.project.columns[0].id!]: [sheet.rowIds[1]] });
  assert.equal(sheet.revision, 1);
  assert.equal(result(next, resultId).status, "stale");
  const input = requestData({ ...selectedProject(sheet, [0, 1]), analysis: "descriptive" });
  assert.equal(input.columns[0].values[1], null);
  assert.equal(input.columns[0].values.filter((value) => value !== null).length, 7);
  assert.equal(input.columns[1].values.filter((value) => value !== null).length, 8);
  const task = recalculationTask(next, result(next, resultId));
  assert.equal(task?.input?.columns[0].values[1], null);
  assert.equal(task?.input?.columns[0].values[0], 42);
  assert.deepEqual(parseWorkbook(JSON.stringify(next)), next);
});

test("the same command restores a fully excluded selection and excludes a mixed one", () => {
  const { book, dataId } = withResult();
  let next = toggleExcludedValues(book, dataId, cell(0, 0)).book;
  const mixed = toggleExcludedValues(next, dataId, { startColumn: 0, endColumn: 0, startRow: 0, endRow: 2 });
  assert.equal(mixed.excluded, true);
  assert.equal(mixed.count, 2);
  assert.equal(excludedCount(data(mixed.book, dataId)), 3);
  const restored = toggleExcludedValues(mixed.book, dataId, { startColumn: 0, endColumn: 0, startRow: 0, endRow: 2 });
  assert.equal(restored.excluded, false);
  assert.equal(restored.count, 3);
  next = restored.book;
  assert.equal("excluded" in data(next, dataId), false);
  assert.deepEqual(includedProject(data(next, dataId)).columns, data(book, dataId).project.columns);
  assert.deepEqual(parseWorkbook(JSON.stringify(next)), next);
});

test("blank, draft and virtual cells are never excluded; empty selections fail explicitly", () => {
  const project = sample("column");
  project.columns = [{ name: "A", values: ["1", "", "-", "4"] }];
  const book = fromProject(project);
  const dataId = book.activeSheetId;
  const all = toggleExcludedValues(book, dataId, { startColumn: 0, endColumn: 29, startRow: 0, endRow: 9999 });
  assert.equal(all.count, 2);
  assert.deepEqual([...exclusionPositions(data(all.book, dataId)).get(0)!], [0, 3]);
  assert.throws(() => toggleExcludedValues(book, dataId, cell(0, 1)), /numeric values/);
  assert.throws(() => toggleExcludedValues(book, dataId, cell(0, 2)), /numeric values/);
  assert.throws(() => toggleExcludedValues(book, dataId, cell(5, 50)), /numeric values/);
  assert.throws(() => toggleExcludedValues(book, book.sheets[1].id, cell(0, 0)), /data table/);
});

test("exclusions follow stable row and dataset identities through structural edits", () => {
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  book = toggleExcludedValues(book, dataId, cell(1, 2)).book;
  const before = data(book, dataId);
  const excludedRow = before.rowIds[2];
  // Insert a row above and a dataset before the excluded one.
  const inserted = newRowIds(1)[0];
  book = updateData(
    book,
    dataId,
    {
      ...before.project,
      columns: [
        { name: "New", values: ["0"] },
        ...before.project.columns.map((column) => ({ ...column, values: ["", ...column.values] })),
      ],
    },
    { rowIds: [inserted, ...before.rowIds] },
  );
  let current = data(book, dataId);
  assert.deepEqual([...exclusionPositions(current).get(2)!], [3]);
  assert.equal(includedProject(current).columns[2].values[3], "");
  // Reorder rows: the excluded observation moves with its row identity.
  const order = [...current.rowIds.keys()].reverse();
  book = updateData(
    book,
    dataId,
    {
      ...current.project,
      columns: current.project.columns.map((column) => ({
        ...column,
        values: order.map((row) => column.values[row] ?? ""),
      })),
    },
    { rowIds: order.map((row) => current.rowIds[row]) },
  );
  current = data(book, dataId);
  const row = current.rowIds.indexOf(excludedRow);
  assert.deepEqual([...exclusionPositions(current).get(2)!], [row]);
  assert.equal(current.project.columns[2].values[row], before.project.columns[1].values[2]);
  // Deleting the row removes the exclusion rather than retargeting another row.
  book = updateData(
    book,
    dataId,
    {
      ...current.project,
      columns: current.project.columns.map((column) => ({
        ...column,
        values: column.values.filter((_, index) => index !== row),
      })),
    },
    { rowIds: current.rowIds.filter((_, index) => index !== row) },
  );
  assert.equal("excluded" in data(book, dataId), false);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});

test("editing, clearing or deleting an excluded value drops only that exclusion", () => {
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  book = toggleExcludedValues(book, dataId, { startColumn: 0, endColumn: 2, startRow: 0, endRow: 0 }).book;
  assert.equal(excludedCount(data(book, dataId)), 3);
  const edited = structuredClone(data(book, dataId).project);
  edited.columns[0].values[0] = "41";
  edited.columns[1].values[0] = "";
  book = updateData(book, dataId, edited);
  const current = data(book, dataId);
  assert.deepEqual(current.excluded, { [current.project.columns[2].id!]: [current.rowIds[0]] });
  const removed = { ...current.project, columns: current.project.columns.slice(0, 2) };
  book = updateData(book, dataId, removed);
  assert.equal("excluded" in data(book, dataId), false);
  // A renamed table keeps exclusions and does not invalidate output.
  let renamed = toggleExcludedValues(book, dataId, cell(0, 1)).book;
  const revision = data(renamed, dataId).revision;
  renamed = updateData(renamed, dataId, { ...data(renamed, dataId).project, name: "Renamed" });
  assert.equal(data(renamed, dataId).revision, revision);
  assert.equal(excludedCount(data(renamed, dataId)), 1);
});

test("excluded XY X values remove the row's points while Y values stay recoverable", () => {
  const book = fromProject(sample("xy"));
  const dataId = book.activeSheetId;
  const next = toggleExcludedValues(book, dataId, cell(0, 3)).book;
  const selected = selectedProject(data(next, dataId), [1, 2]);
  assert.equal(selected.columns[0].values[3], "");
  assert.equal(selected.columns[1].values[3], "47");
  assert.equal(data(next, dataId).project.columns[0].values[3], "3");
});

test("undo and redo restore exclusion commands as single workbook changes", () => {
  const { book, dataId } = withResult();
  const after = toggleExcludedValues(book, dataId, { startColumn: 0, endColumn: 1, startRow: 0, endRow: 3 }).book;
  const history = commitHistory(emptyHistory(), book, after, { label: "Exclude values" });
  assert.equal(history.past.length, 1);
  const undone = moveHistory(history, after, "undo")!;
  assert.equal(undone.label, "Exclude values");
  assert.equal("excluded" in data(undone.workbook, dataId), false);
  const redone = moveHistory(undone.history, undone.workbook, "redo")!;
  assert.equal(excludedCount(data(redone.workbook, dataId)), 8);
});

test("frozen tables reject exclusion changes; frozen results keep their captured exclusions", () => {
  const { book, dataId, resultId } = withResult();
  const frozenData = toggleSheetFrozen(book, dataId);
  assert.throws(() => toggleExcludedValues(frozenData, dataId, cell(0, 0)), /Unfreeze/);
  assert.throws(
    () => updateData(frozenData, dataId, data(frozenData, dataId).project, { excluded: { [data(book).project.columns[0].id!]: [data(book).rowIds[0]] } }),
    /exclusions/,
  );
  let live = toggleExcludedValues(book, dataId, cell(0, 0)).book;
  live = recordResult(live, {
    name: "Result",
    dataId,
    analysis: "descriptive",
    columnIndices: [0, 1],
    sourceRevision: data(live, dataId).revision,
    result: output,
  }, resultId);
  const frozen = toggleSheetFrozen(live, resultId);
  const restored = toggleExcludedValues(frozen, dataId, cell(0, 0)).book;
  assert.equal("excluded" in data(restored, dataId), false);
  const snapshot = effectiveSource(restored, result(restored, resultId));
  assert.equal(excludedCount(snapshot), 1);
  assert.equal(selectedProject(snapshot, [0])[`columns`][0].values[0], "");
  assert.equal(result(restored, resultId).status, "current");
  assert.deepEqual(parseWorkbook(JSON.stringify(restored)), restored);
  // Undo can reuse a revision with different exclusions. A frozen result captured
  // from the other exclusion state is historical: no new live graph or graph freeze.
  const graphBook = addGraph(frozen, dataId, resultId);
  const reused = data(toggleExcludedValues(book, dataId, cell(1, 1)).book, dataId);
  assert.equal(reused.revision, result(frozen, resultId).sourceRevision);
  const conflicting = {
    ...graphBook,
    sheets: graphBook.sheets.map((sheet) => (sheet.id === dataId ? reused : sheet)),
  };
  assert.throws(() => addGraph(conflicting, dataId, resultId), /historical source data/);
  assert.throws(() => toggleSheetFrozen(conflicting, graphBook.activeSheetId), /different source data/);
});

test("version 4 round-trips exclusions; v3 migrates and malformed exclusions are rejected", () => {
  const { book, dataId } = withResult();
  const excluded = toggleExcludedValues(book, dataId, { startColumn: 0, endColumn: 1, startRow: 1, endRow: 2 }).book;
  const saved = JSON.parse(JSON.stringify(excluded));
  assert.equal(saved.version, 4);
  const v3 = JSON.parse(JSON.stringify(book));
  v3.version = 3;
  assert.equal(parseWorkbook(JSON.stringify(v3)).version, 4);
  const legacyWithExclusions = structuredClone(saved);
  legacyWithExclusions.version = 3;
  assert.throws(() => parseWorkbook(JSON.stringify(legacyWithExclusions)), /version 4/);
  const sheet = saved.sheets[0];
  const [first, second] = sheet.project.columns.map((column: { id: string }) => column.id);
  const mutations = [
    (s: any) => { s.excluded = []; },
    (s: any) => { s.excluded = { missing: [s.rowIds[0]] }; },
    (s: any) => { s.excluded[first] = ["dangling"]; },
    (s: any) => { s.excluded[first] = [s.rowIds[1], s.rowIds[1]]; },
    (s: any) => { s.excluded[first] = []; },
    (s: any) => { s.project.columns[0].values[1] = ""; },
    (s: any) => { s.project.columns[0].values[1] = "-"; },
    (s: any) => { s.excluded = JSON.parse(`{"__proto__": ["${s.rowIds[0]}"]}`); },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(saved);
    mutate(copy.sheets[0]);
    assert.throws(() => parseWorkbook(JSON.stringify(copy)));
  }
  // Valid but non-canonical ordering is normalized, not rejected.
  const reordered = structuredClone(saved);
  reordered.sheets[0].excluded = {
    [second]: [...sheet.excluded[second]].reverse(),
    [first]: [...sheet.excluded[first]].reverse(),
  };
  assert.deepEqual(parseWorkbook(JSON.stringify(reordered)), parseWorkbook(JSON.stringify(saved)));
});

test("data copies own remapped exclusions and imported excluded cells become identities", () => {
  const { book, dataId } = withResult();
  const excluded = toggleExcludedValues(book, dataId, cell(2, 4)).book;
  const copied = duplicateSheet(excluded, dataId);
  const copy = data(copied, copied.activeSheetId);
  assert.deepEqual([...exclusionPositions(copy).get(2)!], [4]);
  assert.ok(!Object.keys(copy.excluded!).some((uid) => uid in data(excluded, dataId).excluded!));
  assert.deepEqual(parseWorkbook(JSON.stringify(copied)), copied);
  const imported = addData(book, sample("column"), [{ column: 1, row: 0 }, { column: 1, row: 7 }]);
  const table = data(imported, imported.activeSheetId);
  assert.deepEqual([...exclusionPositions(table).get(1)!], [0, 7]);
  assert.throws(() => fromProject({ ...sample("column"), columns: [{ name: "A", values: ["", "1"] }] }, [{ column: 0, row: 0 }]), /numeric/);
  assert.equal(sourceSheet(imported, imported.sheets.at(-1)!).id, table.id);
});
