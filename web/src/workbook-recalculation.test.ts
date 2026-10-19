import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Analysis, Response } from "./data.ts";
import { addData, fromProject, recordResult, updateData } from "./workbook.ts";
import type { DataSheet, ResultSheet, Workbook } from "./workbook.ts";
import {
  commitHistory,
  emptyHistory,
  moveHistory,
} from "./workbook-history.ts";
import {
  applyRecalculatedResult,
  recalculationTask,
  WorkbookRecalculator,
} from "./workbook-recalculation.ts";
import type {
  RecalculationStates,
  RecalculationTask,
} from "./workbook-recalculation.ts";

function output(
  analysis: Analysis = "descriptive",
  marker = "fresh",
): Response {
  return {
    analysis,
    summary: [],
    results: [{ label: "Response marker", value: marker }],
    warnings: [],
    fit: [],
  };
}
function data(book: Workbook, id: string): DataSheet {
  const sheet = book.sheets.find((s) => s.id === id);
  assert.ok(sheet?.kind === "data");
  return sheet;
}
function result(book: Workbook, id: string): ResultSheet {
  const sheet = book.sheets.find((s) => s.id === id);
  assert.ok(sheet?.kind === "results");
  return sheet;
}
function edit(book: Workbook, id: string, value: string): Workbook {
  const project = structuredClone(data(book, id).project);
  project.columns[0].values[0] = value;
  return updateData(book, id, project);
}
function addAnalysis(
  book: Workbook,
  dataId: string,
  analysis: Analysis,
): Workbook {
  return recordResult(book, {
    name: `${analysis} output`,
    dataId,
    analysis,
    columnIndices: analysis === "welch_t" ? [0, 1] : [0, 1, 2],
    sourceRevision: data(book, dataId).revision,
    result: output(analysis, "previous"),
  });
}
function fixture(analyses: Analysis[] = ["descriptive"]) {
  let book = fromProject(sample("column"));
  const dataId = book.activeSheetId;
  const resultIds: string[] = [];
  for (const analysis of analyses) {
    book = addAnalysis(book, dataId, analysis);
    resultIds.push(book.activeSheetId);
  }
  return { book, dataId, resultIds };
}
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
// Drain chained queue microtasks without depending on real wall-clock sleeps.
async function drain() {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}
function harness(
  t: TestContext,
  initial: Workbook,
  compute: (
    task: RecalculationTask,
    signal: AbortSignal,
  ) => Promise<unknown> = async (task) => output(task.input!.analysis),
  debounceMs = 400,
) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  const state = {
    book: initial,
    states: {} as RecalculationStates,
    calls: [] as { task: RecalculationTask; signal: AbortSignal }[],
    applied: [] as string[],
    events: [] as RecalculationStates[],
  };
  const queue = new WorkbookRecalculator({
    read: () => state.book,
    debounceMs,
    compute: (task, signal) => {
      state.calls.push({ task, signal });
      return compute(task, signal);
    },
    apply: (task, response) => {
      const next = applyRecalculatedResult(state.book, task, response);
      if (next !== state.book) state.applied.push(task.id);
      state.book = next;
    },
    changed: (states) => {
      state.states = states;
      state.events.push(structuredClone(states));
    },
  });
  t.after(() => queue.dispose());
  async function tick(ms: number) {
    t.mock.timers.tick(ms);
    await drain();
  }
  return { state, queue, tick };
}

test("all linked result sheets recalculate after the last edit and retain their own analyses", async (t) => {
  const f = fixture(["descriptive", "welch_t", "anova"]);
  const h = harness(t, edit(f.book, f.dataId, "57"));
  h.queue.sync();
  assert.equal(h.state.calls.length, 0);
  assert.deepEqual(
    Object.values(h.state.states).map((s) => s.phase),
    ["queued", "queued", "queued"],
  );
  await h.tick(399);
  assert.equal(h.state.calls.length, 0);
  await h.tick(1);
  assert.deepEqual(
    h.state.calls.map((c) => c.task.input!.analysis),
    ["descriptive", "welch_t", "anova"],
  );
  assert.deepEqual(h.state.applied, f.resultIds);
  for (const id of f.resultIds) {
    const sheet = result(h.state.book, id);
    assert.equal(sheet.status, "current");
    assert.equal(sheet.sourceRevision, 1);
    assert.equal(sheet.result!.analysis, sheet.analysis);
  }
  assert.deepEqual(h.state.states, {});
  h.queue.sync();
  await h.tick(5000);
  assert.equal(
    h.state.calls.length,
    3,
    "current sheets must not recalculate repeatedly",
  );
});

