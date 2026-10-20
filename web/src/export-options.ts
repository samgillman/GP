/** File > Export options for graphs, mirroring gp/models.py ExportRequest. */
export const EXPORT_FORMATS = {
  pdf: {
    label: "PDF (Portable Document Format)",
    extension: "pdf",
    raster: false,
    description: "Vector-based format. Supports transparency. High quality at any size; opens almost everywhere.",
  },
  tiff: {
    label: "TIFF (Tagged Image File Format)",
    extension: "tif",
    raster: true,
    description: "Bitmap format often requested by journals. Supports transparency.",
  },
  png: {
    label: "PNG (Portable Network Graphics)",
    extension: "png",
    raster: true,
    description: "Bitmap format with lossless compression. Supports transparency. Good for slides and web pages.",
  },
  jpeg: {
    label: "JPEG (Joint Photographic Experts Group)",
    extension: "jpg",
    raster: true,
    description: "Bitmap format with lossy compression. No transparency.",
  },
  svg: {
    label: "SVG (Scalable Vector Graphics)",
    extension: "svg",
    raster: false,
    description: "Vector-based format for drawing programs and the web. Supports transparency.",
  },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;
export const EXPORT_RESOLUTIONS = [72, 150, 300, 600, 1200] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];
/** The graph's actual size when exported, in inches. */
export const ACTUAL_SIZE = { width: 7.5, height: 5 } as const;
export const MAX_EXPORT_PIXELS = 60_000_000;
export const MIN_WIDTH = 1;
export const MAX_WIDTH = 20;

export type ExportOptions = {
  format: ExportFormat;
  dpi: ExportResolution;
  size: "actual" | "width";
  /** Width in inches when size is "width". */
  width: number;
  background: "white" | "clear";
};
export const DEFAULT_EXPORT: ExportOptions = {
  format: "pdf",
  dpi: 300,
  size: "actual",
  width: ACTUAL_SIZE.width,
  background: "white",
};

/** What GP can do with these options in this format. */
export function exportAbilities(format: ExportFormat) {
  return {
    resolution: EXPORT_FORMATS[format].raster,
    // PDF keeps the graph's actual size; SVG and bitmaps can scale.
    resize: format !== "pdf",
    clear: format !== "jpeg",
  };
}

/** The request fields sent to /api/export for these options. */
export function exportRequest(options: ExportOptions) {
  const can = exportAbilities(options.format);
  return {
    format: options.format,
    ...(can.resolution ? { dpi: options.dpi } : {}),
    ...(can.resize && options.size === "width" ? { width_inches: options.width } : {}),
    transparent: can.clear && options.background === "clear",
  };
}

/** Pixel size of a bitmap export, or null for vector formats. */
export function exportPixels(options: ExportOptions): [number, number] | null {
  if (!EXPORT_FORMATS[options.format].raster) return null;
  const width = exportAbilities(options.format).resize && options.size === "width" ? options.width : ACTUAL_SIZE.width;
  const scale = width / ACTUAL_SIZE.width;
  return [
    Math.round(ACTUAL_SIZE.width * scale * options.dpi),
    Math.round(ACTUAL_SIZE.height * scale * options.dpi),
  ];
}

/** Why these options cannot be exported, or null when they can. */
export function exportProblem(options: ExportOptions, name: string): string | null {
  if (!name.trim()) return "Enter a file name.";
  if (options.size === "width" && exportAbilities(options.format).resize) {
    if (!Number.isFinite(options.width) || options.width < MIN_WIDTH || options.width > MAX_WIDTH)
      return `Enter a width from ${MIN_WIDTH} to ${MAX_WIDTH} inches.`;
  }
  const pixels = exportPixels(options);
  if (pixels && pixels[0] * pixels[1] > MAX_EXPORT_PIXELS)
    return "That resolution and size exceed 60 megapixels; lower the resolution or the width.";
  return null;
}

/** Characters that file systems reject become hyphens, as Prism does for ":". */
export function exportFileName(sheetName: string, format: ExportFormat): string {
  const base = sheetName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "GP graph";
  return `${base}.${EXPORT_FORMATS[format].extension}`;
}

/** Keep the typed name but switch its extension to the chosen format. */
export function withExtension(name: string, format: ExportFormat): string {
  const known = new Set<string>([...Object.values(EXPORT_FORMATS).map((f) => f.extension), "tiff", "jpeg"]);
  const dot = name.lastIndexOf(".");
  const base = dot > 0 && known.has(name.slice(dot + 1).toLowerCase()) ? name.slice(0, dot) : name;
  return `${base}.${EXPORT_FORMATS[format].extension}`;
}

const DEFAULTS_KEY = "gp.export.defaults.v1";

export function parseExportOptions(value: unknown): ExportOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.format !== "string" || !Object.hasOwn(EXPORT_FORMATS, v.format) ||
    !EXPORT_RESOLUTIONS.includes(v.dpi as never) ||
    (v.size !== "actual" && v.size !== "width") ||
    typeof v.width !== "number" || !Number.isFinite(v.width) || v.width < MIN_WIDTH || v.width > MAX_WIDTH ||
    (v.background !== "white" && v.background !== "clear")
  )
    return null;
  return {
    format: v.format as ExportFormat,
    dpi: v.dpi as ExportResolution,
    size: v.size,
    width: v.width,
    background: v.background,
  };
}

/** "Make these options become the default" is remembered in this browser. */
export function loadExportDefaults(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): ExportOptions {
  try {
    const saved = storage?.getItem(DEFAULTS_KEY);
    return (saved && parseExportOptions(JSON.parse(saved))) || DEFAULT_EXPORT;
  } catch {
    return DEFAULT_EXPORT;
  }
}

export function saveExportDefaults(
  options: ExportOptions | null,
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined = globalThis.localStorage,
) {
  try {
    if (options) storage?.setItem(DEFAULTS_KEY, JSON.stringify(options));
    else storage?.removeItem(DEFAULTS_KEY);
  } catch {
    // Defaults are a convenience; exporting works without storage.
  }
}
