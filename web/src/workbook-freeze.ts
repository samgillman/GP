import { remapGraphDatasetColors } from "./workbook-graph-colors.ts";
import { retainDatasetStyles } from "./workbook-style-identity.ts";
import {
  datasetSelection,
  responseValid,
  sameSourceData,
  sourceSheet,
} from "./workbook.ts";
import type {
  DataSheet,
  FrozenResultSnapshot,
  GraphSheet,
  ResultSheet,
  Sheet,
  Workbook,
} from "./workbook.ts";

/** Frozen inputs are historical copies. The source table still participates in
 * the workbook's structural family/cascade policy; this is not orphan support.
 */
export function effectiveSource(book: Workbook, sheet: Sheet): DataSheet {
  if (sheet.kind !== "data" && sheet.frozen) {
    if (!sheet.frozenSource)
      throw new Error("The frozen sheet has no captured source.");
    return sheet.frozenSource;
  }
  return sourceSheet(book, sheet);
}

export function effectiveResult(
  book: Workbook,
  graph: GraphSheet,
): ResultSheet | FrozenResultSnapshot | null {
  if (graph.frozen) return graph.frozenResult ?? null;
  const result = book.sheets.find((sheet) => sheet.id === graph.resultId);
  return result?.kind === "results" ? result : null;
}

function checkedSelection(source: DataSheet, sheet: ResultSheet | GraphSheet) {
  const selection = datasetSelection(source, sheet.columnIndices);
  if (
    sheet.selectionInvalid ||
    !selection.datasetIds.length ||
    JSON.stringify(selection.datasetIds) !== JSON.stringify(sheet.datasetIds)
  )
    throw new Error("Review the selected datasets before freezing this sheet.");
}

function checkedResult(source: DataSheet, result: ResultSheet) {
  if (result.dataId !== source.id)
    throw new Error("The linked result belongs to a different source table.");
  checkedSelection(source, result);
  if (
    result.status !== "current" ||
    result.sourceRevision !== source.revision ||
    !responseValid(result.result) ||
    result.result.analysis !== result.analysis
  )
    throw new Error(
      "Recalculate the analysis for the current source data before freezing.",
    );
  if (
    result.frozen &&
    (!result.frozenSource || !sameSourceData(result.frozenSource, source))
  )
    throw new Error(
      "The linked frozen result belongs to different source data. Unfreeze and recalculate it first.",
    );
}

function captureSource(source: DataSheet): DataSheet {
  const copy = structuredClone(source);
  delete copy.frozen;
  return copy;
}

function captureResult(result: ResultSheet): FrozenResultSnapshot {
  const copy = structuredClone(result);
  delete copy.frozen;
  delete copy.frozenSource;
  return copy;
}

function remap(source: DataSheet, sheet: ResultSheet | GraphSheet) {
  const indices = sheet.datasetIds
    .map((uid) =>
      source.project.columns.findIndex((column) => column.id === uid),
    )
    .filter(
      (index) =>
        index >= 0 && (source.project.table_type !== "xy" || index !== 0),
    );
  const selection = datasetSelection(source, indices);
  const old = sheet.frozenSource!;
  return {
    ...selection,
    selectionInvalid: Boolean(
      sheet.selectionInvalid ||
      selection.datasetIds.length !== sheet.datasetIds.length ||
      old.project.table_type !== source.project.table_type ||
      (old.project.table_type === "xy" &&
        old.project.columns[0]?.id !== source.project.columns[0]?.id),
    ),
  };
}

/** A GP state operation with no navigation, history or scheduling side effects.
 * Prism's native handlers support per-sheet toggles; snapshot persistence and
 * automatic recalculation on thaw are independent GP implementation choices.
 */
export function toggleSheetFrozen(book: Workbook, id: string): Workbook {
  const sheet = book.sheets.find((candidate) => candidate.id === id);
  if (!sheet) throw new Error("The sheet no longer exists.");
  let next: Sheet;
  if (sheet.kind === "data") {
    next = { ...sheet, frozen: !sheet.frozen };
  } else {
    const source = sourceSheet(book, sheet);
    if (sheet.frozen) {
      if (!sheet.frozenSource)
        throw new Error("The frozen sheet has no captured source.");
      const selection = remap(source, sheet);
      if (sheet.kind === "results") {
        next = {
          ...sheet,
          ...selection,
          frozen: false,
          status: "stale",
          result: null,
        };
        delete next.frozenSource;
      } else {
        const colors = remapGraphDatasetColors(sheet.frozenSource.project, source.project, sheet, selection.columnIndices);
        next = {
          ...sheet,
          ...colors,
          graph: retainDatasetStyles(colors.graph, source.project.columns),
          ...selection,
          frozen: false,
          resultId: book.sheets.some(
            (candidate) =>
              candidate.kind === "results" &&
              candidate.id === sheet.resultId &&
              candidate.dataId === sheet.dataId,
          )
            ? sheet.resultId
            : null,
        };
        delete next.frozenSource;
        delete next.frozenResult;
      }
    } else if (sheet.kind === "results") {
      checkedResult(source, sheet);
      next = {
        ...structuredClone(sheet),
        frozen: true,
        frozenSource: captureSource(source),
      };
    } else {
      checkedSelection(source, sheet);
      const linked = effectiveResult(book, sheet);
      if (sheet.resultId !== null && !linked)
        throw new Error("The graph's linked result is missing.");
      if (linked) checkedResult(source, linked);
      next = {
        ...structuredClone(sheet),
        frozen: true,
        frozenSource: captureSource(source),
      };
      if (linked) next.frozenResult = captureResult(linked);
    }
  }
  return {
    ...book,
    sheets: book.sheets.map((candidate) =>
      candidate.id === id ? next : candidate,
    ),
  };
}
