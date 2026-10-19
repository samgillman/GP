import { requestData } from "./data.ts";
import { responseValid, selectedProject } from "./workbook.ts";
import type { ResultSheet, Workbook } from "./workbook.ts";

export type RecalculationTask = {
  id: string;
  key: string;
  sourceRevision: number;
  input?: ReturnType<typeof requestData>;
  blocked?: string;
};
export type RecalculationState = {
  phase: "queued" | "running" | "error" | "blocked";
  message: string;
};
export type RecalculationStates = Record<string, RecalculationState>;

// The complete input identity matters: undo and document replacement can reuse
// revision numbers. Navigation, graph formatting and sheet names do not affect it.
export function recalculationTask(
  book: Workbook,
  sheet: ResultSheet,
): RecalculationTask | null {
  if (sheet.status !== "stale") return null;
  const source = book.sheets.find((s) => s.id === sheet.dataId);
  const selected = source?.kind === "data"
    ? selectedProject(source, sheet.columnIndices)
    : null;
  const key = JSON.stringify([
    sheet.id, sheet.dataId, source?.kind === "data" ? source.revision : null,
    sheet.analysis, sheet.regression_model, sheet.columnIndices,
    sheet.selectionInvalid, selected?.table_type, selected?.columns,
  ]);
  const task: RecalculationTask = {
    id: sheet.id, key,
    sourceRevision: source?.kind === "data" ? source.revision : -1,
  };
  if (!selected) return { ...task, blocked: "The source data table is missing." };
  if (sheet.selectionInvalid)
    return { ...task, blocked: "The source table structure changed. Use Analyze Data to review the datasets and create a replacement analysis." };
  if (!sheet.columnIndices.length)
    return { ...task, blocked: "Select at least one dataset using Analyze Data." };
  try {
    return { ...task, input: requestData({
      ...selected, analysis: sheet.analysis,
      regression_model: sheet.regression_model,
    }) };
  } catch (error) {
    return { ...task, blocked: error instanceof Error ? error.message : "Finish editing the source data before recalculating." };
  }
}

export function applyRecalculatedResult(
  book: Workbook,
  task: RecalculationTask,
  result: unknown,
): Workbook {
  const sheet = book.sheets.find((s) => s.id === task.id);
  if (sheet?.kind !== "results" || recalculationTask(book, sheet)?.key !== task.key)
    return book;
  if (!responseValid(result) || result.analysis !== sheet.analysis)
    throw new Error("The analysis engine returned an invalid result. Try Recalculate analysis again.");
  return {
    ...book,
    sheets: book.sheets.map((s) => s.id === sheet.id ? {
      ...sheet, sourceRevision: task.sourceRevision, status: "current", result,
    } : s),
  };
}

type Entry = {
  task: RecalculationTask;
  state: RecalculationState;
  readyAt: number;
};
type Options = {
  read: () => Workbook;
  compute: (task: RecalculationTask, signal: AbortSignal) => Promise<unknown>;
  apply: (task: RecalculationTask, result: unknown) => void;
  changed: (states: RecalculationStates) => void;
  debounceMs?: number;
};

/** One queue per open workbook. Failures stay visible until edited or retried.
 * Cancellation rejects obsolete results; worker Python already executing is not
 * physically interrupted. Debouncing and a single active request bound dispatch.
 */
export class WorkbookRecalculator {
  private options: Options;
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: { entry: Entry; controller: AbortController } | null = null;
  private disposed = false;
  constructor(options: Options) { this.options = options; }

  sync() {
    if (this.disposed) return;
    const wanted = new Set<string>();
    for (const sheet of this.options.read().sheets) {
      if (sheet.kind !== "results") continue;
      const task = recalculationTask(this.options.read(), sheet);
      if (!task) continue;
      wanted.add(task.id);
      if (this.entries.get(task.id)?.task.key === task.key) continue;
      this.entries.set(task.id, {
        task,
        state: task.blocked
          ? { phase: "blocked", message: task.blocked }
          : { phase: "queued", message: "Waiting for edits to finish…" },
        readyAt: Date.now() + (this.options.debounceMs ?? 400),
      });
    }
    for (const id of this.entries.keys()) if (!wanted.has(id)) this.entries.delete(id);
    if (this.running && this.entries.get(this.running.entry.task.id) !== this.running.entry)
      this.running.controller.abort();
    this.emit();
    this.pump();
  }

  retry(id: string) {
    const entry = this.entries.get(id);
    if (!entry || entry.state.phase === "running" || entry.state.phase === "queued") return;
    this.entries.delete(id);
    this.sync();
  }

  // Call at document replacement even if IDs, values and revisions are identical.
  reset() {
    clearTimeout(this.timer);
    this.running?.controller.abort();
    this.running = null;
    this.entries.clear();
    this.emit();
  }

  dispose() {
    this.disposed = true;
    this.reset();
  }

  private emit() {
    if (!this.disposed)
      this.options.changed(Object.fromEntries([...this.entries].map(([id, entry]) => [id, entry.state])));
  }

  private pump() {
    clearTimeout(this.timer);
    if (this.disposed || this.running) return;
    const entry = [...this.entries.values()]
      .filter((e) => e.state.phase === "queued")
      .sort((a, b) => a.readyAt - b.readyAt)[0];
    if (!entry) return;
    const delay = entry.readyAt - Date.now();
    if (delay > 0) {
      this.timer = setTimeout(() => this.pump(), delay);
      return;
    }
    const running = { entry, controller: new AbortController() };
    this.running = running;
    entry.state = { phase: "running", message: "Recalculating linked analysis…" };
    this.emit();
    const eligible = () => !this.disposed && !running.controller.signal.aborted
      && this.running === running && this.entries.get(entry.task.id) === entry;
    // A synchronous adapter exception is handled just like a rejected request.
    Promise.resolve().then(() => {
      if (!eligible()) return undefined;
      return this.options.compute(entry.task, running.controller.signal);
    }).then((result) => {
      if (!eligible()) return;
      this.options.apply(entry.task, result);
      this.entries.delete(entry.task.id);
    }).catch((error: unknown) => {
      if (!eligible()) return;
      entry.state = {
        phase: "error",
        message: error instanceof Error ? error.message : "The calculation failed. Try Recalculate analysis again.",
      };
    }).finally(() => {
      if (this.running !== running) return;
      this.running = null;
      if (!this.disposed) { this.emit(); this.pump(); }
    });
  }
}
