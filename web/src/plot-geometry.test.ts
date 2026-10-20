import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Response, Summary } from "./data.ts";
import {
  bracketLevels,
  buildPlotGeometry,
  drawDensePoints,
  linearTicks,
  plotFrame,
  pointHitIndex,
  drawSelectedPoints,
} from "./plot-geometry.ts";

test("paired-test graphs keep all observed cells and use CIs for the plotted population", () => {
  const project = sample("column");
  project.graph.error = "ci";
  project.columns = [
    { name: "A", values: ["1", "2", "100"] },
    { name: "B", values: ["2", "4", ""] },
  ];
  // The test uses A=[1,2], B=[2,4]. The graph intentionally retains A=100.
  // 95% critical values: t(df=1)=12.7062047364321, t(df=2)=4.30265272969614.
  const completeA: Summary = {
    name: "A", n: 2, mean: 1.5, sd: Math.sqrt(0.5), sem: 0.5,
    median: 1.5, min: 1, max: 2,
    ci_low: 1.5 - 12.7062047364321 / 2,
    ci_high: 1.5 + 12.7062047364321 / 2,
  };
  const completeB: Summary = {
    name: "B", n: 2, mean: 3, sd: Math.sqrt(2), sem: 1,
    median: 3, min: 2, max: 4,
    ci_low: 3 - 12.7062047364321,
    ci_high: 3 + 12.7062047364321,
  };
  const observedA: Summary = {
    ...completeA, n: 3, mean: 103 / 3, sd: Math.sqrt(9703 / 3),
    sem: Math.sqrt(9703) / 3, median: 2, max: 100,
    ci_low: 103 / 3 - 4.30265272969614 * Math.sqrt(9703) / 3,
    ci_high: 103 / 3 + 4.30265272969614 * Math.sqrt(9703) / 3,
  };
  const result: Response = {
    analysis: "t_test", analysis_revision: 2,
    summary: [completeA, completeB],
    graph_summary: [observedA, completeB], results: [], warnings: [], fit: [],
  };
  const before = structuredClone({ project, result });
  const geometry = buildPlotGeometry(project, result)!;
  const a = geometry.series[0];
  assert.equal(geometry.count, 5);
  assert.equal(a.points.length, 3);
  assert.deepEqual(a.values, [1, 2, 100]);
  assert.equal(a.mean, 103 / 3);
  assert.equal(a.lo, observedA.ci_low);
  assert.equal(a.hi, observedA.ci_high);
  assert.notEqual(a.lo, completeA.ci_low);
  assert.equal(geometry.series[1].points.length, 2);
  assert.equal(geometry.series[1].lo, completeB.ci_low);
  assert.equal(result.summary[0].n, 2);
  assert.deepEqual({ project, result }, before, "rendering must not alter data, exclusions, or matched summaries");
  // Other analyses and older responses still use their ordinary graph population.
  const { graph_summary, ...ordinary } = result;
  const fallback = buildPlotGeometry(project, { ...ordinary, analysis: "descriptive", summary: graph_summary! })!;
  assert.equal(fallback.series[0].lo, observedA.ci_low);
});

