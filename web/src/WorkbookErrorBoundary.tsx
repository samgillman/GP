import { Component } from "react";
import type { ReactNode } from "react";
import { errorMessage } from "./error-message.ts";
import { recoveryFile } from "./render-recovery.ts";
import { download } from "./data.ts";

type Props = { children: ReactNode };
type State = { error: string | null; downloadError: string | null };

export class WorkbookErrorBoundary extends Component<Props, State> {
  state: State = { error: null, downloadError: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: errorMessage(error), downloadError: null };
  }

  saveRecovery = () => {
    try {
      const file = recoveryFile();
      if (!file)
        throw new Error(
          "No workbook is available to download in this session or browser storage.",
        );
      download(
        new Blob([file.text], { type: "application/json" }),
        file.filename,
      );
      this.setState({ downloadError: null });
    } catch (error) {
      this.setState({ downloadError: errorMessage(error) });
    }
  };

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main
        style={{
          maxWidth: 680,
          margin: "48px auto",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          overflowWrap: "anywhere",
        }}
      >
        <h1>The workbook could not be displayed</h1>
        <p role="alert">{this.state.error}</p>
        <p>
          Download your latest workbook before retrying. Retrying does not clear
          browser storage.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button type="button" onClick={this.saveRecovery}>
            Download workbook
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null, downloadError: null })}
          >
            Retry display
          </button>
        </div>
        {this.state.downloadError && (
          <p role="alert">{this.state.downloadError}</p>
        )}
      </main>
    );
  }
}
