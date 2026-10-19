import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Response } from "./data.ts";
import { addData, fromProject, recordResult, updateData } from "./workbook.ts";
import { prepareWorkbookSnapshot } from "./workbook-snapshot.ts";
import {
  breakHistoryGroup,
  commitHistory,
  emptyHistory,
  moveHistory,
  shouldHandleHistoryShortcut,
} from "./workbook-history.ts";
const output: Response = {
  analysis: "descriptive",
  summary: [],
  results: [],
  warnings: [],
  fit: [],
};
test("undo data edit restores matching linked output; redo restores invalidation", () => {
  let before = fromProject(sample("column"));
  const id = before.sheets[0].id;
  before = recordResult(before, {
    name: "Summary",
    dataId: id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: output,
  });
  const p = sample("column");
  p.columns[0].values[0] = "99";
  const after = updateData(before, id, p);
  const history = commitHistory(emptyHistory(), before, after, {
    label: "Edit data",
  });
  const undo = moveHistory(history, after, "undo")!;
  assert.deepEqual(undo.workbook, before);
  assert.equal(
    undo.workbook.sheets[2].kind === "results" &&
      undo.workbook.sheets[2].status,
    "current",
  );
  assert.deepEqual(
    moveHistory(undo.history, undo.workbook, "redo")!.workbook,
    after,
  );
});
test("sheet creation is undoable and navigation does not add an entry or erase redo", () => {
  const before = fromProject(sample("column")),
    after = addData(before, sample("xy"));
  let h = commitHistory(emptyHistory(), before, after, {
    label: "Create table",
  });
  const undo = moveHistory(h, after, "undo")!;
  assert.equal(undo.workbook.sheets.length, 2);
  const navigated = { ...undo.workbook, activeSheetId: before.sheets[1].id };
  h = commitHistory(undo.history, undo.workbook, navigated);
  assert.equal(h.past.length, 0);
  assert.equal(h.future.length, 1);
  const redo = moveHistory(h, navigated, "redo")!;
  assert.equal(redo.workbook.sheets.length, 4);
  assert.equal(redo.workbook.activeSheetId, navigated.activeSheetId);
});
test("each graph Apply is one commit; unchanged apply and cancelled drafts add no commit", () => {
  const a = fromProject(sample("column"));
  const b = structuredClone(a);
  if (b.sheets[1].kind === "graph") b.sheets[1].graph.title = "Applied title";
  let h = commitHistory(emptyHistory(), a, b, { label: "Format graph" });
  assert.equal(h.past.length, 1);
  const cancelledDraft = structuredClone(b);
  if (cancelledDraft.sheets[1].kind === "graph")
    cancelledDraft.sheets[1].graph.title = "Cancelled";
  h = commitHistory(h, b, b, { label: "Format graph" });
  assert.equal(h.past.length, 1);
  assert.deepEqual(moveHistory(h, b, "undo")!.workbook, a);
});
test("typing coalesces only same-field edits in a short window and stops at blur", () => {
  const a = fromProject(sample("column")),
    b = { ...a, name: "A" },
    c = { ...a, name: "AB" },
    d = { ...a, name: "ABC" };
  let h = commitHistory(emptyHistory(), a, b, {
    coalesceKey: "name",
    now: 100,
  });
  h = commitHistory(h, b, c, { coalesceKey: "name", now: 200 });
  assert.equal(h.past.length, 1);
  h = commitHistory(breakHistoryGroup(h), c, d, {
    coalesceKey: "name",
    now: 300,
  });
  assert.equal(h.past.length, 2);
  assert.equal(moveHistory(h, d, "undo")!.workbook.name, "AB");
});
test("new edits after undo clear redo; reset discards history at workbook boundaries", () => {
  const a = fromProject(sample("column")),
    b = { ...a, name: "B" };
  let h = commitHistory(emptyHistory(), a, b);
  const undone = moveHistory(h, b, "undo")!;
  h = commitHistory(undone.history, undone.workbook, { ...a, name: "C" });
  assert.equal(h.future.length, 0);
  assert.deepEqual(commitHistory(h, a, b, { reset: true }), emptyHistory());
});
test("snapshot count and conservative string memory limits are enforced", () => {
  let book = fromProject(sample("column")),
    h = emptyHistory();
  for (let i = 0; i < 10; i++) {
    const next = { ...book, name: String(i) };
    h = commitHistory(h, book, next, {}, { count: 3, bytes: 100000 });
    book = next;
  }
  assert.equal(h.past.length, 3);
  assert.equal(h.limited, true);
  h = commitHistory(
    h,
    book,
    { ...book, name: "last" },
    {},
    { count: 40, bytes: 1 },
  );
  assert.equal(h.past.length, 0);
});
test("keyboard shortcuts leave text-input undo, dialogs and handled events alone", () => {
  const event = {
    key: "z",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
  };
  assert.equal(shouldHandleHistoryShortcut(event, false, false), "undo");
  assert.equal(
    shouldHandleHistoryShortcut({ ...event, shiftKey: true }, false, false),
    "redo",
  );
  assert.equal(
    shouldHandleHistoryShortcut({ ...event, key: "y" }, false, false),
    "redo",
  );
  assert.equal(
    shouldHandleHistoryShortcut(
      { ...event, ctrlKey: false, metaKey: true },
      false,
      false,
    ),
    "undo",
  );
  assert.equal(shouldHandleHistoryShortcut(event, true, false), null);
  assert.equal(shouldHandleHistoryShortcut(event, false, true), null);
  assert.equal(
    shouldHandleHistoryShortcut(
      { ...event, defaultPrevented: true },
      false,
      false,
    ),
    null,
  );
});

test("prepared typing groups preserve redo/navigation and exact history byte boundaries", () => {
  const a = fromProject(sample("column")), b = { ...a, name: "B" }, c = { ...a, name: "BC" };
  const pa = prepareWorkbookSnapshot(a), pb = prepareWorkbookSnapshot(b), pc = prepareWorkbookSnapshot(c);
  let h = commitHistory(emptyHistory(), pa, pb, { coalesceKey: "name", now: 1 }, { count: 40, bytes: pa.historyBytes });
  assert.equal(h.past.length, 1); assert.equal(h.limited, false);
  h = commitHistory(h, pb, pc, { coalesceKey: "name", now: 2 });
  assert.equal(h.past.length, 1);
  const undo = moveHistory(h, pc, "undo")!;
  assert.equal(undo.workbook.name, a.name);
  const navigated = prepareWorkbookSnapshot({ ...undo.workbook, activeSheetId: a.sheets[1].id });
  const navigationHistory = commitHistory(undo.history, prepareWorkbookSnapshot(undo.workbook), navigated);
  assert.equal(navigationHistory.future.length, 1);
  const redo = moveHistory(navigationHistory, navigated, "redo")!;
  assert.equal(redo.workbook.name, "BC");
  assert.equal(redo.workbook.activeSheetId, a.sheets[1].id);
  const limited = commitHistory(emptyHistory(), pa, pb, {}, { count: 40, bytes: pa.historyBytes - 1 });
  assert.equal(limited.past.length, 0); assert.equal(limited.limited, true);
});
