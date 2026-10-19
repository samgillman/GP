import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { addGraph, fromProject, WORKBOOK_STORAGE } from "./workbook.ts";
import {
  restoreWorkbook,
  persistWorkbook,
  workbookLimitError,
  MAX_WORKBOOK_BYTES,
} from "./workbook-storage.ts";
import { prepareWorkbookSnapshot } from "./workbook-snapshot.ts";
test("malformed saved workbook remains byte-for-byte intact while autosave is paused", () => {
  const original = '{"version":2,"unfinished":';
  const storage = new Map([[WORKBOOK_STORAGE, original]]);
  const restored = restoreWorkbook((key) => storage.get(key) ?? null);
  assert.equal(restored.recovery?.original, original);
  let writes = 0;
  const saved = persistWorkbook(
    (key, value) => {
      writes++;
      storage.set(key, value);
    },
    restored.workbook,
    restored.recovery,
  );
  assert.equal(saved, false);
  assert.equal(writes, 0);
  assert.equal(storage.get(WORKBOOK_STORAGE), original);
});
test("browser storage read failures are surfaced and prevent attempted writes", () => {
  const restored = restoreWorkbook(() => {
    throw new Error("Access denied");
  });
  assert.match(restored.recovery?.message ?? "", /could not be read/);
  assert.equal(restored.recovery?.original, null);
  let written = false;
  persistWorkbook(
    () => {
      written = true;
    },
    restored.workbook,
    restored.recovery,
  );
  assert.equal(written, false);
});
test("explicit recovery resolution permits autosave; valid legacy files migrate", () => {
  const legacy = JSON.stringify(sample("xy"));
  const restored = restoreWorkbook((key) =>
    key === WORKBOOK_STORAGE ? null : legacy,
  );
  assert.equal(restored.recovery, null);
  assert.equal(restored.workbook.sheets.length, 2);
  let output = "";
  assert.equal(
    persistWorkbook((_, value) => (output = value), restored.workbook, null),
    true,
  );
  assert.equal(JSON.parse(output).version, 4);
});
test("sheet limit permits 500 sheets but rejects creation of sheet 501 without throwing", () => {
  let book = fromProject(sample("column"));
  const dataId = book.sheets[0].id;
  while (book.sheets.length < 500) book = addGraph(book, dataId);
  assert.equal(workbookLimitError(book), null);
  assert.match(
    workbookLimitError(addGraph(book, dataId)) ?? "",
    /500-sheet limit/,
  );
});
test("size guard prevents producing a workbook larger than the importer limit", () => {
  const book = fromProject(sample("column"));
  book.name = "x".repeat(20_000_001);
  assert.match(workbookLimitError(book) ?? "", /20 MB workbook limit/);
});

test("prepared UTF-8 size limit accepts exact boundary and rejects added multibyte content", () => {
  const book = fromProject(sample("column")); book.name = "";
  const available = MAX_WORKBOOK_BYTES - prepareWorkbookSnapshot(book).utf8Bytes;
  book.name = "é".repeat(Math.floor(available / 2)) + "x".repeat(available % 2);
  const atLimit = prepareWorkbookSnapshot(book);
  assert.equal(atLimit.utf8Bytes, MAX_WORKBOOK_BYTES);
  assert.equal(workbookLimitError(atLimit), null);
  book.name += "💊";
  const overLimit = prepareWorkbookSnapshot(book);
  assert.equal(overLimit.utf8Bytes, MAX_WORKBOOK_BYTES + 4);
  assert.match(workbookLimitError(overLimit) ?? "", /20 MB workbook limit/);
  assert.equal(workbookLimitError(atLimit), null, "mutation cannot change the captured limit result");
});

test("prepared autosave honors recovery pauses and propagates write failures", () => {
  const snapshot = prepareWorkbookSnapshot(fromProject(sample("column")));
  let calls = 0;
  assert.equal(persistWorkbook(() => { calls++; }, snapshot, { message: "Paused", original: "original" }), false);
  assert.equal(calls, 0);
  assert.throws(() => persistWorkbook(() => { throw Error("Quota exceeded"); }, snapshot, null), /Quota exceeded/);
});
