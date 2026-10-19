import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelimited } from "./data.ts";
import {
  GridSessionCache,
  GRID_ROWS,
  GRID_COLUMNS,
  ROW_HEIGHT,
  MAX_MOUNTED_ROWS,
  rowWindow,
  columnWindow,
  columnOffsets,
  virtualRuns,
  rangeBetween,
  contains,
  nextCell,
  selectionTSV,
  groupLabel,
} from "./data-grid.ts";

test("10,000-row viewport mounts bounded rows at top, middle and bottom while retaining offscreen focus", () => {
  for (const scroll of [0, 120000, GRID_ROWS * ROW_HEIGHT - 600]) {
    const indices = rowWindow(scroll, 600, 42);
    assert.ok(indices.length <= MAX_MOUNTED_ROWS);
    assert.ok(indices.includes(42));
    assert.ok(indices.every((i) => i >= 0 && i < GRID_ROWS));
    const visible = Math.min(GRID_ROWS - 1, Math.floor(scroll / ROW_HEIGHT));
    assert.ok(indices.includes(visible));
  }
  assert.ok(rowWindow(GRID_ROWS * ROW_HEIGHT - 600, 600).includes(9999));
  assert.ok(rowWindow(0, 4000, 9999).length <= MAX_MOUNTED_ROWS);
});
test("horizontal virtualization follows resized widths and preserves focused column", () => {
  const widths = Array(GRID_COLUMNS).fill(112);
  widths[0] = 300;
  assert.deepEqual(columnOffsets(widths).slice(0, 3), [0, 300, 412]);
  const first = columnWindow(0, 600, widths);
  assert.ok(first.length < GRID_COLUMNS);
  const right = columnWindow(2500, 600, widths, 0);
  assert.ok(right.includes(0));
  assert.ok(right.includes(22));
  assert.ok(right.length < GRID_COLUMNS);
  assert.ok(columnWindow(3100, 600, widths).includes(29));
});
test("spacers preserve total geometry when focused row is distant from viewport", () => {
  const offsets = Array.from(
    { length: GRID_ROWS + 1 },
    (_, i) => i * ROW_HEIGHT,
  );
  const indices = rowWindow(180000, 600, 2);
  const runs = virtualRuns(indices, offsets, GRID_ROWS * ROW_HEIGHT);
  const fullHeight = runs.reduce(
    (total, run) => total + (run.kind === "gap" ? run.size : ROW_HEIGHT),
    0,
  );
  assert.equal(fullHeight, GRID_ROWS * ROW_HEIGHT);
  assert.equal(runs.filter((r) => r.kind === "item").length, indices.length);
  assert.equal(new Set(runs.map((r) => r.key)).size, runs.length);
});
test("rectangular selection normalizes reverse drags and includes virtual empty cells", () => {
  const selection = rangeBetween(
    { row: 9999, column: 29 },
    { row: 4, column: 2 },
  );
  assert.deepEqual(selection, {
    startRow: 4,
    endRow: 9999,
    startColumn: 2,
    endColumn: 29,
  });
  assert.equal(contains(selection, { row: 9999, column: 29 }), true);
  assert.equal(contains(selection, { row: 3, column: 2 }), false);
});
test("Enter, arrows and Tab navigate across viewport edges and clamp advertised limits", () => {
  assert.deepEqual(nextCell({ row: 50, column: 2 }, "Enter"), {
    row: 51,
    column: 2,
  });
  assert.deepEqual(nextCell({ row: 50, column: 2 }, "Enter", true), {
    row: 49,
    column: 2,
  });
  assert.deepEqual(nextCell({ row: 50, column: 29 }, "Tab"), {
    row: 51,
    column: 0,
  });
  assert.deepEqual(nextCell({ row: 50, column: 0 }, "Tab", true), {
    row: 49,
    column: 29,
  });
  assert.deepEqual(nextCell({ row: 9999, column: 29 }, "Enter"), {
    row: 9999,
    column: 29,
  });
  assert.deepEqual(nextCell({ row: 0, column: 0 }, "ArrowUp"), {
    row: 0,
    column: 0,
  });
  assert.equal(nextCell({ row: 0, column: 0 }, "F2"), null);
  assert.equal(groupLabel(29), "AD");
});
test("range copy preserves missing cells, rectangular shape, and quoted TSV values", () => {
  const columns = [
    { name: "A", values: ["1", "", "a\tb"] },
    { name: "B", values: ["2", "3", '"note"'] },
  ];
  const text = selectionTSV(columns, {
    startRow: 0,
    endRow: 2,
    startColumn: 0,
    endColumn: 2,
  });
  assert.deepEqual(parseDelimited(text, "\t"), [
    ["1", "2", ""],
    ["", "3", ""],
    ["a\tb", '"note"', ""],
  ]);
});

test("sheet remount retains the selected rectangle and its direction independently of scroll", () => {
  const cache = new GridSessionCache();
  const anchor = { row: 12, column: 4 },
    head = { row: 7, column: 2 };
  const range = rangeBetween(anchor, head);
  cache.update("first", { active: head, anchor, head, range });
  const widths = [...cache.read("first").widths];
  widths[0] = 192;
  cache.update("first", { scrollTop: 150000, scrollLeft: 1500, widths });
  cache.update("second", {
    active: { row: 400, column: 20 },
    range: rangeBetween({ row: 400, column: 20 }, { row: 400, column: 20 }),
  });
  const restored = cache.read("first");
  assert.deepEqual(restored.active, head);
  assert.deepEqual(restored.anchor, anchor);
  assert.deepEqual(restored.head, head);
  assert.deepEqual(restored.range, range);
  assert.equal(restored.scrollTop, 150000);
  assert.equal(restored.scrollLeft, 1500);
  assert.equal(restored.widths[0], 192);
  assert.deepEqual(
    rangeBetween(restored.anchor, nextCell(restored.active, "ArrowDown")!),
    { startRow: 8, endRow: 12, startColumn: 2, endColumn: 4 },
  );
  assert.deepEqual(cache.read("new").active, { row: 0, column: 0 });
  assert.equal(cache.read("new").scrollTop, 0);
  assert.equal(new GridSessionCache().read("first").widths[0], 112);
});
