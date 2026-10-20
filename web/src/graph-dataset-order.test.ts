import assert from "node:assert/strict";
import { test } from "node:test";
import { colorsForDatasetOrder, frontToBackDatasets, rememberDatasetColors, reorderGraphDatasets } from "./graph-dataset-order.ts";
import type { DatasetOrderAction } from "./graph-dataset-order.ts";
import { sample } from "./data.ts";
import { buildPlotGeometry, pointHitIndex } from "./plot-geometry.ts";

test("front-to-back presentation reverses storage without mutating it", () => {
  const stored = Object.freeze([1, 3, 7]);
  assert.deepEqual(frontToBackDatasets(stored), [7, 3, 1]);
  assert.deepEqual(stored, [1, 3, 7]);
  assert.deepEqual(frontToBackDatasets([]), []);
});

test("each action moves the selected source identity in displayed order", () => {
  const stored = Object.freeze([1, 2, 3, 4]);
  const expected: [DatasetOrderAction, number[]][] = [
    ["top", [1, 3, 4, 2]],
    ["up", [1, 3, 2, 4]],
    ["down", [2, 1, 3, 4]],
    ["bottom", [2, 1, 3, 4]],
    ["reverse", [4, 3, 2, 1]],
  ];
  for (const [action, order] of expected) {
    assert.deepEqual(reorderGraphDatasets(stored, 2, action), order, action);
    assert.deepEqual(stored, [1, 2, 3, 4]);
  }
  assert.deepEqual(reorderGraphDatasets(stored, 3, "bottom"), [3, 1, 2, 4]);
});

test("boundary actions and missing selections cannot insert or lose datasets", () => {
  for (const action of ["top", "up", "down", "bottom"] as const) {
    assert.deepEqual(reorderGraphDatasets([5], 5, action), [5]);
    assert.deepEqual(reorderGraphDatasets([1, 2], null, action), [1, 2]);
    assert.deepEqual(reorderGraphDatasets([1, 2], 9, action), [1, 2]);
    assert.deepEqual(reorderGraphDatasets([], null, action), []);
  }
  assert.deepEqual(reorderGraphDatasets([1, 2, 3], 3, "up"), [1, 2, 3]);
  assert.deepEqual(reorderGraphDatasets([1, 2, 3], 1, "down"), [1, 2, 3]);
  assert.deepEqual(reorderGraphDatasets([1, 2], null, "reverse"), [2, 1]);
});

test("repeated reordering preserves sparse source identities and reverses twice to the same order", () => {
  let order = [2, 8, 13, 21, 34];
  for (const selected of order.slice()) {
    for (const action of ["top", "down", "bottom", "up", "reverse"] as const) {
      const next = reorderGraphDatasets(order, selected, action);
      assert.deepEqual([...next].sort((a, b) => a - b), [2, 8, 13, 21, 34]);
      assert.equal(new Set(next).size, 5);
      order = next;
    }
  }
  assert.deepEqual(reorderGraphDatasets(reorderGraphDatasets(order, null, "reverse"), null, "reverse"), order);
});

test("the first displayed dataset is the renderer's frontmost overlapping observation", () => {
  const project = sample("xy");
  project.columns = [
    { name: "X", values: ["1"] },
    { name: "A", values: ["2"] },
    { name: "B", values: ["2"] },
    { name: "C", values: ["2"] },
  ];
  for (const selected of [1, 2, 3]) {
    const indices = reorderGraphDatasets([1, 2, 3], selected, "top");
    const geometry = buildPlotGeometry({
      ...project,
      columns: [project.columns[0], ...indices.map(index => project.columns[index])],
    }, null)!;
    const hit = pointHitIndex(geometry)(geometry.x(1), geometry.y(2))!;
    assert.equal(frontToBackDatasets(indices)[0], selected);
    assert.equal(geometry.series[hit.seriesIndex].name, project.columns[selected].name);
    assert.equal(hit.seriesIndex, indices.length - 1);
  }
});

test("dataset colors follow source identities through every reorder action", () => {
  const indices = [1, 2, 3], colors = ["#112233", "#445566", "#778899"];
  const remembered = rememberDatasetColors(new Map(), indices, colors);
  for (const action of ["top", "up", "down", "bottom", "reverse"] as const) {
    const order = reorderGraphDatasets(indices, 2, action);
    const result = colorsForDatasetOrder(remembered, order);
    assert.deepEqual(result.colors, order.map(source => colors[source - 1]), action);
    assert.deepEqual([...remembered], [[1, "#112233"], [2, "#445566"], [3, "#778899"]]);
    assert.notEqual(result.remembered, remembered);
  }
});

test("remove and re-add preserve colors within the dialog, including later Appearance edits", () => {
  let remembered = rememberDatasetColors(new Map(), [1, 2, 3], ["#112233", "#445566", "#778899"]);
  const removed = colorsForDatasetOrder(remembered, [1, 3]);
  assert.deepEqual(removed.colors, ["#112233", "#778899"]);
  remembered = rememberDatasetColors(removed.remembered, [1, 3], ["#abcdef", "#123456"]);
  const restored = colorsForDatasetOrder(remembered, [3, 2, 1]);
  assert.deepEqual(restored.colors, ["#123456", "#445566", "#abcdef"]);
  const empty = colorsForDatasetOrder(restored.remembered, []);
  assert.deepEqual(empty.colors, []);
  assert.deepEqual(colorsForDatasetOrder(empty.remembered, [2]).colors, ["#445566"]);
});

test("new datasets use deterministic source palette colors and remember them", () => {
  const empty = new Map<number, string>();
  const initial = colorsForDatasetOrder(empty, [8, 2]);
  const opposite = colorsForDatasetOrder(empty, [2, 8]);
  assert.deepEqual(initial.colors, [...opposite.colors].reverse());
  assert.equal(empty.size, 0);
  assert.deepEqual(colorsForDatasetOrder(initial.remembered, [2, 8]).colors, opposite.colors);
  const repeated = rememberDatasetColors(empty, [1, 2, 3], ["#abcdef"]);
  assert.deepEqual(colorsForDatasetOrder(repeated, [3, 1, 2]).colors, ["#abcdef", "#abcdef", "#abcdef"]);
});
