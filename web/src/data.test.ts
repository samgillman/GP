import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDelimited,
  importCsv,
  exportCsv,
  numeric,
  parseProject,
  sample,
  importedProject,
  requestData,
  fmt,
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

test("semicolon CSV supports BOM, quoted separators, escaped quotes and CRLF", () => {
  const columns = importCsv('\uFEFF"Control; A";"Dose, \"\"B\"\""\r\n-1.2;\r\n.5;1e3\r\n');
  assert.deepEqual(columns, [
    { name: "Control; A", values: ["-1.2", ".5"] },
    { name: 'Dose, "B"', values: ["", "1e3"] },
  ]);
  assert.deepEqual(importCsv(exportCsv(columns)), columns);
});

test("delimiter detection ignores quoted multiline header content", () => {
  const columns = importCsv('"Dose,\r\nlevel; μM";Response\r\n1;2\r\n');
  assert.equal(columns[0].name, "Dose,\r\nlevel; μM");
  assert.equal(columns[1].values[0], "2");
  assert.deepEqual(importCsv(exportCsv(columns)), columns);
});

test("numeric data separators resolve other punctuation in unquoted headers", () => {
  assert.equal(importCsv("Dose, units;Response\n1;2")[0].name, "Dose, units");
  assert.equal(importCsv("Dose; units,Response\n1,2")[0].name, "Dose; units");
  assert.deepEqual(importCsv("Name; units\n1\n2", ","), [
    { name: "Name; units", values: ["1", "2"] },
  ]);
});

test("CSV preserves plaintext hostile headers and intentional whitespace", () => {
  const columns = [
    { name: '<img src=x onerror="alert(1)">', values: ["1", "2"] },
    { name: " __proto__;constructor ", values: ["3", "4"] },
    { name: '=HYPERLINK("https://example.invalid")', values: ["5", "6"] },
  ];
  assert.deepEqual(importCsv(exportCsv(columns)), columns);
});

test("CSV roundtrip preserves final missing rows including single-column tables", () => {
  for (const columns of [
    [{ name: "A", values: ["1", "", ""] }],
    [{ name: "A", values: ["1", ""] }, { name: "B", values: ["2", ""] }],
    [{ name: "A", values: [""] }],
  ]) assert.deepEqual(importCsv(exportCsv(columns)), columns);
  assert.deepEqual(parseDelimited('A\r\n1\r\n\r\n'), [["A"], ["1"], [""]]);
});

test("malformed semicolon CSV does not coerce or execute fields", () => {
  assert.throws(() => importCsv('A;B\n"1"suffix;2'), /Unexpected text/);
  assert.throws(() => importCsv('A;B\n1;"2'), /unclosed/);
  assert.throws(() => importCsv('A;B\n1;alert(1)'), /CSV row 2, column 2.*not a valid number/);
  assert.throws(() => importCsv('A;B\n1,5;2,5'), /not a valid number/);
});

test("numeric limits match the backend inclusive absolute 1e100 cap", () => {
  assert.equal(numeric("1e100"), 1e100);
  assert.equal(numeric("-1e100"), -1e100);
  for (const value of ["1.0000000001e100", "-1.0000000001e100", "1e308", "1e309"])
    assert.throws(() => numeric(value), /supported range: −1e100 to 1e100/);
  assert.throws(() => importCsv("A;B\n1;1e101"), /CSV row 2, column 2.*supported range/);
  const project = importedProject([{ name: "Dose", values: ["1e101"] }], "column", "Imported");
  assert.throws(() => requestData(project), /Dose, row 1.*supported range/);
  assert.throws(() => parseProject(JSON.stringify(project)), /supported range/);
});

test("fresh imported projects use requested types and neutral independent settings", () => {
  const columns = [{ name: "Time", values: ["1", "2"] }, { name: "Signal", values: ["3", "4"] }];
  const xy = importedProject(columns, "xy", "New XY");
  assert.equal(xy.analysis, "descriptive");
  assert.equal(xy.table_type, "xy");
  assert.equal(xy.regression_model, undefined);
  assert.equal(xy.graph.type, "line");
  assert.equal(xy.graph.error, "none");
  assert.equal(xy.graph.title, "New XY");
  assert.equal(xy.graph.x_label, "Time");
  assert.equal(xy.graph.y_label, "Value");
  assert.deepEqual(requestData(xy).columns[0], { name: "Time", values: [1, 2] });
  const column = importedProject(columns, "column", "New Column");
  assert.equal(column.graph.type, "bar");
  assert.equal(column.graph.error, "sem");
  assert.equal(column.graph.x_label, "Groups");
  assert.equal(column.graph.y_label, "Value");
  xy.columns[0].values[0] = "99";
  xy.columns[0].name = "Changed";
  xy.graph.colors[0] = "#000000";
  assert.equal(columns[0].values[0], "1");
  assert.equal(column.columns[0].name, "Time");
  assert.notEqual(column.graph.colors[0], "#000000");
  assert.deepEqual(parseProject(JSON.stringify(column)), column);
});

test("formatting uses scientific notation at large and small magnitudes", () => {
  assert.equal(fmt(1e100), "1.000e+100");
  assert.equal(fmt(-1e100), "-1.000e+100");
  assert.equal(fmt(1e6), "1.000e+6");
  assert.equal(fmt(999999), "999,999");
  assert.equal(fmt(0.00001), "1.000e-5");
  assert.equal(fmt(-0.00001), "-1.000e-5");
  assert.equal(fmt(0.001), "0.001");
  assert.equal(fmt(12.34567), "12.346");
  assert.equal(fmt(0), "0");
  for (const value of [null, undefined, NaN, Infinity, -Infinity])
    assert.equal(fmt(value), "—");
});

test("formatting distinguishes near-perfect R squared and other near-integer results", () => {
  assert.equal(fmt(1), "1");
  assert.equal(fmt(0.99997), "0.99997");
  assert.equal(fmt(0.9999999), "0.9999999");
  assert.equal(fmt(0.9999999999999999), "0.9999999999999999");
  assert.equal(fmt(1.000001), "1.000001");
  assert.equal(fmt(-0.99997), "-0.99997");
});

test("optional standalone dataset IDs roundtrip but never leak into numerical requests", () => {
  const project = sample("column");
  project.columns[0].id = "dataset-A";
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.equal("id" in requestData(project).columns[0], false);
  for (const invalid of [null, 42, {}, ""]) {
    const raw = JSON.parse(JSON.stringify(project));
    raw.columns[0].id = invalid;
    assert.throws(() => parseProject(JSON.stringify(raw)), /Invalid project table/);
  }
});
