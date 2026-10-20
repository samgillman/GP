/* Icons from the supplied GP graph-sheet design reference. Decorative:
   every button that shows one carries its own accessible label. */
import type { ReactElement } from "react";

const icon = (viewBox: string, body: ReactElement) => (
  <svg viewBox={viewBox} aria-hidden="true" focusable="false">{body}</svg>
);

export const ribbonIcons = {
  newFile: icon("0 0 16 16", <><path d="M3 1.5h6.5L13 5v9.5H3z" fill="#fff" stroke="#6b6b6b" /><path d="M9.5 1.5V5H13" fill="none" stroke="#6b6b6b" /></>),
  open: icon("0 0 16 16", <><path d="M1.5 4h5L8 5.5h6.5v8h-13z" fill="#f2c94c" stroke="#a87b00" /></>),
  save: icon("0 0 16 16", <><rect x="2" y="2" width="12" height="12" rx="1" fill="#2b5797" /><rect x="4.5" y="2" width="7" height="4" fill="#fff" /><rect x="4" y="9" width="8" height="5" fill="#dfe8f5" /></>),
  saveAs: icon("0 0 16 16", <><rect x="2" y="2" width="12" height="12" rx="1" fill="#2b5797" /><rect x="4.5" y="2" width="7" height="4" fill="#fff" /><rect x="4" y="9" width="8" height="5" fill="#dfe8f5" /></>),
  highlight: icon("0 0 16 16", <><path d="M3 12l2-5 6-5.5 3 3L8 10z" fill="#f4d03f" stroke="#a67c00" /><path d="M1.5 14.5h8" stroke="#f4d03f" strokeWidth="2.6" /></>),
  freeze: icon("0 0 16 16", <><path d="M8 1v14M2 4.5l12 7M14 4.5l-12 7" stroke="#5aa9e6" strokeWidth="1.5" /></>),
  pin: icon("0 0 16 16", <><path d="M9 1.5l5.5 5.5-2 .5-2.5 2.5.5 3-1 1-3-3-3.5 3.5-.5-.5L6 9.5l-3-3 1-1 3 .5L9.5 3.5z" fill="#f2b632" stroke="#9a6a00" /></>),
  deleteSheet: icon("0 0 16 16", <><path d="M3.5 4.5h9l-1 10h-7z" fill="none" stroke="#d13438" strokeWidth="1.5" /><path d="M2.5 4.5h11M6 2h4M6.5 7v5M9.5 7v5" stroke="#d13438" strokeWidth="1.3" /></>),
  newSheet: icon("0 0 16 16", <><path d="M8 2v12M2 8h12" stroke="#2e9e44" strokeWidth="2.6" /></>),
  newTableGraph: icon("0 0 16 16", <><path d="M2.5 2v11.5H14" fill="none" stroke="#2b5797" strokeWidth="1.5" /><path d="M9 3v8M5 7h8" stroke="#2e9e44" strokeWidth="2" /></>),
  undo: icon("0 0 16 16", <><path d="M5 3.5L2 6.5l3 3M2 6.5h7.5a4 4 0 010 8H7" fill="none" stroke="#3a3a3a" strokeWidth="1.5" /></>),
  redo: icon("0 0 16 16", <><path d="M11 3.5l3 3-3 3M14 6.5H6.5a4 4 0 000 8H9" fill="none" stroke="#b5b5b5" strokeWidth="1.5" /></>),
  cut: icon("0 0 16 16", <><circle cx="4" cy="12" r="2.2" fill="none" stroke="#333" strokeWidth="1.3" /><circle cx="12" cy="12" r="2.2" fill="none" stroke="#333" strokeWidth="1.3" /><path d="M5.5 10.3L11.5 1.5M10.5 10.3L4.5 1.5" stroke="#333" strokeWidth="1.3" /></>),
  copy: icon("0 0 16 16", <><rect x="5" y="5" width="9" height="10" fill="#fff" stroke="#555" /><path d="M3 11V1.5h8" fill="none" stroke="#555" /></>),
  paste: icon("0 0 16 16", <><rect x="2.5" y="3" width="11" height="12" rx="1" fill="#d9822b" /><rect x="5" y="1.5" width="6" height="3" rx="1" fill="#6b6b6b" /><rect x="4.5" y="6" width="7" height="7" fill="#fff" /></>),
  analyze: icon("0 0 16 16", <><rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#fff" stroke="#2b5797" /><path d="M4.5 6h7M4.5 10h7" stroke="#2b5797" strokeWidth="2" /></>),
  shortcuts: icon("0 0 16 16", <><path d="M12.5 2.5h-9l5 5.5-5 5.5h9" fill="none" stroke="#7b3fb5" strokeWidth="2" /></>),
  checklist: icon("0 0 16 16", <><path d="M1.5 4h3M1.5 8h3M1.5 12h3" stroke="#555" strokeWidth="1.5" /><path d="M7 8.5l2.5 2.5L14.5 5" fill="none" stroke="#2e9e44" strokeWidth="2" /></>),
  parameters: icon("0 0 16 16", <><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#c76b12" /><path d="M1.5 6h13M6 2.5v11" stroke="#c76b12" /></>),
  recalculate: icon("0 0 16 16", <><path d="M13.5 8A5.5 5.5 0 113 5" fill="none" stroke="#2e9e44" strokeWidth="2" /><path d="M1.5 2.5L3 5.5 6 4" fill="none" stroke="#2e9e44" strokeWidth="1.5" /></>),
  byExample: icon("0 0 16 16", <><path d="M2 14L11 5" stroke="#6b4a2b" strokeWidth="2" /><path d="M12 1.5v2.5M14.5 4h-2M13.5 2.5l-1 1" stroke="#e0a800" strokeWidth="1.5" /></>),
  graphType: icon("0 0 16 16", <><rect x="2" y="8" width="3" height="6.5" fill="#2b7bd6" /><rect x="6.5" y="3.5" width="3" height="11" fill="#e8553a" /><rect x="11" y="6" width="3" height="8.5" fill="#2e9e44" /></>),
  formatGraph: icon("0 0 16 16", <><path d="M2.5 8l5-5 5 5-5 5z" fill="#f4f4f4" stroke="#444" /><path d="M13 9c1 1.6 1 3 0 3s-1-1.4 0-3z" fill="#2b7bd6" /><path d="M1 15h14" stroke="#e8a33d" strokeWidth="2" /></>),
  formatAxes: icon("0 0 16 16", <><path d="M3.5 1.5v11h11" fill="none" stroke="#333" strokeWidth="1.5" /><path d="M3.5 4.5H1.5M3.5 8.5H1.5M7 12.5v2M11 12.5v2" stroke="#333" /></>),
  sort: icon("0 0 16 16", <><path d="M4 2v12M1.5 11.5L4 14l2.5-2.5" fill="none" stroke="#2b5797" strokeWidth="1.5" /><path d="M8.5 7l2-5 2 5M9.2 5.3h2.6M8.5 9h4l-4 5h4" fill="none" stroke="#333" strokeWidth="1.3" /></>),
  colorScheme: icon("0 0 16 16", <><circle cx="8" cy="8" r="6.5" fill="#f6e7c8" stroke="#a07a3a" /><circle cx="5.3" cy="6" r="1.4" fill="#d13438" /><circle cx="9" cy="4.6" r="1.4" fill="#2b7bd6" /><circle cx="11.3" cy="8" r="1.4" fill="#2e9e44" /></>),
  pairwise: icon("0 0 16 16", <><path d="M3 12V7h10v5" fill="none" stroke="#333" strokeWidth="1.5" /><path d="M6 4l2-2 2 2" fill="none" stroke="#d13438" strokeWidth="1.5" /></>),
  magic: icon("0 0 16 16", <><path d="M2 14l8-8" stroke="#333" strokeWidth="2" /><path d="M11 1.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="#e0a800" /></>),
  decimal: icon("0 0 16 16", <><path d="M2 4v8M5 12h.5M8 4.5c1.5-1.3 3.5-.5 3 1.3L8 12h3.5" fill="none" stroke="#333" strokeWidth="1.5" /></>),
  importData: icon("0 0 30 30", <><rect x="10" y="8" width="18" height="18" fill="#fff" stroke="#2b5797" /><path d="M10 14h18M10 20h18M16 8v18M22 8v18" stroke="#2b5797" /><path d="M2 13c2-8 10-9 13-4" fill="none" stroke="#e8553a" strokeWidth="2.6" /><path d="M15.5 4.5L15 9.5 10.5 8" fill="none" stroke="#e8553a" strokeWidth="2" /></>),
  drawLine: icon("0 0 16 16", <><path d="M2 14L14 2" stroke="#d13438" strokeWidth="1.5" /></>),
  drawShape: icon("0 0 16 16", <><rect x="2" y="3.5" width="12" height="9" fill="none" stroke="#555" strokeWidth="1.3" /></>),
  equation: icon("0 0 16 16", <><path d="M1.5 9h2l2 5 3-12h6" fill="none" stroke="#666" strokeWidth="1.3" /></>),
  resultsTable: icon("0 0 16 16", <><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#666" /><path d="M1.5 6h13M1.5 9.5h13M6 2.5v11" stroke="#999" /></>),
  exportGraph: icon("0 0 16 16", <><rect x="1.5" y="3" width="10" height="9" fill="#e6f0fb" stroke="#2b5797" /><path d="M3 10.5l3-4 2 2 2-3" fill="none" stroke="#2e9e44" strokeWidth="1.3" /><path d="M10 9.5h5M13 7.5l2 2-2 2" fill="none" stroke="#e8553a" strokeWidth="1.5" /></>),
  exportPdf: icon("0 0 16 16", <><path d="M3 1.5h6.5L13 5v9.5H3z" fill="#fff" stroke="#b02a2a" /><rect x="3" y="8" width="10" height="4" fill="#d13438" /></>),
  print: icon("0 0 16 16", <><rect x="4" y="1.5" width="8" height="4" fill="#fff" stroke="#555" /><rect x="1.5" y="5.5" width="13" height="6" rx="1" fill="#6f6f6f" /><rect x="4" y="9.5" width="8" height="5" fill="#fff" stroke="#555" /></>),
  printLayout: icon("0 0 16 16", <><rect x="2.5" y="1.5" width="11" height="13" fill="#fff" stroke="#555" /><rect x="4.5" y="3.5" width="3" height="3" fill="#2b7bd6" /><rect x="8.5" y="3.5" width="3" height="3" fill="#e8553a" /><rect x="4.5" y="8.5" width="7" height="4" fill="#2e9e44" /></>),
  email: icon("0 0 16 16", <><rect x="1.5" y="3.5" width="13" height="9" fill="#fff" stroke="#2b5797" /><path d="M1.5 3.5L8 9l6.5-5.5" fill="none" stroke="#2b5797" /></>),
  share: icon("0 0 16 16", <><circle cx="4" cy="8" r="2" fill="#2b7bd6" /><circle cx="12" cy="3.5" r="2" fill="#2b7bd6" /><circle cx="12" cy="12.5" r="2" fill="#2b7bd6" /><path d="M4 8l8-4.5M4 8l8 4.5" stroke="#2b7bd6" /></>),
  help: icon("0 0 16 16", <><circle cx="8" cy="8" r="6.5" fill="#2b7bd6" /><path d="M6 6.2a2 2 0 114 0c0 1.5-2 1.4-2 3" fill="none" stroke="#fff" strokeWidth="1.5" /><circle cx="8" cy="11.8" r="1" fill="#fff" /></>),
  tips: icon("0 0 16 16", <><path d="M8 1.5a4.5 4.5 0 00-2.5 8.2V12h5V9.7A4.5 4.5 0 008 1.5z" fill="#f4d03f" stroke="#a67c00" /><path d="M6 13.5h4M6.5 15h3" stroke="#666" /></>),
  previousSheet: icon("0 0 12 12", <><path d="M8 2L4 6l4 4" fill="none" stroke="#333" strokeWidth="1.5" /></>),
  nextSheet: icon("0 0 12 12", <><path d="M4 2l4 4-4 4" fill="none" stroke="#333" strokeWidth="1.5" /></>),
  goData: icon("0 0 16 16", <><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#5a6f8c" /><path d="M1.5 6h13M6 2.5v11" stroke="#5a6f8c" /></>),
  goResults: icon("0 0 16 16", <><rect x="1.5" y="2" width="13" height="12" rx="1" fill="#fff" stroke="#5a6f8c" /><path d="M4 6h8M4 9h8M4 12h5" stroke="#5a6f8c" /></>),
};

export const navigatorIcons = {
  table: icon("0 0 16 16", <><rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#5a6f8c" /><path d="M1.5 6h13M1.5 9.5h13M6 2.5v11M10 2.5v11" stroke="#9fb0c8" /></>),
  graph: icon("0 0 16 16", <><rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#8a8a8a" /><path d="M3.5 12l3-4 2.5 2 4-6" fill="none" stroke="#d13438" strokeWidth="1.3" /></>),
  add: icon("0 0 16 16", <><circle cx="8" cy="8" r="6" fill="none" stroke="#777" /><path d="M8 5v6M5 8h6" stroke="#777" /></>),
  info: icon("0 0 16 16", <><circle cx="8" cy="8" r="6.5" fill="#fff" stroke="#2b7bd6" /><path d="M8 7v4.5" stroke="#2b7bd6" strokeWidth="2" /><circle cx="8" cy="4.8" r="1" fill="#2b7bd6" /></>),
  results: icon("0 0 16 16", <><rect x="1.5" y="2" width="13" height="12" rx="1" fill="#fff" stroke="#5a6f8c" /><path d="M4 6h8M4 9h8M4 12h5" stroke="#5a6f8c" /></>),
  layout: icon("0 0 16 16", <><rect x="2.5" y="1.5" width="11" height="13" fill="#fff" stroke="#8a8a8a" /><rect x="4.5" y="3.5" width="3" height="3" fill="#2b7bd6" /><rect x="8.5" y="3.5" width="3" height="3" fill="#e8553a" /><rect x="4.5" y="8.5" width="7" height="4" fill="#2e9e44" /></>),
};

/** Small drop-down arrow beside ribbon buttons that open a menu. */
export const dropArrow = (
  <svg className="dd" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
    <path d="M1 2.5h6L4 6z" fill="currentColor" />
  </svg>
);
/** Section chevron in the navigator. */
export const chevron = (
  <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M1.5 3l3.5 3.5L8.5 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
export const searchIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="#666" strokeWidth="1.5" />
    <path d="M10 10l4.5 4.5" stroke="#666" strokeWidth="1.5" />
  </svg>
);
