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
      all_pairs: ["tukey", "bonferroni", "sidak", "fisher"],
      vs_control: ["sidak", "bonferroni", "fisher"],
    };
  if (!options.equal_sd) return { all_pairs: ["games_howell"] };
  return {
    all_pairs: ["tukey", "bonferroni", "sidak", "fisher"],
    vs_control: ["dunnett", "bonferroni", "sidak", "fisher"],
  };
}

/** Keep the comparison design and method valid for the chosen test. */
export function normalizeComparisonOptions(
  options: ComparisonOptions,
  datasets: number,
): ComparisonOptions {
  const choices = comparisonChoices(options);
  const comparisons =
    options.comparisons !== "none" && !choices[options.comparisons]
      ? "all_pairs"
      : options.comparisons;
  const allowed = comparisons === "none" ? [] : (choices[comparisons] ?? []);
  return {
    ...options,
    comparisons,
    control: Math.min(Math.max(0, options.control), Math.max(0, datasets - 1)),
    method:
      comparisons === "none"
        ? null
        : options.method && allowed.includes(options.method)
          ? options.method
          : allowed[0],
  };
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
    !keys.every((key) => key in o) ||
    typeof o.paired !== "boolean" ||
    typeof o.gaussian !== "boolean" ||
    typeof o.equal_sd !== "boolean" ||
    typeof o.reverse_difference !== "boolean" ||
    !["geisser_greenhouse", "assume"].includes(o.sphericity as string) ||
    ![1, 2].includes(o.tails as number) ||
    !["none", "all_pairs", "vs_control"].includes(o.comparisons as string) ||
    !Number.isInteger(o.control) ||
    (o.control as number) < 0 ||
    (o.control as number) > 29 ||
    (o.method !== null && !Object.hasOwn(methodLabels, String(o.method))) ||
    typeof o.alpha !== "number" ||
    !(o.alpha > 0 && o.alpha < 0.5)
  )
    throw new Error("Invalid analysis parameters.");
  return o as unknown as ComparisonOptions;
}
