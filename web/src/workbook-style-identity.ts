import type { Graph } from "./data.ts";

/** Copy appearance into a new dataset identity namespace, without sharing the
 * mutable style objects. Unknown historical IDs cannot be assigned by position.
 */
export function remapDatasetStyleIds(graph: Graph, identities: ReadonlyMap<string, string>): Graph {
  if (graph.dataset_styles === undefined) return graph;
  return {
    ...graph,
    dataset_styles: Object.fromEntries(
      Object.entries(graph.dataset_styles).flatMap(([source, style]) => {
        const target = identities.get(source);
        return target === undefined ? [] : [[target, { ...style }]];
      }),
    ),
  };
}

/** Keep every surviving source ID, including an omitted dataset or a column
 * currently serving as XY X. Only real source deletion removes its appearance.
 * Frozen graphs must pass their captured columns until they are thawed.
 */
export function retainDatasetStyles(graph: Graph, columns: readonly { id?: string }[]): Graph {
  if (graph.dataset_styles === undefined) return graph;
  const allowed = new Set(columns.map(column => column.id));
  const entries = Object.entries(graph.dataset_styles);
  if (entries.every(([uid]) => allowed.has(uid))) return graph;
  return {
    ...graph,
    dataset_styles: Object.fromEntries(entries.filter(([uid]) => allowed.has(uid))),
  };
}
