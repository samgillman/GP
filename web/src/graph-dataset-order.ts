import { palette } from "./data.ts";

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

/** Keep graph-local styles attached to source indices while this dialog is
 * open. This is ephemeral memory, not a new persisted workbook field. */
export function rememberDatasetColors(
  remembered: ReadonlyMap<number, string>,
  indices: readonly number[],
  colors: readonly string[],
): Map<number, string> {
  const next = new Map(remembered);
  indices.forEach((source, position) => {
    next.set(source, colors[position % colors.length] || palette[position % palette.length]);
  });
  return next;
}

/** Materialize positional graph colors from source identity. New XY datasets
 * receive their source-column palette color, independent of insertion order. */
export function colorsForDatasetOrder(
  remembered: ReadonlyMap<number, string>,
  indices: readonly number[],
): { colors: string[]; remembered: Map<number, string> } {
  const next = new Map(remembered);
  const colors = indices.map(source => {
    const color = next.get(source) ?? palette[Math.max(0, source - 1) % palette.length];
    next.set(source, color);
    return color;
  });
  return { colors, remembered: next };
}
