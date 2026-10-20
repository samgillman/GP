# Format Graph: bounded dialog contract and dataset ordering

This change restructures **Change → Format Graph…** around the retained REA
record for the shipped XY dialog in
[prism-graph-format-evidence.md](prism-graph-format-evidence.md). It does not
establish native Prism parity: the resources prove which controls and groups
ship, not their runtime behavior, defaults or pixel geometry.

Session context: a fresh cloud container (`/home/user/GP`, Node 22.22, Python
3.13) without the Prism installer, extracted image, `/workspace/rea` or
`/workspace/gp-evidence`. No new REA operation was possible; this unit reuses
the committed projection of Evidence
`ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`
(FormatGraphXY, Appearance, Datasets and Graph Settings NIBs with their
recorded SHA-256 hashes). The scope of that record is XY; GP applies the same
dialog to Column graphs as an implementation decision.

## What the dialog now does

- **Appearance** edits one selected data set at a time. A data set popup with
  previous/next buttons selects it (archived selector 319 and 641/648); the
  color control changes only that data set. Style (graph type), Symbols (show
  symbols, label from archived checkbox 654), Error bars (enable plus
  SD/SEM/95% CI) and the graph title follow beneath. Style, symbol and error
  settings remain whole-graph settings in GP's model; the dialog says so rather
  than showing an inert "all data sets" scope control.
- **Data Sets on Graph** is one list headed *Data sets plotted (front to back)*
  with an action column: Add…, Remove, Top, Up, Reverse, Down, Bottom
  (archived buttons 230/96/145/153/112/59/8). Add… opens a bounded chooser of
  the same table's other data sets. The list is keyboard navigable and shows
  each data set's color swatch. Replace, nudge offsets, row skipping and
  cross-table sources are not added.
- **Graph Settings** keeps GP's linked-analysis choice and states that the
  shipped page's missing-value, individual-point and line-of-identity options
  are not implemented.
- **Footer** places Change Graph Type… at the left and Apply, Cancel, OK at the
  right in the archived order (objects 76, 70, 63, 56). Change Graph Type…
  applies pending edits, closes Format Graph and opens the existing Change
  Graph Type dialog. That apply-then-switch rule is a GP choice.
- **Double-clicking** a data set's bars, box, line or points opens Format Graph
  on that data set (shipped routing is not observed; this is GP's entry route).
  Double-clicks on bars previously never reached the handler because the
  viewport took pointer capture on pointerdown; capture now starts only once a
  drag moves.

## Front-to-back drawing and color ownership

The archive text states that higher data sets in the list draw in front of
lower ones. GP's browser SVG, dense canvas layer, selection rings and
hit-testing now draw and resolve the first listed data set in front
(`drawOrder` in `plot-geometry.ts`), and the Matplotlib exporter ranks XY
point and line layers the same way (`_series_zorder`), keeping curves above
marks. Column positions on a categorical axis are unchanged because they use
list order, not z order. This is a rendering rule taken from the resource
text; no native overlap rendering was compared.

Colors are stored positionally (`graph.colors[position]`). The dialog's
helpers in `graph-datasets.ts` expand the cycling list to one explicit entry
per plotted data set and permute colors with the data sets, so Top/Up/Down/
Bottom/Reverse/Remove keep each data set's color and Add… assigns the next
cycle color at the back. Graphs with more than 32 data sets keep the
historical cycling behavior. Native color-scheme and per-data-set style
ownership (G031, G110) remain open; this is ownership within the dialog's
operations, not a schema change.

## Explicit GP choices and unfinished work

- The 700 px dialog, two-column groups, swatches and responsive collapse are
  GP choices; archived frames establish grouping only.
- Error bar enable/type is one stored field (`graph.error`); the dialog
  remembers the last type while error bars are off.
- A removed data set loses its custom color; re-adding it uses the next cycle
  color. Prism's behavior here is unknown.
- Per-data-set symbols, bars, lines, area fills, legends, right-Y assignment,
  global/subset scope, Replace, offsets, row skipping, cross-table Add and the
  Graph Settings options remain open in G019, G031, G040, G043, G044 and
  their audit rows.
- No native screenshot or runtime comparison exists here; passing GP checks
  verify GP behavior only.

## Reproducible checks

- `npm --prefix web run typecheck`
- From `web`: `node --experimental-strip-types --test src/*.test.ts`
  (`graph-datasets.test.ts`, updated `plot-geometry.test.ts`)
- `python -m pytest tests/test_graph_draw_order.py`
- `GP_CHROMIUM=… python3 scripts/check_format_graph.py URL` (CI runs it on
  both builds): selected-data-set color, list operations with color
  ownership, first-listed data set in front, Apply/OK/Cancel, undo/redo,
  double-click entry, Change Graph Type hand-off, reload and a 390 px
  viewport.
