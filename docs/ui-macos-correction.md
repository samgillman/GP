# macOS workbook appearance correction

The initial GP interface used a dark sidebar, large page headings, cards, and widely spaced inputs. Those choices did not resemble Prism for macOS. This correction rebuilds the application shell around a compact desktop workbook.

- Light disclosure navigator for Data Tables, Results, and Graphs, with a separate Family pane.
- Small document title, working application menus, and grouped toolbar commands.
- Full-sheet grid with group/title/type headers, row numbers, blue focus selection, and editable empty rows and columns.
- White graph page on a gray workspace, and tabular results with statistics arranged down rows.
- New Table dialog with table-family navigation and a preview; Analyze dialog with analysis and dataset lists; Format Graph dialog with three tabs and standard Apply/OK/Cancel controls.
- Modal focus containment, Escape cancellation, and focus restoration. The separate grouped/survival workspace also uses compact neutral controls.

## Current GP screenshots

These are screenshots of the implemented browser app, captured by `scripts/check_desktop_ui.py` at 1440 × 900. They are not screenshots of Prism.

![GP data sheet](images/data.png)

![GP analysis dialog](images/analyze.png)

![GP graph sheet](images/graph.png)

![GP graph formatting](images/format-graph.png)

![GP results](images/results.png)

[New-table dialog](images/new-table.png) · [Mobile dialog](images/mobile-dialog.png)

## Reference evidence and limits

The subsequent [user-supplied Prism 10.3.1 guide](prism10-guide-findings.md) adds 51 embedded image occurrences and reported runtime workflows. It informs the new dark appearance; its evidence is versioned separately from the Prism 11 target.

The [reference manifest](ui-visual-references.json) records official GraphPad image URLs, source hashes, observed platform, and the purpose of each reference. The macOS window image in the current guide illustrates an older Sierra-era window; its presence in the Prism 11 guide does not establish that it depicts Prism 11.1. The current product illustrations supplement the recovered installer controls documented in [the UI structure map](prism-ui-map.md).

This is a substantial visual correction, not verified pixel or interaction equivalence with Prism 11.1.0. Icons are independently supplied by Lucide. Exact native spacing, fonts, menus, full inspector behavior, spreadsheet selection/navigation, graph rendering defaults, and unsupported table/analysis families remain incomplete. No running Prism reference was available. Proprietary screenshots and application assets are not embedded in GP.

## Validation

Both server and static frontend builds pass, as do the 25 frontend tests. Chromium checks cover the existing workbook import/analyze/recalculate/save/open workflow, graph formatting transactions, undo/redo, recovery, scientific reference cases, and SVG/PNG/PDF export. The desktop-specific check verifies editing an empty cell expands the actual dataset, undo restores it, menu dismissal works, modal focus is contained and restored, graphs are visible without the data sheet covering them, results render, and mobile dialogs fit the viewport.

To repeat the desktop check against a running static build, install Playwright in your test environment, install its Chromium browser, and run:

```bash
python scripts/check_desktop_ui.py http://127.0.0.1:8001
```

For an existing Chromium installation, set `GP_CHROMIUM` to its executable path. Set `GP_SCREENSHOTS` to change the output directory (default `/tmp/gp-desktop-ui`). These checks demonstrate GP behavior; they do not compare against an executing Prism application.

## Second correction: Prism-style sheets (2026-10-19)

User feedback: the app still did not feel or work like Prism. A review of GP's own screenshots found GP-specific chrome on every sheet and a dashboard-style graph. This pass removes that chrome and moves each function to the place recorded Prism resources put it. No Prism screenshot could be compared in this session: the cloud container had no copy of the user's Prism 10 guide images, and its network policy blocked graphpad.com.

| Change | Basis |
|---|---|
| Graph type moves from on-page buttons to **Change → Change Graph Type…** and a toolbar button | `ChangeGraphType.nib` is a separate dialog ([UI map](prism-ui-map.md)) |
| Table kind moves from an on-sheet select to **Change → Format Data Table…** (Kind of table) | `FormatDataTable.nib` `Kind of table:` |
| Nonlinear model choice moves into the Analyze dialog | Guide §3.3–3.4: analysis selection is followed by its parameters ([findings](prism10-guide-findings.md)) |
| Zoom controls move to a compact strip below the graph; the View menu presets remain | `MainMenu.nib` zoom items ([UI evidence](prism-ui-rea-evidence.md)) |
| Graph export moves to **File → Export graph as SVG/PNG/PDF…** | GP placement modeled on a File-menu export command, not observed natively |
| The ANALYSIS strip appears only on results sheets; the data sheet keeps just the grid | `Document.nib` outlets: navigator, sheet, inspector, toolbar and status bar only |
| Sample data comes from **New Data Table and Graph → Start with sample data** | GP adaptation; the exact native wording is unverified |
| Add row/Add column buttons and empty-column "Series N" placeholders removed; the grid grows as values are typed | GP choice for a spreadsheet-like sheet |
| Journal-style graphs: black 1.5-pt axes with outward ticks, no gridlines, Arial, bold titles, black error bars and mean lines, solid fitted curves, outlined bars; column graphs have no legend or caption | GP styling informed by Prism's typical defaults; **not** a pixel or default-setting comparison |
| The Matplotlib export uses the same axis, tick, font, bar, error-bar and point styling as the screen | Keeps exported figures consistent with the preview |
| Results are a numbered grid with lettered data-set columns; method notes appear as a list below | Spreadsheet-style results sheet; exact native row labels and order are not recovered |

Open: a row-title column, subcolumn/replicate headers, a full Format Axes dialog, the inspector, native default fonts/sizes and graph defaults, results tabs, parameter dialogs for every analysis, and side-by-side visual verification against Prism.
