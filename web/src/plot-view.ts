// Shipped menu presets: REA ev_212198e3cb25470fb0235238305c0f50a540af50328dc6518b90657015019b68,
// MainMenu.nib objects 1531,1535,1539,1544,1548,1552,1556,1560,1564 (setZoom: tags).
// These static menu records do not establish native slider bounds, increments,
// physical sizing at 100%, or the algorithms behind Fit Page / Fit Graph.
export const GRAPH_ZOOM_PRESETS = [
  50, 75, 100, 150, 200, 400, 600, 800, 1000,
] as const;
export const MIN_GRAPH_ZOOM = 25; // Existing GP view choice, not a recovered Prism minimum.
export const MAX_GRAPH_ZOOM = 1000;

export function clampGraphZoom(value: number) {
  return Number.isNaN(value)
    ? 100
    : Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, Math.round(value)));
}

// View magnification must not create an unbounded canvas backing store.
export function canvasPixelRatio(zoom: number, devicePixelRatio: number) {
  return Math.min(4, Math.max(2, ((devicePixelRatio || 1) * zoom) / 100));
}
