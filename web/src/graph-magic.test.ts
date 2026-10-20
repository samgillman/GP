import assert from "node:assert/strict";
import { test } from "node:test";
import { sample } from "./data.ts";
import { applyColorScheme, COLOR_SCHEMES } from "./graph-style.ts";
import { makeGraphConsistent } from "./graph-magic.ts";
import { fromProject, parseWorkbook } from "./workbook.ts";

const all = { appearance: true, colors: true, axes: true };

test("Magic copies appearance and styles by data-set position, not by ID", () => {
  const target = sample("column").graph, source = { ...sample("column").graph, type: "scatter" as const, error: "sd" as const };
  source.dataset_styles = { s0: { symbol_shape: "square" }, s1: { error_cap: "I" } };
  source.colors = ["#111111", "#222222"];
  const next = makeGraphConsistent(target, source, ["t0", "t1", "t2"], ["s0", "s1"], all, true);
  assert.equal(next.type, "scatter");
  assert.equal(next.error, "sd");
  assert.deepEqual(next.dataset_styles, { t0: { symbol_shape: "square" }, t1: { error_cap: "I" }, t2: { symbol_shape: "square" } });
  assert.deepEqual(next.colors, ["#111111", "#222222", "#111111"]);
  assert.equal(next.title, target.title, "titles are never copied");
});

test("Magic keeps target colors when colors are not chosen", () => {
  const target = sample("column").graph, source = sample("column").graph;
  target.dataset_styles = { t0: { fill: "#abcdef" } };
  source.dataset_styles = { s0: { fill: "#000000", symbol_size: 6 } };
  source.colors = ["#000000"];
  const next = makeGraphConsistent(target, source, ["t0"], ["s0"], { appearance: true, colors: false, axes: false }, true);
  assert.deepEqual(next.dataset_styles, { t0: { symbol_size: 6, fill: "#abcdef" } });
  assert.deepEqual(next.colors, target.colors);
});

test("Magic never copies a column graph type or axes onto an XY graph", () => {
  const target = sample("xy").graph, source = sample("column").graph;
  source.axes = { x: {}, y: {} } as never;
  const next = makeGraphConsistent(target, source, ["y1"], ["c0"], all, false);
  assert.equal(next.type, target.type);
  assert.equal(next.axes, target.axes);
});

test("color schemes recolor every data set and clear per-data-set color overrides", () => {
  const graph = sample("column").graph;
  graph.dataset_styles = { a: { fill: "#ffffff", symbol_size: 5, error_color: "#000000" } };
  const next = applyColorScheme(graph, 3, "Grays");
  assert.deepEqual(next.colors, COLOR_SCHEMES.Grays.slice(0, 3));
  assert.deepEqual(next.dataset_styles, { a: { symbol_size: 5 } });
  assert.equal(applyColorScheme(graph, 8, "Bright").colors.length, 8);
});

test("sheet highlights save and invalid highlights are rejected", () => {
  const book = fromProject(sample("column"));
  book.sheets[0].highlight = "green";
  const parsed = parseWorkbook(JSON.stringify(book));
  assert.equal(parsed.sheets[0].highlight, "green");
  const bad = structuredClone(book) as unknown as { sheets: { highlight: string }[] };
  bad.sheets[0].highlight = "chartreuse";
  assert.throws(() => parseWorkbook(JSON.stringify(bad)));
});
