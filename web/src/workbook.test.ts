import { test } from "node:test";
import assert from "node:assert/strict";
import { sample } from "./data.ts";
import type { Response } from "./data.ts";
import {
  addData,
  addGraph,
  fromProject,
  parseWorkbook,
  recordResult,
  sourceSheet,
  selectedProject,
  updateData,
} from "./workbook.ts";
const response: Response = {
  analysis: "descriptive",
  summary: [],
  results: [],
  warnings: [],
  fit: [],
};
test("legacy project migration creates linked persistent data and graph identities", () => {
  const b = parseWorkbook(JSON.stringify(sample("xy")));
  assert.equal(b.sheets.length, 2);
  assert.equal(sourceSheet(b, b.sheets[1]).id, b.sheets[0].id);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("multiple analyses persist; only changed source dependencies become stale", () => {
  let b = fromProject(sample("column"));
  const first = b.sheets[0];
  b = recordResult(b, {
    name: "First analysis",
    dataId: first.id,
    analysis: "descriptive",
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: response,
  });
  const resultId = b.activeSheetId;
  b = addGraph(b, first.id, resultId);
  b = addData(b, sample("xy"));
  const otherId = b.activeSheetId;
  b = recordResult(b, {
    name: "Other table",
    dataId: otherId,
    analysis: "descriptive",
    columnIndices: [1],
    sourceRevision: 0,
    result: response,
  });
  const otherResult = b.activeSheetId;
  const updated = sample("column");
  updated.columns[0].values[0] = "999";
  b = updateData(b, first.id, updated);
  const stale = b.sheets.find((s) => s.id === resultId);
  assert.equal(stale?.kind === "results" && stale.status, "stale");
  assert.equal(stale?.kind === "results" && stale.result, null);
  const other = b.sheets.find((s) => s.id === otherResult);
  assert.equal(other?.kind === "results" && other.status, "current");
  assert.equal(b.sheets.filter((s) => s.kind === "graph").length, 3);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("rename preserves results and late responses cannot overwrite changed input", () => {
  let b = fromProject(sample("column"));
  const data = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: data.id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: response,
  });
  b = updateData(b, data.id, { ...sample("column"), name: "Renamed" });
  assert.equal(b.sheets[2].kind === "results" && b.sheets[2].status, "current");
  const p = sample("column");
  p.columns[0].values[0] = "12";
  b = updateData(b, data.id, p);
  const same = recordResult(b, {
    name: "Late",
    dataId: data.id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: response,
  });
  assert.equal(same, b);
});
test("workbook import rejects broken dependencies and malformed results", () => {
  const b = fromProject(sample("column"));
  (b.sheets[1] as { dataId: string }).dataId = "missing";
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
  const valid = fromProject(sample("column"));
  valid.sheets.push({ ...valid.sheets[0] });
  assert.throws(() => parseWorkbook(JSON.stringify(valid)));
});

test("draft numeric edits persist and dataset removal cannot silently retarget a result", () => {
  let b = fromProject(sample("column"));
  const source = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: source.id,
    analysis: "descriptive",
    columnIndices: [1],
    sourceRevision: 0,
    result: response,
  });
  const p = sample("column");
  p.columns.splice(1, 1);
  p.columns[0].values[0] = "-";
  b = updateData(b, source.id, p);
  const r = b.sheets[2];
  assert.equal(r.kind === "results" && r.selectionInvalid, true);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});

test("graph dataset order survives save and XY keeps X first", () => {
  let b = fromProject(sample("xy"));
  const source = sourceSheet(b, b.sheets[0]);
  assert.deepEqual(
    selectedProject(source, [2, 1]).columns.map((c) => c.name),
    ["Concentration (µM)", "Compound B", "Compound A"],
  );
});
test("dataset rename preserves identity through subsequent middle column deletion", () => {
  let b = fromProject(sample("column"));
  const source = b.sheets[0];
  b = recordResult(b, {
    name: "Result",
    dataId: source.id,
    analysis: "descriptive",
    columnIndices: [2],
    sourceRevision: 0,
    result: response,
  });
  let p = sample("column");
  p.columns[2].name = "Renamed B";
  b = updateData(b, source.id, p);
  let r = b.sheets[2];
  assert.deepEqual(r.kind === "results" && r.columnIndices, [2]);
  assert.equal(r.kind === "results" && r.selectionInvalid, false);
  p = { ...p, columns: p.columns.filter((_, i) => i !== 1) };
  b = updateData(b, source.id, p);
  r = b.sheets[2];
  assert.deepEqual(r.kind === "results" && r.columnIndices, [1]);
  assert.equal(r.kind === "results" && r.selectionInvalid, false);
  assert.deepEqual(parseWorkbook(JSON.stringify(b)), b);
});
test("saved output must match its analysis record and optional summary fields must be numeric", () => {
  let b = fromProject(sample("column"));
  b = recordResult(b, {
    name: "Wrong analysis",
    dataId: b.sheets[0].id,
    analysis: "welch_t",
    columnIndices: [0, 1],
    sourceRevision: 0,
    result: response,
  });
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
});

test("malformed optional statistical values are rejected on workbook open", () => {
  let b = fromProject(sample("column"));
  const output = {
    ...response,
    summary: [
      {
        name: "Control",
        n: 2,
        mean: 1,
        sd: 0,
        sem: 0,
        median: 1,
        min: 1,
        max: 1,
        ci_low: 1,
        ci_high: 1,
        geometric_mean: { unexpected: "object" },
      },
    ],
  };
  b = recordResult(b, {
    name: "Result",
    dataId: b.sheets[0].id,
    analysis: "descriptive",
    columnIndices: [0],
    sourceRevision: 0,
    result: output as unknown as Response,
  });
  assert.throws(() => parseWorkbook(JSON.stringify(b)));
});
