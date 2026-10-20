import type { Project } from "./data.ts";
import type { GraphSheet } from "./workbook.ts";
import { colorsForDatasetIds, seedDatasetColors } from "./graph-dataset-order.ts";

/** Graph-local memory, not part of the numerical/graph API payload.
 * Positional colors remain authoritative for currently displayed datasets.
 */
export function validateGraphDatasetColors(project: Project, sheet: GraphSheet): void {
  const value = sheet.datasetColors;
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid graph dataset color memory.");
  const allowed = new Set(project.columns.map(column => column.id));
  const entries = Object.entries(value);
  if (entries.length > project.columns.length || entries.some(([id, color]) =>
    !allowed.has(id) || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)))
    throw new Error("Graph dataset colors must reference existing source dataset IDs and six-digit hex colors.");
}

/** Absent legacy metadata stays absent until editing needs persistent memory. */
export function normalizeGraphDatasetColors(project: Project, sheet: GraphSheet): GraphSheet {
  if (sheet.datasetColors === undefined) return sheet;
  validateGraphDatasetColors(project, sheet);
  return {
    ...sheet,
    datasetColors: seedDatasetColors(project, sheet.columnIndices, sheet.graph.colors, sheet.datasetColors),
  };
}

/** Capture colors before a structural remap, then project them by stable ID.
 * Frozen callers supply the captured project as previous and live source as next.
 */
export function remapGraphDatasetColors(
  previous: Project,
  next: Project,
  sheet: GraphSheet,
  indices: readonly number[],
): Pick<GraphSheet, "graph" | "datasetColors"> {
  const nextIds = indices.map(index => next.columns[index].id);
  const sameSelection = JSON.stringify(nextIds) === JSON.stringify(sheet.datasetIds);
  if (sheet.datasetColors === undefined && sameSelection) return { graph: sheet.graph };
  const remembered = seedDatasetColors(previous, sheet.columnIndices, sheet.graph.colors, sheet.datasetColors);
  const allowed = new Set(next.columns.map(column => column.id));
  const pruned = Object.fromEntries(Object.entries(remembered).filter(([id]) => allowed.has(id)));
  if (sameSelection) return { graph: sheet.graph, datasetColors: pruned };
  const projected = colorsForDatasetIds(next, indices, pruned);
  return { graph: { ...sheet.graph, colors: projected.colors }, datasetColors: projected.datasetColors };
}