test("debounce restarts for each numeric edit and dispatches only the latest input", async (t) => {
  const f = fixture();
  const h = harness(t, edit(f.book, f.dataId, "5"));
  h.queue.sync();
  await h.tick(300);
  h.state.book = edit(h.state.book, f.dataId, "58");
  h.queue.sync();
  await h.tick(399);
  assert.equal(h.state.calls.length, 0);
  await h.tick(1);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0].task.input!.columns[0].values[0], 58);
  assert.equal(result(h.state.book, f.resultIds[0]).sourceRevision, 2);
});

test("an abort-ignoring adapter cannot apply a late output after source data changes", async (t) => {
  const f = fixture();
  const pending = [deferred(), deferred()];
  let n = 0;
  const h = harness(
    t,
    edit(f.book, f.dataId, "10"),
    () => pending[n++].promise,
    0,
  );
  h.queue.sync();
  await drain();
  assert.equal(h.state.calls.length, 1);
  h.state.book = edit(h.state.book, f.dataId, "20");
  h.queue.sync();
  assert.equal(h.state.calls[0].signal.aborted, true);
  pending[0].resolve(output("descriptive", "obsolete"));
  await drain();
  assert.equal(h.state.applied.length, 0);
  assert.equal(h.state.calls.length, 2);
  assert.equal(h.state.calls[1].task.input!.columns[0].values[0], 20);
  pending[1].resolve(output("descriptive", "latest"));
  await drain();
  assert.deepEqual(h.state.applied, f.resultIds);
  assert.equal(
    result(h.state.book, f.resultIds[0]).result!.results[0].value,
    "latest",
  );
});

test("undo followed by a different edit cannot reuse an old task with the same revision", async (t) => {
  const f = fixture();
  const first = edit(f.book, f.dataId, "10");
  const history = commitHistory(emptyHistory(), f.book, first, {
    label: "Edit data",
  });
  const pending = [deferred(), deferred()];
  let n = 0;
  const h = harness(t, first, () => pending[n++].promise, 0);
  h.queue.sync();
  await drain();
  const oldTask = h.state.calls[0].task;
  const undone = moveHistory(history, h.state.book, "undo")!;
  h.state.book = undone.workbook;
  h.queue.sync();
  h.state.book = edit(h.state.book, f.dataId, "99");
  h.queue.sync();
  const newTask = recalculationTask(
    h.state.book,
    result(h.state.book, f.resultIds[0]),
  )!;
  assert.equal(oldTask.sourceRevision, newTask.sourceRevision);
  assert.notEqual(oldTask.key, newTask.key);
  assert.equal(
    applyRecalculatedResult(h.state.book, oldTask, output()),
    h.state.book,
  );
  pending[0].resolve(output("descriptive", "old revision one"));
  await drain();
  assert.equal(h.state.applied.length, 0);
  pending[1].resolve(output("descriptive", "new revision one"));
  await drain();
  assert.equal(
    result(h.state.book, f.resultIds[0]).result!.results[0].value,
    "new revision one",
  );
});

