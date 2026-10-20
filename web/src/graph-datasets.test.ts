import { test } from "node:test";
import assert from "node:assert/strict";
import { palette } from "./data.ts";
import {
  MAX_EXPLICIT_COLORS,
  addDatasets,
  datasetColor,
  explicitColors,
  removeDataset,
  reorderDataset,
  reverseDatasets,
  setDatasetColor,
} from "./graph-datasets.ts";

const three = { columnIndices: [0, 1, 2], colors: ["#111111", "#222222", "#333333"] };

test("explicit colors expand the cycling list to one entry per dataset", () => {
  assert.deepEqual(explicitColors({ columnIndices: [3, 4, 5, 6], colors: ["#aaaaaa", "#bbbbbb"] }),
    ["#aaaaaa", "#bbbbbb", "#aaaaaa", "#bbbbbb"]);
  assert.deepEqual(explicitColors({ columnIndices: [0, 1], colors: [] }), [palette[0], palette[1]]);
  assert.equal(datasetColor([], 7), palette[7 % palette.length]);
});

test("moving a dataset carries its color and reports the new position", () => {
  const up = reorderDataset(three, 2, "top");
  assert.deepEqual(up.arrangement, { columnIndices: [2, 0, 1], colors: ["#333333", "#111111", "#222222"] });
  assert.equal(up.position, 0);
  const down = reorderDataset(three, 0, "down");
  assert.deepEqual(down.arrangement.columnIndices, [1, 0, 2]);
  assert.deepEqual(down.arrangement.colors, ["#222222", "#111111", "#333333"]);
  assert.equal(down.position, 1);
  const bottom = reorderDataset(three, 0, "bottom");
  assert.deepEqual(bottom.arrangement.columnIndices, [1, 2, 0]);
  assert.deepEqual(bottom.arrangement.colors, ["#222222", "#333333", "#111111"]);
  assert.equal(bottom.position, 2);
  // Boundary moves are no-ops and keep the same object.
  assert.equal(reorderDataset(three, 0, "up").arrangement, three);
  assert.equal(reorderDataset(three, 2, "down").arrangement, three);
  assert.equal(reorderDataset(three, 5, "top").arrangement, three);
  // The source arrangement is never mutated.
  assert.deepEqual(three, { columnIndices: [0, 1, 2], colors: ["#111111", "#222222", "#333333"] });
});

test("reverse, remove and add keep each dataset's color", () => {
  assert.deepEqual(reverseDatasets(three), { columnIndices: [2, 1, 0], colors: ["#333333", "#222222", "#111111"] });
  assert.deepEqual(removeDataset(three, 1), { columnIndices: [0, 2], colors: ["#111111", "#333333"] });
  assert.equal(removeDataset(three, 9), three);
  const added = addDatasets({ columnIndices: [0, 2], colors: ["#111111", "#333333"] }, [4, 1, 4, 0]);
  assert.deepEqual(added.columnIndices, [0, 2, 4, 1]);
  assert.deepEqual(added.colors, ["#111111", "#333333", "#111111", "#333333"]);
  assert.equal(addDatasets(three, [0, 1]), three);
});

test("cycling colors are made explicit before a permutation changes positions", () => {
  const cycling = { columnIndices: [0, 1, 2, 3], colors: ["#aaaaaa", "#bbbbbb"] };
  const moved = reorderDataset(cycling, 3, "top").arrangement;
  assert.deepEqual(moved.columnIndices, [3, 0, 1, 2]);
  assert.deepEqual(moved.colors, ["#bbbbbb", "#aaaaaa", "#bbbbbb", "#aaaaaa"]);
});

test("a dataset color edit targets only that dataset", () => {
  const edited = setDatasetColor({ columnIndices: [0, 1, 2], colors: ["#aaaaaa"] }, 1, "#00ff00");
  assert.deepEqual(edited.colors, ["#aaaaaa", "#00ff00", "#aaaaaa"]);
  assert.equal(setDatasetColor(three, 3, "#00ff00"), three);
});

test("very wide graphs keep the historical cycling colors", () => {
  const wide = { columnIndices: Array.from({ length: MAX_EXPLICIT_COLORS + 1 }, (_, i) => i), colors: ["#aaaaaa", "#bbbbbb"] };
  const moved = reorderDataset(wide, 0, "bottom").arrangement;
  assert.equal(moved.columnIndices[MAX_EXPLICIT_COLORS], 0);
  assert.deepEqual(moved.colors, ["#aaaaaa", "#bbbbbb"]);
  const added = addDatasets(wide, [99]);
  assert.deepEqual(added.colors, ["#aaaaaa", "#bbbbbb"]);
  assert.equal(added.columnIndices.length, MAX_EXPLICIT_COLORS + 2);
});
