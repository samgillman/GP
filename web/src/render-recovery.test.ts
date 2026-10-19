import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { fromProject, WORKBOOK_STORAGE } from "./workbook.ts";
import { getRecoveryWorkbook, rememberWorkbook, recoveryFile } from "./render-recovery.ts";

test("storage fallback preserves even malformed saved bytes without writes or parsing", () => {
  assert.equal(getRecoveryWorkbook(), null);
  const original = '{"name":"<img onerror=alert(1)>","unfinished":';
  const storage = new Map([[WORKBOOK_STORAGE, original]]);
  const reads: string[] = [];
  const file = recoveryFile((key) => { reads.push(key); return storage.get(key) ?? null; });
  assert.equal(file?.text, original);
  assert.equal(file?.source, "storage");
  assert.deepEqual(reads, [WORKBOOK_STORAGE]);
  assert.deepEqual([...storage.entries()], [[WORKBOOK_STORAGE, original]]);
  assert.equal(getRecoveryWorkbook(), null);
});

test("fallback supports legacy files and absent or inaccessible storage", () => {
  const reads: string[] = [];
  assert.equal(recoveryFile((key) => { reads.push(key); return key === "gp.project.v1" ? "legacy" : null; })?.text, "legacy");
  assert.deepEqual(reads, [WORKBOOK_STORAGE, "gp.project.v1"]);
  assert.equal(recoveryFile(() => null), null);
  assert.throws(() => recoveryFile(() => { throw new Error("Storage is inaccessible"); }), /inaccessible/);
});

test("remembering stores an immutable reference without serialization, storage, or events", () => {
  const book = fromProject(sample("column"));
  let serializations = 0;
  Object.defineProperty(book, "toJSON", { value: () => { serializations++; return { version: book.version }; } });
  Object.freeze(book);
  rememberWorkbook(book);
  assert.equal(getRecoveryWorkbook(), book);
  assert.equal(serializations, 0);
  const file = recoveryFile(() => { throw new Error("Memory recovery must not read storage"); });
  assert.equal(file?.text, '{"version":2}');
  assert.equal(file?.source, "memory");
  assert.equal(serializations, 1);
});

test("download uses the latest unsaved edit rather than a stale workbook snapshot", () => {
  const original = fromProject(sample("column"));
  rememberWorkbook(original);
  const latest = { ...original, name: '<svg onload="alert(1)"> latest' };
  rememberWorkbook(latest);
  assert.equal(getRecoveryWorkbook(), latest);
  const file = recoveryFile(() => { throw new Error("Do not read older storage"); });
  assert.equal(file?.text, JSON.stringify(latest));
  assert.equal(JSON.parse(file!.text).name, latest.name);
  assert.equal(file?.filename, "GP-recovered-workbook.json");
  assert.notEqual(original.name, latest.name);
});