test("document reset rejects an in-flight result even when all IDs and inputs are identical", async (t) => {
  const f = fixture();
  const pending = [deferred(), deferred()];
  let n = 0;
  const h = harness(
    t,
    edit(f.book, f.dataId, "10"),
    () => pending[n++].promise,
    0,
  );
  h.queue.sync();
  await drain();
  const oldKey = h.state.calls[0].task.key;
  h.queue.reset();
  assert.equal(h.state.calls[0].signal.aborted, true);
  assert.deepEqual(h.state.states, {});
  h.state.book = structuredClone(h.state.book);
  h.queue.sync();
  await drain();
  assert.equal(h.state.calls.length, 2);
  assert.equal(h.state.calls[1].task.key, oldKey);
  pending[0].resolve(output("descriptive", "previous document"));
  await drain();
  assert.equal(h.state.applied.length, 0);
  assert.equal(h.state.states[f.resultIds[0]].phase, "running");
  pending[1].resolve(output("descriptive", "current document"));
  await drain();
  assert.equal(
    result(h.state.book, f.resultIds[0]).result!.results[0].value,
    "current document",
  );
});

test("incomplete numeric drafts block requests and valid replacement automatically recovers", async (t) => {
  const f = fixture();
  const h = harness(t, edit(f.book, f.dataId, "-"));
  h.queue.sync();
  assert.equal(h.state.states[f.resultIds[0]].phase, "blocked");
  assert.match(h.state.states[f.resultIds[0]].message, /finite number/);
  await h.tick(5000);
  assert.equal(h.state.calls.length, 0);
  h.state.book = edit(h.state.book, f.dataId, "-12.5");
  h.queue.sync();
  await h.tick(400);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0].task.input!.columns[0].values[0], -12.5);
  assert.equal(result(h.state.book, f.resultIds[0]).status, "current");
});

test("invalid or empty dataset selections remain blocked without dispatch until explicitly repaired", async (t) => {
  const f = fixture();
  let book = edit(f.book, f.dataId, "10");
  book = {
    ...book,
    sheets: book.sheets.map((s) =>
      s.id === f.resultIds[0] ? { ...s, selectionInvalid: true } : s,
    ),
  };
  const h = harness(t, book);
  h.queue.sync();
  await h.tick(2000);
  assert.equal(h.state.calls.length, 0);
  assert.match(
    h.state.states[f.resultIds[0]].message,
    /source table structure changed/,
  );
  h.state.book = {
    ...h.state.book,
    sheets: h.state.book.sheets.map((s) =>
      s.id === f.resultIds[0]
        ? { ...s, selectionInvalid: false, columnIndices: [] }
        : s,
    ),
  };
  h.queue.sync();
  await h.tick(2000);
  assert.equal(h.state.calls.length, 0);
  assert.match(h.state.states[f.resultIds[0]].message, /at least one dataset/);
  h.state.book = {
    ...h.state.book,
    sheets: h.state.book.sheets.map((s) =>
      s.id === f.resultIds[0] ? { ...s, columnIndices: [0] } : s,
    ),
  };
  h.queue.sync();
  await h.tick(400);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0].task.input!.columns.length, 1);
});

test("one failed job does not block other results or retry itself; explicit retry resumes it", async (t) => {
  const f = fixture(["descriptive", "welch_t"]);
  let attempts = 0;
  const h = harness(
    t,
    edit(f.book, f.dataId, "10"),
    async (task) => {
      if (task.id === f.resultIds[0] && ++attempts === 1)
        throw new Error("Model could not converge");
      return output(task.input!.analysis);
    },
    0,
  );
  h.queue.sync();
  await drain();
  assert.equal(h.state.states[f.resultIds[0]].phase, "error");
  assert.match(h.state.states[f.resultIds[0]].message, /could not converge/);
  assert.equal(result(h.state.book, f.resultIds[1]).status, "current");
  for (let i = 0; i < 3; i++) {
    h.queue.sync();
    await h.tick(1000);
  }
  assert.equal(attempts, 1);
  assert.equal(h.state.calls.length, 2);
  h.queue.retry(f.resultIds[0]);
  await drain();
  assert.equal(attempts, 2);
  assert.equal(result(h.state.book, f.resultIds[0]).status, "current");
  assert.deepEqual(h.state.states, {});
});

