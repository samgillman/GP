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
