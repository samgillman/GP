import { symbolRadius } from "./graph-style.ts";
import type { ResolvedDatasetStyle, SymbolShape } from "./graph-style.ts";

/** Polygon vertices matching graph-style's SVG symbolPath, centered at zero. */
export function symbolVertices(shape: SymbolShape, radius: number): [number, number][] {
  if (shape === "square") {
    const h = radius * 0.9;
    return [[-h, -h], [h, -h], [h, h], [-h, h]];
  }
  if (shape === "triangle") {
    const h = radius * 1.15;
    return [[0, -h], [h * 0.95, h * 0.65], [-h * 0.95, h * 0.65]];
  }
  if (shape === "diamond") {
    const h = radius * 1.2;
    return [[0, -h], [h, 0], [0, h], [-h, 0]];
  }
  return [];
}

type SymbolStyle = Pick<ResolvedDatasetStyle, "symbol_shape" | "symbol_size">;

/** Include polygon corners when picking or drawing a circular selection ring. */
export function symbolExtent(style: SymbolStyle): number {
  const radius = symbolRadius(style.symbol_size);
  const vertices = symbolVertices(style.symbol_shape, radius);
  return vertices.length
    ? Math.max(...vertices.map(([x, y]) => Math.hypot(x, y)))
    : radius;
}

export function symbolSelectionRadius(style: SymbolStyle): number {
  return Math.max(7, symbolExtent(style) + 3);
}
