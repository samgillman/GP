import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canvasPixelRatio,
  clampGraphZoom,
  GRAPH_ZOOM_PRESETS,
  MAX_GRAPH_ZOOM,
  MIN_GRAPH_ZOOM,
} from "./plot-view.ts";

test("all recovered zoom menu tags are reachable, including presets above 400%", () => {
  assert.deepEqual(
    GRAPH_ZOOM_PRESETS,
    [50, 75, 100, 150, 200, 400, 600, 800, 1000],
  );
  for (const preset of GRAPH_ZOOM_PRESETS)
    assert.equal(clampGraphZoom(preset), preset);
  assert.equal(clampGraphZoom(400 + 25), 425);
  assert.equal(clampGraphZoom(975 + 25), 1000);
  assert.equal(clampGraphZoom(1000 + 25), MAX_GRAPH_ZOOM);
});

test("free zoom retains GP's existing minimum and integer percentage behavior", () => {
  assert.equal(MIN_GRAPH_ZOOM, 25);
  assert.equal(clampGraphZoom(0), 25);
  assert.equal(clampGraphZoom(174.7), 175);
  assert.equal(clampGraphZoom(1000 * Math.exp(80 * 0.005)), 1000);
  assert.equal(clampGraphZoom(Number.NaN), 100);
});

test("1000% view zoom keeps dense and selection canvases within the existing 4x cap", () => {
  for (const zoom of GRAPH_ZOOM_PRESETS) {
    for (const ratio of [1, 2, 3, 4]) {
      const actual = canvasPixelRatio(zoom, ratio);
      assert.ok(actual >= 2 && actual <= 4);
      assert.ok(680 * actual <= 2720 && 420 * actual <= 1680);
    }
  }
  assert.equal(canvasPixelRatio(1000, 3), 4);
  assert.equal(canvasPixelRatio(100, 1), 2);
  assert.equal(canvasPixelRatio(100, 3), 3);
});
