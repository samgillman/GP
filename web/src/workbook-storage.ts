import { fromProject, parseWorkbook, WORKBOOK_STORAGE } from "./workbook.ts";
import type { Workbook } from "./workbook.ts";
import { sample } from "./data.ts";
import { workbookSnapshot } from "./workbook-snapshot.ts";
import type { WorkbookSnapshotInput } from "./workbook-snapshot.ts";
export const MAX_WORKBOOK_SHEETS = 500;
export const MAX_WORKBOOK_BYTES = 20_000_000;
export type Recovery = { message: string; original: string | null };
export type Restoration = { workbook: Workbook; recovery: Recovery | null };
export function restoreWorkbook(
  read: (key: string) => string | null,
): Restoration {
  let original: string | null = null;
  try {
    original = read(WORKBOOK_STORAGE) ?? read("gp.project.v1");
    if (original !== null) {
      const workbook = parseWorkbook(original);
      const limitError = workbookLimitError(workbook);
      if (limitError) throw new Error(limitError);
      return { workbook, recovery: null };
    }
    return { workbook: fromProject(sample("column")), recovery: null };
  } catch {
    return {
      workbook: fromProject(sample("column")),
      recovery: {
        original,
        message:
          original === null
            ? "Browser storage could not be read. Autosave is paused to protect any existing workbook."
            : "The saved workbook could not be restored. Its original contents are preserved, and autosave is paused.",
      },
    };
  }
}
export function workbookLimitError(workbook: WorkbookSnapshotInput): string | null {
  const snapshot = workbookSnapshot(workbook);
  if (snapshot.sheetCount > MAX_WORKBOOK_SHEETS)
    return "This workbook has reached the 500-sheet limit. Open or start another workbook before adding sheets.";
  if (
    snapshot.utf8Bytes > MAX_WORKBOOK_BYTES
  )
    return "This change would exceed the 20 MB workbook limit. Save this workbook and use another workbook for additional data.";
  return null;
}
export function persistWorkbook(
  write: (key: string, value: string) => void,
  workbook: WorkbookSnapshotInput,
  recovery: Recovery | null,
): boolean {
  if (recovery) return false;
  write(WORKBOOK_STORAGE, workbookSnapshot(workbook).json);
  return true;
}
