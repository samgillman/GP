import type { Graph } from "./data.ts";

/** Per-data-set appearance from Format Graph > Appearance. Every field is
 * optional: an unset field follows the data set's color and the graph-wide
 * settings, so legacy graphs keep drawing from `graph.colors` alone. */
export const SYMBOL_SHAPES = ["circle", "square", "triangle", "diamond"] as const;
export type SymbolShape = (typeof SYMBOL_SHAPES)[number];
/** "T" draws a cap at the end of each error bar; "I" draws the line only. */
export const ERROR_CAPS = ["T", "I"] as const;
export type ErrorCap = (typeof ERROR_CAPS)[number];
export const ERROR_DIRECTIONS = ["above", "below", "both"] as const;
export type ErrorDirection = (typeof ERROR_DIRECTIONS)[number];
/** Line weights offered in points. */
export const LINE_WEIGHTS = [0.25, 0.5, 1, 1.5, 2, 3, 4] as const;
export const SYMBOL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type DatasetStyle = {
  fill?: string;
  pattern?: boolean;
  border_width?: number;
  symbols?: boolean;
  symbol_color?: string;
  symbol_shape?: SymbolShape;
  symbol_size?: number;
  error_bars?: boolean;
  error_color?: string;
  error_cap?: ErrorCap;
  error_direction?: ErrorDirection;
  error_width?: number;
  line_width?: number;
};
/** A complete style; `color` is the data set's own color (its border/line). */
export type ResolvedDatasetStyle = Required<DatasetStyle> & { color: string };

const HEX = /^#[0-9a-f]{6}$/i;
const STYLE_KEYS: Record<keyof DatasetStyle, (value: unknown) => boolean> = {
  fill: (v) => typeof v === "string" && HEX.test(v),
  pattern: (v) => typeof v === "boolean",
  border_width: (v) => LINE_WEIGHTS.includes(v as never),
  symbols: (v) => typeof v === "boolean",
  symbol_color: (v) => typeof v === "string" && HEX.test(v),
  symbol_shape: (v) => SYMBOL_SHAPES.includes(v as never),
  symbol_size: (v) => SYMBOL_SIZES.includes(v as never),
  error_bars: (v) => typeof v === "boolean",
  error_color: (v) => typeof v === "string" && HEX.test(v),
  error_cap: (v) => ERROR_CAPS.includes(v as never),
  error_direction: (v) => ERROR_DIRECTIONS.includes(v as never),
  error_width: (v) => LINE_WEIGHTS.includes(v as never),
  line_width: (v) => LINE_WEIGHTS.includes(v as never),
};

/** Mix a #rrggbb color with white; `amount` is the share of the color kept. */
export function tint(color: string, amount = 0.2): string {
  if (!HEX.test(color)) return color;
  return (
    "#" +
    [1, 3, 5]
      .map((start) => {
        const channel = parseInt(color.slice(start, start + 2), 16);
        return Math.round(255 - (255 - channel) * amount)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export function defaultDatasetStyle(
  graph: Pick<Graph, "type" | "error" | "show_points">,
  color: string,
): ResolvedDatasetStyle {
  return {
    color,
    fill: tint(color),
    pattern: false,
    border_width: 2,
    symbols: graph.show_points || graph.type === "scatter",
    symbol_color: color,
    symbol_shape: "circle",
    symbol_size: 3,
    error_bars: graph.error !== "none",
    error_color: color,
    error_cap: "T",
    error_direction: graph.type === "bar" ? "above" : "both",
    error_width: 1,
    line_width: 1,
  };
}

export function resolveDatasetStyle(
  graph: Pick<Graph, "type" | "error" | "show_points">,
  color: string,
  style: DatasetStyle | undefined,
): ResolvedDatasetStyle {
  const resolved = defaultDatasetStyle(graph, color);
  if (!style) return resolved;
  for (const key of Object.keys(STYLE_KEYS) as (keyof DatasetStyle)[])
    if (style[key] !== undefined) (resolved as Record<string, unknown>)[key] = style[key];
  return resolved;
}

/** Styles for the plotted columns, in drawing order. XY skips the X column. */
export function plottedDatasetStyles(
  graph: Graph,
  columns: readonly { id?: string }[],
  xy: boolean,
  palette: readonly string[],
): ResolvedDatasetStyle[] {
  return columns.slice(xy ? 1 : 0).map((column, index) =>
    resolveDatasetStyle(
      graph,
      graph.colors[index % graph.colors.length] || palette[index % palette.length],
      column.id === undefined ? undefined : graph.dataset_styles?.[column.id],
    ),
  );
}

export function validDatasetStyle(value: unknown): value is DatasetStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, field]) =>
      Object.hasOwn(STYLE_KEYS, key) &&
      STYLE_KEYS[key as keyof DatasetStyle](field),
  );
}

/** Saved styles are keyed by stable source data-set IDs, like datasetColors. */
export function validDatasetStyles(
  value: unknown,
): value is Record<string, DatasetStyle> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 1000 &&
    entries.every(
      ([id, style]) => id.length > 0 && id.length <= 200 && validDatasetStyle(style),
    )
  );
}

/** Line weight in points to graph-page pixels at 100% zoom. */
export const ptToPx = (points: number) => points * 1.1;
/** Symbol radius in CSS pixels for a Format Graph symbol size. */
export const symbolRadius = (size: number) => size + 0.2;

/** SVG path for a symbol centered at (0, 0), drawn with fill only. */
export function symbolPath(shape: SymbolShape, radius: number): string {
  const r = radius;
  if (shape === "square") {
    const h = r * 0.9;
    return `M${-h},${-h}H${h}V${h}H${-h}Z`;
  }
  if (shape === "triangle") {
    const h = r * 1.15;
    return `M0,${-h}L${h * 0.95},${h * 0.65}H${-h * 0.95}Z`;
  }
  if (shape === "diamond") {
    const h = r * 1.2;
    return `M0,${-h}L${h},0L0,${h}L${-h},0Z`;
  }
  return `M${-r},0A${r},${r} 0 1 0 ${r},0A${r},${r} 0 1 0 ${-r},0Z`;
}
