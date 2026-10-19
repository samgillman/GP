import type { Workbook } from "./workbook.ts";

const prepared = Symbol("prepared workbook snapshot");
export type PreparedWorkbookSnapshot = Readonly<{
  [prepared]: true;
  json: string;
  utf8Bytes: number;
  historyBytes: number;
  sheetCount: number;
  activeSheetId: string;
}>;
export type WorkbookSnapshotInput = Workbook | PreparedWorkbookSnapshot;
type Field = { key: string; json: string };
type Details = {
  fields: Field[];
  sheetsJSON: string;
  sheets: Map<string, string>;
};
// Keys are opaque immutable handles, never mutable Workbook objects. Entries do
// not outlive their handles, and no process-wide strong snapshot cache exists.
const details = new WeakMap<PreparedWorkbookSnapshot, Details>();
const deeplyFrozen = new WeakSet<object>();

/** Opt in only at committed-state boundaries. Ordinary public workbook APIs stay
 * mutable. Objects previously completed by this helper can be skipped safely;
 * arbitrary shallow Object.freeze calls cannot certify an entire branch.
 * Workbook state is JSON data: accessors and non-plain mutable objects are
 * rejected rather than pretending Object.freeze protects their hidden state.
 */
export function deepFreezeWorkbookState<T extends Workbook>(workbook: T): T {
  const pending: object[] = [workbook],
    visited = new WeakSet<object>(),
    objects: object[] = [];
  while (pending.length) {
    const object = pending.pop()!;
    if (deeplyFrozen.has(object) || visited.has(object)) continue;
    visited.add(object);
    const prototype = Object.getPrototypeOf(object);
    if (
      !Array.isArray(object) &&
      prototype !== Object.prototype &&
      prototype !== null
    )
      throw new Error(
        "Committed workbook state must contain plain JSON objects and arrays.",
      );
    objects.push(object);
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
      if (!("value" in descriptor))
        throw new Error(
          "Committed workbook state must not contain accessor properties.",
        );
      const value: unknown = descriptor.value;
      if (
        value !== null &&
        (typeof value === "object" || typeof value === "function")
      )
        pending.push(value);
    }
  }
  for (let i = objects.length - 1; i >= 0; i--) Object.freeze(objects[i]);
  // Publish cache entries only after the entire traversal/freezing succeeds.
  for (const object of objects) deeplyFrozen.add(object);
  return workbook;
}

function stringEnd(json: string, start: number): number {
  let end = json.indexOf('"', start + 1);
  while (end >= 0) {
    let slashes = 0;
    for (let i = end - 1; json[i] === "\\"; i--) slashes++;
    if (slashes % 2 === 0) return end + 1;
    end = json.indexOf('"', end + 1);
  }
  throw new Error("Invalid serialized workbook string.");
}

// Only scan JSON just emitted by JSON.stringify. String contents (including
// escaped quotes, braces, and commas) are skipped intact. No reserialization,
// hash, or numeric comparison is used to establish equality.
function valueEnd(json: string, start: number): number {
  if (json[start] === '"') return stringEnd(json, start);
  if (json[start] === "{" || json[start] === "[") {
    let depth = 0;
    for (let i = start; i < json.length; i++) {
      const char = json[i];
      if (char === '"') i = stringEnd(json, i) - 1;
      else if (char === "{" || char === "[") depth++;
      else if ((char === "}" || char === "]") && --depth === 0) return i + 1;
    }
    throw new Error("Invalid serialized workbook structure.");
  }
  let end = start;
  while (
    end < json.length &&
    json[end] !== "," &&
    json[end] !== "}" &&
    json[end] !== "]"
  )
    end++;
  return end;
}

