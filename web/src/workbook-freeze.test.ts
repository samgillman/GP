import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Response, TableType } from "./data.ts";
import {
  addData,
  addGraph,
  fromProject,
  parseWorkbook,
  recordResult,
  sourceSheet,
  updateData,
} from "./workbook.ts";
import type {
  DataSheet,
  GraphSheet,
  ResultSheet,
  Workbook,
} from "./workbook.ts";
import { deleteSheet, duplicateSheet } from "./workbook-actions.ts";
import {
  effectiveResult,
  effectiveSource,
  toggleSheetFrozen,
} from "./workbook-freeze.ts";
import {
  applyRecalculatedResult,
  recalculationTask,
} from "./workbook-recalculation.ts";
import { deepFreezeWorkbookState } from "./workbook-snapshot.ts";

const output: Response = {
  analysis: "descriptive",
  summary: [],
  results: [{ label: "Saved", value: 3 }],
  fit: [],
  warnings: [],
};
function fixture(type: TableType = "column") {
  let book = fromProject(sample(type));
  const data = book.sheets[0] as DataSheet;
  book = recordResult(book, {
    name: "Results",
    dataId: data.id,
    analysis: "descriptive",
    columnIndices: type === "xy" ? [1, 2] : [0, 2],
    sourceRevision: data.revision,
    result: structuredClone(output),
  });
  const resultId = book.activeSheetId;
  book = addGraph(book, data.id, resultId);
  return { book, dataId: data.id, resultId, graphId: book.activeSheetId };
}
function data(book: Workbook, id: string) {
  return book.sheets.find((s) => s.id === id) as DataSheet;
}
function result(book: Workbook, id: string) {
  return book.sheets.find((s) => s.id === id) as ResultSheet;
}
function graph(book: Workbook, id: string) {
  return book.sheets.find((s) => s.id === id) as GraphSheet;
}
function edit(book: Workbook, id: string) {
  const next = structuredClone(data(book, id).project);
  next.columns[1].values[0] = "999";
  return updateData(book, id, next);
}
function roundtrip(book: Workbook) {
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
}

for (const type of ["column", "xy"] as const) {
  test(`${type}: frozen results and graphs preserve original inputs/output across value, row and dataset deletion`, () => {
    const f = fixture(type);
    let book = toggleSheetFrozen(
      toggleSheetFrozen(f.book, f.resultId),
      f.graphId,
    );
    const savedResult = structuredClone(result(book, f.resultId));
    const savedGraph = structuredClone(graph(book, f.graphId));
    book = edit(book, f.dataId);
    let source = data(book, f.dataId);
    // Remove a selected dataset and a represented row. Captures retain IDs that
    // no longer occur in the live table, and reopen validates them independently.
    const next = {
      ...source.project,
      columns: source.project.columns
        .slice(0, -1)
        .map((c) => ({ ...c, values: c.values.slice(1) })),
    };
    book = updateData(book, source.id, next, {
      rowIds: source.rowIds.slice(1),
    });
    assert.deepEqual(result(book, f.resultId), savedResult);
    assert.deepEqual(graph(book, f.graphId), savedGraph);
    assert.deepEqual(
      effectiveSource(book, graph(book, f.graphId)),
      savedGraph.frozenSource,
    );
    assert.deepEqual(
      effectiveResult(book, graph(book, f.graphId)),
      savedGraph.frozenResult,
    );
    assert.equal(recalculationTask(book, result(book, f.resultId)), null);
    roundtrip(book);
    const frozenBook = structuredClone(book);
    book = toggleSheetFrozen(toggleSheetFrozen(book, f.resultId), f.graphId);
    const thawed = result(book, f.resultId);
    assert.equal(thawed.status, "stale");
    assert.equal(thawed.result, null);
    assert.equal(thawed.selectionInvalid, true);
    assert.equal(graph(book, f.graphId).selectionInvalid, true);
    assert.equal(thawed.frozenSource, undefined);
    assert.equal(graph(book, f.graphId).frozenResult, undefined);
    assert.match(
      recalculationTask(book, thawed)?.blocked ?? "",
      /structure changed/,
    );
    assert.deepEqual(
      frozenBook.sheets.find((s) => s.id === f.resultId),
      savedResult,
    );
    roundtrip(book);
  });
}

