/** Parameters for t tests and one-way ANOVA; mirrors gp/models.py ComparisonOptions
 * and the method rules in gp/column_tests.py. */
export type ComparisonAnalysis = "t_test" | "one_way_anova";
export type ComparisonMethod =
  | "tukey"
  | "bonferroni"
  | "sidak"
  | "fisher"
  | "dunnett"
  | "games_howell"
  | "dunn";
export type ComparisonOptions = {
  paired: boolean;
  gaussian: boolean;
  equal_sd: boolean;
  sphericity: "geisser_greenhouse" | "assume";
  tails: 1 | 2;
  alternative: "a_greater" | "b_greater" | null;
  reverse_difference: boolean;
  comparisons: "none" | "all_pairs" | "vs_control";
  control: number;
  method: ComparisonMethod | null;
  alpha: number;
};
export const defaultComparisonOptions: ComparisonOptions = {
  paired: false,
  gaussian: true,
  equal_sd: true,
  sphericity: "geisser_greenhouse",
  tails: 2,
  alternative: null,
  reverse_difference: false,
  comparisons: "all_pairs",
  control: 0,
  method: null,
  alpha: 0.05,
};
export const methodLabels: Record<ComparisonMethod, string> = {
  tukey: "Tukey",
  bonferroni: "Bonferroni",
  sidak: "Šídák",
  fisher: "Fisher's LSD (no correction for multiple comparisons)",
  dunnett: "Dunnett",
  games_howell: "Games-Howell",
  dunn: "Dunn's",
};

export function isComparisonAnalysis(
  analysis: string,
): analysis is ComparisonAnalysis {
  return analysis === "t_test" || analysis === "one_way_anova";
}

/** Multiple-comparison designs GP offers; the first method is the default. */
export function comparisonChoices(
  options: ComparisonOptions,
): Partial<Record<"all_pairs" | "vs_control", ComparisonMethod[]>> {
  if (!options.gaussian) return { all_pairs: ["dunn"], vs_control: ["dunn"] };
  if (options.paired)
    return {
      all_pairs: options.sphericity === "assume"
        ? ["tukey", "bonferroni", "sidak", "fisher"]
        : ["bonferroni", "sidak", "fisher"],
      vs_control: ["bonferroni", "sidak", "fisher"],
    };
  if (!options.equal_sd) return { all_pairs: ["games_howell"] };
  return {
    all_pairs: ["tukey", "bonferroni", "sidak", "fisher"],
    vs_control: ["dunnett", "bonferroni", "sidak", "fisher"],
  };
}

/** Resolve an unspecified method without replacing an explicit scientific choice.
 * Unsupported saved settings stay visible and must be corrected by the user. */
export function normalizeComparisonOptions(
  options: ComparisonOptions,
  _datasets: number,
): ComparisonOptions {
  const choices = comparisonChoices(options);
  const comparisons = options.comparisons;
  const allowed = comparisons === "none" ? [] : (choices[comparisons] ?? []);
  return {
    ...options,
    alternative: options.alternative ?? null,
    comparisons,
    method:
      comparisons === "none"
        ? null
        : options.method ?? allowed[0] ?? null,
  };
}

/** Invalid designs must never be silently converted to a different test/family. */
export function comparisonOptionsProblem(
  analysis: ComparisonAnalysis,
  options: ComparisonOptions,
  datasets: number,
): string {
  if (analysis === "t_test") {
    if (datasets !== 2)
      return `t tests compare exactly two data sets; ${datasets} are selected.`;
    return options.tails === 1 && !options.alternative
      ? "A one-tailed test requires a prespecified direction on the Options page. The direction is independent of how the difference is displayed."
      : "";
  }
  if (datasets < 2) return "One-way ANOVA needs at least two data sets.";
  if (options.paired && !options.gaussian && datasets < 3)
    return "Friedman requires at least three matched columns. For two columns, choose a paired test from the t tests family.";
  if (options.comparisons === "none") return "";
  const allowed = comparisonChoices(options)[options.comparisons];
  if (!allowed)
    return "This design does not support comparisons against a control. Choose every pair or no multiple comparisons; GP will not substitute a different comparison family.";
  if (options.comparisons === "vs_control" && options.control >= datasets)
    return "The selected control column is unavailable. Select a control on the Multiple Comparisons page.";
  if (options.method !== null && !allowed.includes(options.method))
    return `${methodLabels[options.method]} is not supported for this design. Choose an available test on the Options page; the saved method has not been replaced.`;
  return "";
}