for (const [columns, rows] of [
  [20, 10_000],
  [1, 300_000],
]) {
  test(`${columns * rows} observations retain full bounds and draw every point without variadic calls`, () => {
    const project = sample("column");
    project.graph.type = "scatter";
    project.graph.error = "none";
    project.columns = Array.from({ length: columns }, (_, c) => ({
      name: `Group ${c}`,
      values: Array.from({ length: rows }, (_, r) => String(c * rows + r)),
    }));
    project.columns[columns - 1].values[rows - 1] = "900000";
    project.columns[0].values[rows - 2] = "-700000";
    const geometry = buildPlotGeometry(project, null)!;
    assert.equal(geometry.count, columns * rows);
    assert.ok(geometry.minY <= -700000);
    assert.ok(geometry.maxY >= 900000);
    assert.equal(geometry.series[columns - 1].points[rows - 1].row, rows - 1);
    let arcs = 0,
      fills = 0,
      strokes = 0,
      foundLow = false,
      foundHigh = false;
    const context = {
      beginPath() {},
      arc(x: number, y: number) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(
          y >= plotFrame.top && y <= plotFrame.height - plotFrame.bottom,
        );
        if (y === geometry.y(-700000)) foundLow = true;
        if (y === geometry.y(900000)) foundHigh = true;
        arcs++;
      },
      fill() {
        fills++;
      },
      stroke() {
        strokes++;
      },
    } as unknown as CanvasRenderingContext2D;
    drawDensePoints(context, geometry);
    assert.equal(arcs, columns * rows);
    assert.equal(fills, arcs);
    assert.equal(strokes, arcs);
    assert.ok(
      foundLow && foundHigh,
      "both outliers must be rendered, not just included in bounds",
    );
  });
}
test("300000-value box uses all observations for whiskers and quartiles", () => {
  const project = sample("column");
  project.graph.type = "box";
  project.columns = [
    {
      name: "Large",
      values: Array.from({ length: 300_000 }, (_, i) => String(i)),
    },
  ];
  const geometry = buildPlotGeometry(project, null)!;
  const series = geometry.series[0];
  assert.equal(series.min, 0);
  assert.equal(series.max, 299999);
  assert.deepEqual(series.quartiles, [74999.75, 149999.5, 224999.25]);
});
test("300000 XY observations include extrema from data and fit without spreading", () => {
  const project = sample("xy");
  project.graph.error = "none";
  project.columns = [
    {
      name: "X",
      values: Array.from({ length: 300_000 }, (_, i) => String(i - 150000)),
    },
    {
      name: "Y",
      values: Array.from({ length: 300_000 }, (_, i) => String(i % 13)),
    },
  ];
  const result: Response = {
    analysis: "linear_regression",
    summary: [],
    results: [],
    warnings: [],
    fit: [
      {
        series: "Y",
        parameters: {},
        points: [
          { x: 500000, y: 800000 },
          { x: -500000, y: -800000 },
        ],
      },
    ],
  };
  const geometry = buildPlotGeometry(project, result)!;
  assert.equal(geometry.count, 300_000);
  assert.ok(geometry.minX <= -500000 && geometry.maxX >= 500000);
  assert.ok(geometry.minY <= -800000 && geometry.maxY >= 800000);
});
test("dose-response log display excludes nonpositive X without changing input or fit", () => {
  const project = sample("xy");
  project.columns = [
    { name: "X", values: ["0", "-1", "0.1", "1", "10"] },
    { name: "Y", values: ["-999", "999", "2", "3", "4"] },
  ];
  const result: Response = {
    analysis: "dose_response",
    summary: [],
    results: [],
    warnings: [],
    fit: [
      {
        series: "Y",
        parameters: {},
        points: [
          { x: 0, y: -500 },
          { x: 0.1, y: 2 },
          { x: 10, y: 4 },
        ],
      },
    ],
  };
  const geometry = buildPlotGeometry(project, result)!;
  assert.equal(geometry.count, 3);
  assert.equal(geometry.fits[0].points.length, 2);
  assert.ok(geometry.minX > 0 && geometry.minY > -500 && geometry.maxY < 999);
  assert.deepEqual(
    geometry.series[0].points.map((p) => p.row),
    [2, 3, 4],
  );
  assert.equal(project.columns[0].values.length, 5);
  assert.equal(result.fit[0].points.length, 3);
  assert.ok(
    geometry.xTicks.every((v) => v > 0 && Number.isFinite(geometry.x(v))),
  );
});
test("positive and negative bars end their axis at zero; mixed bars include zero", () => {
  for (const [values, side] of [
    [["10", "20"], "min"],
    [["-10", "-20"], "max"],
    [["-10", "20"], "mixed"],
  ] as const) {
    const project = sample("column");
    project.graph.error = "none";
    project.columns = [{ name: "A", values: [...values] }];
    const g = buildPlotGeometry(project, null)!;
    if (side === "min") assert.equal(g.minY, 0);
    if (side === "max") assert.equal(g.maxY, 0);
    assert.ok(g.minY <= 0 && g.maxY >= 0);
  }
});
test("linear ticks use short decimal steps at ordinary and small scales", () => {
  assert.deepEqual(linearTicks(1.13, 9.72).ticks, [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(
    linearTicks(0.00113, 0.00972).ticks,
    [0, 0.002, 0.004, 0.006, 0.008, 0.01],
  );
});
test("empty and missing XY cells never create synthetic observations", () => {
  const project = sample("xy");
  project.columns = [
    { name: "X", values: ["1", "", "3", "4"] },
    { name: "Y", values: ["", "2", "3", "bad"] },
  ];
  const g = buildPlotGeometry(project, null)!;
  assert.deepEqual(g.series[0].points, [{ x: 3, y: 3, row: 2 }]);
  project.columns[1].values = [""];
  assert.equal(buildPlotGeometry(project, null), null);
});

test("spatial hit testing identifies dense observations and expands beyond marker radius", () => {
  const project = sample("xy");
  project.columns = [
    {
      name: "X",
      values: Array.from({ length: 300_000 }, (_, i) => String(i % 1000)),
    },
    {
      name: "Y",
      values: Array.from({ length: 300_000 }, (_, i) =>
        String(Math.floor(i / 1000)),
      ),
    },
  ];
  const geometry = buildPlotGeometry(project, null)!;
  const hit = pointHitIndex(geometry);
  const row = 152_500,
    point = geometry.series[0].points[row];
  assert.equal(hit(geometry.x(point.x), geometry.y(point.y), 0.01)?.row, row);
  assert.equal(hit(-100, -100), null);
  const simple = sample("xy");
  simple.columns = [
    { name: "X", values: ["1", "", "5"] },
    { name: "Y", values: ["2", "7", "9"] },
  ];
  const g = buildPlotGeometry(simple, null)!;
  const found = pointHitIndex(g)(g.x(5) + 8, g.y(9), 12)!;
  assert.equal(found.row, 2);
  assert.equal(found.seriesIndex, 0);
  assert.equal(found.y, 9);
});
test("coincident points select the last drawn dataset and original row", () => {
  const project = sample("xy");
  project.columns = [
    { name: "X", values: ["1", "1"] },
    { name: "First", values: ["2", "2"] },
    { name: "Last", values: ["2", "2"] },
  ];
  const g = buildPlotGeometry(project, null)!;
  const hit = pointHitIndex(g)(g.x(1), g.y(2))!;
  assert.equal(hit.seriesIndex, 1);
  assert.equal(hit.row, 1);
});

test("zero-only bars have a finite zero-based domain", () => {
  const p = sample("column");
  p.columns = [{ name: "Zero", values: ["0", "0"] }];
  const g = buildPlotGeometry(p, null)!;
  assert.equal(g.minY, 0);
  assert.ok(g.maxY > 0);
  assert.ok(Number.isFinite(g.y(0)));
});
test("300000-point selection draws every selected observation without DOM marks", () => {
  const p = sample("column");
  p.columns = [
    {
      name: "All",
      values: Array.from({ length: 300_000 }, (_, r) => String(r)),
    },
  ];
  const g = buildPlotGeometry(p, null)!;
  let arcs = 0;
  const context = {
    beginPath() {},
    arc() {
      arcs++;
    },
    stroke() {},
  } as unknown as CanvasRenderingContext2D;
  const count = drawSelectedPoints(context, g, [
    { seriesIndex: 0, startRow: 0, endRow: 299999 },
  ]);
  assert.equal(count, 300000);
  assert.equal(arcs, 300000);
  assert.equal(
    drawSelectedPoints(context, g, [
      { seriesIndex: 1, startRow: 0, endRow: 299999 },
    ]),
    0,
  );
});
test("selection ranges preserve missing-cell row identities and tolerate reversed ranges", () => {
  const p = sample("column");
  p.columns = [{ name: "A", values: ["1", "", "3", "4"] }];
  const g = buildPlotGeometry(p, null)!;
  const context = {
    beginPath() {},
    arc() {},
    stroke() {},
  } as unknown as CanvasRenderingContext2D;
  assert.equal(
    drawSelectedPoints(context, g, [
      { seriesIndex: 0, startRow: 2, endRow: 1 },
    ]),
    1,
  );
});

test("pairwise brackets stack like the export and raise the axis to fit", () => {
  const placed = bracketLevels(
    [
      { a: 0, b: 2, label: "**" },
      { a: 1, b: 0, label: "*" },
      { a: 1, b: 2, label: "ns" },
    ],
    [10, 12, 11],
    1,
  );
  assert.deepEqual(
    placed.map((b) => [b.x1, b.x2, Number(b.y.toFixed(6)), b.label]),
    [
      [1, 2, 12.6, "*"],
      [2, 3, 13.6, "ns"],
      [1, 3, 14.6, "**"],
    ],
  );
  assert.deepEqual(bracketLevels([{ a: 0, b: 3, label: "*" }], [1, 2], 1), []);
  const project = sample("column");
  const plain = buildPlotGeometry(project, null)!;
  const annotated = buildPlotGeometry(project, null, [
    { a: 0, b: 1, label: "****" },
  ])!;
  assert.equal(annotated.brackets.length, 1);
  assert.ok(
    annotated.brackets[0].y >
      Math.max(...project.columns[0].values.map(Number)),
  );
  assert.ok(annotated.maxY >= plain.maxY);
  assert.ok(annotated.maxY > annotated.brackets[0].y);
});
