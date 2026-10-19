import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDelimited,
  importCsv,
  exportCsv,
  numeric,
  parseProject,
  sample,
} from "./data.ts";
test("CSV supports BOM, quoted commas, escaped quotes, CRLF and missing values", () => {
  const c = importCsv(
    '\uFEFF"Control, A","A ""quoted"" label"\r\n-1.2,\r\n.5,1e3\r\n',
  );
  assert.equal(c[0].name, "Control, A");
  assert.equal(c[1].name, 'A "quoted" label');
  assert.deepEqual(c[1].values, ["", "1e3"]);
  assert.deepEqual(importCsv(exportCsv(c)), c);
});
test("malformed CSV and invalid numeric inputs fail instead of coercing", () => {
  assert.throws(() => parseDelimited('"unclosed'));
  assert.throws(() => importCsv("A\n1,2"));
  assert.throws(() => importCsv("A\nhello"));
  assert.throws(() => numeric("Infinity"));
  assert.throws(() => numeric("0x12"));
  assert.equal(numeric(""), null);
  assert.equal(numeric("-0.25"), -0.25);
});
test("TSV clipboard cells preserve rectangular missing data", () =>
  assert.deepEqual(parseDelimited("1\t\t3\r\n4\t5\t6\r\n", "\t"), [
    ["1", "", "3"],
    ["4", "5", "6"],
  ]));
test("project roundtrip and schema validation", () => {
  assert.deepEqual(parseProject(JSON.stringify(sample("xy"))), sample("xy"));
  assert.throws(() => parseProject('{"version":2}'));
  const p = sample("column");
  p.columns[0].values[0] = "nope";
  assert.throws(() => parseProject(JSON.stringify(p)));
});
