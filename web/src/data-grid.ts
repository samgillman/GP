import type { Column } from "./data.ts";
export const GRID_ROWS = 10000;
export const GRID_COLUMNS = 30;
export const ROW_HEIGHT = 24;
export const HEADER_HEIGHT = 60;
export const ROW_HEADER_WIDTH = 38;
export const DEFAULT_COLUMN_WIDTH = 112;
export const MAX_MOUNTED_ROWS = 80;
export type GridCell = { row: number; column: number };
export type GridRange = {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
};
export type GridSession = {
  scrollTop: number;
  scrollLeft: number;
  widths: number[];
  active: GridCell;
  anchor: GridCell;
  head: GridCell;
  range: GridRange;
};
/** Browser-session UI state only; scientific workbook data is saved separately. */
export class GridSessionCache {
  private sheets = new Map<string, GridSession>();
  read(id: string): GridSession {
    let saved = this.sheets.get(id);
    if (!saved) {
      const cell = { row: 0, column: 0 };
      saved = {
        scrollTop: 0,
        scrollLeft: 0,
        widths: Array(GRID_COLUMNS).fill(DEFAULT_COLUMN_WIDTH),
        active: cell,
        anchor: cell,
        head: cell,
        range: rangeBetween(cell, cell),
      };
      this.sheets.set(id, saved);
    }
    return saved;
  }
  update(id: string, state: Partial<GridSession>): void {
    this.sheets.set(id, { ...this.read(id), ...state });
  }
}
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
export function rangeBetween(a: GridCell, b: GridCell): GridRange {
  return {
    startRow: clamp(Math.min(a.row, b.row), 0, GRID_ROWS - 1),
    endRow: clamp(Math.max(a.row, b.row), 0, GRID_ROWS - 1),
    startColumn: clamp(Math.min(a.column, b.column), 0, GRID_COLUMNS - 1),
    endColumn: clamp(Math.max(a.column, b.column), 0, GRID_COLUMNS - 1),
  };
}
export function contains(range: GridRange, cell: GridCell) {
  return (
    cell.row >= range.startRow &&
    cell.row <= range.endRow &&
    cell.column >= range.startColumn &&
    cell.column <= range.endColumn
  );
}
export function rowWindow(
  scrollTop: number,
  height: number,
  focusedRow?: number,
): number[] {
  const first = clamp(Math.floor(scrollTop / ROW_HEIGHT), 0, GRID_ROWS - 1);
  const visible = Math.max(
    1,
    Math.ceil((height - HEADER_HEIGHT) / ROW_HEIGHT) + 1,
  );
  const budget = MAX_MOUNTED_ROWS - (focusedRow === undefined ? 0 : 1);
  const count = Math.min(budget, visible + 12);
  const start = clamp(first - 6, 0, GRID_ROWS - count);
  const result = Array.from({ length: count }, (_, i) => start + i);
  if (
    focusedRow !== undefined &&
    focusedRow >= 0 &&
    focusedRow < GRID_ROWS &&
    !result.includes(focusedRow)
  )
    result.push(focusedRow);
  return result.sort((a, b) => a - b);
}
export function columnOffsets(widths: number[]): number[] {
  const positions = [0];
  for (let i = 0; i < GRID_COLUMNS; i++)
    positions.push(positions.at(-1)! + (widths[i] ?? DEFAULT_COLUMN_WIDTH));
  return positions;
}
export function columnAt(x: number, widths: number[]): number {
  const positions = columnOffsets(widths);
  for (let i = 0; i < GRID_COLUMNS; i++) if (x < positions[i + 1]) return i;
  return GRID_COLUMNS - 1;
}
export function columnWindow(
  scrollLeft: number,
  width: number,
  widths: number[],
  focusedColumn?: number,
): number[] {
  const first = columnAt(scrollLeft, widths),
    last = columnAt(scrollLeft + Math.max(0, width - ROW_HEADER_WIDTH), widths);
  const start = Math.max(0, first - 1),
    end = Math.min(GRID_COLUMNS - 1, last + 1);
  const result = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  if (
    focusedColumn !== undefined &&
    focusedColumn >= 0 &&
    focusedColumn < GRID_COLUMNS &&
    !result.includes(focusedColumn)
  )
    result.push(focusedColumn);
  return result.sort((a, b) => a - b);
}
export type GridRun =
  | { kind: "item"; index: number; key: string }
  | { kind: "gap"; size: number; key: string };
export function virtualRuns(
  indices: number[],
  offsets: number[],
  total: number,
): GridRun[] {
  const runs: GridRun[] = [];
  let previous = 0;
  for (const i of indices) {
    const start = offsets[i];
    if (start > previous)
      runs.push({ kind: "gap", size: start - previous, key: `gap-${i}` });
    runs.push({ kind: "item", index: i, key: `item-${i}` });
    previous = offsets[i + 1];
  }
  if (previous < total)
    runs.push({ kind: "gap", size: total - previous, key: "gap-end" });
  return runs;
}
export function groupLabel(index: number): string {
  let text = "",
    n = index + 1;
  while (n > 0) {
    n--;
    text = String.fromCharCode(65 + (n % 26)) + text;
    n = Math.floor(n / 26);
  }
  return text;
}
export function nextCell(
  cell: GridCell,
  key: string,
  shift = false,
): GridCell | null {
  let { row, column } = cell;
  if (key === "Enter") row += shift ? -1 : 1;
  else if (key === "ArrowDown") row++;
  else if (key === "ArrowUp") row--;
  else if (key === "ArrowRight") column++;
  else if (key === "ArrowLeft") column--;
  else if (key === "Tab") {
    column += shift ? -1 : 1;
    if (column >= GRID_COLUMNS && row < GRID_ROWS - 1) {
      column = 0;
      row++;
    }
    if (column < 0 && row > 0) {
      column = GRID_COLUMNS - 1;
      row--;
    }
  } else return null;
  return {
    row: clamp(row, 0, GRID_ROWS - 1),
    column: clamp(column, 0, GRID_COLUMNS - 1),
  };
}
export function selectionTSV(columns: Column[], range: GridRange): string {
  const quote = (text: string) =>
    /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  const lines: string[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    const cells: string[] = [];
    for (let c = range.startColumn; c <= range.endColumn; c++)
      cells.push(quote(columns[c]?.values[r] ?? ""));
    lines.push(cells.join("\t"));
  }
  return lines.join("\r\n");
}
