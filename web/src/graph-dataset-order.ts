import { palette } from "./data.ts";
import type { Project } from "./data.ts";

/** The renderer draws persisted indices from first to last. The UI lists the
 * frontmost observations first, so presentation reverses that storage order. */
export function frontToBackDatasets(indices: readonly number[]): number[] {
  return [...indices].reverse();
}

export type DatasetOrderAction = "top" | "up" | "down" | "bottom" | "reverse";

/** Reorder observations without changing the persisted order convention. */
export function reorderGraphDatasets(
  indices: readonly number[],
  selected: number | null,
  action: DatasetOrderAction,
): number[] {
  if (action === "reverse") return [...indices].reverse();
  const displayed = frontToBackDatasets(indices);
  const position = selected === null ? -1 : displayed.indexOf(selected);
  if (position < 0) return [...indices];
  const destination =
    action === "top" ? 0 :
    action === "bottom" ? displayed.length - 1 :
    Math.max(0, Math.min(displayed.length - 1, position + (action === "up" ? -1 : 1)));
  displayed.splice(position, 1);
  displayed.splice(destination, 0, selected!);
  return displayed.reverse();
}

/** Column uses physical left-to-right order, not XY's front-to-back order. */
export function reorderColumnGraphDatasets(
  indices: readonly number[],
  selected: number | null,
  action: DatasetOrderAction,
): number[] {
  if (action === "reverse") return [...indices].reverse();
  const next = [...indices], position = selected === null ? -1 : next.indexOf(selected);
  if (position < 0) return next;
  const destination = action === "top" ? 0 :
    action === "bottom" ? next.length - 1 :
    Math.max(0, Math.min(next.length - 1, position + (action === "up" ? -1 : 1)));
  next.splice(position, 1);
  next.splice(destination, 0, selected!);
  return next;
}

/** Resolve persisted source identities, never substituting a dataset name or
 * a mutable column position for a missing ID. Workbook parsing validates the
 * complete source; these checks protect direct helper callers as well. */
function selectedDatasetIds(project: Project, indices: readonly number[]): string[] {
  const seen = new Set<string>();
  return indices.map(index => {
    if (!Number.isInteger(index) || index < (project.table_type === "xy" ? 1 : 0) || index >= project.columns.length)
      throw new Error("Invalid dataset selection for graph colors.");
    const id = project.columns[index].id;
    if (typeof id !== "string" || !id.length || id.length > 200 || seen.has(id))
      throw new Error("Graph colors require unique, valid dataset IDs.");
    seen.add(id);
    return id;
  });
}

/** Capture the currently rendered positional colors under stable source IDs.
 * Active graph.colors wins over older metadata. Entries for unplotted datasets
 * remain available for later re-addition; the workbook owns source pruning. */
export function seedDatasetColors(
  project: Project,
  indices: readonly number[],
  colors: readonly string[],
  remembered: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const next = new Map(Object.entries(remembered));
  selectedDatasetIds(project, indices).forEach((id, position) => {
    next.set(id, colors[position % colors.length] || palette[position % palette.length]);
  });
  // Object.fromEntries defines own data properties even for IDs such as
  // "__proto__"; ordinary object assignment would invoke its legacy setter.
  return Object.fromEntries(next);
}

/** Project stable-ID colors into the existing browser/export positional array.
 * Never-plotted datasets use their source-column palette color. Once assigned,
 * that color is remembered even if the source is subsequently renamed/moved. */
export function colorsForDatasetIds(
  project: Project,
  indices: readonly number[],
  remembered: Readonly<Record<string, string>>,
): { colors: string[]; datasetColors: Record<string, string> } {
  const next = new Map(Object.entries(remembered));
  const offset = project.table_type === "xy" ? 1 : 0;
  const colors = selectedDatasetIds(project, indices).map((id, position) => {
    const color = next.get(id) ?? palette[(indices[position] - offset) % palette.length];
    next.set(id, color);
    return color;
  });
  return { colors, datasetColors: Object.fromEntries(next) };
}
