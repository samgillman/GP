/** Axis option surface backed by the shipped FormatAxes resources. Automatic
 * bounds/tick algorithms are GP choices, not recovered Prism algorithms. */
export type AxisSettings = {
  scale: "auto" | "linear" | "log10";
  minimum: number | null;
  maximum: number | null;
  majorInterval: number | null;
  reverse: boolean;
  showAxis: boolean;
  showGrid: boolean;
};
export type GraphAxes = { x: AxisSettings; y: AxisSettings };
export const defaultAxisSettings = (): AxisSettings => ({
  scale: "auto", minimum: null, maximum: null, majorInterval: null,
  reverse: false, showAxis: true, showGrid: false,
});
export const defaultGraphAxes = (): GraphAxes => ({
  x: defaultAxisSettings(), y: defaultAxisSettings(),
});
/** Converting XY to a categorical table removes numeric X formatting only.
 * Existing view direction/visibility and Y formatting remain meaningful. */
export function axesForTableType(axes: GraphAxes, xy: boolean): GraphAxes {
  return xy ? axes : { ...axes, x: { ...axes.x, scale: "auto", minimum: null,
    maximum: null, majorInterval: null } };
}
const keys = Object.keys(defaultAxisSettings());
function validAxis(value: unknown): value is AxisSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as AxisSettings;
  return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)) &&
    ["auto", "linear", "log10"].includes(v.scale) &&
    [v.minimum, v.maximum, v.majorInterval].every(n => n === null ||
      (typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e100)) &&
    (v.majorInterval === null || v.majorInterval > 0) &&
    (v.minimum === null || v.maximum === null || v.minimum < v.maximum) &&
    (v.scale !== "log10" || ((v.minimum === null || v.minimum > 0) &&
      (v.maximum === null || v.maximum > 0) && v.majorInterval === null)) &&
    [v.reverse, v.showAxis, v.showGrid].every(b => typeof b === "boolean");
}
export function validGraphAxes(value: unknown): value is GraphAxes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const axes = value as GraphAxes;
  return Object.keys(axes).length === 2 && Object.hasOwn(axes, "x") &&
    Object.hasOwn(axes, "y") && validAxis(axes.x) && validAxis(axes.y);
}
export function axesSettingsProblem(axes: GraphAxes, xy: boolean, autoLogX = false): string | null {
  if (!validGraphAxes(axes))
    return "Axis limits must be finite and ordered from minimum to maximum. Logarithmic limits must be positive, with automatic tick spacing.";
  if (!xy && (axes.x.scale !== "auto" || axes.x.minimum !== null ||
      axes.x.maximum !== null || axes.x.majorInterval !== null))
    return "A categorical X axis uses dataset positions. Numeric scale, range and interval settings apply to XY tables.";
  for (const key of ["x", "y"] as const) {
    const axis = axes[key];
    const log = axis.scale === "log10" || (key === "x" && xy && autoLogX && axis.scale === "auto");
    if (log && (axis.majorInterval !== null ||
        (axis.minimum !== null && axis.minimum <= 0) ||
        (axis.maximum !== null && axis.maximum <= 0)))
      return `${key.toUpperCase()} logarithmic axis requires positive limits and automatic tick spacing.`;
    if (axis.majorInterval !== null && axis.minimum !== null && axis.maximum !== null &&
        Math.floor(axis.maximum / axis.majorInterval) -
          Math.ceil(axis.minimum / axis.majorInterval) + 1 > 200)
      return `${key.toUpperCase()} major tick interval is too small. Choose an interval with no more than 200 ticks.`;
  }
  return null;
}