test("a synchronous adapter exception becomes a visible job failure and edits permit recovery", async (t) => {
  const f = fixture();
  let fail = true;
  const h = harness(
    t,
    edit(f.book, f.dataId, "10"),
    (task) => {
      if (fail) throw new Error("Engine not ready");
      return Promise.resolve(output(task.input!.analysis));
    },
    0,
  );
  h.queue.sync();
  await drain();
  assert.equal(h.state.states[f.resultIds[0]].phase, "error");
  fail = false;
  h.state.book = edit(h.state.book, f.dataId, "11");
  h.queue.sync();
  await drain();
  assert.equal(result(h.state.book, f.resultIds[0]).status, "current");
});

test("invalid engine output and mismatched analysis are rejected without replacing saved output", async (t) => {
  const f = fixture(["descriptive", "welch_t"]);
  const h = harness(
    t,
    edit(f.book, f.dataId, "10"),
    async (task) =>
      task.id === f.resultIds[0]
        ? { analysis: "descriptive", summary: "invalid" }
        : output("anova"),
    0,
  );
  h.queue.sync();
  await drain();
  for (const id of f.resultIds) {
    assert.equal(h.state.states[id].phase, "error");
    assert.match(h.state.states[id].message, /invalid result/);
    assert.equal(result(h.state.book, id).status, "stale");
    assert.equal(result(h.state.book, id).result, null);
  }
  assert.equal(h.state.applied.length, 0);
});

test("navigation, sheet naming, and graph formatting preserve a pending job and its selection", async (t) => {
  const f = fixture();
  const pending = deferred();
  const h = harness(t, edit(f.book, f.dataId, "10"), () => pending.promise, 0);
  h.queue.sync();
  await drain();
  const originalTask = h.state.calls[0].task;
  const graphId = h.state.book.sheets.find((s) => s.kind === "graph")!.id;
  h.state.book = {
    ...h.state.book,
    name: "Renamed workbook",
    activeSheetId: graphId,
    sheets: h.state.book.sheets.map((s) =>
      s.kind === "data"
        ? {
            ...s,
            name: "Renamed source",
            project: { ...s.project, name: "Renamed source" },
          }
        : s.kind === "results"
          ? { ...s, name: "Renamed result" }
          : {
              ...s,
              name: "Renamed graph",
              graph: { ...s.graph, title: "New graph title" },
            },
    ),
  };
  h.queue.sync();
  assert.equal(h.state.calls[0].signal.aborted, false);
  assert.equal(
    recalculationTask(h.state.book, result(h.state.book, f.resultIds[0]))!.key,
    originalTask.key,
  );
  pending.resolve(output());
  await drain();
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.book.activeSheetId, graphId);
  assert.equal(h.state.book.name, "Renamed workbook");
  assert.equal(result(h.state.book, f.resultIds[0]).name, "Renamed result");
  const graph = h.state.book.sheets.find((s) => s.id === graphId)!;
  assert.equal(graph.kind === "graph" && graph.graph.title, "New graph title");
});

test("tables maintain independent jobs while a different table is edited during computation", async (t) => {
  const f = fixture();
  let book = addData(f.book, sample("column"));
  const secondDataId = book.activeSheetId;
  book = addAnalysis(book, secondDataId, "descriptive");
  const secondResultId = book.activeSheetId;
  book = edit(edit(book, f.dataId, "10"), secondDataId, "20");
  const pending = [deferred(), deferred(), deferred()];
  let n = 0;
  const h = harness(t, book, () => pending[n++].promise, 0);
  h.queue.sync();
  await drain();
  await h.tick(1); // Give the queued second table an earlier deadline than the replacement.
  h.state.book = edit(h.state.book, f.dataId, "11");
  h.queue.sync();
  pending[0].resolve(output("descriptive", "discarded A"));
  await drain();
  assert.equal(h.state.calls[1].task.id, secondResultId);
  h.state.book = edit(h.state.book, f.dataId, "12");
  h.queue.sync();
  assert.equal(
    h.state.calls[1].signal.aborted,
    false,
    "editing A must not abort B",
  );
  pending[1].resolve(output("descriptive", "B"));
  await drain();
  assert.equal(result(h.state.book, secondResultId).status, "current");
  assert.equal(h.state.calls[2].task.id, f.resultIds[0]);
  assert.equal(h.state.calls[2].task.input!.columns[0].values[0], 12);
  pending[2].resolve(output("descriptive", "A latest"));
  await drain();
  assert.equal(
    result(h.state.book, f.resultIds[0]).result!.results[0].value,
    "A latest",
  );
  assert.equal(
    result(h.state.book, secondResultId).result!.results[0].value,
    "B",
  );
});

