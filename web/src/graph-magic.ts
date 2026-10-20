import type { Graph } from "./data.ts";

/** Change > Magic (make graphs consistent): which parts of the source graph's
 * formatting to copy. Data, titles and the linked analysis are never copied. */
export type MagicParts = {
  appearance: boolean;
  colors: boolean;
  axes: boolean;
};

/** Copy formatting from `source` onto `target`. Per-data-set styles and colors
 * are matched by position on the graph, as Prism does. Axis settings are copied
 * only between graphs of the same kind (both XY or both column). */
export function makeGraphConsistent(
  target: Graph,
  source: Graph,
  targetIds: readonly string[],
  sourceIds: readonly string[],
  parts: MagicParts,
  sameKind: boolean,
): Graph {
  let next: Graph = { ...target };
  if (parts.appearance) {
    next = {
      ...next,
      type: sameKind ? source.type : target.type,
      error: source.error,
      show_points: source.show_points,
      ...(source.show_legend === undefined ? {} : { show_legend: source.show_legend }),
      ...(source.column_space_percent === undefined ? {} : { column_space_percent: source.column_space_percent }),
      ...(source.pairwise && target.pairwise ? { pairwise: { ...source.pairwise } } : {}),
    };
    const styles = { ...(target.dataset_styles ?? {}) };
    targetIds.forEach((id, position) => {
      const from = sourceIds[position % Math.max(1, sourceIds.length)];
      const style = from === undefined ? undefined : source.dataset_styles?.[from];
      if (style) styles[id] = parts.colors ? { ...style } : withoutColors(style, styles[id]);
      else delete styles[id];
    });
    next.dataset_styles = styles;
  }
  if (parts.colors && source.colors.length)
    next.colors = targetIds.map((_, position) => source.colors[position % source.colors.length]);
  if (parts.axes && sameKind && source.axes) next.axes = structuredClone(source.axes);
  return next;
}

function withoutColors(
  style: NonNullable<Graph["dataset_styles"]>[string],
  previous: NonNullable<Graph["dataset_styles"]>[string] | undefined,
) {
  const { fill: _f, symbol_color: _s, error_color: _e, ...rest } = style;
  return {
    ...rest,
    ...(previous?.fill ? { fill: previous.fill } : {}),
    ...(previous?.symbol_color ? { symbol_color: previous.symbol_color } : {}),
    ...(previous?.error_color ? { error_color: previous.error_color } : {}),
  };
}
