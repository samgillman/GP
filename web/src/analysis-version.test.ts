import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Response } from "./data.ts";
import { defaultComparisonOptions } from "./column-analysis.ts";
import { COLUMN_ANALYSIS_REVISION, isHistoricalColumnOutput } from "./analysis-version.ts";
import { fromProject, recordResult, parseWorkbook, responseValid } from "./workbook.ts";
import type { ResultSheet } from "./workbook.ts";
import { toggleSheetFrozen } from "./workbook-freeze.ts";
import { recalculationTask } from "./workbook-recalculation.ts";

function fixture(revision?: number) {
  const initial = fromProject(sample("column"));
  const output: Response = {
    analysis: "one_way_anova", ...(revision === undefined ? {} : { analysis_revision: revision }),
    summary: [], results: [{ label: "P value", value: 0.031 }], warnings: [], fit: [],
  };
  return recordResult(initial, {
    name: "Historical RM analysis", dataId: initial.activeSheetId,
    analysis: "one_way_anova", options: { ...defaultComparisonOptions, paired: true },
    columnIndices: [0, 1, 2], sourceRevision: 0, result: output,
  });
}

test("pre-audit column outputs cannot reopen as current calculations", () => {
  for (const revision of [undefined, 1]) {
    const original = fixture(revision);
    const restored = parseWorkbook(JSON.stringify(original));
    const result = restored.sheets.find((s) => s.id === original.activeSheetId) as ResultSheet;
    assert.equal(result.status, "stale");
    assert.equal(result.result, null);
    assert.ok(recalculationTask(restored, result)?.input);
    assert.deepEqual(result.options, (original.sheets.at(-1) as ResultSheet).options);
  }
});

test("current audited output survives reopen without unnecessary recalculation", () => {
  const book = fixture(COLUMN_ANALYSIS_REVISION);
  assert.deepEqual(parseWorkbook(JSON.stringify(book)), book);
  assert.equal(isHistoricalColumnOutput((book.sheets.at(-1) as ResultSheet).result), false);
});

test("frozen historical output keeps its numbers and is identifiable as historical", () => {
  let book = fixture();
  book = toggleSheetFrozen(book, book.activeSheetId);
  const restored = parseWorkbook(JSON.stringify(book));
  const result = restored.sheets.find((s) => s.id === book.activeSheetId) as ResultSheet;
  assert.deepEqual(result, book.sheets.find((s) => s.id === book.activeSheetId));
  assert.equal(result.result?.results[0].value, 0.031);
  assert.equal(isHistoricalColumnOutput(result.result), true);
  assert.equal(recalculationTask(restored, result), null);
  const thawed = toggleSheetFrozen(restored, result.id);
  const thawedResult = thawed.sheets.find((s) => s.id === result.id) as ResultSheet;
  assert.equal(thawedResult.status, "stale");
});

test("calculation revision metadata rejects malformed values", () => {
  const output = (fixture(COLUMN_ANALYSIS_REVISION).sheets.at(-1) as ResultSheet).result!;
  for (const revision of [-1, 0, 1.5, "2", null])
    assert.equal(responseValid({ ...output, analysis_revision: revision }), false);
});
