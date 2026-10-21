import assert from "node:assert/strict";
import { test } from "node:test";
import { sample } from "./data.ts";
import { reorderRows, reversedOrder, xValueOrder } from "./data-sort.ts";
import { reverseGraphDatasets } from "./graph-dataset-order.ts";
import { fromProject } from "./workbook.ts";

test("sort by X moves whole rows with their IDs; blanks and text X stay last", () => {
  const project = sample("xy");
  project.columns = [
    { id: "x", name: "X", values: ["3", "", "1", "2", "1"] },
    { id: "y", name: "Y", values: ["30", "99", "10", "20"] },
  ];
  const order = xValueOrder(project, 5);
  assert.deepEqual(order, [2, 4, 3, 0, 1]);
  const sorted = reorderRows(project, ["r0", "r1", "r2", "r3", "r4"], order);
  assert.deepEqual(sorted.project.columns[0].values, ["1", "1", "2", "3", ""]);
  assert.deepEqual(sorted.project.columns[1].values, ["10", "", "20", "30", "99"]);
  assert.deepEqual(sorted.rowIds, ["r2", "r4", "r3", "r0", "r1"]);
  assert.throws(() => xValueOrder(sample("column"), 3), /XY data table/);
});

test("reverse row order and invalid orders", () => {
  assert.deepEqual(reversedOrder(4), [3, 2, 1, 0]);
  const project = sample("column");
  const rows = project.columns[0].values.map((_, i) => `r${i}`);
  const reversed = reorderRows(project, rows, reversedOrder(rows.length));
  assert.deepEqual(reversed.project.columns[0].values, [...project.columns[0].values].reverse());
  assert.throws(() => reorderRows(project, rows, [0, 0]), /every row once/);
});

test("reversing data sets keeps each data set's color", () => {
  const book = fromProject(sample("column"));
  const data = book.sheets.find((s) => s.kind === "data")!;
  const graph = book.sheets.find((s) => s.kind === "graph")!;
  if (data.kind !== "data" || graph.kind !== "graph") throw new Error("sample workbook");
  const before = graph.graph.colors.slice(0, graph.columnIndices.length);
  const reversed = reverseGraphDatasets(data.project, graph);
  assert.deepEqual(reversed.columnIndices, [...graph.columnIndices].reverse());
  assert.deepEqual(reversed.graph.colors, [...before].reverse());
});
