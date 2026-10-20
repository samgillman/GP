import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import { defaultGraphAxes } from "./axes.ts";
import { COLUMN_PLOT_HEIGHT, COLUMN_SLOT, columnPageLayout, plotLabelLayout } from "./plot-label-layout.ts";
import { buildPlotGeometry, drawDensePoints, drawSelectedPoints, plotFrame, pointHitIndex, reframePlotGeometry } from "./plot-geometry.ts";

test("formatted units reserve a separate title band without changing page dimensions", () => {
  const layout = plotLabelLayout({ xWidth: 75, yWidth: 70, tickHeight: 13, titleHeight: 14, hasYTitle: true });
  assert.ok(layout.frame.left > plotFrame.left);
  assert.ok(layout.frame.left - 10 - 70 - layout.yTitleX >= 12);
  assert.equal(layout.frame.width, 680);
  assert.equal(layout.frame.height, 420);
  assert.ok(layout.frame.right >= 75 / 2 + 8);
  const short = plotLabelLayout({ xWidth: 20, yWidth: 20, tickHeight: 13, titleHeight: 14, hasYTitle: true });
  assert.deepEqual(short.frame, plotFrame);
});

test("extreme affixes and font sizes cannot consume the plotted data rectangle", () => {
  const layout = plotLabelLayout({ xWidth: 2000, yWidth: 2000, tickHeight: 100, titleHeight: 100, hasYTitle: true });
  assert.ok(layout.frame.width - layout.frame.left - layout.frame.right >= 300);
  assert.ok(layout.frame.height - layout.frame.top - layout.frame.bottom >= 260);
  assert.ok(layout.yTickWidth < 2000);
});

test("reprojection shares observations and statistics, keeps clipping and hit targets aligned", () => {
  const project = sample("xy");
  project.graph.axes = defaultGraphAxes();
  project.graph.axes.x.minimum = 1;
  project.graph.axes.x.maximum = 100;
  project.graph.axes.x.scale = "log10";
  project.graph.axes.x.reverse = true;
  project.graph.axes.y.minimum = 0;
  project.graph.axes.y.maximum = 100;
  project.graph.axes.y.reverse = true;
  const original = buildPlotGeometry(project, null)!;
  const frame = { ...plotFrame, left: 140, right: 55, bottom: 100 };
  const geometry = reframePlotGeometry(original, frame);
  assert.strictEqual(geometry.series, original.series);
  assert.strictEqual(geometry.fits, original.fits);
  assert.deepEqual(geometry.xTicks, original.xTicks);
  assert.deepEqual(original.frame, plotFrame);
  assert.equal(geometry.x(100), frame.left);
  assert.equal(geometry.x(1), frame.width - frame.right);
  assert.equal(geometry.y(0), frame.top);
  assert.equal(geometry.y(100), frame.height - frame.bottom);
  assert.equal(geometry.boundedY(-1), frame.top);
  assert.equal(geometry.boundedY(101), frame.height - frame.bottom);
  const hit = pointHitIndex(geometry);
  const point = geometry.series[0].points.find(point => point.x === 3)!;
  assert.equal(hit(geometry.x(point.x), geometry.y(point.y), 2)?.row, point.row);
  assert.equal(hit(frame.left - 1, geometry.y(point.y), 1000), null);
  assert.equal(hit(geometry.x(point.x), frame.height - frame.bottom + 1, 1000), null);
  const clipped = geometry.linePath([{ x: .1, y: 50 }, { x: 1000, y: 50 }]);
  assert.equal(clipped, `M${frame.width - frame.right},${geometry.y(50)}L${frame.left},${geometry.y(50)}`);
  const rectangles: number[][] = [], points: number[][] = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, clip() {}, fill() {}, stroke() {},
    rect(...args: number[]) { rectangles.push(args); },
    arc(...args: number[]) { points.push(args); },
  } as unknown as CanvasRenderingContext2D;
  drawDensePoints(context, geometry);
  drawSelectedPoints(context, geometry, [{ seriesIndex: 0, startRow: point.row, endRow: point.row }]);
  assert.deepEqual(rectangles, Array(2).fill([frame.left, frame.top, frame.width - frame.left - frame.right, frame.height - frame.top - frame.bottom]));
  assert.deepEqual(points.at(-1)?.slice(0, 2), [geometry.x(point.x), geometry.y(point.y)]);
});

test("column page gives each data set a fixed slot on a 220 px plotting area", () => {
  const short = columnPageLayout({ count: 3, xWidths: [40, 41, 42], yWidth: 27, tickHeight: 14, titleHeight: 16, hasYTitle: true, hasXTitle: true });
  assert.equal(short.slanted, false);
  assert.equal(short.frame.width - short.frame.left - short.frame.right, COLUMN_SLOT * 3.2);
  assert.equal(short.frame.height - short.frame.top - short.frame.bottom, COLUMN_PLOT_HEIGHT);
  const wide = columnPageLayout({ count: 6, xWidths: [40, 41, 42, 43, 44, 45], yWidth: 27, tickHeight: 14, titleHeight: 16, hasYTitle: true, hasXTitle: true });
  assert.equal(wide.frame.width - wide.frame.left - wide.frame.right, COLUMN_SLOT * 6.2);
});

test("column labels wider than a slot slant and get room below and to the left", () => {
  const layout = columnPageLayout({ count: 3, xWidths: [55, 88, 88], yWidth: 27, tickHeight: 14, titleHeight: 16, hasYTitle: true, hasXTitle: true });
  assert.equal(layout.slanted, true);
  // The slanted labels drop by about their diagonal extent; the title sits below them.
  assert.ok(layout.frame.bottom >= Math.SQRT1_2 * (88 + 14) + 14 + 16);
  assert.ok(layout.xTitleOffset < layout.frame.bottom);
  // Room for the Y tick labels plus the rotated Y title.
  assert.ok(layout.frame.left >= 27 + 12 + 16 + 34);
  assert.ok(layout.yTitleX > 0 && layout.yTitleX < layout.frame.left - 27);
  const long = columnPageLayout({ count: 1, xWidths: [400], yWidth: 10, tickHeight: 14, titleHeight: 16, hasYTitle: false, hasXTitle: false });
  // Label widths are capped, so a pathological name cannot grow the page without bound.
  assert.ok(long.frame.bottom < 160);
  // The first slanted label still starts inside the page.
  assert.ok(long.frame.left + COLUMN_SLOT * 0.6 - (Math.SQRT1_2 * (160 + 7) - 5) >= 8);
});

test("a legend widens the right margin by its width", () => {
  const base = { count: 3, xWidths: [40, 40, 40], yWidth: 27, tickHeight: 14, titleHeight: 16, hasYTitle: true, hasXTitle: true };
  const without = columnPageLayout(base), withLegend = columnPageLayout({ ...base, legendWidth: 90 });
  assert.equal(withLegend.frame.right - without.frame.right, 108);
  assert.equal(withLegend.frame.left, without.frame.left);
});
