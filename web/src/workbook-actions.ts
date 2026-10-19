import type { Sheet, Workbook } from "./workbook.ts";
export function deletionIds(book: Workbook, id: string): Set<string> {
  const sheet = book.sheets.find((s) => s.id === id);
  if (!sheet) throw new Error("The sheet no longer exists.");
  if (
    sheet.kind === "data" &&
    book.sheets.filter((s) => s.kind === "data").length === 1
  )
    throw new Error("Keep at least one data table in the workbook.");
  return new Set(
    book.sheets
      .filter(
        (s) =>
          s.id === id ||
          (sheet.kind === "data" && s.kind !== "data" && s.dataId === id),
      )
      .map((s) => s.id),
  );
}
export function deleteSheet(book: Workbook, id: string): Workbook {
  const removed = deletionIds(book, id);
  const sheets = book.sheets
    .filter((s) => !removed.has(s.id))
    .map((s) =>
      s.kind === "graph" && s.resultId && removed.has(s.resultId)
        ? { ...s, resultId: null }
        : s,
    );
  return {
    ...book,
    sheets,
    activeSheetId: removed.has(book.activeSheetId)
      ? sheets.find((s) => s.kind === "data")!.id
      : book.activeSheetId,
  };
}
export function duplicateSheet(book: Workbook, id: string): Workbook {
  const sheet = book.sheets.find((s) => s.id === id);
  if (!sheet) throw new Error("The sheet no longer exists.");
  const names = new Set(book.sheets.map((s) => s.name));
  let name = `${sheet.name} copy`,
    suffix = 2;
  while (names.has(name)) name = `${sheet.name} copy ${suffix++}`;
  const copy: Sheet = {
    ...structuredClone(sheet),
    id: crypto.randomUUID(),
    name,
  };
  if (copy.kind === "data") {
    copy.project.name = name;
    copy.project.columns = copy.project.columns.map((column) => ({ ...column, id: crypto.randomUUID() }));
    copy.rowIds = copy.rowIds.map(() => crypto.randomUUID());
  }
  return { ...book, sheets: [...book.sheets, copy], activeSheetId: copy.id };
}
