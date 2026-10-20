import { plotFrame } from "./plot-geometry.ts";

/** GP browser layout policy; no native margin algorithm is inferred here.
 * Keep the 680 × 420 page and reserve at least 300 px for plotted data.
 * Extreme labels retain their full text but are compressed within these bounds.
 */
export function plotLabelLayout(input: {
  xWidth: number;
  yWidth: number;
  tickHeight: number;
  titleHeight: number;
  hasYTitle: boolean;
}) {
  const titleBand = input.hasYTitle ? Math.min(32, input.titleHeight) + 24 : 12;
  const yWidth = Math.min(190, Math.max(0, input.yWidth));
  const xWidth = Math.min(200, Math.max(0, input.xWidth));
  const left = Math.max(plotFrame.left, Math.ceil(yWidth + 10 + titleBand), Math.ceil(xWidth / 2 + 8));
  const right = Math.max(plotFrame.right, Math.ceil(xWidth / 2 + 8));
  const bottom = Math.max(plotFrame.bottom, Math.ceil(input.tickHeight + input.titleHeight + 38));
  return {
    frame: { ...plotFrame, left, right, bottom: Math.min(120, bottom) },
    yTitleX: Math.max(18, left - 10 - yWidth - 16),
    yTickWidth: Math.max(1, left - 10 - titleBand),
    xTickWidth: 200,
  };
}

/** Column (category) graphs are drawn on a portrait page: each data set gets a
 * fixed 70 px slot and the plotting area is 220 px tall, so bar width and
 * spacing do not stretch with the window. Category labels slant 45° when any
 * label is wider than its slot. */
export const COLUMN_SLOT = 70;
export const COLUMN_PLOT_HEIGHT = 220;
export function columnPageLayout(input: {
  count: number;
  xWidths: readonly number[];
  yWidth: number;
  tickHeight: number;
  titleHeight: number;
  hasYTitle: boolean;
  hasXTitle: boolean;
  legendWidth?: number;
}) {
  const count = Math.max(1, input.count);
  const plotWidth = COLUMN_SLOT * (count + 0.2);
  // Category centers sit 0.6 slot in from each plotting edge (domain 0.4..n+0.6).
  const edgeToCenter = COLUMN_SLOT * 0.6;
  const widths = input.xWidths.map((w) => Math.min(160, Math.max(0, w)));
  const slanted = widths.some((w) => w > COLUMN_SLOT - 10);
  const widest = Math.max(0, ...widths);
  const titleBand = input.hasYTitle ? Math.min(32, input.titleHeight) + 34 : 10;
  const yWidth = Math.min(190, Math.max(0, input.yWidth));
  const firstReach = slanted
    ? Math.SQRT1_2 * ((widths[0] ?? 0) + input.tickHeight / 2) - 5
    : (widths[0] ?? 0) / 2;
  const lastReach = slanted ? 0 : (widths.at(-1) ?? 0) / 2;
  const left = Math.ceil(Math.max(40, yWidth + 12 + titleBand, firstReach - edgeToCenter + 8));
  const right = Math.ceil(
    Math.max(50, lastReach - edgeToCenter + 8) +
      (input.legendWidth ? input.legendWidth + 18 : 0),
  );
  const labelDrop = slanted
    ? Math.SQRT1_2 * (widest + input.tickHeight) + 14
    : input.tickHeight + 14;
  const top = 16;
  const bottom = Math.ceil(10 + labelDrop + (input.hasXTitle ? input.titleHeight + 14 : 4));
  return {
    frame: {
      width: Math.ceil(left + plotWidth + right),
      height: top + COLUMN_PLOT_HEIGHT + bottom,
      left,
      right,
      top,
      bottom,
    },
    slanted,
    /** Baseline of the X axis title, measured from the plot's bottom edge. */
    xTitleOffset: Math.ceil(10 + labelDrop + input.titleHeight),
    yTitleX: Math.max(14, left - 12 - yWidth - 16),
    yTickWidth: Math.max(1, left - 12 - titleBand),
  };
}
