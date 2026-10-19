# Prism point formatting, menus, zoom and tooltip evidence

This pass used the public REA repository launcher to decode actual shipped Prism NIB resources. It confirms a point-formatting context-menu workflow, dataset-formatting controls, zoom menu options and a data-link tooltip structure. It does not establish runtime hit testing, hover timing, pixel geometry or complete menu enablement.

## REA evidence and exact target scope

The initial `decode-interface-builder` run on the original application reached its 64-document limit entirely within Sparkle framework localizations. It supplied no Prism UI coverage. A subsequent focused resource-only collection was rejected because the unchanged Info.plist names `Contents/MacOS/Prism` and the public tool requires that file.

Two new **derived partial bundles**, outside Git, therefore contain the unchanged original executable, unchanged Info.plist and selected unchanged Prism NIBs. No target code was executed. These carriers are analysis inputs, not complete runnable Prism copies. Source/copy manifests record every exact source path, byte length and SHA-256 and verify identical contents.

All artifacts are under `/workspace/gp-evidence/rea-pass4/ui-resources/`:

| Scope | Full REA output | Evidence ID |
|---|---|---|
| Main/context menus, document and data tooltip; four NIBs | `rea-menus-tooltip.json` | `ev_212198e3cb25470fb0235238305c0f50a540af50328dc6518b90657015019b68` |
| XY graph/data/axes formatting and point inspectors; 16 NIBs | `rea-graph-formatting.json` | `ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f` |

Both records identify the unchanged executable SHA-256 `854b63fc6df2712b7c67660142b2e6ff7f1bf755a5d78136fb5bec92e6fbc632`. That digest is the program identity, **not a digest of the selected resource layout**. `menus-copy-manifest.json` and `formatting-copy-manifest.json` establish the layout and each resource's original provenance. Every REA document digest matches its original source/copy digest.

All 20 selected archives and their recognized objects decoded without a document/object-limit omission: 9,251 recognized objects and 3,176 declared connections. **Both graphs still report `truncated=true`** because 164 connectors have unresolved owners: 15 in the menu/document set and 149 in the formatting set. These omissions remain unresolved; completing selected archive traversal is not complete connection recovery.

`projected-ui-findings.json` retains source-bound actions, outlets and control labels, resolving `NSLocalizableString.NSDev` references from REA's returned graph. `focused-actions.json` selects relevant actions. These are projections of REA output, not substitute analyses. They retain original document/object IDs and REA Evidence IDs. `project_findings.py` reproduces the projection; the two preparation scripts and copy manifests document input construction.

Commands used, after sourcing `/workspace/.gp-tools/activate.sh`:

```bash
rea decode-interface-builder '/workspace/gp-evidence/rea-pass4/ui-resources/Menus and Tooltip - Derived Prism Analysis.app' --max-documents 4 --max-objects 20000 --max-connections 40000 --format json
rea decode-interface-builder '/workspace/gp-evidence/rea-pass4/ui-resources/Graph and Data Formatting - Derived Prism Analysis.app' --max-documents 16 --max-objects 20000 --max-connections 40000 --format json
```

## Confirmed point-context formatting

`Contents/Resources/Base.lproj/FormatGraphXYGraphSettingsTab.nib`, objects 12/15/16, explicitly instructs the user to Ctrl-click a data point and choose **“Format This Point”** to format it differently from its dataset. The same archive's object 51 is a reset control connected to `toggleResetHighlighting:`; its label says to remove individual formatting and restore dataset formatting.

This supports a concrete reconstruction obligation: per-point overrides must coexist with dataset formatting, and resetting overrides should inherit the dataset appearance again. The serialized instruction establishes the intended interaction. It does not recover the native selection/hit-testing algorithm or how right-click and Ctrl-click are mapped on every device.

The context-menu archive independently exposes selectors for symbol color/transparency, shape, size, border color, bar fill/pattern/border, error-bar color, quartiles and line color. Stored menu scopes include individual formatting, **“Format Entire Data Set”** and **“Format All Data Sets.”** The reset action is `removeHighlighting:`. Some menu titles are generic or context-specific, such as “Format This Bar”; the runtime may relabel or select menus dynamically.

Other directly connected context actions include:

| Stored label | Selector | Context-menu source object |
|---|---|---:|
| Exclude Values | `excludeValues:` | 1499; another occurrence 6542 |
| Edit the Row of Data for This Point | `bubblePlotEditDataForPoint:` | 1270; another occurrence 7397 |
| Show/Hide Data Label for This Point | `bubblePlotShowHideLabelForCurrentPoint:` | 1257 |
| Show Data Labels for All Points | `bubblePlotShowLabelsForAllPoints:` | 1261 |
| Hide Data Labels for All Points | `bubblePlotHideLabelsForAllPoints:` | 1265 |
| Format Axes... | `showFormatAxesDialog:` | 989 |

The `bubblePlot…` selectors establish a shipped context workflow for that graph subsystem. They do not prove the same actions appear for every classic XY/Column graph.

The separate `PSXInspectorDataPointView.nib` connects object 75, **“Edit the Row of Data for This Point,”** to `editRowAction:` on `PSXInspectorDataPointViewController`. Its owner and destination are explicit, making it a useful native-handler trace seed. A label “Format Points” and `formatPointsMenuItem` outlet also exist in MainMenu; this pass does not recover a direct action for that submenu merely from its title.

