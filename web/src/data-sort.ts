import { numeric } from "./data.ts";
import type { Project } from "./data.ts";

/** Edit › Sort by X Value and Reverse Row Order, as in Prism. Whole rows move
 * together and keep their row IDs, so exclusions and links follow the values. */
export function reorderRows(
  project: Project,
  rowIds: readonly string[],
  order: readonly number[],
): { project: Project; rowIds: string[] } {
  if (order.length !== rowIds.length || new Set(order).size !== order.length || order.some((i) => !(i >= 0 && i < rowIds.length)))
    throw new Error("A row order must list every row once.");
  return {
    project: {
      ...project,
      columns: project.columns.map((column) => ({
        ...column,
        values: order.map((row) => column.values[row] ?? ""),
      })),
    },
    rowIds: order.map((row) => rowIds[row]),
  };
}

/** Rows ordered by their X value, smallest first. Rows without a numeric X
 * keep their relative order after the sorted rows, as blanks do in Prism. */
export function xValueOrder(project: Project, rowCount: number): number[] {
  if (project.table_type !== "xy") throw new Error("Sort by X Value needs an XY data table.");
  const x = project.columns[0]?.values ?? [];
  const keyed = Array.from({ length: rowCount }, (_, row) => {
    let value: number | null = null;
    try {
      value = numeric(x[row] ?? "");
    } catch {
      value = null;
    }
    return { row, value };
  });
  const numbered = keyed.filter((k) => k.value !== null).sort((a, b) => a.value! - b.value! || a.row - b.row);
  return [...numbered, ...keyed.filter((k) => k.value === null)].map((k) => k.row);
}

export function reversedOrder(rowCount: number): number[] {
  return Array.from({ length: rowCount }, (_, row) => rowCount - 1 - row);
}
