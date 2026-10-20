import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparisonChoices,
  comparisonDisclosures,
  comparisonOptionsProblem,
  defaultComparisonOptions,
  normalizeComparisonOptions,
  pairwiseMethodDescription,
  parseComparisonOptions,
  showPairwiseComparison,
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

test("normalizing resolves defaults without silently replacing the method, family or control", () => {
  const vsControl = normalizeComparisonOptions(
    { ...defaultComparisonOptions, comparisons: "vs_control", control: 7 },
    3,
  );
  assert.equal(vsControl.method, "dunnett");
  assert.equal(vsControl.control, 7);
  assert.match(comparisonOptionsProblem("one_way_anova", vsControl, 3), /control column is unavailable/);
  const welch = normalizeComparisonOptions(
    { ...vsControl, equal_sd: false },
    3,
  );
  assert.equal(welch.comparisons, "vs_control");
  assert.equal(welch.method, "dunnett");
  assert.match(comparisonOptionsProblem("one_way_anova", welch, 3), /will not substitute/);
  const none = normalizeComparisonOptions({ ...welch, comparisons: "none" }, 3);
  assert.equal(none.method, null);
});

test("saved repeated-measures Tukey remains visible and cannot run under the GG variance model", () => {
  const options = normalizeComparisonOptions({ ...defaultComparisonOptions, paired: true, method: "tukey" }, 3);
  assert.equal(options.method, "tukey");
  assert.match(comparisonOptionsProblem("one_way_anova", options, 3), /Tukey is not supported/);
  assert.equal(comparisonOptionsProblem("one_way_anova", { ...options, sphericity: "assume" }, 3), "");
  assert.equal(normalizeComparisonOptions({ ...options, method: null }, 3).method, "bonferroni");
});

test("one-tailed tests require a fixed alternative independent of displayed difference direction", () => {
  const options = { ...defaultComparisonOptions, tails: 1 as const };
  assert.match(comparisonOptionsProblem("t_test", options, 2), /prespecified direction/);
  for (const reverse_difference of [true, false]) {
    assert.equal(comparisonOptionsProblem("t_test", { ...options, alternative: "a_greater", reverse_difference }, 2), "");
    assert.match(pairwiseMethodDescription("t_test", { ...options, alternative: "a_greater", reverse_difference }, 2), /A > B/);
  }
});

test("bracket visibility uses the selected alpha including strict threshold boundaries", () => {
  // At alpha .01, P=.03 carries a star but must be hidden; at alpha .10,
  // P=.08 carries 'ns' but must be shown. Never filter on the star summary.
  assert.equal(showPairwiseComparison(0.03, false, 0.01), false);
  assert.equal(showPairwiseComparison(0.08, false, 0.1), true);
  assert.equal(showPairwiseComparison(0.01, false, 0.01), false);
  assert.equal(showPairwiseComparison(0.00999, false, 0.01), true);
  assert.equal(showPairwiseComparison(0.8, true, 0.01), true);
  for (const invalid of [NaN, Infinity, -0.01, 1.01])
    assert.equal(showPairwiseComparison(invalid, true, 0.05), false);
});

test("rank methods disclose approximate tails, small-sample scope and native equivalence limits", () => {
  const options = { ...defaultComparisonOptions, gaussian: false };
  const mw = comparisonDisclosures("t_test", options).join(" ");
  assert.match(mw, /Numerical validation does not establish GraphPad Prism equivalence/);
  assert.match(mw, /with at most 50 values in each column/);
  assert.match(mw, /ties/);
  const wilcoxon = comparisonDisclosures("t_test", { ...options, paired: true }).join(" ");
  assert.match(wilcoxon, /Pratt handling is unsupported/);
  assert.match(wilcoxon, /Exact P with ties is unsupported/);
  const kw = comparisonDisclosures("one_way_anova", options).join(" ");
  assert.match(kw, /fewer than five observations/);
  assert.match(kw, /Bonferroni adjustment/);
  assert.match(kw, /pooled ranks, a tie-corrected standard error/);
  const friedman = comparisonDisclosures("one_way_anova", { ...options, paired: true }).join(" ");
  assert.match(friedman, /Friedman: P uses a tie-corrected chi-square approximation/);
  assert.match(friedman, /Incomplete rows are refused/);
  assert.match(friedman, /untied reference formula and is not reduced for ties/);
  assert.doesNotMatch(friedman, /P values with tie corrections/);
  assert.match(comparisonOptionsProblem("one_way_anova", { ...options, paired: true }, 2), /at least three matched columns/);
});

test("comparison disclosures distinguish RM error terms, unadjusted LSD and independent CI levels", () => {
  const options = { ...defaultComparisonOptions, paired: true, method: "bonferroni" as const };
  assert.match(comparisonDisclosures("one_way_anova", options).join(" "), /each pair's differences/);
  assert.match(comparisonDisclosures("one_way_anova", { ...options, sphericity: "assume" }).join(" "), /pooled ANOVA residual/);
  assert.match(comparisonDisclosures("one_way_anova", { ...options, method: "fisher" }).join(" "), /does not control familywise error/);
  assert.match(comparisonDisclosures("one_way_anova", { ...options, alpha: 0.01 }).join(" "), /confidence intervals remain 95%/);
});

test("bracket context identifies correction and the number of comparisons in the family", () => {
  assert.match(pairwiseMethodDescription("one_way_anova", { ...defaultComparisonOptions, method: "bonferroni" }, 4), /Bonferroni; 6 comparisons \(all pairs\).*Family-adjusted P/);
  assert.match(pairwiseMethodDescription("one_way_anova", { ...defaultComparisonOptions, comparisons: "vs_control", method: "dunnett" }, 4), /Dunnett; 3 comparisons/);
  assert.match(pairwiseMethodDescription("one_way_anova", { ...defaultComparisonOptions, method: "fisher" }, 4), /Unadjusted P/);
  assert.match(pairwiseMethodDescription("t_test", { ...defaultComparisonOptions, gaussian: false }, 2), /Exact or approximate calculation and tie handling/);
  assert.match(pairwiseMethodDescription("one_way_anova", { ...defaultComparisonOptions, gaussian: false, method: "dunn" }, 3), /Approximate normal P values from pooled ranks with a tie-corrected standard error/);
  assert.match(pairwiseMethodDescription("one_way_anova", { ...defaultComparisonOptions, gaussian: false, paired: true, method: "dunn" }, 3), /standard error is not reduced for ties/);
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
    { ...defaultComparisonOptions, alternative: "choose_after_observation" },
    (({ alpha: _alpha, ...rest }) => rest)(defaultComparisonOptions),
  ])
    assert.throws(() => parseComparisonOptions(bad));
});

test("older saved options migrate without silently choosing a one-sided hypothesis", () => {
  const { alternative: _alternative, ...legacy } = { ...defaultComparisonOptions, tails: 1 as const };
  const migrated = parseComparisonOptions(legacy);
  assert.equal(migrated.alternative, null);
  assert.match(comparisonOptionsProblem("t_test", migrated, 2), /prespecified direction/);
});
