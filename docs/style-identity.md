# Dataset appearance identity and dense rendering

This follow-up starts from `f5d3eed` (PR #15). It keeps the current macOS-style
window, Welcome window, first-view graph-type chooser, non-modal Format Graph
sheet, in-place text editors, Analyze Data and Export dialogs. It repairs the
existing `graph.dataset_styles` map and rendering paths; it adds no appearance
controls or alternate style schema.

## Basis and limits

The retained [Format Graph evidence](prism-graph-format-evidence.md) establishes
selected-dataset appearance and separate symbol/color/size controls in the
shipped Column and XY resources:

| Retained source | REA Evidence ID | Recorded Appearance NIB SHA-256 |
| --- | --- | --- |
| XY | `ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f` | `443996d58ae7e6ce26178b4c267c6ab19fc72ece16a2e7c7d8bf6ea3497ef781` |
| Column | `ev_ff9c5094b7f4562421c7eeb24cd8c987d2500186575f364afba7c00b229ecc31` | `2cebcc2cfff0da4744bae7c7d7afbc1c202bfc48073f9e5764451419a0de38c6` |

These are reused, previously recorded hashes and Evidence IDs. No original
Prism resource was rehashed or decoded in this session, and no live Prism
comparison ran. The newer UI observations recorded in
[completion progress](completion-progress.md), under the macOS window and
Prism behavior batches, are a separate visual/runtime source and remain intact.
Native defaults, exact marker geometry, picking tolerances, style persistence
and Global/subset behavior are not established by these archive records.

## GP contract repaired

`graph.dataset_styles` remains an optional object keyed by stable source-column
ID. Its existing fill, pattern, border, symbol, error-bar and line-width fields
retain their current meaning. The numerical export API still receives resolved
styles in plotted order through `graph.styles`.

- Importing a single-table project or duplicating a data sheet creates new
  column identities and remaps appearance to those identities. The copied
  appearance does not alias the original.
- Removing a dataset only from a graph preserves its remembered appearance,
  including across save, reload, file import and re-addition. Deleting a source
  column prunes styles for that missing source. Frozen graph snapshots preserve
  the historical source and its appearance; thawing reconciles with live IDs.
- Dense canvas symbols use the same existing shape, fill color and size rules
  as sparse SVG symbols. Hidden symbols do not draw or intercept another
  dataset's hit target. Large visible symbols remain selectable near their
  outer extent. These presentation choices do not alter source cells,
  statistical inputs, axis bounds or connecting-line observations.
- Numeric appearance options in the export API require actual numbers from
  the supported choices; booleans and numeric strings do not pass as weights
  or symbol sizes.

Existing GP marker geometry is retained: symbol radius is `size + 0.2` graph
units; square half-side is `0.9 × radius`; triangle and diamond use their
existing path proportions. These values are GP drawing rules, not recovered
Prism physical units. The dense threshold counts visible symbol observations;
the total input observations remain in the scientific geometry.

## Regression coverage

[`scripts/check_style_identity.py`](../scripts/check_style_identity.py) drives
the current UI and real JSON importer on both packaged-server and static builds.
It preserves a partial JSON report and screenshot on failure. CI retains its
artifacts alongside the existing Format Graph, dataset-order and Prism-dialog
checks.

The deterministic sparse fixture has four distinct visible symbols and two
hidden observations. Its dense twin has 6,261 total observations, of which
5,008 have visible symbols. Isolated center, tip, corner and outside samples
check the actual canvas pixels against the sparse SVG raster. A hidden final
series overlaps a visible point to test nearest-point filtering; a size-10
diamond is clicked 11 graph units from its center at 200% zoom to test the
large-marker extent. The source-row action must still focus the correct cell.

The same script checks selected-dataset Apply/edit/Cancel and undo/redo,
ownership through omit/save/reload/import/re-addition, data-sheet duplication
with new identities, the inherited graph's first-view type chooser, and actual
SVG export through the current Export dialog. The export payload's shapes,
sizes, colors and visibility are checked in addition to rendered SVG colors.

## Validation on 2026-10-20

The final production and static builds passed the new seven-group browser
regression on the first attempt, with no page or console errors. Both also
passed the existing `check_format_graph.py` suite, which covers Global and
single-dataset edits, undo/redo, reload, legend, double-click scoping, SVG export
and horizontal wrapping. No application or harness corrections were made
between these final runs.

| Final check | Packaged server | Self-contained static |
| --- | --- | --- |
| New style identity suite | 7 groups passed, 3.601 s | 7 groups passed, 12.110 s |
| Existing Format Graph suite | Passed, 2.014 s | Passed, 10.346 s |

The coordinating agent's full runs passed **530 backend tests and 298 frontend
tests**, both builds and all **19 locked browser-runtime packages**. The local
environment was Python 3.12.14, Node 24.19.0 (repository pin 24.18.0), Playwright
1.58.0 and Chromium 153.0.8010.0 on Linux. These are local validation results;
hosted CI and deployment must be recorded separately.

The [retained manifest](validation/style-identity/manifest.json) identifies the
base commit, exact tested source hashes, final reports, screenshots and SVG
artifacts. The [server report](validation/style-identity/server/report.json)
and [static report](validation/style-identity/static/report.json) retain each
scenario result, fixture hashes, pixel samples, timestamps and console/page
errors. The source-deletion and frozen/thaw contracts are covered by
`web/src/workbook-style-identity.test.ts`; the new browser suite does not claim
to exercise those additional state transitions.

Desktop sparse/dense and Format Graph screenshots were visually inspected. At
390 × 844 the existing Format Graph check verifies horizontal containment, but
the tall ribbon/navigation places much of the dialog below the initial
viewport. This check does not establish complete mobile usability. The follow-up
does not change that existing layout.

Historical results from the unpublished `e6e6d45` branch do not validate this
current-main follow-up and were not reused in these counts or artifacts.
