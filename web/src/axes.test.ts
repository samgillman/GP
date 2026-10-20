import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultGraphAxes, validGraphAxes, axesSettingsProblem } from "./axes.ts";
import { parseProject, sample } from "./data.ts";
import { fromProject, parseWorkbook, updateData } from "./workbook.ts";
import { duplicateSheet } from "./workbook-actions.ts";
import { toggleSheetFrozen } from "./workbook-freeze.ts";

test("legacy projects retain absent axes; configured axes survive workbook and duplicate", () => {
  const legacy = sample("xy");
  assert.equal(parseProject(JSON.stringify(legacy)).graph.axes, undefined);
  const axes = defaultGraphAxes();
  axes.x = { ...axes.x, scale: "log10", minimum: 0.1, maximum: 100, reverse: true };
  axes.y.showGrid = true;
  legacy.graph.axes = axes;
  const book = fromProject(legacy);
  const graph = book.sheets.find(s => s.kind === "graph")!;
  const copied = duplicateSheet(book, graph.id);
  assert.deepEqual(parseWorkbook(JSON.stringify(copied)), copied);
  const duplicate = copied.sheets.at(-1)!;
  assert.equal(duplicate.kind, "graph");
  if (duplicate.kind === "graph") {
    assert.deepEqual(duplicate.graph.axes, axes);
    assert.notEqual(duplicate.graph.axes, graph.kind === "graph" && graph.graph.axes);
  }
  assert.deepEqual(copied.sheets[0], book.sheets[0]);
});

test("axis validation rejects incomplete, hostile, unbounded and contradictory settings", () => {
  for (const patch of [
    { minimum: Infinity }, { maximum: 1e101 }, { minimum: 2, maximum: 1 },
    { majorInterval: 0 }, { scale: "log10", minimum: 0 },
    { scale: "log10", majorInterval: 1 }, { showGrid: "true" }, { extra: 1 },
  ]) {
    const axes = defaultGraphAxes();
    Object.assign(axes.y, patch);
    assert.equal(validGraphAxes(axes), false, JSON.stringify(patch));
    const project = sample("xy");
    project.graph.axes = axes;
    // Infinity becomes null in JSON, so validate its in-memory value above.
    if (patch.minimum !== Infinity)
      assert.throws(() => parseProject(JSON.stringify(project)));
  }
  const axes = defaultGraphAxes();
  axes.y = {} as typeof axes.y;
  assert.equal(validGraphAxes(axes), false);
});

test("categorical imports reject numeric X settings; XY conversion resets them", () => {
  const axes = defaultGraphAxes();
  axes.x = { ...axes.x, scale: "linear", minimum: 1, maximum: 10,
    majorInterval: 2, reverse: true, showGrid: true };
  axes.y.minimum = -20;
  assert.match(axesSettingsProblem(axes, false)!, /categorical/);
  const invalid = sample("column");
  invalid.graph.axes = axes;
  assert.throws(() => parseProject(JSON.stringify(invalid)));
  const project = sample("xy");
  project.graph.axes = axes;
  const book = fromProject(project);
  const source = book.sheets[0];
  assert.equal(source.kind, "data");
  if (source.kind !== "data") return;
  const changed = updateData(book, source.id, { ...source.project, table_type: "column" });
  const expectedX = { ...defaultGraphAxes().x, reverse: true, showGrid: true };
  for (const sheet of changed.sheets) {
    if (sheet.kind === "data") assert.deepEqual(sheet.project.graph.axes?.x, expectedX);
    if (sheet.kind === "graph") {
      assert.deepEqual(sheet.graph.axes?.x, expectedX);
      assert.deepEqual(sheet.graph.axes?.y, axes.y);
    }
  }
  assert.deepEqual(parseWorkbook(JSON.stringify(changed)), changed);
  assert.deepEqual(project.graph.axes, axes);
});

test("automatic dose-response logarithmic X rejects nonpositive manual limits", () => {
  const axes = defaultGraphAxes();
  axes.x.minimum = 0;
  assert.equal(axesSettingsProblem(axes, true, false), null);
  assert.match(axesSettingsProblem(axes, true, true)!, /positive/);
});

test("manual tick validation counts zero-anchored ticks, not just span", () => {
  const axes = defaultGraphAxes();
  Object.assign(axes.y, { minimum: 0.1, maximum: 200.9, majorInterval: 1 });
  assert.equal(axesSettingsProblem(axes, true), null);
  Object.assign(axes.y, { minimum: 0, maximum: 200 });
  assert.match(axesSettingsProblem(axes, true)!, /200 ticks/);
});

test("table conversion preserves frozen axes and their captured XY source", () => {
  const project = sample("xy");
  project.graph.axes = defaultGraphAxes();
  project.graph.axes.x.scale = "log10";
  project.graph.axes.x.minimum = 0.01;
  let book = fromProject(project);
  const graph = book.sheets.find(s => s.kind === "graph")!;
  book = toggleSheetFrozen(book, graph.id);
  const frozen = structuredClone(book.sheets.find(s => s.id === graph.id));
  const source = book.sheets[0];
  if (source.kind !== "data") throw new Error("Expected source");
  book = updateData(book, source.id, { ...source.project, table_type: "column" });
  assert.deepEqual(book.sheets.find(s => s.id === graph.id), frozen);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
});
