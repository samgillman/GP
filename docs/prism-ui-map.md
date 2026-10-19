# Prism 11 UI structure recovered from the installer

The supplied Prism 11.1.0 build 110218 installer contains serialized UI structure used to reconstruct GP's core workbook workflow. This document records observed controls, connections, frames, localization keys, and native entry points. It does **not** establish a pixel-identical appearance or observed runtime behavior. No screenshot of running Prism was available for this installer pass. A subsequent [macOS visual correction](ui-macos-correction.md) uses official GraphPad illustrations as additional, explicitly bounded references.

GP now implements separate Data Tables, Results and Graphs, a linked Family navigator, a two-pane Analyze Data chooser, Format Graph tabs with Apply/OK/Cancel, and bounded workbook Undo/Redo. Browser checks cover multiple saved analyses, dataset selection and graph ordering, source-edit invalidation, explicit recalculation, save/open and legacy migration, export, and recovery without overwriting unreadable saved work. Undo/Redo checks include restoration of linked result state, one graph-Apply commit, Cancel without a commit, and rejection of late analysis responses after Undo. History is limited to 40 snapshots/32 MiB and is not persisted; native transaction boundaries remain unverified. These checks verify GP's behavior, not native Prism's behavior. Only Column/XY sheets currently use the workbook; grouped and survival inputs remain separate. Fonts, geometry, complete table editing, all parameter dialogs, full graph/axes formatting and native recalculation/transaction rules remain open.

## Evidence and how to locate a claim

The extracted bundle is `/workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app`. Paths below are relative to `Contents/Resources/Base.lproj/`, unless stated otherwise. The decoded NIB inventory is `/workspace/gp-evidence/resources-pass2/nibs.json`; each entry identifies the original file SHA-256 and a `nib-*.json` evidence file in that directory. Detailed files preserve object indices, key/value references, and original NIB byte offsets. Object indices below refer to these decoded objects; offsets refer to the original NIB bytes, not JSON-file positions.

`localizations.json` preserves the source `.strings` file, SHA-256, key, value and character offset. Character offsets in these decoded resources are not binary byte offsets. `feature-map.json` groups recovered analysis/graphing labels; it is a discovery index, not an independent source of runtime evidence. NIB `NSLocalizableString` labels and their fallback `NSString` copies often appear twice; those copies do not count as independent observations. Placeholder labels such as `Item1`, `OtherViews`, `Text Cell` and `Radio` must not be shipped as final UI labels.

The native method anchors come from `/workspace/gp-evidence/native-metadata/methods.jsonl`. Addresses are unslid x86-64 virtual addresses in the slice whose SHA-256 is `8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf`; see [the native map](prism-native-map.md). Method names demonstrate stored entry points. The subsequent [native-code pass](prism-native-code.md) decompiled selected dialog handlers, including graph Apply's undo grouping. None of these passes executed the native application.

| Resource | SHA-256 |
| --- | --- |
| `Document.nib` | `d025b7e90ee46c770805455ce9f1f36c95f048d69466bd9c91a19faa753eab6b` |
| `CreateDataTable.nib` | `88f0fbd773aac95b7b86e572a1a8f495d64b621c211f2155e80fe1752d736f6f` |
| `FormatDataTable.nib` | `c7e9f08c2bb5f1dbfd6e98eb014a8142d4f6b175ae776ce95227b87e86a2c54d` |
| `AnalyzeData.nib` | `1f49e8e3fc5d5602255023bc1866955fb97022a1fedc588a375056e15715a5e4` |
| `FormatGraphXY.nib` | `c03cfd72bf8a7e9ec2f79b69c4701381f94d8d40c47eabc641952341f886fe7a` |
| `FormatGraphXYAppearanceTab.nib` | `443996d58ae7e6ce26178b4c267c6ab19fc72ece16a2e7c7d8bf6ea3497ef781` |
| `FormatGraphXYDatasetsTab.nib` | `e6025ddeb62165bdab64095870bb6990f4a222ba0682848c1f81c27dff195fe8` |
| `FormatGraphXYGraphSettingsTab.nib` | `cd68bf066a3d4dfecd86b9f0d8bfb0d49c6736ac586f2a5421593af8006188ce` |
| `FormatAxesDialog.nib` | `a779171a729a42d3392d02755c9ef4cf5df58f7b98c2bc3c6f3e3b67a5f3171d` |
| `ChangeGraphType.nib` | `9a1683e821b93da6cfa5cfacb6332794a296af334c77fd0235e6633e3681cb8e` |
| `MainMenu.nib` | `2cfdd66b236136a8123c3e1a47b499fa8af724dc4bc005be92b0a4db7a90c28a` |

