/* Toolbar, navigator and bottom-bar icons drawn after GraphPad Prism for
   macOS (Prism 10/11 toolbar as shown on the user's Mac). Decorative: every
   control that shows one carries its own accessible label. */
import type { ReactElement } from "react";

const icon = (body: ReactElement, viewBox = "0 0 16 16") => (
  <svg viewBox={viewBox} aria-hidden="true" focusable="false">{body}</svg>
);
const page = (fill = "#fff", stroke = "#9a9a9a") => (
  <>
    <path d="M3.5 1.5h6l3 3v10h-9z" fill={fill} stroke={stroke} />
    <path d="M9.5 1.5v3h3" fill="none" stroke={stroke} />
  </>
);

export const ribbonIcons = {
  // File
  newFile: icon(page()),
  open: icon(<>
    <path d="M3.5 1.5h6l3 3v10h-9z" fill="#f6d36b" stroke="#b58b1a" />
    <path d="M6 9h5M9 7l2 2-2 2" fill="none" stroke="#2f9b47" strokeWidth="1.6" />
  </>),
  save: icon(<>
    <rect x="2" y="2" width="12" height="12" rx="1.5" fill="#6d6d6d" />
    <rect x="4.5" y="2" width="7" height="4" fill="#d9d9d9" />
    <rect x="4" y="9" width="8" height="5" fill="#a9a9a9" />
  </>),
  saveAs: icon(<>
    <rect x="2" y="2" width="12" height="12" rx="1.5" fill="#6d6d6d" />
    <rect x="4.5" y="2" width="7" height="4" fill="#d9d9d9" />
    <rect x="4" y="9" width="8" height="5" fill="#ececec" />
  </>),
  // Sheet
  highlight: icon(<>
    <path d="M4 11l2-5 5.5-4.5 2.5 2.5L9.5 9.5z" fill="#f2c94c" stroke="#a87b00" />
    <path d="M2 14.5h9" stroke="#f2c94c" strokeWidth="2.6" />
  </>),
  freeze: icon(<path d="M8 1v14M2 4.5l12 7M14 4.5l-12 7M6.5 2.3L8 3.8l1.5-1.5M6.5 13.7L8 12.2l1.5 1.5" fill="none" stroke="#6cc3f5" strokeWidth="1.5" />),
  pin: icon(<path d="M9.5 1.5l5 5-2 .5-2.5 2.5.5 3-1 1-3-3-3.5 3.5-.5-.5L6 10l-3-3 1-1 3 .5 2.5-2.5z" fill="#f4c542" stroke="#9a6a00" />),
  deleteSheet: icon(<>
    <path d="M3.5 4.5h9l-.9 10h-7.2z" fill="none" stroke="#f0704a" strokeWidth="1.4" />
    <path d="M2.5 4.5h11M6 2h4M6.5 7v5.5M9.5 7v5.5" stroke="#f0704a" strokeWidth="1.3" />
  </>),
  newSheet: icon(<path d="M8 2v12M2 8h12" stroke="#5cc26b" strokeWidth="2.6" />),
  newTableGraph: icon(<>
    <path d="M2.5 1.5v12.5H15" fill="none" stroke="#5cc26b" strokeWidth="1.5" />
    <path d="M9 3v8M5 7h8" stroke="#5cc26b" strokeWidth="2.2" />
  </>),
  // Undo
  undo: icon(<path d="M4.5 4.5A5 5 0 1 1 3 8.5M4.5 1.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" />),
  redo: icon(<path d="M11.5 4.5A5 5 0 1 0 13 8.5M11.5 1.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.4" />),
  // Clipboard
  cut: icon(<>
    <circle cx="4" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 10.3L11.5 1.5M10.5 10.3L4.5 1.5" stroke="currentColor" strokeWidth="1.3" />
  </>),
  copy: icon(<>
    <path d="M2.5 1.5h7v10h-7z" fill="#4c9be8" />
    <path d="M6 4.5h7v10H6z" fill="#fff" stroke="#9a9a9a" />
  </>),
  copyPicture: icon(<>
    <rect x="2" y="2" width="8" height="8" fill="#3f7d4c" />
    <rect x="6" y="6" width="8" height="8" fill="#4b9a5b" />
  </>),
  paste: icon(<>
    <rect x="2.5" y="3" width="11" height="12" rx="1" fill="#ef6b4a" />
    <rect x="5" y="1.5" width="6" height="3" rx="1" fill="#f2f2f2" />
    <rect x="4.5" y="6" width="7" height="7" fill="#fff" />
  </>),
  // Analysis
  shortcutLine: icon(<>
    <path d="M2 2v12h12" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 8h2M8 8h2M12 8h2" stroke="#4ea3f1" strokeWidth="1.4" />
  </>),
  shortcutFit: icon(<>
    <path d="M2 2v12h12" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 11h2M8 7h2M12 4h2" stroke="#4ea3f1" strokeWidth="1.4" />
  </>),
  analyze: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#f4f4f4" stroke="#8d8d8d" />
    <path d="M4.5 6h7M4.5 10h7" stroke="#6b6b6b" strokeWidth="1.6" />
  </>),
  parameters: icon(<>
    <rect x="1.5" y="3.5" width="13" height="11" fill="#fff" stroke="#e0803a" />
    <path d="M1.5 7h13M6 3.5v11" stroke="#e0803a" />
    <path d="M10 1.5l3 2.5-3 2.5" fill="none" stroke="#4ea3f1" strokeWidth="1.5" />
  </>),
  recalculate: icon(<>
    <path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.8" fill="none" stroke="#5cc26b" strokeWidth="1.8" />
    <path d="M9.5 1.5l3 2.5-2.8 2.6" fill="none" stroke="#5cc26b" strokeWidth="1.5" />
  </>),
  byExample: icon(<>
    <path d="M2 14L10 6" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 1.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="#f2c94c" />
  </>),
  // Change
  graphType: icon(<>
    <rect x="1.5" y="7" width="3.5" height="7.5" fill="#4c9be8" />
    <rect x="6.25" y="3" width="3.5" height="11.5" fill="#ef6b4a" />
    <rect x="11" y="5.5" width="3.5" height="9" fill="#5cc26b" />
  </>),
  formatAxes: icon(<>
    <path d="M3.5 1.5v11h11" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 9l4-4M10 5H7.5M10 5v2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </>),
  formatGraph: icon(<>
    <rect x="2" y="9" width="3" height="5.5" fill="#5cc26b" />
    <rect x="6.5" y="6" width="3" height="8.5" fill="#ef6b4a" />
    <path d="M11 6l3.5-3.5M14.5 2.5H12M14.5 2.5V5" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </>),
  sort: icon(<>
    <path d="M4 2v12M1.5 11.5L4 14l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8.5 7l2-5 2 5M9.2 5.3h2.6M8.5 9h4l-4 5h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </>),
  magic: icon(<>
    <path d="M2 14l8-8" stroke="currentColor" strokeWidth="1.8" />
    <path d="M11.5 1.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="#f2c94c" />
  </>),
  addData: icon(<>
    <rect x="2" y="2" width="9" height="12" fill="#fff" stroke="#9a9a9a" />
    <rect x="4" y="8" width="2" height="4" fill="#ef6b4a" />
    <path d="M12.5 8v6M9.5 11h6" stroke="#f2c94c" strokeWidth="2" />
  </>),
  pairwise: icon(<>
    <path d="M3 13V7h10v6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 4l2-2 2 2M8 2v4" fill="none" stroke="#ef6b4a" strokeWidth="1.5" />
  </>),
  colorScheme: icon(<>
    <circle cx="6" cy="6" r="4" fill="#ef6b4a" fillOpacity=".9" />
    <circle cx="10" cy="6" r="4" fill="#5cc26b" fillOpacity=".8" />
    <circle cx="8" cy="10" r="4" fill="#4c9be8" fillOpacity=".8" />
  </>),
  formatTable: icon(<>
    <rect x="1.5" y="2.5" width="13" height="11" fill="#fff" stroke="#9a9a9a" />
    <path d="M1.5 6h13M1.5 9.5h13M6 2.5v11M10 2.5v11" stroke="#4c9be8" />
  </>),
  exclude: icon(<path d="M8 2v12M3 5l10 6M13 5L3 11" stroke="#4ea3f1" strokeWidth="1.8" />),
  // Data
  transform: icon(<text x="8" y="12.5" textAnchor="middle" fontFamily="Times New Roman, serif" fontStyle="italic" fontSize="12" fill="currentColor">fx</text>),
  decimals: icon(<>
    <text x="8" y="7.5" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="7" fill="currentColor">123</text>
    <path d="M8 9v5M6 12l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.1" />
  </>),
  roundTo: icon(<text x="8" y="11" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="7.5" fill="currentColor" textDecoration="line-through">t.23</text>),
  // Import / Export
  importData: icon(<>
    <rect x="9" y="6" width="19" height="20" fill="#fff" stroke="#9a9a9a" />
    <path d="M9 12h19M9 18h19M15.5 6v20M22 6v20" stroke="#4c9be8" />
    <path d="M2 4h9v12H2z" fill="#fff" stroke="#9a9a9a" />
    <text x="6.5" y="9.5" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="4.2" fill="#333">txt</text>
    <text x="6.5" y="14" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="4.2" fill="#333">xml</text>
    <path d="M5 19c1 4 4 5 8 4" fill="none" stroke="#ef6b4a" strokeWidth="2" />
  </>, "0 0 30 30"),
  exportGraph: icon(<>
    <rect x="2" y="9" width="15" height="17" fill="#fff" stroke="#9a9a9a" />
    <rect x="5" y="17" width="2.5" height="6" fill="#5cc26b" />
    <rect x="9" y="14" width="2.5" height="9" fill="#ef6b4a" />
    <path d="M14 3h10l4 4v13H14z" fill="#fff" stroke="#9a9a9a" />
    <text x="21" y="11.5" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="5" fill="#333">tiff</text>
    <text x="21" y="17" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="5" fill="#333">bmp</text>
    <path d="M10 27c4 1 8-1 9-5" fill="none" stroke="#ef6b4a" strokeWidth="2" />
  </>, "0 0 30 30"),
  exportPdf: icon(<>
    {page()}
    <rect x="3.5" y="8" width="9" height="4" fill="#e5483a" />
  </>),
  // Arrange / Draw
  arrange: icon(<rect x="3" y="2" width="10" height="12" fill="#4ea3f1" stroke="#cfe8ff" />),
  layers: icon(<>
    <rect x="2" y="5" width="8" height="8" fill="#5cc26b" />
    <rect x="6" y="2" width="8" height="8" fill="#4ea3f1" fillOpacity=".85" />
  </>),
  drawLine: icon(<>
    <path d="M2 12h12" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 3l1 2.2 2.4.3-1.8 1.6.5 2.4L8 8.3l-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="#ef6b4a" />
  </>),
  compactLetters: icon(<>
    <rect x="2" y="9" width="3" height="5.5" fill="#5cc26b" />
    <rect x="7" y="6" width="3" height="8.5" fill="#ef6b4a" />
    <text x="8" y="5" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="5" fill="currentColor">CLD</text>
  </>),
  drawShape: icon(<rect x="2" y="3.5" width="12" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" />),
  riskTable: icon(<path d="M2 3v10h12M3 5h3v3h3v3h4" fill="none" stroke="#9a9a9a" strokeWidth="1.2" />),
  // Write / Text
  infoNote: icon(<>
    <circle cx="7" cy="7" r="5.5" fill="#fff" />
    <path d="M7 6v4" stroke="#2f6fd6" strokeWidth="1.8" />
    <circle cx="7" cy="4" r="1" fill="#2f6fd6" />
    <path d="M12.5 10v5M10 12.5h5" stroke="#f2c94c" strokeWidth="2" />
  </>),
  alpha: icon(<text x="8" y="12.5" textAnchor="middle" fontFamily="Times New Roman, serif" fontSize="14" fill="currentColor">α</text>),
  textBox: icon(<text x="8" y="13" textAnchor="middle" fontFamily="Times New Roman, serif" fontSize="15" fill="currentColor">T</text>),
  framedText: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="currentColor" />
    <text x="8" y="12.5" textAnchor="middle" fontFamily="Times New Roman, serif" fontSize="12" fill="currentColor">T</text>
  </>),
  // Send / Help
  share: icon(<path d="M8 1.5v9M5 4.5l3-3 3 3M4.5 7.5H3v7h10v-7h-1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />),
  cube: icon(<path d="M8 1.5l6 3.2v6.6l-6 3.2-6-3.2V4.7zM2 4.7l6 3.3 6-3.3M8 8v6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />),
  email: icon(<>
    <rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="#4ea3f1" />
    <path d="M1.5 3.5L8 9l6.5-5.5" fill="none" stroke="#4ea3f1" />
  </>),
  shareLink: icon(<>
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="#4ea3f1" strokeWidth="1.3" />
    <path d="M6 4.5v6.5h4" fill="none" stroke="#4ea3f1" strokeWidth="1.6" />
  </>),
  videos: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="#f2c94c" strokeWidth="1.2" />
    <path d="M6 4.5v7l5.5-3.5z" fill="#4ea3f1" />
  </>),
  tips: icon(<rect x="2" y="2" width="12" height="12" fill="#8a8a8a" />),
  help: icon(<>
    <circle cx="8" cy="8" r="6.5" fill="#f2f2f2" />
    <path d="M6 6.2a2 2 0 114 0c0 1.5-2 1.4-2 3" fill="none" stroke="#333" strokeWidth="1.5" />
    <circle cx="8" cy="11.8" r="1" fill="#333" />
  </>),
  // Bottom bar
  toggleNavigator: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="#f2f2f2" />
    <path d="M5 3.5v9" stroke="#444" strokeWidth="1.5" />
    <path d="M12 4.5l-4 3.5 4 3.5z" fill="#444" />
  </>),
  previousSheet: icon(<path d="M11 2.5L4 8l7 5.5z" fill="#4fbf4a" />),
  nextSheet: icon(<path d="M5 2.5L12 8l-7 5.5z" fill="#4fbf4a" />),
  findSheet: icon(<>
    <circle cx="7" cy="7" r="4.5" fill="#4fbf4a" />
    <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="6" r="1.5" fill="#fff" />
  </>),
  singleSheet: icon(<path d="M4 1.5h6l3 3v10H4zM10 1.5v3h3" fill="none" stroke="currentColor" />),
  gallery: icon(<path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" fill="none" stroke="currentColor" />),
  viewData: icon(<>
    <rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="currentColor" />
    <path d="M1.5 6h13M1.5 9.5h13M5.5 2.5v11M10 2.5v11" stroke="currentColor" strokeWidth=".8" />
  </>),
  viewInfo: icon(<>
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" />
    <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8" cy="4.8" r=".9" fill="currentColor" />
  </>),
  viewResults: icon(<path d="M1.5 4.5h13v3h-13zM1.5 9.5h13v3h-13z" fill="none" stroke="currentColor" />),
  viewGraph: icon(<path d="M2 2v12h12M3.5 11.5l3-4 2.5 2 4.5-6" fill="none" stroke="currentColor" strokeWidth="1.1" />),
  viewLayout: icon(<path d="M2 2v12h12M2 5h12M4 8h2M7 10h2M10 7h2" fill="none" stroke="currentColor" strokeWidth="1" />),
  link: icon(<path d="M7 9l2-2M5.5 7.5L4 9a2.1 2.1 0 003 3l1.5-1.5M10.5 8.5L12 7a2.1 2.1 0 00-3-3L7.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />),
  zoomOut: icon(<>
    <circle cx="6.5" cy="6.5" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4.3 6.5h4.4M10 10l4 4" stroke="currentColor" strokeWidth="1.3" />
  </>),
  zoomIn: icon(<>
    <circle cx="6.5" cy="6.5" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4.3 6.5h4.4M6.5 4.3v4.4M10 10l4 4" stroke="currentColor" strokeWidth="1.3" />
  </>),
  statusSheet: icon(<>
    <rect x="1.5" y="3.5" width="11" height="10" fill="#8a8a8a" />
    <path d="M1.5 7h11M1.5 10h11M5 3.5v10M9 3.5v10" stroke="#bdbdbd" strokeWidth=".7" />
    <path d="M10 1.5l4.5 3-3 1.5z" fill="#ef6b4a" />
  </>),
};

export const navigatorIcons = {
  table: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#4c7fd1" />
    <path d="M1.5 5h13M1.5 8h13M1.5 11h13M5.5 1.5v13M10 1.5v13" stroke="#4c7fd1" strokeWidth=".8" />
    <rect x="1.5" y="1.5" width="13" height="3.5" fill="#4c7fd1" />
  </>),
  graph: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#8b6fbf" />
    <path d="M3.5 12.5l3-5 2.5 2.5 4-6" fill="none" stroke="#8b6fbf" strokeWidth="1.3" />
  </>),
  results: icon(<>
    <rect x="1.5" y="1.5" width="13" height="13" fill="#fff" stroke="#e0803a" />
    <path d="M4 5h8M4 8h8M4 11h5" stroke="#e0803a" strokeWidth="1.1" />
  </>),
  info: icon(<>
    <circle cx="8" cy="8" r="6.5" fill="#fff" />
    <path d="M8 7v4.5" stroke="#2f6fd6" strokeWidth="1.8" />
    <circle cx="8" cy="4.6" r="1.1" fill="#2f6fd6" />
  </>),
  layout: icon(<>
    <rect x="2.5" y="1.5" width="11" height="13" fill="#fff" stroke="#9a9a9a" />
    <rect x="4.5" y="3.5" width="3" height="3" fill="#4c9be8" />
    <rect x="8.5" y="3.5" width="3" height="3" fill="#ef6b4a" />
    <rect x="4.5" y="8.5" width="7" height="4" fill="#5cc26b" />
  </>),
  add: icon(<>
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" />
    <path d="M8 5v6M5 8h6" stroke="currentColor" />
  </>),
};

/** Small drop-down arrow beside toolbar buttons that open a menu. */
export const dropArrow = (
  <svg className="dd" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
    <path d="M1 2.5h6L4 6z" fill="currentColor" />
  </svg>
);
/** Section disclosure chevron in the navigator. */
export const chevron = (
  <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M1.5 3l3.5 3.5L8.5 3" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
export const searchIcon = (
  <svg viewBox="0 0 20 16" aria-hidden="true" focusable="false">
    <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 10l3.5 3.5M15 6l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