/** Scientific scope is shown before calculation, not only in repository docs. */
export function comparisonDisclosures(
  analysis: ComparisonAnalysis,
  options: ComparisonOptions,
): string[] {
  const notes = [
    "GP uses independent statistical implementations. Numerical validation does not establish GraphPad Prism equivalence; native comparison is limited to one paired t test example.",
  ];
  if (!options.gaussian) {
    if (analysis === "t_test")
      notes.push(options.paired
        ? "Wilcoxon: zero differences are discarded (Pratt handling is unsupported). Tied absolute differences or more than 50 nonzero pairs use a normal approximation, which may be inaccurate for small samples. Exact P with ties is unsupported."
        : "Mann–Whitney: exact P is used only without ties and with at most 50 values in each column. Otherwise GP uses a normal approximation with tie and continuity corrections. This differs from Prism's documented exact-P handling, including tied small samples.");
    else
      notes.push(options.paired
        ? "Friedman: P uses a tie-corrected chi-square approximation. Small samples can give a different significance conclusion from an exact test. GP does not compute Prism's documented small-sample exact P values."
        : "Kruskal–Wallis: P uses a tie-corrected chi-square approximation. With fewer than five observations in any group, the approximation can be unreliable. GP does not compute Prism's documented exact P values.");
  }
  if (options.paired)
    notes.push(analysis === "t_test"
      ? "Rows define matched subjects; paired analyses exclude rows missing either value. Review missing and excluded observations before analysis."
      : "Rows define matched subjects. Incomplete rows are refused for repeated-measures ANOVA and Friedman. GP does not silently discard subjects or substitute a mixed-effects model; mixed effects are unsupported.");
  if (analysis === "one_way_anova") {
    notes.push("Mixed-effects models, selected-pair families, Holm–Šídák, FDR, Newman–Keuls, Dunnett T3 and Tamhane T2 are unsupported.");
    if (options.comparisons !== "none") {
      if (!options.gaussian)
        notes.push(options.paired
          ? "Friedman/Dunn comparisons rank within each subject and use approximate normal P values with Bonferroni adjustment over the requested comparison family. The rank-sum standard error uses the untied reference formula and is not reduced for ties. Native Prism output is still needed to validate this convention."
          : "Kruskal–Wallis/Dunn comparisons use pooled ranks, a tie-corrected standard error, and approximate normal P values with Bonferroni adjustment over the requested comparison family. They are not exact tests.");
      else if (options.paired)
        notes.push(options.sphericity === "assume"
          ? "Repeated-measures comparisons assume sphericity and use the pooled ANOVA residual variance and degrees of freedom. Native Prism comparison output is still needed."
          : "Repeated-measures comparisons use each pair's differences and n − 1 degrees of freedom. The Geisser–Greenhouse correction applies to the omnibus ANOVA, not these paired comparisons. Tukey with this variance model is unsupported; native Prism comparison output is still needed.");
      if (options.method === "fisher")
        notes.push("Fisher's LSD reports unadjusted P values and individual confidence intervals. It does not control familywise error over all requested comparisons, and GP does not require a significant omnibus test first.");
      if (options.method === "games_howell")
        notes.push("Games–Howell compares every pair using separate variances and approximate degrees of freedom. Prism's recommended small-sample alternative, Dunnett T3, and control-only comparisons are unsupported for unequal-SD ANOVA.");
    }
  }
  if (analysis === "t_test" && options.tails === 1)
    notes.push("Choose the directional hypothesis before seeing the data. One-tailed P uses that direction even when the observed effect is opposite; reversing the reported difference does not change the hypothesis. Confidence intervals remain two-sided 95% and need not agree with the one-tailed significance decision. Use a two-tailed test if direction was not prespecified.");
  if (options.alpha !== 0.05)
    notes.push(`Significance decisions use alpha = ${options.alpha}; confidence intervals remain 95% and asterisks retain fixed 0.05/0.01/0.001/0.0001 thresholds. A star or an interval excluding zero need not mean significance at the selected alpha.`);
  return notes;
}

