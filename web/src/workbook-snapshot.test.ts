import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { fromProject } from "./workbook.ts";
import {
  commitHistory,
  emptyHistory,
  moveHistory,
} from "./workbook-history.ts";
import { persistWorkbook, workbookLimitError } from "./workbook-storage.ts";
import {
  deepFreezeWorkbookState,
  prepareWorkbookSnapshot,
  sameWorkbookContent,
  sameWorkbookSheet,
  sameWorkbookSheets,
  workbookSnapshot,
} from "./workbook-snapshot.ts";

test("prepared capture survives later nested mutation; raw API inputs still see fresh data", () => {
  const book = fromProject(sample("column"));
  const captured = prepareWorkbookSnapshot(book);
  const data = book.sheets[0];
  assert.equal(data.kind, "data");
  if (data.kind !== "data") throw Error("fixture");
  data.project.columns[0].values[0] = "123456";
  book.name = "Changed after capture";
  assert.equal(JSON.parse(captured.json).name, "Treatment response study");
  assert.equal(
    JSON.parse(captured.json).sheets[0].project.columns[0].values[0],
    "42",
  );
  assert.ok(Object.isFrozen(captured));
  assert.equal(workbookSnapshot(captured), captured);
  assert.equal(
    sameWorkbookContent(captured, prepareWorkbookSnapshot(book)),
    false,
  );
  let saved = "";
  persistWorkbook(
    (_, json) => {
      saved = json;
    },
    book,
    null,
  );
  assert.equal(
    JSON.parse(saved).sheets[0].project.columns[0].values[0],
    "123456",
  );
  persistWorkbook(
    (_, json) => {
      saved = json;
    },
    captured,
    null,
  );
  assert.equal(saved, captured.json);
});

test("escaping, Unicode and nested activeSheetId text cannot confuse exact equality", () => {
  const book = fromProject(sample("column"));
  book.name = 'é💊 \\"activeSheetId":"ignored",{"sheets":["\\\\\\\"}';
  const data = book.sheets[0];
  if (data.kind !== "data") throw Error("fixture");
  data.project.columns[0].values = [
    '"',
    "\\",
    '\\"',
    "}],[",
    "é💊",
    "",
    "line\nfeed",
  ];
  const initial = prepareWorkbookSnapshot(book);
  const navigated = prepareWorkbookSnapshot({
    ...book,
    activeSheetId: book.sheets[1].id,
  });
  assert.equal(initial.json, JSON.stringify(book));
  assert.equal(
    initial.utf8Bytes,
    new TextEncoder().encode(initial.json).length,
  );
  assert.equal(initial.historyBytes, initial.json.length * 2);
  assert.equal(sameWorkbookContent(initial, navigated), true);
  assert.equal(sameWorkbookSheets(initial, navigated), true);
  const edited = structuredClone(book);
  if (edited.sheets[0].kind !== "data") throw Error("fixture");
  edited.sheets[0].project.columns[0].values[3] += ":activeSheetId";
  const changed = prepareWorkbookSnapshot(edited);
  assert.equal(sameWorkbookContent(initial, changed), false);
  assert.equal(sameWorkbookSheets(initial, changed), false);
  assert.equal(sameWorkbookSheet(initial, changed, book.sheets[0].id), false);
  assert.equal(sameWorkbookSheet(initial, changed, book.sheets[1].id), true);
});

test("limits, equality, history and persistence reuse each capture without stringifying again", () => {
  const a = fromProject(sample("column")),
    b = { ...a, name: "B" };
  const original = JSON.stringify;
  let serializations = 0;
  JSON.stringify = ((...args: Parameters<typeof JSON.stringify>) => {
    serializations++;
    return original(...args);
  }) as typeof JSON.stringify;
  try {
    const before = prepareWorkbookSnapshot(a),
      after = prepareWorkbookSnapshot(b);
    assert.equal(serializations, 2);
    assert.equal(workbookLimitError(after), null);
    assert.equal(sameWorkbookSheets(before, after), true);
    assert.equal(sameWorkbookContent(before, after), false);
    const history = commitHistory(emptyHistory(), before, after);
    persistWorkbook(() => {}, after, null);
    assert.equal(moveHistory(history, after, "undo")!.workbook.name, a.name);
    assert.equal(serializations, 2);
  } finally {
    JSON.stringify = original;
  }
});

