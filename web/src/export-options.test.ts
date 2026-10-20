import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_EXPORT,
  exportFileName,
  exportPixels,
  exportProblem,
  exportRequest,
  loadExportDefaults,
  parseExportOptions,
  saveExportDefaults,
  withExtension,
} from "./export-options.ts";

test("requests carry only the options that apply to the format", () => {
  assert.deepEqual(exportRequest(DEFAULT_EXPORT), { format: "pdf", transparent: false });
  assert.deepEqual(exportRequest({ ...DEFAULT_EXPORT, format: "pdf", size: "width", width: 3, background: "clear" }),
    { format: "pdf", transparent: true }, "PDF keeps its actual size");
  assert.deepEqual(exportRequest({ ...DEFAULT_EXPORT, format: "png", dpi: 600, size: "width", width: 3.5 }),
    { format: "png", dpi: 600, width_inches: 3.5, transparent: false });
  assert.deepEqual(exportRequest({ ...DEFAULT_EXPORT, format: "jpeg", background: "clear" }),
    { format: "jpeg", dpi: 300, transparent: false }, "JPEG has no transparency");
  assert.deepEqual(exportRequest({ ...DEFAULT_EXPORT, format: "svg", size: "width", width: 10 }),
    { format: "svg", width_inches: 10, transparent: false }, "SVG has no resolution");
});

test("bitmap pixel sizes follow resolution and width", () => {
  assert.equal(exportPixels(DEFAULT_EXPORT), null);
  assert.deepEqual(exportPixels({ ...DEFAULT_EXPORT, format: "tiff", dpi: 300 }), [2250, 1500]);
  assert.deepEqual(exportPixels({ ...DEFAULT_EXPORT, format: "png", dpi: 600, size: "width", width: 3.75 }), [2250, 1500]);
});

test("problems block export with a reason", () => {
  assert.equal(exportProblem(DEFAULT_EXPORT, "graph.pdf"), null);
  assert.equal(exportProblem(DEFAULT_EXPORT, "  "), "Enter a file name.");
  assert.match(exportProblem({ ...DEFAULT_EXPORT, format: "png", size: "width", width: 0.5 }, "a.png")!, /from 1 to 20 inches/);
  assert.equal(exportProblem({ ...DEFAULT_EXPORT, format: "pdf", size: "width", width: 0.5 }, "a.pdf"), null, "PDF ignores the width");
  assert.match(exportProblem({ ...DEFAULT_EXPORT, format: "png", dpi: 1200, size: "width", width: 20 }, "a.png")!, /60 megapixels/);
});

test("file names follow the sheet name and the chosen format", () => {
  assert.equal(exportFileName("Col: One-way ANOVA", "pdf"), "Col- One-way ANOVA.pdf");
  assert.equal(exportFileName("  ", "png"), "GP graph.png");
  assert.equal(withExtension("Figure 2.pdf", "tiff"), "Figure 2.tif");
  assert.equal(withExtension("Figure 2.final", "png"), "Figure 2.final.png");
  assert.equal(withExtension("results.JPEG", "svg"), "results.svg");
});

test("saved defaults are validated and survive missing storage", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const chosen = { ...DEFAULT_EXPORT, format: "tiff" as const, dpi: 600 as const };
  saveExportDefaults(chosen, storage);
  assert.deepEqual(loadExportDefaults(storage), chosen);
  store.set("gp.export.defaults.v1", JSON.stringify({ ...chosen, dpi: 299 }));
  assert.deepEqual(loadExportDefaults(storage), DEFAULT_EXPORT);
  store.set("gp.export.defaults.v1", "{not json");
  assert.deepEqual(loadExportDefaults(storage), DEFAULT_EXPORT);
  saveExportDefaults(null, storage);
  assert.equal(store.size, 0);
  assert.deepEqual(loadExportDefaults(undefined), DEFAULT_EXPORT);
  assert.equal(parseExportOptions({ ...chosen, extra: 1, width: 25 }), null);
});
