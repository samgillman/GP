import { palette } from "./data.ts";

/**
 * Dataset membership and order for one graph, with each dataset's color kept
 * with that dataset through every operation.
 *
 * Storage stays positional (`graph.colors[position]`), so these helpers first
 * expand the cycling color list to one explicit entry per plotted dataset and
 * then permute both arrays together. The first listed dataset is the front
 * dataset: the shipped Format Graph resource labels the list "Data sets
 * plotted (front to back)" and states that higher datasets draw in front of
 * lower ones. Honoring that in GP's renderer is a GP decision informed by that
 * resource text, not an observed Prism runtime comparison.
 */
export type DatasetArrangement = { columnIndices: number[]; colors: string[] };
export type ReorderOperation = "top" | "up" | "down" | "bottom";

/** Colors beyond this count keep the historical cycling behavior unchanged. */
export const MAX_EXPLICIT_COLORS = 32;

export function datasetColor(colors: string[], position: number): string {
  return colors[position % (colors.length || 1)] ?? palette[position % palette.length];
}

/** One explicit color per plotted dataset, derived from the current cycle. */
export function explicitColors(arrangement: DatasetArrangement): string[] {
  const count = arrangement.columnIndices.length;
  if (count > MAX_EXPLICIT_COLORS) return [...arrangement.colors];
  return Array.from({ length: count }, (_, position) => datasetColor(arrangement.colors, position));
}

function withColors(arrangement: DatasetArrangement): DatasetArrangement {
  return { columnIndices: [...arrangement.columnIndices], colors: explicitColors(arrangement) };
}

function permute(arrangement: DatasetArrangement, order: number[]): DatasetArrangement {
  const next = withColors(arrangement);
  if (next.colors.length !== next.columnIndices.length) {
    // Too many datasets for explicit colors: positions keep cycling colors.
    return { columnIndices: order.map((i) => next.columnIndices[i]), colors: next.colors };
  }
  return {
    columnIndices: order.map((i) => next.columnIndices[i]),
    colors: order.map((i) => next.colors[i]),
  };
}

/** Moves the dataset at `position`; returns the arrangement and its new position. */
export function reorderDataset(
  arrangement: DatasetArrangement,
  position: number,
  operation: ReorderOperation,
): { arrangement: DatasetArrangement; position: number } {
  const count = arrangement.columnIndices.length;
  if (position < 0 || position >= count) return { arrangement, position };
  const target =
    operation === "top" ? 0
    : operation === "bottom" ? count - 1
    : operation === "up" ? Math.max(0, position - 1)
    : Math.min(count - 1, position + 1);
  if (target === position) return { arrangement, position };
  const order = Array.from({ length: count }, (_, i) => i);
  order.splice(position, 1);
  order.splice(target, 0, position);
  return { arrangement: permute(arrangement, order), position: target };
}

export function reverseDatasets(arrangement: DatasetArrangement): DatasetArrangement {
  const count = arrangement.columnIndices.length;
  return permute(arrangement, Array.from({ length: count }, (_, i) => count - 1 - i));
}

export function removeDataset(arrangement: DatasetArrangement, position: number): DatasetArrangement {
  const count = arrangement.columnIndices.length;
  if (position < 0 || position >= count) return arrangement;
  return permute(arrangement, Array.from({ length: count }, (_, i) => i).filter((i) => i !== position));
}

/** Appends datasets at the back with the next unused cycle colors. */
export function addDatasets(arrangement: DatasetArrangement, indices: number[]): DatasetArrangement {
  const next = withColors(arrangement);
  const fresh = indices.filter((index, i) => !next.columnIndices.includes(index) && indices.indexOf(index) === i);
  if (!fresh.length) return arrangement;
  const columnIndices = [...next.columnIndices, ...fresh];
  if (columnIndices.length > MAX_EXPLICIT_COLORS) return { columnIndices, colors: [...arrangement.colors] };
  const colors = [...next.colors];
  while (colors.length < columnIndices.length) colors.push(datasetColor(arrangement.colors, colors.length));
  return { columnIndices, colors };
}

export function setDatasetColor(arrangement: DatasetArrangement, position: number, color: string): DatasetArrangement {
  const next = withColors(arrangement);
  if (position < 0 || position >= next.columnIndices.length) return arrangement;
  if (next.colors.length !== next.columnIndices.length) {
    const colors = [...next.colors];
    while (colors.length <= position) colors.push(datasetColor(arrangement.colors, colors.length));
    colors[position] = color;
    return { columnIndices: next.columnIndices, colors };
  }
  next.colors[position] = color;
  return next;
}
