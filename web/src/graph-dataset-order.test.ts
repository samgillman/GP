import assert from "node:assert/strict";
import { test } from "node:test";
import { colorsForDatasetIds, frontToBackDatasets, seedDatasetColors, reorderGraphDatasets, reorderColumnGraphDatasets } from "./graph-dataset-order.ts";
import type { DatasetOrderAction } from "./graph-dataset-order.ts";
import { palette, sample } from "./data.ts";
import type { Project, TableType } from "./data.ts";
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

function colorProject(type: TableType = "xy"): Project {
  const project = sample(type);
  const datasets = ["a", "b", "c"].map((id, i) => ({id: `id-${id}`, name: id.toUpperCase(), values: [String(i + 1)]}));
  project.columns = type === "xy" ? [{id: "id-x", name: "X", values: ["1"]}, ...datasets] : datasets;
  return project;
}

test("dataset colors follow stable identities through every reorder action", () => {
  const project = colorProject(), indices = [1, 2, 3], colors = ["#112233", "#445566", "#778899"];
  const remembered = Object.freeze(seedDatasetColors(project, indices, colors));
  for (const action of ["top", "up", "down", "bottom", "reverse"] as const) {
    const order = reorderGraphDatasets(indices, 2, action);
    const result = colorsForDatasetIds(project, order, remembered);
    assert.deepEqual(result.colors, order.map(source => colors[source - 1]), action);
    assert.deepEqual(remembered, {"id-a": "#112233", "id-b": "#445566", "id-c": "#778899"});
    assert.notEqual(result.datasetColors, remembered);
  }
});

test("serialized remove, close, reopen and re-add retain colors and later Appearance edits", () => {
  const project = colorProject();
  const original = seedDatasetColors(project, [1, 2, 3], ["#112233", "#445566", "#778899"]);
  const removed = colorsForDatasetIds(project, [1, 3], original);
  assert.deepEqual(removed.colors, ["#112233", "#778899"]);
  // This data survives without the old component instance or any Map cache.
  const persisted = JSON.parse(JSON.stringify({columnIndices: [1, 3], ...removed}));
  const reopened = seedDatasetColors(project, persisted.columnIndices, persisted.colors, persisted.datasetColors);
  const edited = seedDatasetColors(project, [1, 3], ["#abcdef", "#123456"], reopened);
  const restored = colorsForDatasetIds(project, [3, 2, 1], edited);
  assert.deepEqual(restored.colors, ["#123456", "#445566", "#abcdef"]);
  const empty = colorsForDatasetIds(project, [], restored.datasetColors);
  assert.deepEqual(empty.colors, []);
  assert.deepEqual(colorsForDatasetIds(project, [2], empty.datasetColors).colors, ["#445566"]);
});

test("legacy seeding captures rendered cyclic positional colors, not source palette positions", () => {
  const project = colorProject();
  const colors = ["#123456", "#abcdef"];
  const seeded = seedDatasetColors(project, [3, 1, 2], colors);
  assert.deepEqual(seeded, {"id-c": "#123456", "id-a": "#abcdef", "id-b": "#123456"});
  assert.deepEqual(colorsForDatasetIds(project, [1, 2, 3], seeded).colors, ["#abcdef", "#123456", "#123456"]);
  assert.deepEqual(colors, ["#123456", "#abcdef"]);
  assert.deepEqual(seedDatasetColors(project, [3, 2], []), {"id-c": palette[0], "id-b": palette[1]});
});

test("active positional colors win conflicts without discarding unplotted dataset colors", () => {
  const project = colorProject();
  const previous = Object.freeze({"id-a": "#111111", "id-b": "#222222", "id-c": "#333333"});
  const next = seedDatasetColors(project, [1, 3], ["#aaaaaa", "#cccccc"], previous);
  assert.deepEqual(next, {"id-a": "#aaaaaa", "id-b": "#222222", "id-c": "#cccccc"});
  assert.deepEqual(previous, {"id-a": "#111111", "id-b": "#222222", "id-c": "#333333"});
});

test("source-column moves and renames preserve colors by ID", () => {
  const project = colorProject();
  const colors = seedDatasetColors(project, [1, 2, 3], ["#112233", "#445566", "#778899"]);
  const moved = {...project, columns: [project.columns[0], {...project.columns[3], name: "Renamed C"}, {...project.columns[1], name: "Renamed A"}, project.columns[2]]};
  assert.deepEqual(colorsForDatasetIds(moved, [1, 2, 3], colors).colors, ["#778899", "#112233", "#445566"]);
  assert.equal(project.columns[1].name, "A");
});

test("a replacement ID cannot inherit an old dataset's custom color just by reusing its column or name", () => {
  const project = colorProject();
  const previous = seedDatasetColors(project, [1], ["#abcdef"]);
  const replacement = {...project, columns: project.columns.map((column, i) => i === 1 ? {...column, id: "new-a"} : column)};
  const result = colorsForDatasetIds(replacement, [1], previous);
  assert.deepEqual(result.colors, [palette[0]]);
  assert.equal(result.datasetColors["new-a"], palette[0]);
  // Source deletion/pruning belongs to the workbook lifecycle, not projection.
  assert.equal(result.datasetColors["id-a"], "#abcdef");
});