test("frozen data rejects values, dataset changes and row permutation, but permits labels/view metadata", () => {
  const f = fixture();
  const book = toggleSheetFrozen(f.book, f.dataId),
    source = data(book, f.dataId);
  assert.throws(() => edit(book, source.id), /Unfreeze the data/);
  const renamed = updateData(book, source.id, {
    ...source.project,
    name: "New label",
    columns: source.project.columns.map((column) => ({
      ...column,
      name: `${column.name} label`,
    })),
    graph: { ...source.project.graph, title: "View title" },
  });
  assert.equal(data(renamed, source.id).name, "New label");
  assert.equal(data(renamed, source.id).frozen, true);
  assert.throws(
    () =>
      updateData(book, source.id, {
        ...source.project,
        columns: [...source.project.columns].reverse(),
      }),
    /Unfreeze/,
  );
  assert.throws(
    () =>
      updateData(book, source.id, source.project, {
        rowIds: [...source.rowIds].reverse(),
      }),
    /Unfreeze/,
  );
  assert.throws(
    () =>
      updateData(
        book,
        source.id,
        {
          ...source.project,
          columns: source.project.columns.map((c) => ({
            ...c,
            values: c.values.slice(1),
          })),
        },
        { rowIds: source.rowIds.slice(1) },
      ),
    /Unfreeze/,
  );
  assert.throws(
    () =>
      updateData(book, source.id, {
        ...source.project,
        columns: source.project.columns.slice(0, -1),
      }),
    /Unfreeze/,
  );
  const thawed = toggleSheetFrozen(book, source.id);
  assert.equal(data(edit(thawed, source.id), source.id).revision, 1);
  roundtrip(book);
});

test("unfreeze remaps reordered datasets, queues current inputs and accepts a recalculated result", () => {
  const f = fixture();
  let book = toggleSheetFrozen(f.book, f.resultId);
  const source = data(book, f.dataId),
    oldIds = result(book, f.resultId).datasetIds;
  book = updateData(book, source.id, {
    ...source.project,
    columns: [
      source.project.columns[2],
      source.project.columns[0],
      source.project.columns[1],
    ],
  });
  book = toggleSheetFrozen(book, f.resultId);
  const thawed = result(book, f.resultId);
  assert.deepEqual(thawed.datasetIds, oldIds);
  assert.deepEqual(thawed.columnIndices, [1, 0]);
  assert.equal(thawed.selectionInvalid, false);
  const task = recalculationTask(book, thawed)!;
  assert.ok(task.input);
  assert.equal(task.blocked, undefined);
  book = applyRecalculatedResult(book, task, output);
  assert.equal(result(book, f.resultId).status, "current");
  assert.equal(
    result(book, f.resultId).sourceRevision,
    data(book, f.dataId).revision,
  );
  roundtrip(book);
});

test("row-only changes recalculate after thaw without invalidating retained dataset IDs", () => {
  const f = fixture();
  let book = toggleSheetFrozen(f.book, f.resultId);
  const source = data(book, f.dataId);
  book = updateData(
    book,
    source.id,
    {
      ...source.project,
      columns: source.project.columns.map((c) => ({
        ...c,
        values: c.values.slice(1),
      })),
    },
    { rowIds: source.rowIds.slice(1) },
  );
  book = toggleSheetFrozen(book, f.resultId);
  assert.equal(result(book, f.resultId).selectionInvalid, false);
  assert.ok(recalculationTask(book, result(book, f.resultId))?.input);
});

test("XY X replacement requires review after thaw even if selected Y datasets survive", () => {
  const f = fixture("xy");
  let book = toggleSheetFrozen(
    toggleSheetFrozen(f.book, f.resultId),
    f.graphId,
  );
  const source = data(book, f.dataId);
  const replacement = { ...source.project.columns[0], id: crypto.randomUUID() };
  book = updateData(book, source.id, {
    ...source.project,
    columns: [replacement, ...source.project.columns.slice(1)],
  });
  book = toggleSheetFrozen(toggleSheetFrozen(book, f.resultId), f.graphId);
  assert.equal(result(book, f.resultId).selectionInvalid, true);
  assert.equal(graph(book, f.graphId).selectionInvalid, true);
});

test("stale, missing, invalid-selection and incompatible frozen outputs cannot be captured", () => {
  const f = fixture();
  const stale = edit(f.book, f.dataId);
  assert.throws(() => toggleSheetFrozen(stale, f.resultId), /Recalculate/);
  assert.throws(() => toggleSheetFrozen(stale, f.graphId), /Recalculate/);
  const frozen = edit(toggleSheetFrozen(f.book, f.resultId), f.dataId);
  assert.throws(
    () => toggleSheetFrozen(frozen, f.graphId),
    /Recalculate|different source/,
  );
  const invalid = structuredClone(f.book);
  result(invalid, f.resultId).selectionInvalid = true;
  assert.throws(() => toggleSheetFrozen(invalid, f.resultId), /Review/);
  const missing = structuredClone(f.book);
  result(missing, f.resultId).result = null;
  assert.throws(() => toggleSheetFrozen(missing, f.resultId), /Recalculate/);
  const inconsistent = toggleSheetFrozen(f.book, f.resultId);
  result(inconsistent, f.resultId).frozenSource!.project.columns[0].values[0] =
    "888";
  assert.throws(
    () => toggleSheetFrozen(inconsistent, f.graphId),
    /different source/,
  );
});