/** Asterisks have fixed thresholds; hiding nonsignificant pairs uses analysis alpha. */
export function showPairwiseComparison(p: number, showNs: boolean, alpha: number): boolean {
  return Number.isFinite(p) && p >= 0 && p <= 1 && (showNs || p < alpha);
}

export function pairwiseMethodDescription(
  analysis: ComparisonAnalysis,
  options: ComparisonOptions,
  datasets: number,
): string {
  const threshold = `Decisions and hiding non-significant pairs use P < ${options.alpha}.`;
  if (analysis === "t_test")
    return `${testName(analysis, options)}; ${options.tails === 2 ? "two-tailed" : `one-tailed (${options.alternative === "a_greater" ? "A > B" : options.alternative === "b_greater" ? "B > A" : "direction required"})`} P for one pair, without a multiple-comparison adjustment. ${threshold}${options.gaussian ? "" : " Exact or approximate calculation and tie handling: see the linked results before exporting."}`;
  if (options.comparisons === "none")
    return "No pairwise comparisons were requested for this analysis. Change its parameters to calculate comparisons.";
  const method = options.method ?? comparisonChoices(options)[options.comparisons]?.[0];
  const count = options.comparisons === "all_pairs" ? datasets * (datasets - 1) / 2 : datasets - 1;
  const family = options.comparisons === "all_pairs" ? "all pairs" : "pairs against the selected control";
  const rankScope = method !== "dunn" ? "" : options.paired
    ? " Approximate normal P values from within-subject ranks; the standard error is not reduced for ties. Review the linked results before exporting."
    : " Approximate normal P values from pooled ranks with a tie-corrected standard error. Review the linked results before exporting.";
  return `${method ? methodLabels[method] : "Unsupported method"}; ${count} comparisons (${family}). ${method === "fisher" ? "Unadjusted" : "Family-adjusted"} P values. ${threshold}${rankScope}`;
}

export function testName(
  analysis: ComparisonAnalysis,
  options: ComparisonOptions,
): string {
  if (analysis === "t_test") {
    if (options.paired)
      return options.gaussian
        ? "Paired t test"
        : "Wilcoxon matched-pairs signed rank test";
    if (!options.gaussian) return "Mann-Whitney test";
    return options.equal_sd ? "Unpaired t test" : "Welch's t test";
  }
  if (options.paired)
    return options.gaussian
      ? "Repeated measures one-way ANOVA"
      : "Friedman test";
  if (!options.gaussian) return "Kruskal-Wallis test";
  return options.equal_sd
    ? "Ordinary one-way ANOVA"
    : "Brown-Forsythe and Welch ANOVA";
}

/** Validates persisted options; unknown keys or values reject the workbook. */
export function parseComparisonOptions(value: unknown): ComparisonOptions {
  const o = value as Record<string, unknown>;
  const keys = Object.keys(defaultComparisonOptions);
  if (
    !o ||
    typeof o !== "object" ||
    Array.isArray(o) ||
    Object.keys(o).some((key) => !keys.includes(key)) ||
    !keys.every((key) => key === "alternative" || key in o) ||
    typeof o.paired !== "boolean" ||
    typeof o.gaussian !== "boolean" ||
    typeof o.equal_sd !== "boolean" ||
    typeof o.reverse_difference !== "boolean" ||
    !["geisser_greenhouse", "assume"].includes(o.sphericity as string) ||
    ![1, 2].includes(o.tails as number) ||
    (o.alternative !== undefined && o.alternative !== null &&
      !["a_greater", "b_greater"].includes(o.alternative as string)) ||
    !["none", "all_pairs", "vs_control"].includes(o.comparisons as string) ||
    !Number.isInteger(o.control) ||
    (o.control as number) < 0 ||
    (o.control as number) > 29 ||
    (o.method !== null && !Object.hasOwn(methodLabels, String(o.method))) ||
    typeof o.alpha !== "number" ||
    !(o.alpha > 0 && o.alpha < 0.5)
  )
    throw new Error("Invalid analysis parameters.");
  return { ...o, alternative: o.alternative ?? null } as unknown as ComparisonOptions;
}