## Graph and dataset formatting

The XY appearance tab records controls and actions for symbol visibility, shape, size, fill/border; error visibility, direction/style/thickness; connecting lines/curves; area fill; legends; point labels from row titles; and Y-axis assignment. Examples include `setSymbolShape:`, `setSymbolSize:`, `setSymbolFillColor:`, `setErrorDirection:`, `setLineConnectType:`, `setLabelEachPoint:` and `selectAxis:`. Stored control values can be design-time placeholders; they are not established runtime defaults.

The graph-settings tab distinguishes **“Leave a gap”** from **“Connect adjacent points”** for missing or off-scale Y values, connected through `toggleLeavesGapAtMissingValues:`. It also provides a line-of-identity setting and individual-format reset. The exact numeric classification of “off-scale” remains a separate native/runtime question.

The dataset tab explicitly describes **front-to-back drawing order** and includes add, remove, replace, reorder and reverse actions. It also contains X/Y offsets, a “nudge all points” option and row skipping. This makes dataset ordering a graph-state requirement, not just a cosmetic ordering of the data editor.

`FormatDataTable.nib` includes variable typing, categorical level ordering, row/subcolumn titles, date/time conversion, replicate counts and summarized Y formats. It connects format changes to `changeTableFormat:`, `changeYColumnFormat:`, `changeNumberOfYSubcolumns:` and related controls. Merely reproducing a two-dimensional numeric grid does not reproduce this table-format workflow.

## Zoom: observed choices and limits

`MainMenu.nib` binds the following controls:

| Label | Selector | Serialized tag |
|---|---|---:|
| Zoom Larger | `zoomIn:` | absent |
| Zoom Smaller | `zoomOut:` | absent |
| To Fit Page | `setZoom:` | absent |
| To Fit Graph | `setZoom:` | 3 |
| 50%, 75%, 100% (Actual Size), 150%, 200% | `setZoom:` | 50, 75, 100, 150, 200 |
| 400%, 600%, 800%, 1000% | `setZoom:` | 400, 600, 800, 1000 |

The corresponding main-menu source objects are 1513/1517 for larger/smaller, 1522/1526 for page/graph fit and 1531–1564 for percentages. Key-equivalent fields contain `+`, `-` and `0` for larger/smaller/actual size, with modifier mask 1048576. The archived numeric mask is observed; native shortcut behavior was not exercised.

A separate **Zoom** menu item uses `performZoom:`, which must not be conflated with graph magnification solely because its label is identical. Many menu items store `NSHiddenInRepresentation=true`; this serialization does not establish their actual runtime visibility or availability.

Unknowns include zoom step selection, minimum/maximum enforcement beyond the listed choices, wheel/pinch support, fit-rectangle calculations, graph-versus-page scaling, panning and whether zoom affects export geometry.

## Tooltip evidence: a crucial distinction

`DataTableToolTipView.nib` belongs to `PSXDataSheetController`. Its five explicit outlets are:

- `_toolTipPrefixField`: a linked-data-object prefix.
- `_toolTipRegionField`: a region label.
- `_toolTipSourceLink`: a `PSXCellColumn` source-link view.
- `_toolTipStartField` and `_toolTipEndField`: starting/ending row-and-column text.

The archived placeholder text uses a very large row number. That is design-time content, not evidence of supported row limits or actual selected data.

This archive supports a **linked-data/source-region tooltip**, not a claim that graph hover displays X/Y coordinates. The point inspector supports an edit-source-row action, but this pass has not recovered graph-hover contents, triggering events, delay, accessibility behavior, coordinate formatting or point hit tolerance. Those questions remain open for native tracing or a declared Prism runtime capture.

## Next native/runtime probes

The strongest native trace seeds are `PSXInspectorDataPointViewController.editRowAction:`, `bubblePlotEditDataForPoint:`, `excludeValues:`, `removeHighlighting:`, `toggleResetHighlighting:`, `setZoom:`, `zoomIn:` and `zoomOut:`. REA explicitly warns that a serialized action selector alone does not prove a matching binary implementation. Null action destinations do not identify the eventual runtime responder.

Runtime evidence is still needed for menu selection/visibility, point versus dataset scope, persistence/undo, hover behavior and rendered output. These findings guide reconstruction without claiming that compiled UI metadata is full behavior recovery. The resource-decoding pass itself did not execute Prism or change its original files.


## GP changes justified by this pass

`web/src/plot-view.ts` records the nine recovered menu presets and their REA source. GP now exposes each preset through 1000%; dense canvas backing resolution stays capped independently of view zoom. `scripts/check_graph_zoom.py` verifies the choices, shortcut/reset behavior and unchanged saved graph settings in both server and static builds. Those GP checks do not establish native zoom geometry, minimum or step rules.

Individual point overrides/reset, the full dataset drawing-order and missing-value options, typed-table formats and complete native tooltip behavior remain open requirements. The decoded controls are evidence to implement and verify them, not proof that GP already supports them.

Later work used the decoded **Exclude Values** label (`excludeValues:`) to add GP's exclusion command to data-cell context menus and graph point details. The native handler, menu key equivalent and owning context remain untraced; see the [exclusion evidence ledger](prism-exclusions-evidence.md).