test("new live graphs reject historical frozen results and foreign source links", () => {
  const f = fixture();
  const frozen = toggleSheetFrozen(f.book, f.resultId);
  const initialGraph = addGraph(frozen, f.dataId, f.resultId);
  assert.equal(graph(initialGraph, initialGraph.activeSheetId).resultId, f.resultId);
  const edited = edit(frozen, f.dataId);
  assert.throws(() => addGraph(edited, f.dataId, f.resultId), /historical source/);
  const other = addData(frozen, sample("column"));
  assert.throws(() => addGraph(other, other.activeSheetId, f.resultId), /Invalid graph result link/);
  const thawed = toggleSheetFrozen(edited, f.resultId);
  const task = recalculationTask(thawed, result(thawed, f.resultId))!;
  const recalculated = applyRecalculatedResult(thawed, task, output);
  const live = addGraph(recalculated, f.dataId, f.resultId);
  roundtrip(live);
});

test("snapshots have no live object aliases and toggle has no navigation or caller mutation", () => {
  const f = fixture();
  const before = JSON.stringify(f.book);
  deepFreezeWorkbookState(f.book);
  const frozen = toggleSheetFrozen(
    toggleSheetFrozen(f.book, f.resultId),
    f.graphId,
  );
  assert.equal(JSON.stringify(f.book), before);
  assert.equal(frozen.activeSheetId, f.book.activeSheetId);
  assert.notEqual(
    result(frozen, f.resultId).result,
    result(f.book, f.resultId).result,
  );
  assert.notEqual(
    result(frozen, f.resultId).frozenSource!.project,
    data(f.book, f.dataId).project,
  );
  assert.notEqual(
    graph(frozen, f.graphId).frozenResult!.result,
    result(frozen, f.resultId).result,
  );
  const changed = edit(frozen, f.dataId);
  assert.equal(JSON.stringify(f.book), before);
  assert.deepEqual(result(changed, f.resultId).result, output);
});

test("frozen graph survives linked result deletion and thaws into an unlinked graph", () => {
  const f = fixture();
  let book = toggleSheetFrozen(f.book, f.graphId);
  const captured = graph(book, f.graphId).frozenResult;
  book = deleteSheet(book, f.resultId);
  assert.equal(graph(book, f.graphId).resultId, null);
  assert.deepEqual(effectiveResult(book, graph(book, f.graphId)), captured);
  roundtrip(book);
  book = toggleSheetFrozen(book, f.graphId);
  assert.equal(graph(book, f.graphId).frozenResult, undefined);
  assert.equal(effectiveResult(book, graph(book, f.graphId)), null);
});

test("duplicates preserve independent frozen captures; source deletion still cascades", () => {
  const f = fixture();
  let book = toggleSheetFrozen(
    toggleSheetFrozen(toggleSheetFrozen(f.book, f.resultId), f.graphId),
    f.dataId,
  );
  for (const id of [f.dataId, f.resultId, f.graphId]) {
    const original = book.sheets.find((s) => s.id === id)!;
    book = duplicateSheet(book, id);
    const copy = book.sheets.find((s) => s.id === book.activeSheetId)!;
    assert.equal(copy.frozen, true);
    assert.notEqual(copy.id, original.id);
    if (copy.kind !== "data" && original.kind !== "data") {
      assert.deepEqual(copy.frozenSource, original.frozenSource);
      assert.notEqual(copy.frozenSource, original.frozenSource);
    }
    roundtrip(book);
  }
  book = addData(book, sample("column"));
  book = deleteSheet(book, f.dataId);
  assert.equal(
    book.sheets.some((s) => s.kind !== "data" && s.dataId === f.dataId),
    false,
  );
  roundtrip(book);
});

test("raw graph capture needs no result and freezes its source through edits", () => {
  let book = fromProject(sample("xy"));
  const graphId = book.sheets[1].id,
    dataId = book.sheets[0].id;
  book = toggleSheetFrozen(book, graphId);
  assert.equal(graph(book, graphId).frozenResult, undefined);
  const source = structuredClone(effectiveSource(book, graph(book, graphId)));
  book = edit(book, dataId);
  assert.deepEqual(effectiveSource(book, graph(book, graphId)), source);
  assert.equal(effectiveResult(book, graph(book, graphId)), null);
  roundtrip(book);
});

