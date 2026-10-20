import type { Response } from "./data.ts";

// Matches analyze_column_comparison in gp/statistics.py. Missing means the
// pre-audit engine; old results need new calculations, not a new version label.
export const COLUMN_ANALYSIS_REVISION = 2;

export function isHistoricalColumnOutput(
  output: Response | null | undefined,
): boolean {
  return !!output &&
    (output.analysis === "t_test" || output.analysis === "one_way_anova") &&
    output.analysis_revision !== COLUMN_ANALYSIS_REVISION;
}