## Workbook shell and navigator

`Document.nib` (`nib-a0fe9ac1651bfb1a.json`) names `PSXDocumentWindowController` at object 4, offset 6936. Its outlet connectors establish the following structure without relying on an imagined screenshot:

| Controller outlet | Connected object and direct evidence |
| --- | --- |
| `mainView` | Connector 38 connects document controller 2 to object 39, a class-swapped `_TtC5Prism12PSXSplitView`; frame reference at offset 12538 |
| `navigatorView` | Connector 262 connects to object 43; frame size `{120, 704}` at offset 12653 |
| `navigatorSplitView` | Connector 260 connects to object 45, an `NSSplitView` |
| `sheetView` | Connector 288 connects to object 251; frame `{{121, 0}, {483, 704}}` at offset 65670 |
| `inspectorView` | Connector 12 connects to object 13; frame `{{605, 0}, {270, 704}}` at offset 7431 |
| `navigatorController` | Connector 255 connects to object 256, named `PSXNavigatorController` |
| `toolbar` / `statusBar` | Connectors 295 / 290 connect to `PSXToolbar` / `PSXStatusBar` custom objects |

The navigator has two scroll-view regions: object 47 is `{120, 343}`; object 103 is `{{0, 353}, {120, 324}}`. A separate `familyView` outlet, connector 320, binds the navigator controller to outline object 107. Accessibility identifiers at offsets 75661–76122 include `Navigator.mainOutline`, `Navigator.familyOutline`, `Navigator.sectionIcon`, `Navigator.newSheetLabel`, `Navigator.addSheetIcon`, `Navigator.groupLabel` and `Navigator.disclosureChevron`. Together these establish a section/sheet navigator plus a linked-family view. The region's runtime orientation, visibility and user-resized dimensions require confirmation.

Search is a real navigator feature: the NIB includes `Search` (object 235, offset 65250), a search field, restriction pop-ups, and actions `search:`, `changeRestrictionValue:` and `changeRestrictionType:`. Restriction labels include `Any`, `Data Table`, `Info Sheet`, `Result`, `Graph`, `Layout`, `Sheet`, `Highlight`, and `Note`. `changeSheetName:` is wired as an action (object 479, offset 72104); renaming is not simply changing a graph title.

The English `CoreLegacy.strings` records identify navigator categories: key `23837` = `Data with Results`, `23839` = `Data Tables`, `23840` = `Results`, `23841` = `Graphs`, `23842` = `Layouts`, and `23836` = `Family` (character offsets 237918–238056). Key `3245` says `Family of linked sheets`. These labels are recoverable; their exact ordering and default expansion are not proven solely by their string-table order.

Two explicit resource instructions support drag-and-drop workflows: `AddDatasetsToGraph.nib` object 223, offset 16466 describes dragging a table from the navigator onto a graph; `PlaceGraphOnLayout.nib` object 465, offset 32391 describes dragging a graph from the navigator onto a layout. `ReorderSheets.nib` object 134, offset 12587 describes reordering sheet names in the navigator or thumbnails in the gallery. These are text documenting intended operations, not successful runtime tests of those operations.

## Native geometry is a starting point, not a screenshot

Frames below are serialized AppKit geometry. Origins are local to their superview except window rectangles. AppKit view flipping, constraints, title bars, runtime resizing, saved preferences, accessibility settings and Retina scaling can change apparent placement. A CSS implementation must not copy native Y coordinates directly or call a native point a device pixel.

| Resource / object | Serialized value | Original byte offset |
| --- | --- | ---: |
| Document window 301 | `NSWindowRect = {{417, 230}, {875, 732}}`; minimum `{638, 388}` | 66814 / 66872 |
| Document split view 39 | `{{0, 28}, {875, 704}}` | 12538 |
| Status bar view 310 | Size `{875, 28}` | 67072 |
| Toolbar view 356 | Size `{880, 72}`; not enough evidence to place all individual tools | 68071 |
| CreateDataTable window 103 | `{{249, 221}, {820, 655}}` | 9314 |
| CreateDataTable tab view 31 | `{{171, 61}, {649, 594}}` | 3282 |
| AnalyzeData window 577 | `{{163, 173}, {630, 595}}` | 75881 |
| AnalyzeData built-in-method pane 273 | `{{20, 60}, {479, 502}}` | 57326 |
| AnalyzeData analysis scroll view 283 | Size `{235, 451}` | 57791 |
| AnalyzeData data-set scroll view 313 | `{{243, -1}, {235, 452}}` | 59054 |
| FormatGraphXY window 41 / tabs 8 | Window size `{683, 692}` / tab frame `{{13, 40}, {657, 647}}` | 7736 / 2521 |
| FormatAxesDialog window 49 / tabs 8 | Window size `{821, 637}` / tab frame `{{13, 40}, {795, 591}}` | 7945 / 2560 |

