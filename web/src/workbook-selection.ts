import type { GridRange } from "./data-grid.ts";
import type { DataSheet } from "./workbook.ts";

export type WorkbookSelection = {
  dataId: string;
  range: GridRange;
  datasetIds: string[];
  rowIds: string[];
};

export function selectionFromRange(
  source: DataSheet,
  range: GridRange,
): WorkbookSelection {
  return {
    dataId: source.id,
    range,
    datasetIds: source.project.columns
      .slice(range.startColumn, range.endColumn + 1)
      .map((column) => column.id!)
      .filter(Boolean),
    rowIds: source.rowIds.slice(range.startRow, range.endRow + 1),
  };
}

// Empty virtual cells do not have scientific identities until data are entered.
export function materializeSelection(
  source: DataSheet,
  selected: WorkbookSelection,
): WorkbookSelection {
  if (
    source.id !== selected.dataId ||
    (selected.datasetIds.length && selected.rowIds.length)
  )
    return selected;
  const current = selectionFromRange(source, selected.range);
  return {
    ...selected,
    datasetIds: selected.datasetIds.length
      ? selected.datasetIds
      : current.datasetIds,
    rowIds: selected.rowIds.length ? selected.rowIds : current.rowIds,
  };
}

export function selectedGraphRanges(
  source: DataSheet,
  indices: number[],
  selected: WorkbookSelection | null,
) {
  if (!selected || selected.dataId !== source.id) return [];
  const datasets = new Set(selected.datasetIds),
    rows = new Set(selected.rowIds);
  const runs: { startRow: number; endRow: number }[] = [];
  for (let row = 0; row < source.rowIds.length; row++) {
    if (!rows.has(source.rowIds[row])) continue;
    const previous = runs.at(-1);
    if (previous && previous.endRow === row - 1) previous.endRow = row;
    else runs.push({ startRow: row, endRow: row });
  }
  return indices.flatMap((column, seriesIndex) =>
    datasets.has(source.project.columns[column]?.id ?? "")
      ? runs.map((run) => ({ seriesIndex, ...run }))
      : [],
  );
}

export function selectedGraphPoint(
  source: DataSheet,
  indices: number[],
  selected: WorkbookSelection | null,
) {
  if (
    !selected ||
    selected.dataId !== source.id ||
    selected.datasetIds.length !== 1 ||
    selected.rowIds.length !== 1
  )
    return null;
  const row = source.rowIds.indexOf(selected.rowIds[0]);
  const seriesIndex = indices.findIndex(
    (column) => source.project.columns[column]?.id === selected.datasetIds[0],
  );
  return row < 0 || seriesIndex < 0 ? null : { seriesIndex, row };
}

export function sourceCellForPoint(
  viewSource: DataSheet,
  liveSource: DataSheet,
  column: number,
  row: number,
) {
  if (viewSource.id !== liveSource.id) return null;
  const datasetId = viewSource.project.columns[column]?.id,
    rowId = viewSource.rowIds[row];
  if (!datasetId || !rowId) return null;
  const liveColumn = liveSource.project.columns.findIndex(
    (dataset) => dataset.id === datasetId,
  );
  const liveRow = liveSource.rowIds.indexOf(rowId);
  return liveColumn < 0 || liveRow < 0
    ? null
    : { column: liveColumn, row: liveRow };
}
