import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultGraphAxes } from "./axes.ts";
import { sample } from "./data.ts";
import type { DatasetStyle, SymbolShape } from "./graph-style.ts";
import {
  buildPlotGeometry,
  DENSE_POINT_THRESHOLD,
  drawDensePoints,
  drawSelectedPoints,
  pointHitIndex,
  reframePlotGeometry,
} from "./plot-geometry.ts";

type PaintedMark = {
  color: string;
  vertices: [number, number][];
  circle: { x: number; y: number; radius: number } | null;
  closed: boolean;
};

function recordingCanvas() {
  const filled: PaintedMark[] = [], stroked: PaintedMark[] = [];
  let vertices: [number, number][] = [], circle: PaintedMark["circle"] = null, closed = false;
  let saves = 0, restores = 0, clips = 0;
  const context = {
    fillStyle: "",
    strokeStyle: "",
    save() { saves++; },
    restore() { restores++; },
    rect() {},
    clip() { clips++; },
    beginPath() { vertices = []; circle = null; closed = false; },
    moveTo(x: number, y: number) { vertices.push([x, y]); },
    lineTo(x: number, y: number) { vertices.push([x, y]); },
    closePath() { closed = true; },
    arc(x: number, y: number, radius: number) { circle = { x, y, radius }; },
    fill() { filled.push({ color: this.fillStyle, vertices, circle, closed }); },
    stroke() { stroked.push({ color: this.strokeStyle, vertices, circle, closed }); },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    filled,
    stroked,
    clipping: () => [saves, restores, clips],
  };
}

function fixture(styles: Record<string, DatasetStyle>) {
  const project = sample("xy");
  project.columns = [
    { id: "x", name: "X", values: ["5"] },
    ...Object.keys(styles).map(id => ({ id, name: id, values: ["5"] })),
  ];
  project.graph.colors = ["#abcdef"];
  project.graph.dataset_styles = styles;
  project.graph.axes = defaultGraphAxes();
  Object.assign(project.graph.axes.x, { minimum: 0, maximum: 10 });
  Object.assign(project.graph.axes.y, { minimum: 0, maximum: 10 });
  return project;
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
}

test("canvas honors each source-ID symbol color, size and existing SVG shape geometry", () => {
  const project = fixture({
    circle: { symbol_shape: "circle", symbol_size: 3, symbol_color: "#123456" },
    square: { symbol_shape: "square", symbol_size: 7, symbol_color: "#654321" },
    triangle: { symbol_shape: "triangle", symbol_size: 4, symbol_color: "#112233" },
    diamond: { symbol_shape: "diamond", symbol_size: 5, symbol_color: "#445566" },
  });
  const geometry = buildPlotGeometry(project, null)!;
  const canvas = recordingCanvas();
  drawDensePoints(canvas.context, geometry);
  assert.deepEqual(canvas.filled.map(mark => mark.color), ["#123456", "#654321", "#112233", "#445566"]);
  assert.equal(canvas.stroked.length, 0, "SVG symbols are fill-only, with no old white canvas outline");
  assert.deepEqual(canvas.clipping(), [1, 1, 1]);
  const cx = geometry.x(5), cy = geometry.y(5);
  assert.deepEqual(canvas.filled[0].circle, { x: cx, y: cy, radius: 3.2 });
  // Existing SVG paths use these unequal shape envelopes; do not normalize them.
  const expected = [
    [[-6.48, -6.48], [6.48, -6.48], [6.48, 6.48], [-6.48, 6.48]],
    [[0, -4.83], [4.5885, 3.1395], [-4.5885, 3.1395]],
    [[0, -6.24], [6.24, 0], [0, 6.24], [-6.24, 0]],
  ];
  canvas.filled.slice(1).forEach((mark, index) => {
    assert.equal(mark.circle, null);
    assert.equal(mark.closed, true);
    assert.equal(mark.vertices.length, expected[index].length);
    mark.vertices.forEach(([x, y], vertex) => {
      close(x - cx, expected[index][vertex][0]);
      close(y - cy, expected[index][vertex][1]);
    });
  });
});

test("hidden dense symbols stay absent without dropping observations, bounds or line data", () => {
  const project = fixture({ visible: { symbol_color: "#123456" }, hidden: { symbols: false } });
  delete project.graph.axes;
  const rows = DENSE_POINT_THRESHOLD + 1;
  project.columns[0].values = Array(rows).fill("5");
  project.columns[1].values = Array(rows).fill("5");
  project.columns[2].values = Array(rows).fill("8");
  const original = structuredClone(project);
  const geometry = buildPlotGeometry(project, null)!;
  const canvas = recordingCanvas();
  drawDensePoints(canvas.context, geometry);
  assert.equal(canvas.filled.length, rows);
  assert.ok(canvas.filled.every(mark => mark.color === "#123456" && mark.circle?.radius === 3.2));
  assert.equal(geometry.symbolCount, rows);
  assert.equal(geometry.count, rows * 2);
  assert.equal(geometry.totalCount, rows * 2);
  assert.equal(geometry.series[1].values.length, rows);
  assert.equal(geometry.series[1].linePoints.length, rows);
  const shown = buildPlotGeometry({ ...project, graph: { ...project.graph, dataset_styles: undefined } }, null)!;
  assert.deepEqual([geometry.minX, geometry.maxX, geometry.minY, geometry.maxY], [shown.minX, shown.maxX, shown.minY, shown.maxY]);
  assert.deepEqual(project, original);
});