test("derived result application can preserve edit history and undo still restores original input", () => {
  const f = fixture();
  const edited = edit(f.book, f.dataId, "99");
  const history = commitHistory(emptyHistory(), f.book, edited, {
    label: "Edit cell",
  });
  const beforeHistory = JSON.stringify(history);
  const task = recalculationTask(edited, result(edited, f.resultIds[0]))!;
  const computed = applyRecalculatedResult(edited, task, output());
  assert.equal(JSON.stringify(history), beforeHistory);
  assert.equal(history.past.length, 1);
  const undo = moveHistory(history, computed, "undo")!;
  assert.equal(
    data(undo.workbook, f.dataId).project.columns[0].values[0],
    "42",
  );
  assert.equal(
    result(undo.workbook, f.resultIds[0]).result!.results[0].value,
    "previous",
  );
  assert.equal(undo.history.past.length, 0);
});

test("dispose cancels pending timers and ignores completions from a disposed running adapter", async (t) => {
  const f = fixture();
  const pending = deferred();
  const h = harness(t, edit(f.book, f.dataId, "10"), () => pending.promise);
  h.queue.sync();
  await h.tick(400);
  assert.equal(h.state.calls.length, 1);
  h.queue.dispose();
  assert.equal(h.state.calls[0].signal.aborted, true);
  const events = h.state.events.length;
  pending.resolve(output());
  await drain();
  h.queue.sync();
  h.queue.retry(f.resultIds[0]);
  await h.tick(5000);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.applied.length, 0);
  assert.equal(h.state.events.length, events);
});

test("disposing during debounce prevents dispatch and queued retry does not bypass debounce", async (t) => {
  const f = fixture();
  const pending = deferred();
  const h = harness(t, edit(f.book, f.dataId, "10"), () => pending.promise);
  h.queue.sync();
  h.queue.retry(f.resultIds[0]);
  await h.tick(399);
  assert.equal(h.state.calls.length, 0);
  h.queue.dispose();
  await h.tick(5000);
  assert.equal(h.state.calls.length, 0);
});

test("a direct stale response cannot apply after selection or analysis parameters change", () => {
  const f = fixture();
  const stale = edit(f.book, f.dataId, "10");
  const task = recalculationTask(stale, result(stale, f.resultIds[0]))!;
  const changed = {
    ...stale,
    sheets: stale.sheets.map((s) =>
      s.id === f.resultIds[0] && s.kind === "results"
        ? { ...s, analysis: "welch_t" as const, columnIndices: [0, 1] }
        : s,
    ),
  };
  assert.equal(applyRecalculatedResult(changed, task, output()), changed);
  const missing = {
    ...stale,
    sheets: stale.sheets.filter((s) => s.id !== f.dataId),
  };
  assert.match(
    recalculationTask(missing, result(missing, f.resultIds[0]))!.blocked ?? "",
    /source data table is missing/,
  );
});

test("retry while an analysis is running does not dispatch a duplicate", async (t) => {
  const f = fixture();
  const pending = deferred();
  const h = harness(t, edit(f.book, f.dataId, "10"), () => pending.promise, 0);
  h.queue.sync();
  await drain();
  h.queue.retry(f.resultIds[0]);
  h.queue.sync();
  await h.tick(5000);
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.calls[0].signal.aborted, false);
  pending.resolve(output());
  await drain();
  assert.equal(h.state.applied.length, 1);
});