The AnalyzeData outline stores row height 17 and indentation 16 (object 8, offsets 9777 and 9830); the data-set table stores row height 18 (object 158, offset 35273). These values support a compact desktop layout, but do not establish the final font metrics. Some stored window minimum sizes exceed the stored content height, reinforcing that an archived window rectangle alone is not a complete rendered specification.

## Data-table creation and editing

`CreateDataTable.nib` names its window `New Data Table and Graph` (object 105, offset 9419). Its selector includes `XY`, `Column`, `Grouped`, `Contingency`, `Survival`, `Parts of whole`, `Multiple variables`, and `Nested` (objects 51–88, offsets 8261–9014), alongside `Existing file` and `Clone a Graph` (objects 92/98, offsets 9107/9223). `OK` and `Cancel` have corresponding actions. The presence of these families does not establish each family's supported options or initial selection.

`FormatDataTable.nib` demonstrates that the data model must distinguish table family, data sets and replicate subcolumns. Recoverable controls include:

- `Kind of table:`, `Show row titles`, `Automatic column widths`, and separate `Column Titles` / `Subcolumn Titles` pages.
- X entry choices for entered values, optional X errors, generated series, elapsed times and dates. The starting value and increment controls are separately bound.
- Y choices for a single value, side-by-side replicate values, or calculated errors. Explicit formats include `Mean, Standard Deviation, N`, `Mean, Standard Error, N`, and `Mean, %CV, N`.
- `Table Format` and `Variable Types` tabs; variable types include continuous, categorical and label, with level order and counts.

Source anchors: Y controls at objects 652–686, offsets 89673–91026; subcolumn title instructions at objects 404/430, offsets 79361/80662; table-format tab object 824, offset 96687. These imply that flattening all subcolumns into unrelated columns will not reproduce the editing workflow. A literal table-cell appearance or full spreadsheet interaction contract has not been recovered from these dialogs.

## Analysis chooser and linked results

`AnalyzeData.nib` (`nib-c504be31e390865e.json`) contains a two-pane chooser: a searchable analysis outline and a data-set selection table. The explicit labels are `Which analysis?` (object 280, offset 57710), `Analyze which data sets?` (310, 58955), `Table:` (185, 51615), `Select All` / `Deselect All` (353/227, 60768/55770), and `Prefix sheet names with:` (554, 75348). The controller has `_analysesOutline`, `_dataSetsTable`, `_descriptionView`, `_methodTabView`, `_selectAllButton`, and `_prefixField` outlets. `Built-in analysis` and `Saved Method` are distinct modes.

The chooser's grouping is backed by `CoreLegacy.strings` keys `50229` (`XY analyses`), `50230` (`Column analyses`), `50231` (`Grouped analyses`), and `50233` (`Survival analyses`), character offsets 213675–213799. Native selectors `analysisGroupNamesForDataTable:` and `analysis:inGroup:matchesSearchString:` support table-aware grouping and search. They do not prove the full eligibility algorithm. A NIB hint explicitly states that a table without X cannot choose XY analyses (object 79, offset 30983).

The menu contains distinct `Analysis Parameters...`, `Data Analyzed...` and `Recalculate All` actions (MainMenu objects 422/427/435, offsets 33229/33355/33577). This is evidence for editable analysis records linked to their input, rather than one transient results panel overwritten on every run. Saved project relationships independently support that model: ordered sheet identifiers and graph references can point to calculated data sheets; see [the native format map](prism-native-map.md) and [graph format map](prism-graph-format.md).

What remains unknown: whether a particular edit recalculates immediately or lazily, how the original app marks pending/failed results, which dependencies propagate first, exact parameter-dialog defaults, and the undo transaction boundaries. GP may implement an explicit dependency model, but should label that implementation behavior as independently chosen until verified.

## Graph formatting is a separate dialog workflow

`FormatGraphXY.nib` has `Appearance`, `Data Sets on Graph`, and `Graph Settings` tabs (objects 16/28/34, offsets 2733/7467/7601). Buttons include `Change Graph Type…`, `Apply`, `OK` and `Cancel`. The Apply tooltip explicitly says it updates the graph without closing the dialog (object 103, offset 9438). The `applyClick:`, `okClick:`, `cancelClick:` and `changeGraphTypeClick:` connectors are preserved. Exact rollback behavior after applying and then cancelling has not been established.