test("only displayed symbols contribute to the dense-rendering threshold", () => {
  const project = fixture({ visible: {}, hidden: { symbols: false } });
  const rows = DENSE_POINT_THRESHOLD + 1;
  project.columns[0].values = Array(rows).fill("5");
  project.columns[2].values = Array(rows).fill("8");
  const geometry = buildPlotGeometry(project, null)!;
  assert.ok(geometry.count > DENSE_POINT_THRESHOLD);
  assert.equal(geometry.symbolCount, 1, "one visible point remains an SVG symbol");
});

test("hidden overlapping datasets do not block visible hits and visible ties stay topmost", () => {
  const project = fixture({ a: {}, b: { symbols: false } });
  project.columns.forEach(column => { column.values = ["5", "5"]; });
  let geometry = buildPlotGeometry(project, null)!;
  let hit = pointHitIndex(geometry)(geometry.x(5), geometry.y(5));
  assert.equal(hit?.seriesIndex, 0);
  assert.equal(hit?.row, 1, "the last drawn visible row still wins");
  project.graph.dataset_styles!.b.symbols = true;
  geometry = buildPlotGeometry(project, null)!;
  hit = pointHitIndex(geometry)(geometry.x(5), geometry.y(5));
  assert.equal(hit?.seriesIndex, 1, "the last drawn visible data set still wins");
  project.graph.dataset_styles!.a.symbols = false;
  project.graph.dataset_styles!.b.symbols = false;
  geometry = buildPlotGeometry(project, null)!;
  assert.equal(pointHitIndex(geometry)(geometry.x(5), geometry.y(5)), null);
  assert.equal(geometry.symbolCount, 0);
  assert.equal(geometry.count, 4);
});

test("size-10 symbol edges and polygon corners remain selectable at higher zoom", () => {
  const edges: [SymbolShape, number, number][] = [
    ["circle", 10, 0],
    ["square", 9, 9],
    ["triangle", 11, 7.5],
    ["diamond", 12, 0],
  ];
  for (const [symbol_shape, dx, dy] of edges) {
    const project = fixture({ a: { symbol_shape, symbol_size: 10 } });
    const geometry = buildPlotGeometry(project, null)!;
    const hit = pointHitIndex(geometry);
    const cx = geometry.x(5), cy = geometry.y(5);
    assert.equal(hit(cx + dx, cy + dy, 6)?.seriesIndex, 0, symbol_shape);
    assert.equal(hit(cx + 15, cy, 6), null, `${symbol_shape} keeps a bounded hit target`);
    assert.equal(hit(cx, cy, Number.NaN), null);
    assert.equal(hit(cx, cy, -1), null);
  }
  const small = buildPlotGeometry(fixture({ a: { symbol_size: 1 } }), null)!;
  assert.ok(pointHitIndex(small)(small.x(5) + 11, small.y(5), 12), "small symbols retain pointer tolerance");
});

test("large symbol picking preserves clipping and follows the reframed plot", () => {
  const project = fixture({ a: { symbol_shape: "square", symbol_size: 10 } });
  project.columns[0].values = ["-1", "0", "5"];
  project.columns[1].values = ["5", "5", "5"];
  const base = buildPlotGeometry(project, null)!;
  const geometry = reframePlotGeometry(base, { width: 500, height: 350, left: 60, right: 40, top: 30, bottom: 50 });
  const hit = pointHitIndex(geometry);
  assert.equal(hit(geometry.frame.left - 1, geometry.y(5), 30), null);
  assert.equal(hit(geometry.x(-1), geometry.y(5), 30), null, "off-scale centers never become targets");
  assert.equal(hit(geometry.x(5) + 9, geometry.y(5) + 9, 6)?.row, 2);
  assert.equal(geometry.series[0].points.length, 3, "clipping does not change observation rows");
});

test("selection rings skip hidden symbols and enclose a large square's corners", () => {
  const project = fixture({ a: { symbol_shape: "square", symbol_size: 10 }, hidden: { symbols: false } });
  const geometry = buildPlotGeometry(project, null)!;
  const canvas = recordingCanvas();
  const count = drawSelectedPoints(canvas.context, geometry, [
    { seriesIndex: 0, startRow: 0, endRow: 0 },
    { seriesIndex: 1, startRow: 0, endRow: 0 },
  ]);
  assert.equal(count, 1);
  assert.equal(canvas.stroked.length, 1);
  assert.equal(canvas.stroked[0].color, "#0866db");
  close(canvas.stroked[0].circle!.radius, Math.hypot(9.18, 9.18) + 3);
  assert.deepEqual(canvas.clipping(), [1, 1, 1]);
});