function fieldsOf(json: string): Field[] {
  if (json[0] !== "{")
    throw new Error("A workbook snapshot must be an object.");
  const fields: Field[] = [];
  let cursor = 1;
  while (json[cursor] !== "}") {
    const keyEnd = stringEnd(json, cursor);
    const key = JSON.parse(json.slice(cursor, keyEnd)) as string;
    const start = keyEnd + 1;
    const end = valueEnd(json, start);
    fields.push({ key, json: json.slice(start, end) });
    cursor = end + (json[end] === "," ? 1 : 0);
  }
  return fields;
}

function sheetId(json: string): string {
  let cursor = 1;
  while (json[cursor] !== "}") {
    const keyEnd = stringEnd(json, cursor),
      start = keyEnd + 1;
    const key = JSON.parse(json.slice(cursor, keyEnd)) as string;
    const end = valueEnd(json, start);
    if (key === "id") return JSON.parse(json.slice(start, end)) as string;
    cursor = end + (json[end] === "," ? 1 : 0);
  }
  throw new Error("A workbook sheet is missing its ID.");
}

/** Capture once at a commit boundary; later mutation of the input cannot affect it.
 * This is serialization, not schema validation. Keep parseWorkbook at import and
 * restore boundaries, and workbookLimitError at every accepted edit boundary.
 */
export function prepareWorkbookSnapshot(
  workbook: Workbook,
): PreparedWorkbookSnapshot {
  const json = JSON.stringify(workbook);
  const fields = fieldsOf(json);
  const sheetsJSON = fields.find((field) => field.key === "sheets")?.json;
  if (!sheetsJSON || sheetsJSON[0] !== "[")
    throw new Error("A workbook needs a sheets array.");
  const sheets = new Map<string, string>();
  let cursor = 1,
    sheetCount = 0;
  while (sheetsJSON[cursor] !== "]") {
    const end = valueEnd(sheetsJSON, cursor);
    const sheet = sheetsJSON.slice(cursor, end),
      id = sheetId(sheet);
    // Match existing first-sheet lookup semantics; schema validation separately
    // rejects duplicate IDs on import.
    if (!sheets.has(id)) sheets.set(id, sheet);
    sheetCount++;
    cursor = end + (sheetsJSON[end] === "," ? 1 : 0);
  }
  const activeJSON = fields.find(
    (field) => field.key === "activeSheetId",
  )?.json;
  const snapshot: PreparedWorkbookSnapshot = Object.freeze({
    [prepared]: true as const,
    json,
    utf8Bytes: new TextEncoder().encode(json).length,
    historyBytes: json.length * 2,
    sheetCount,
    activeSheetId: activeJSON === undefined ? "" : JSON.parse(activeJSON),
  });
  details.set(snapshot, { fields, sheetsJSON, sheets });
  return snapshot;
}

export function workbookSnapshot(
  input: WorkbookSnapshotInput,
): PreparedWorkbookSnapshot {
  return details.has(input as PreparedWorkbookSnapshot)
    ? (input as PreparedWorkbookSnapshot)
    : prepareWorkbookSnapshot(input as Workbook);
}

export function sameWorkbookContent(
  a: PreparedWorkbookSnapshot,
  b: PreparedWorkbookSnapshot,
): boolean {
  if (a === b) return true;
  const left = details.get(a)!.fields,
    right = details.get(b)!.fields;
  if (left.length !== right.length) return false;
  return left.every(
    (field, index) =>
      field.key === right[index].key &&
      (field.key === "activeSheetId" || field.json === right[index].json),
  );
}

export function sameWorkbookSheets(
  a: PreparedWorkbookSnapshot,
  b: PreparedWorkbookSnapshot,
): boolean {
  return a === b || details.get(a)!.sheetsJSON === details.get(b)!.sheetsJSON;
}

export function sameWorkbookSheet(
  a: PreparedWorkbookSnapshot,
  b: PreparedWorkbookSnapshot,
  id: string,
): boolean {
  return (
    a === b || details.get(a)!.sheets.get(id) === details.get(b)!.sheets.get(id)
  );
}