test("Column membership and reordering use the same identity ownership with zero-based palette defaults", () => {
  const project = colorProject("column");
  const saved = seedDatasetColors(project, [0, 2], ["#112233", "#778899"]);
  const added = colorsForDatasetIds(project, [2, 1, 0], saved);
  assert.deepEqual(added.colors, ["#778899", palette[1], "#112233"]);
  const removed = colorsForDatasetIds(project, [1], added.datasetColors);
  const reopened = JSON.parse(JSON.stringify(removed));
  assert.deepEqual(colorsForDatasetIds(project, [0, 1, 2], reopened.datasetColors).colors, ["#112233", palette[1], "#778899"]);
  assert.deepEqual(colorsForDatasetIds(project, [0], {}).colors, [palette[0]]);
});

test("new dataset defaults are deterministic across addition orders and become persistent assignments", () => {
  const project = colorProject(), empty = Object.freeze({});
  const first = colorsForDatasetIds(project, [3, 1], empty);
  const opposite = colorsForDatasetIds(project, [1, 3], empty);
  assert.deepEqual(first.colors, [...opposite.colors].reverse());
  assert.deepEqual(empty, {});
  const moved = {...project, columns: [project.columns[0], project.columns[3], project.columns[2], project.columns[1]]};
  assert.deepEqual(colorsForDatasetIds(moved, [1, 3], first.datasetColors).colors, first.colors);
});

test("prototype-like IDs and duplicate names are handled as literal stable identities", () => {
  const project = colorProject("column");
  project.columns = ["__proto__", "constructor", "toString"].map(id => ({id, name: "Same name", values: ["1"]}));
  const seeded = seedDatasetColors(project, [0, 1], ["#112233", "#445566"]);
  assert.equal(Object.getPrototypeOf(seeded), Object.prototype);
  assert.equal(Object.hasOwn(seeded, "__proto__"), true);
  assert.equal(seeded["__proto__"], "#112233");
  const restored = JSON.parse(JSON.stringify(seeded));
  assert.deepEqual(colorsForDatasetIds(project, [2, 1, 0], restored).colors, [palette[2], "#445566", "#112233"]);
});

test("invalid selections cannot create positional keys or invented stable IDs", () => {
  const project = colorProject();
  for (const indices of [[0], [-1], [4], [1.5], [1, 1]]) {
    assert.throws(() => seedDatasetColors(project, indices, ["#112233"]), /selection|dataset IDs/);
    assert.throws(() => colorsForDatasetIds(project, indices, {}), /selection|dataset IDs/);
  }
  for (const id of [undefined, "", "x".repeat(201)]) {
    const invalid = {...project, columns: project.columns.map((column, i) => i === 1 ? {...column, id} : column)};
    assert.throws(() => seedDatasetColors(invalid, [1], ["#112233"]), /dataset IDs/);
  }
  const duplicate = {...project, columns: project.columns.map((column, i) => i === 2 ? {...column, id: "id-a"} : column)};
  assert.throws(() => colorsForDatasetIds(duplicate, [1, 2], {}), /dataset IDs/);
});

test("Column data-set controls follow left-to-right, not XY stacking", () => {
  const saved = Object.freeze([0, 1, 2, 3]);
  const cases: [DatasetOrderAction, number[]][] = [
    ["top", [1, 0, 2, 3]],
    ["up", [1, 0, 2, 3]],
    ["down", [0, 2, 1, 3]],
    ["bottom", [0, 2, 3, 1]],
    ["reverse", [3, 2, 1, 0]],
  ];
  for (const [action, expected] of cases) {
    assert.deepEqual(reorderColumnGraphDatasets(saved, 1, action), expected, action);
    assert.deepEqual(saved, [0, 1, 2, 3]);
  }
  assert.deepEqual(reorderColumnGraphDatasets(saved, null, "up"), saved);
  assert.deepEqual(reorderColumnGraphDatasets(saved, 99, "bottom"), saved);
  assert.deepEqual(reorderColumnGraphDatasets([0], 0, "top"), [0]);
  assert.deepEqual(reorderColumnGraphDatasets(reorderColumnGraphDatasets(saved, null, "reverse"), null, "reverse"), saved);
});

test("Column color ownership follows source IDs when columns move", () => {
  const project = colorProject("column"), indices = [0, 1, 2];
  const remembered = seedDatasetColors(project, indices, ["#123456", "#abcdef", "#fedcba"]);
  const reordered = reorderColumnGraphDatasets(indices, 0, "bottom");
  assert.deepEqual(reordered, [1, 2, 0]);
  assert.deepEqual(colorsForDatasetIds(project, reordered, remembered).colors,
    ["#abcdef", "#fedcba", "#123456"]);
  assert.deepEqual(indices, [0, 1, 2]);
});
