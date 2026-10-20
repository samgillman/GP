import assert from "node:assert/strict";
import { test } from "node:test";
import { palette, parseProject, sample } from "./data.ts";
import {
  defaultDatasetStyle,
  plottedDatasetStyles,
  resolveDatasetStyle,
  symbolPath,
  tint,
  validDatasetStyle,
  validDatasetStyles,
} from "./graph-style.ts";

test("tint mixes a color with white and leaves non-hex values alone", () => {
  assert.equal(tint("#1e8a80"), "#d2e8e6");
  assert.equal(tint("#000000", 0.5), "#808080");
  assert.equal(tint("#ffffff"), "#ffffff");
  assert.equal(tint("red"), "red");
});

test("defaults follow the data set color and the graph-wide plot choices", () => {
  const bar = defaultDatasetStyle({ type: "bar", error: "sd", show_points: true }, "#1e8a80");
  assert.equal(bar.fill, tint("#1e8a80"));
  assert.equal(bar.symbol_color, "#1e8a80");
  assert.equal(bar.error_color, "#1e8a80");
  assert.equal(bar.error_direction, "above");
  assert.equal(bar.symbols, true);
  assert.equal(bar.error_bars, true);
  const scatter = defaultDatasetStyle({ type: "scatter", error: "none", show_points: false }, "#000000");
  assert.equal(scatter.symbols, true, "a scatter graph always shows its symbols by default");
  assert.equal(scatter.error_bars, false);
  assert.equal(scatter.error_direction, "both");
});

test("explicit fields override defaults; unset fields keep following the color", () => {
  const graph = { type: "bar", error: "sem", show_points: true } as const;
  const style = resolveDatasetStyle(graph, "#5469a6", { symbol_shape: "triangle", error_cap: "I" });
  assert.equal(style.symbol_shape, "triangle");
  assert.equal(style.error_cap, "I");
  assert.equal(style.symbol_color, "#5469a6");
  assert.equal(resolveDatasetStyle(graph, "#123456", { fill: "#ffffff" }).fill, "#ffffff");
});

test("plotted styles are looked up by source ID, skipping the XY X column", () => {
  const project = sample("column");
  project.columns.forEach((column, i) => (column.id = `c${i}`));
  const id = project.columns[1].id!;
  project.graph.dataset_styles = { [id]: { symbol_size: 6 } };
  const styles = plottedDatasetStyles(project.graph, project.columns, false, palette);
  assert.equal(styles.length, project.columns.length);
  assert.equal(styles[1].symbol_size, 6);
  assert.equal(styles[0].symbol_size, 3);
  const xy = sample("xy");
  xy.columns.forEach((column, i) => (column.id = `x${i}`));
  xy.graph.dataset_styles = { [xy.columns[1].id!]: { symbol_shape: "square" } };
  assert.equal(plottedDatasetStyles(xy.graph, xy.columns, true, palette)[0].symbol_shape, "square");
});

test("validation accepts only known fields with allowed values", () => {
  assert.ok(validDatasetStyle({}));
  assert.ok(validDatasetStyle({ fill: "#aabbcc", border_width: 2, symbol_shape: "diamond", error_direction: "below" }));
  assert.ok(!validDatasetStyle({ fill: "url(#x)" }));
  assert.ok(!validDatasetStyle({ border_width: 2.2 }));
  assert.ok(!validDatasetStyle({ symbol_size: 0 }));
  assert.ok(!validDatasetStyle({ unknown: true }));
  assert.ok(!validDatasetStyle(JSON.parse('{"__proto__": {"fill": "#000000"}}')));
  assert.ok(!validDatasetStyle(null));
  assert.ok(validDatasetStyles({ a: { pattern: true } }));
  assert.ok(!validDatasetStyles({ "": {} }));
  assert.ok(!validDatasetStyles([{}]));
});

test("saved projects round-trip styles and reject invalid ones", () => {
  const project = sample("column");
  project.graph.dataset_styles = { c0: { error_cap: "I" } };
  project.graph.show_legend = true;
  const parsed = parseProject(JSON.stringify(project));
  assert.deepEqual(parsed.graph.dataset_styles, project.graph.dataset_styles);
  assert.equal(parsed.graph.show_legend, true);
  assert.throws(() => parseProject(JSON.stringify({ ...project, graph: { ...project.graph, show_legend: "yes" } })));
  assert.throws(() => parseProject(JSON.stringify({ ...project, graph: { ...project.graph, dataset_styles: { a: { error_cap: "X" } } } })));
});

test("every symbol shape draws a closed path", () => {
  for (const shape of ["circle", "square", "triangle", "diamond"] as const)
    assert.match(symbolPath(shape, 3.2), /^M.*Z$/);
});