test("recordResult cannot overwrite a frozen result", () => {
  const f = fixture();
  const book = toggleSheetFrozen(f.book, f.resultId);
  assert.throws(
    () =>
      recordResult(
        book,
        {
          name: "Replacement",
          dataId: f.dataId,
          analysis: "descriptive",
          columnIndices: [0],
          sourceRevision: 0,
          result: output,
        },
        f.resultId,
      ),
    /Unfreeze/,
  );
});

test("reopen rejects malformed/partial nested captures without silently dropping saved output", () => {
  const f = fixture();
  const valid = toggleSheetFrozen(
    toggleSheetFrozen(f.book, f.resultId),
    f.graphId,
  );
  const mutations: ((b: any) => void)[] = [
    (b) => {
      b.sheets[0].frozen = "yes";
    },
    (b) => {
      b.sheets[0].frozenSource = {};
    },
    (b) => {
      b.sheets[2].frozen = false;
    },
    (b) => {
      delete b.sheets[2].frozenSource;
    },
    (b) => {
      b.sheets[2].frozenSource.id = "other";
    },
    (b) => {
      b.sheets[2].frozenSource.rowIds.pop();
    },
    (b) => {
      b.sheets[2].frozenSource.project.columns[0].id =
        b.sheets[2].frozenSource.rowIds[0];
    },
    (b) => {
      b.sheets[2].frozenSource.frozen = true;
    },
    (b) => {
      b.sheets[2].frozenSource.frozenSource = {};
    },
    (b) => {
      b.sheets[2].sourceRevision++;
    },
    (b) => {
      b.sheets[2].status = "stale";
    },
    (b) => {
      b.sheets[2].result = null;
    },
    (b) => {
      b.sheets[2].selectionInvalid = true;
    },
    (b) => {
      b.sheets[2].datasetIds.reverse();
    },
    (b) => {
      b.sheets[2].frozenResult = {};
    },
    (b) => {
      delete b.sheets[3].frozenResult;
    },
    (b) => {
      b.sheets[3].frozenResult = null;
    },
    (b) => {
      b.sheets[3].frozenResult.sourceRevision++;
    },
    (b) => {
      b.sheets[3].frozenResult.id = "wrong";
    },
    (b) => {
      b.sheets[3].frozenResult.dataId = "wrong";
    },
    (b) => {
      b.sheets[3].frozenResult.frozenSource = {};
    },
    (b) => {
      b.sheets[3].frozenResult.frozen = false;
    },
    (b) => {
      b.sheets[3].frozenResult.datasetIds[0] = "missing";
    },
    (b) => {
      b.sheets[3].frozenResult.result.analysis = "welch_t";
    },
    (b) => {
      b.sheets[3].selectionInvalid = true;
    },
  ];
  for (const mutate of mutations) {
    const book = JSON.parse(JSON.stringify(valid));
    mutate(book);
    assert.throws(() => parseWorkbook(JSON.stringify(book)), mutate.toString());
  }
  roundtrip(valid);
});

test("freeze and thaw are independent undoable commits preserving historical output", async () => {
  const { commitHistory, emptyHistory, moveHistory } =
    await import("./workbook-history.ts");
  const f = fixture();
  const frozen = toggleSheetFrozen(f.book, f.resultId);
  let history = commitHistory(emptyHistory(), f.book, frozen, {
    label: "Freeze sheet",
  });
  const edited = edit(frozen, f.dataId);
  history = commitHistory(history, frozen, edited, { label: "Edit data" });
  const thawed = toggleSheetFrozen(edited, f.resultId);
  history = commitHistory(history, edited, thawed, { label: "Unfreeze sheet" });
  const undoThaw = moveHistory(history, thawed, "undo")!;
  assert.deepEqual(undoThaw.workbook, edited);
  assert.deepEqual(result(undoThaw.workbook, f.resultId).result, output);
  roundtrip(undoThaw.workbook);
  const redoThaw = moveHistory(undoThaw.history, undoThaw.workbook, "redo")!;
  assert.deepEqual(redoThaw.workbook, thawed);
  const undoEdit = moveHistory(undoThaw.history, undoThaw.workbook, "undo")!;
  assert.deepEqual(undoEdit.workbook, frozen);
  const undoFreeze = moveHistory(undoEdit.history, undoEdit.workbook, "undo")!;
  assert.deepEqual(undoFreeze.workbook, f.book);
});
