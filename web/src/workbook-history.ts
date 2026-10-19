import type { Workbook } from "./workbook.ts";
export const HISTORY_LIMITS = { count: 40, bytes: 32 * 1024 * 1024 };
export type HistoryOptions = {
  label?: string;
  coalesceKey?: string;
  now?: number;
  reset?: boolean;
};
type Entry = { snapshot: string; label: string; bytes: number };
export type WorkbookHistory = {
  past: Entry[];
  future: Entry[];
  group: { key: string; at: number } | null;
  limited: boolean;
};
export function emptyHistory(): WorkbookHistory {
  return { past: [], future: [], group: null, limited: false };
}
function entry(workbook: Workbook, label: string): Entry {
  const snapshot = JSON.stringify(workbook);
  return { snapshot, label, bytes: snapshot.length * 2 };
}
function content(book: Workbook) {
  return JSON.stringify({ ...book, activeSheetId: "" });
}
function bounded(
  history: WorkbookHistory,
  limits = HISTORY_LIMITS,
): WorkbookHistory {
  const past = [...history.past],
    future = [...history.future];
  let bytes = [...past, ...future].reduce((n, e) => n + e.bytes, 0),
    limited = history.limited;
  while (past.length + future.length > limits.count || bytes > limits.bytes) {
    const removed = past.length ? past.shift() : future.shift();
    if (!removed) break;
    bytes -= removed.bytes;
    limited = true;
  }
  return { ...history, past, future, limited };
}
export function breakHistoryGroup(history: WorkbookHistory): WorkbookHistory {
  return { ...history, group: null };
}
export function commitHistory(
  history: WorkbookHistory,
  before: Workbook,
  after: Workbook,
  options: HistoryOptions = {},
  limits = HISTORY_LIMITS,
): WorkbookHistory {
  if (options.reset) return emptyHistory();
  if (content(before) === content(after))
    return before.activeSheetId !== after.activeSheetId
      ? breakHistoryGroup(history)
      : history;
  const now = options.now ?? Date.now(),
    key = options.coalesceKey;
  const merge =
    key &&
    history.group?.key === key &&
    now - history.group.at <= 1500 &&
    now >= history.group.at &&
    history.past.length > 0;
  const next = {
    past: merge
      ? history.past
      : [...history.past, entry(before, options.label ?? "Edit workbook")],
    future: [],
    group: key ? { key, at: now } : null,
    limited: history.limited,
  };
  return bounded(next, limits);
}
export function moveHistory(
  history: WorkbookHistory,
  current: Workbook,
  direction: "undo" | "redo",
  limits = HISTORY_LIMITS,
): { history: WorkbookHistory; workbook: Workbook; label: string } | null {
  const stack = direction === "undo" ? history.past : history.future,
    last = stack.at(-1);
  if (!last) return null;
  const saved = JSON.parse(last.snapshot) as Workbook;
  // Sheet selection is not an edit: retain the user's current view when that sheet exists.
  const workbook = {
    ...saved,
    activeSheetId: saved.sheets.some((s) => s.id === current.activeSheetId)
      ? current.activeSheetId
      : saved.activeSheetId,
  };
  const replacement = entry(current, last.label);
  const next =
    direction === "undo"
      ? {
          ...history,
          past: history.past.slice(0, -1),
          future: [...history.future, replacement],
          group: null,
        }
      : {
          ...history,
          past: [...history.past, replacement],
          future: history.future.slice(0, -1),
          group: null,
        };
  return { workbook, history: bounded(next, limits), label: last.label };
}
export function shouldHandleHistoryShortcut(
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    defaultPrevented: boolean;
  },
  editing: boolean,
  dialogOpen: boolean,
): "undo" | "redo" | null {
  if (
    editing ||
    dialogOpen ||
    event.defaultPrevented ||
    event.altKey ||
    !(event.ctrlKey || event.metaKey)
  )
    return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey)
    return "redo";
  return null;
}