| Tab or related dialog | Recoverable controls / behavior stated in the resource |
| --- | --- |
| XY Appearance | Data-set selector; symbols, bars/spikes/droplines, error bars, connecting line/curve, area fill; colors, sizes, styles and thicknesses; left/right Y-axis assignment; legend display; labels from row titles; change all or selected data sets. Key labels at objects 636, 657, 738, 748, 758, 774, 794, 800, 853 and 857. |
| XY Data Sets on Graph | Add, replace, remove and reorder data sets; top/up/reverse/down/bottom; X/Y offsets; row skipping. Object 180, offset 15858 explicitly states that data sets higher in the list are drawn in front of lower ones. This supports per-graph ordering separate from table ordering. |
| XY Graph Settings | Remove individual point formatting, line of identity, and a choice between leaving a gap or connecting adjacent points at missing/off-scale Y values (objects 173/181/187, offsets 14543/14995/15138). A resource instruction documents Ctrl-click → `Format This Point` (object 16, offset 4854). |
| Format Axes | Separate dialog with `Frame and Origin`, `X Axis`, `Left Y Axis`, `Right Y Axis`, `Titles & Fonts`; Apply/OK/Cancel. Tab labels at objects 16/27/32/37/42. |
| Change Graph Type | Graph-family selector and `Revert to Prism defaults`; the same eight table/graph families appear. Actual selected graph subtype, defaults and thumbnail appearance still require decoding or runtime evidence. |

The current GP graph settings must not be described as equivalent to these dialogs. Several existing controls cover only a small subset, and saved ordinary graph appearance often resides in undecoded `PCFFGRA4` payloads. Neither a NIB color-picker control nor a saved graph title proves the drawing algorithm or the rendered visual result.

## Native entry points for the next focused pass

| Owner / selector | Address | Method-record offset |
| --- | --- | ---: |
| `PSXDocumentWindowController createDataTableAndGraph:` | `0x10138f143` | 48998360 |
| `PSXDocumentWindowController analyze:` | `0x10138e738` | 48998288 |
| `PSXDocumentWindowController createNewAnalysis` | `0x10138f325` | 48998456 |
| `PSXDocumentWindowController createNewGraphOfExistingData:` | `0x10139246c` | 48998768 |
| `PSXDocumentWindowController setCurrentSheet:` | `0x101381fa4` | 48995648 |
| `PSXNavigatorController familyOfSheet:` | `0x100fbc4d2` | 48310448 |
| `PSXNavigatorController clickItem:` | `0x100fc4fc3` | 48312872 |
| `PSXNavigatorController changeSheetName:` | `0x100fc5512` | 48313016 |
| `PSXAnalyzeDataDialogController analysisGroupNamesForDataTable:` | `0x1010683aa` | 48454968 |
| `PSXAnalyzeDataDialogController performOKBuiltInAnalysisTab` | `0x10106c3d4` | 48456144 |
| `PSXAnalyzeDataDialogController analysis:inGroup:matchesSearchString:` | `0x10106e061` | 48456816 |
| `PSXFormatAxesWindowController applyClick:` | `0x1010c0b9c` | 48522336 |
| `PSXFormatGraphXYWindowController prepareToShow` | `0x1010c40df` | 48526680 |

These are prioritized tracing targets, not implementations recovered by this document. In particular, class inheritance may supply shared graph-dialog actions; the existence of a NIB selector must not be treated as proof that its body belongs to the XY controller itself.

## Implemented workbook foundation and remaining work

GP's persistent workbook now contains separately identified data, analysis-result and graph sheets, with a navigator and active sheet view. A single input can own multiple analysis records and multiple independently formatted graphs. Input references, per-graph data-set order, and sheets survive switching, renaming and adding analyses. This structure is supported jointly by NIB outlets, localization names, native selectors, and saved-project cross-references.

The implemented and browser-tested workflow creates a Column or XY table and associated graph, selects the table in the navigator, opens Analyze Data with analysis search and data-set checkboxes, creates a linked result sheet while preserving existing results, and opens a separate Format Graph dialog with working Apply/OK/Cancel. Unsupported families and parameter options remain unavailable. Recalculation and cancellation behavior are documented and tested as GP behavior until original runtime confirmation is possible.

Remaining visual/interaction evidence includes actual window screenshots, normal and dark-mode appearance, menu/toolbar ordering after runtime construction, initial window/inspector states, selection and keyboard behavior, per-platform shortcuts, accessibility semantics, graph previews, exact dialog defaults, result-sheet formatting, pagination and print output. These cannot be certified by static labels and frames alone. The supplied installer supports substantial further reconstruction; it does not support a claim of complete functional or visual identity today.
