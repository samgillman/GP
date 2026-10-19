import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonChoices,
  defaultComparisonOptions,
  normalizeComparisonOptions,
  parseComparisonOptions,
  testName,
} from "./column-analysis.ts";

test("designs offer only the multiple-comparison methods the backend computes", () => {
  const ordinary = defaultComparisonOptions;
  assert.deepEqual(comparisonChoices(ordinary).all_pairs?.[0], "tukey");
  assert.deepEqual(comparisonChoices(ordinary).vs_control?.[0], "dunnett");
  const welch = { ...ordinary, equal_sd: false };
  assert.deepEqual(comparisonChoices(welch), { all_pairs: ["games_howell"] });
  assert.deepEqual(
    comparisonChoices({ ...ordinary, gaussian: false }).vs_control,
    ["dunn"],
  );
  assert.equal(
    comparisonChoices({ ...ordinary, paired: true }).vs_control?.includes(
      "dunnett",
    ),
    false,
  );
});

test("normalizing repairs methods, designs and control after design changes", () => {
  const vsControl = normalizeComparisonOptions(
    { ...defaultComparisonOptions, comparisons: "vs_control", control: 7 },
    3,
  );
  assert.equal(vsControl.method, "dunnett");
  assert.equal(vsControl.control, 2);
  const welch = normalizeComparisonOptions(
    { ...vsControl, equal_sd: false },
    3,
  );
  assert.equal(welch.comparisons, "all_pairs");
  assert.equal(welch.method, "games_howell");
  const none = normalizeComparisonOptions({ ...welch, comparisons: "none" }, 3);
  assert.equal(none.method, null);
});

test("test names follow the chosen design", () => {
  const o = defaultComparisonOptions;
  assert.equal(testName("t_test", o), "Unpaired t test");
  assert.equal(testName("t_test", { ...o, equal_sd: false }), "Welch's t test");
  assert.equal(
    testName("t_test", { ...o, gaussian: false }),
    "Mann-Whitney test",
  );
  assert.equal(
    testName("t_test", { ...o, paired: true, gaussian: false }),
    "Wilcoxon matched-pairs signed rank test",
  );
  assert.equal(
    testName("one_way_anova", { ...o, paired: true }),
    "Repeated measures one-way ANOVA",
  );
  assert.equal(
    testName("one_way_anova", { ...o, gaussian: false }),
    "Kruskal-Wallis test",
  );
});

test("saved parameters are validated strictly", () => {
  assert.deepEqual(
    parseComparisonOptions(structuredClone(defaultComparisonOptions)),
    defaultComparisonOptions,
  );
  for (const bad of [
    null,
    [],
    { ...defaultComparisonOptions, extra: true },
    { ...defaultComparisonOptions, method: "magic" },
    { ...defaultComparisonOptions, alpha: 0.9 },
    { ...defaultComparisonOptions, control: 1.5 },
    { ...defaultComparisonOptions, tails: 3 },
    (({ alpha: _alpha, ...rest }) => rest)(defaultComparisonOptions),
  ])
    assert.throws(() => parseComparisonOptions(bad));
});
