import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import App from "./App";
import { WorkbookErrorBoundary } from "./WorkbookErrorBoundary";
import "./workbook-notifications.css";
import "./desktop.css";
import "./desktop-dark.css";
// The workbook window and Format Graph follow the GP graph-sheet design reference.
import "./prism-shell.css";
import "./format-graph.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorkbookErrorBoundary>
      <App />
    </WorkbookErrorBoundary>
  </React.StrictMode>,
);
