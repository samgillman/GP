import { WORKBOOK_STORAGE } from "./workbook.ts";
import type { Workbook } from "./workbook.ts";

let latestWorkbook: Workbook | null = null;

/** Keep the immutable state reference; serialization happens only on download. */
export function rememberWorkbook(workbook: Workbook): void {
  latestWorkbook = workbook;
}

export function getRecoveryWorkbook(): Workbook | null {
  return latestWorkbook;
}

export type RecoveryFile = {
  text: string;
  filename: string;
  source: "memory" | "storage";
};

export function recoveryFile(
  read: (key: string) => string | null = (key) => localStorage.getItem(key),
): RecoveryFile | null {
  const workbook = getRecoveryWorkbook();
  if (workbook) {
    return {
      text: JSON.stringify(workbook),
      filename: "GP-recovered-workbook.json",
      source: "memory",
    };
  }
  // Preserve saved bytes even when the saved document itself is malformed.
  // This function never writes to storage or registers browser event handlers.
  const saved = read(WORKBOOK_STORAGE) ?? read("gp.project.v1");
  return saved === null
    ? null
    : {
        text: saved,
        filename: "GP-recovered-saved-workbook.json",
        source: "storage",
      };
}
