import type { CSSProperties } from "react";
import type { Graph } from "./data.ts";

/** Text objects on a graph that can be selected and formatted from the Text
 * toolbar, as in Prism. Mirrors gp/models.py TextStyle. */
export const TEXT_OBJECTS = ["title", "x_label", "y_label", "x_ticks", "y_ticks", "legend"] as const;
export type TextObject = (typeof TEXT_OBJECTS)[number];
export const TEXT_OBJECT_LABELS: Record<TextObject, string> = {
  title: "Graph title",
  x_label: "X axis title",
  y_label: "Y axis title",
  x_ticks: "X axis labels",
  y_ticks: "Y axis labels",
  legend: "Legend",
};
export const TEXT_FONTS = ["Arial", "Helvetica", "Verdana", "Times New Roman", "Georgia", "Courier New"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];
/** Text › color choices. */
export const TEXT_COLORS: readonly (readonly [string, string])[] = [
  ["Black", "#000000"],
  ["Dark gray", "#555555"],
  ["Gray", "#999999"],
  ["White", "#ffffff"],
  ["Red", "#d62728"],
  ["Orange", "#ff7f0e"],
  ["Green", "#2ca02c"],
  ["Blue", "#1f77b4"],
  ["Purple", "#9467bd"],
];
/** Sizes in points; the graph page is drawn at one pixel per point. */
export const TEXT_SIZES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72] as const;

export type TextStyle = {
  font?: TextFont;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};
export type ResolvedTextStyle = Required<TextStyle>;

const base = { font: "Arial", bold: true, italic: false, color: "#000000" } as const;
/** GP's graph text before any formatting: bold Arial, as on Prism graphs. */
export const TEXT_DEFAULTS: Record<TextObject, ResolvedTextStyle> = {
  title: { ...base, size: 18 },
  x_label: { ...base, size: 16 },
  y_label: { ...base, size: 16 },
  x_ticks: { ...base, size: 14 },
  y_ticks: { ...base, size: 14 },
  legend: { ...base, size: 13 },
};

const FONT_STACKS: Record<TextFont, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Times New Roman": '"Times New Roman", Times, serif',
  Georgia: "Georgia, serif",
  "Courier New": '"Courier New", Courier, monospace',
};

export function resolveTextStyle(graph: Pick<Graph, "text_styles">, object: TextObject): ResolvedTextStyle {
  return { ...TEXT_DEFAULTS[object], ...graph.text_styles?.[object] };
}

/** CSS font shorthand, for drawing and for measuring label widths. */
export function cssFont(style: ResolvedTextStyle): string {
  return `${style.italic ? "italic " : ""}${style.bold ? 700 : 400} ${style.size}px ${FONT_STACKS[style.font]}`;
}

/** Inline SVG text style; only set for objects the user has formatted, so
 * unformatted text keeps the stylesheet's look. */
export function textStyleProps(graph: Pick<Graph, "text_styles">, object: TextObject): CSSProperties | undefined {
  if (!graph.text_styles?.[object]) return undefined;
  const style = resolveTextStyle(graph, object);
  return {
    font: cssFont(style),
    fill: style.color,
  };
}

/** Larger/Smaller text: the next size in the list. */
export function stepTextSize(size: number, direction: 1 | -1): number {
  if (direction > 0) return TEXT_SIZES.find((s) => s > size) ?? TEXT_SIZES[TEXT_SIZES.length - 1];
  return [...TEXT_SIZES].reverse().find((s) => s < size) ?? TEXT_SIZES[0];
}

/** Apply a change to one text object. Values equal to GP's defaults are not
 * stored, so formatting back to the default leaves no override. */
export function formatText(graph: Graph, object: TextObject, change: TextStyle): Graph {
  const merged: TextStyle = { ...graph.text_styles?.[object], ...change };
  const kept = Object.fromEntries(
    Object.entries(merged).filter(
      ([key, value]) => value !== undefined && value !== TEXT_DEFAULTS[object][key as keyof TextStyle],
    ),
  ) as TextStyle;
  const { [object]: _old, ...others } = graph.text_styles ?? {};
  const text_styles = Object.keys(kept).length ? { ...others, [object]: kept } : others;
  const { text_styles: _previous, ...rest } = graph;
  return Object.keys(text_styles).length ? { ...rest, text_styles } : rest;
}

const HEX = /^#[0-9a-f]{6}$/i;
const STYLE_CHECKS: Record<keyof TextStyle, (value: unknown) => boolean> = {
  font: (v) => TEXT_FONTS.includes(v as TextFont),
  size: (v) => TEXT_SIZES.includes(v as never),
  bold: (v) => typeof v === "boolean",
  italic: (v) => typeof v === "boolean",
  color: (v) => typeof v === "string" && HEX.test(v),
};

export function validTextStyles(value: unknown): value is Partial<Record<TextObject, TextStyle>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([object, style]) =>
      TEXT_OBJECTS.includes(object as TextObject) &&
      Boolean(style) &&
      typeof style === "object" &&
      !Array.isArray(style) &&
      Object.entries(style as object).every(
        ([key, field]) => Object.hasOwn(STYLE_CHECKS, key) && STYLE_CHECKS[key as keyof TextStyle](field),
      ),
  );
}