test("sheet reordering and metadata changes are edits; navigation alone is not", () => {
  const book = fromProject(sample("column")),
    before = prepareWorkbookSnapshot(book);
  const reordered = prepareWorkbookSnapshot({
    ...book,
    sheets: [...book.sheets].reverse(),
  });
  assert.equal(sameWorkbookContent(before, reordered), false);
  assert.equal(sameWorkbookSheets(before, reordered), false);
  assert.equal(sameWorkbookSheet(before, reordered, book.sheets[0].id), true);
  const renamed = prepareWorkbookSnapshot({ ...book, name: book.name + "!" });
  assert.equal(sameWorkbookSheets(before, renamed), true);
  assert.equal(sameWorkbookContent(before, renamed), false);
});

test("opt-in committed state rejects nested edits, including initially shallow-frozen branches", () => {
  const book = fromProject(sample("column"));
  const data = book.sheets[0];
  if (data.kind !== "data") throw Error("fixture");
  Object.freeze(data.project);
  assert.equal(Object.isFrozen(data.project.columns[0].values), false);
  assert.equal(deepFreezeWorkbookState(book), book);
  assert.throws(() => {
    data.project.columns[0].values[0] = "changed";
  }, TypeError);
  assert.throws(() => {
    book.sheets.push(book.sheets[0]);
  }, TypeError);
  assert.throws(() => {
    book.activeSheetId = "changed";
  }, TypeError);
  const next = { ...book, name: "Next" };
  assert.equal(deepFreezeWorkbookState(next).name, "Next");
  assert.equal(Object.isFrozen(next), true);
});

test("deep freeze handles shared branches/cycles without recursive stack overflow", () => {
  const book = fromProject(sample("column")) as ReturnType<
    typeof fromProject
  > & { extra?: object };
  const first: { next?: object } = {};
  let node = first;
  for (let i = 0; i < 20000; i++) {
    const next = {};
    node.next = next;
    node = next;
  }
  node.next = first;
  book.extra = { first, shared: first, book };
  deepFreezeWorkbookState(book);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(node));
  assert.throws(() => {
    node.next = {};
  }, TypeError);
});

test("incremental freezing skips only branches fully processed by this helper", () => {
  const book = fromProject(sample("column"));
  const data = book.sheets[0];
  if (data.kind !== "data") throw Error("fixture");
  let inspections = 0;
  data.project.columns[0] = new Proxy(data.project.columns[0], {
    ownKeys(target) {
      inspections++;
      return Reflect.ownKeys(target);
    },
  });
  deepFreezeWorkbookState(book);
  assert.ok(inspections > 0);
  const initial = inspections;
  deepFreezeWorkbookState({ ...book, name: "Renamed" });
  assert.equal(
    inspections,
    initial,
    "certified frozen branches must not be inspected again",
  );
  const external = Object.freeze({ nested: { editable: true } });
  deepFreezeWorkbookState({ ...book, external });
  assert.equal(
    Object.isFrozen(external.nested),
    true,
    "externally shallow-frozen objects need traversal",
  );
});

test("failed freeze cannot certify mutable internal state or poison a later attempt", () => {
  const book = fromProject(sample("column")) as ReturnType<
    typeof fromProject
  > & { extra?: unknown };
  book.extra = new Map([["mutable", true]]);
  assert.throws(() => deepFreezeWorkbookState(book), /plain JSON/);
  const accessor = Object.defineProperty({}, "value", {
    configurable: true,
    get: () => ({ mutable: true }),
  });
  book.extra = accessor;
  assert.throws(() => deepFreezeWorkbookState(book), /accessor/);
  Object.defineProperty(accessor, "value", { value: { mutable: true } });
  deepFreezeWorkbookState(book);
  assert.equal(Object.isFrozen((accessor as { value: object }).value), true);
});
