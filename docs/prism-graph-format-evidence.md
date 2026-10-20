# Format Graph: retained native UI contract

GP's three Format Graph tab names match the shipped XY dialog, but its current control groups differ substantially. The retained REA record supports a selected-dataset Appearance editor, a single ordered dataset list with an action column, and Graph Settings devoted to point/line display. This report maps the concrete differences to original object IDs and construction frames; it does not claim a running macOS reference or visual parity.

## Evidence and source identity

Reused `decode_interface_builder` Evidence: `ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`. Full record: `/workspace/gp-evidence/rea-pass4/ui-resources/rea-graph-formatting.json`, SHA-256 `d56dfb61f8e9d0d29d71937b78bc928012b900e88475385a76755d0439463807`. The original/copy manifest describes the unchanged resources in the derived partial analysis bundle. No repeated decode or native session was needed.

Original NIBs are under `/workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app/Contents/Resources/Base.lproj/`. This pass reverified their hashes:

| Resource | SHA-256 | Connection coverage reported by REA |
| --- | --- | --- |
| `FormatGraphXY.nib` | `c03cfd72bf8a7e9ec2f79b69c4701381f94d8d40c47eabc641952341f886fe7a` | 9 examined, 2 omitted |
| `FormatGraphXYAppearanceTab.nib` | `443996d58ae7e6ce26178b4c267c6ab19fc72ece16a2e7c7d8bf6ea3497ef781` | 120 examined, 108 omitted |
| `FormatGraphXYDatasetsTab.nib` | `e6025ddeb62165bdab64095870bb6990f4a222ba0682848c1f81c27dff195fe8` | 40 examined, 33 omitted |
| `FormatGraphXYGraphSettingsTab.nib` | `cd68bf066a3d4dfecd86b9f0d8bfb0d49c6736ac586f2a5421593af8006188ce` | 25 examined, none omitted |

`/workspace/gp-evidence/rea-pass5/graph-format/xy-dialog-contract.json` preserves selected documents, full recognized nodes/edges, actions, outlets, labels, coverage, and hashes of the inspected GP component/CSS. It is a projection of existing Evidence, not a new REA Evidence ID. Object IDs below are local to each NIB; full node IDs use `ib:"Contents/Resources/Base.lproj/<file>.nib":object:["<id>"]`.

This scope is **XY**. It does not establish Column/one-grouping-variable, grouped, survival or other graph-family dialogs. GP currently shares its component between Column and XY, so layout reuse across families is an implementation decision until their resources are checked.

## Dialog shell

`FormatGraphXY.nib` content view49 is 683×692, matching window template41's archived size. Main tab8 is `(13,40,657,647)` and the archive labels Appearance (string16), Data Sets on Graph (28), Graph Settings (34). Tab-item ordering and runtime dimensions are not independently observed.

Footer controls have explicit frames and actions:

| Control | Object | Archived frame `(x,y,w,h)` | Action |
| --- | --- | --- | --- |
| Help | 51 | `(18,16,25,25)` | `showWindowHelp:` |
| Change Graph Type… | 76 | `(47,12,178,32)` | `changeGraphTypeClick:` |
| Apply | 70 | `(403,12,82,32)` | `applyClick:` |
| Cancel | 63 | `(485,12,92,32)` | `cancelClick:` |
| OK | 56 | `(577,12,92,32)` | `okClick:` |

Current GP has a graph-type dropdown inside Appearance and a Cancel/Apply/OK footer. A separate Change Graph Type affordance and Apply/Cancel/OK alignment are directly supported by this archive, but must route to functioning existing behavior. Apply's shipped tooltip says it applies without closing. Native commit/close findings are separately recorded in [prism-native-code.md](prism-native-code.md); their Evidence includes `ev_f11827d6953b277733aa7b6e9173103dc500ba60190862f7d8c802942e80bf71`. This resource pass adds no new rollback or undo conclusions.

## Appearance: selected-dataset editor

Root600 is 640×616. All frames below are relative to that root. The serialized grouping is a dense series of horizontal sections; color is one field within each section, rather than a full-page list of dataset colors.

| Section | Observed objects, actions and geometry |
| --- | --- |
| Dataset scope | Selector319 at `(103,571,360,26)` → `selectDataSet:`; previous641 and next648 at x468/x491 → corresponding selection actions. Global popup841 at `(521,571,82,26)` has menu actions `selectAllDataSets:` / `selectSomeDataSets:`. Exact scope semantics/default selection remain unknown. |
| Style | Appearance selector58 at `(119,519,206,26)` → `setAppearance:`; plot selector831 at `(417,519,210,26)` → `setPlots:`. Archived Item1/Item2 placeholders do not establish actual runtime options. |
| Symbols | Show symbols654 at `(18,500,118,18)` → `toggleShowSymbols:`. Fill-color674, shape678 `(283,468,115,26)`, border-color701, size705 `(283,438,115,26)`, border-thickness728 `(520,438,107,26)` each have separate setters. |
| Bars/spikes/droplines | Enable735 at `(18,419,215,18)` → `setShowBars:`. Separate fill268, width297, pattern274, border235/241, and baseline188 setters. These controls do not prove bar rendering or baseline rules. |
| Error bars | Enable745 at `(18,337,130,18)` → `setShowErrors:`; color347, direction353 `(214,306,87,26)`, style382 `(360,306,76,26)`, thickness401 `(520,306,107,26)`. This page's appearance controls are not evidence that SD/SEM/CI computation choices belong to this particular row. |
| Connecting line/curve | Enable755 at `(18,285,217,18)` → `setShowLines:`; color472, thickness547, connect478, style529 and pattern510. Separate origin765, symbol-gap427 and discontinuous-axis-gap45 checkboxes. |
| Area fill | Enable771 at `(18,181,117,18)` → `setShowAreaFill:`; color98, position145 `(283,150,171,26)`, pattern107/124 and pattern-color171. Numerical region and band semantics remain unknown. |
| Additional options | Y-axis matrix612 at `(122,55,99,40)` → `selectAxis:`. Legend797/435, revert-to-column-title803, row-title point labels419 and label color608 have distinct actions. |

Current `web/src/WorkbookDialogs.tsx` places Plot, Titles and axis labels, and an all-dataset color list in Appearance. The inspected CSS uses a two-column grid with colors spanning both left-side sections. Those are GP arrangements; the retained XY page instead organizes appearance by the chosen dataset and drawing component. No title-text editing control is observed on this XY Appearance page. Moving title editing elsewhere must preserve a reachable working GP edit path, rather than removing useful functionality solely for visual similarity.

A bounded next layout can add a dataset selector and edit that dataset's already-supported color, then group existing point/error/line controls beneath it. Unsupported symbol shapes, border thickness, area fill, right-Y assignment and legend modes should wait for data-model/rendering support instead of appearing as inert native-looking controls. Preserve the distinction between per-dataset and whole-graph settings in GP's current model.

## Data Sets on Graph: ordered list and action column

Root161 is 640×616. Scroll view163 is `(20,102,490,424)` and table19 is 488×422 with archived row height17. Heading184 says “Data sets plotted (front to back)”. Text177 states that higher datasets draw in front of lower datasets. That is a shipped instruction, not an observed overlap rendering test.

The right action column is x524, width102: Add230 at y473, Replace104 at441, Remove96 at409; Top145 at341, Up153 at309, Reverse112 at277, Down59 at245, Bottom8 at213. Each action is connected (`showAddDatasetsDialog:`, `showReplaceDatasetDialog:`, `removeDataset:`, and the corresponding ordering selectors). Selected-dataset controls sit below the list: nudge77, X206 and Y219 offsets in data units, plus skip-rows120/135.

GP currently shows two equally sized panes: inclusion checkboxes and drawing order, with inline up/down buttons. A native-informed next subset is one selected-dataset list and an adjacent reorder column, preserving working inclusion/removal via a bounded chooser. Top/bottom/reverse can be implemented as GP ordering operations, but native drawing precedence should be tested against GP's renderer before using “front to back” as a behavioral guarantee. Offsets, row skipping, cross-table Add and Replace semantics remain unimplemented or independently unverified; do not add them as decoration.

## Graph Settings and the smallest remaining resource gaps

Root81 is 640×428. Missing/off-scale Y heading170 at `(18,392,472,16)` precedes radio matrix176 `(32,344,170,40)` → `toggleLeavesGapAtMissingValues:`. Its two labels are Leave a gap and Connect adjacent points. The condition includes **off-scale** values; whether clipping/log-invalid data follows the same path remains unknown.

Individual-point formatting section71 at y171 contains reset51 `(30,84,540,18)` → `toggleResetHighlighting:` and a resource instruction for Ctrl-click → Format This Point. Line of identity105 at `(18,52,123,18)` has color95, thickness117 and pattern128 controls beneath it. The identity-checkbox action is not among this projection's recognized target-actions; do not invent its selector or numerical behavior.

Container83 at `(20,199,600,133)` is connected to `scatterPlotAppearanceViewContainer`; controller256 is `PSXScatterPlotAppearanceViewController`. This record does not include the injected view's controls. The smallest next decode for that concrete gap is the shipped `Base.lproj/ScatterPlotAppearance.nib` using the same supported focused-resource carrier workflow, preserving original bytes and hashes. It is not necessary to re-import the full executable. The Column follow-up below now decodes its distinct OneGV resource set; filenames alone were not treated as evidence of its behavior.

GP's current Graph Settings tab contains only linked-analysis selection and explanatory text. That control is useful GP functionality, but its placement is not supported by this native page. Exact native analysis-link UI is outside the four-file scope. A layout revision should retain this working capability explicitly rather than relabeling it as native point/line settings.

Unlike the inspected axes archives, this Graph Settings record contains **54 recognized NSLayoutConstraint objects**, including raw item references, attribute numbers, constants and symbolic spacing. They are preserved in the external contract. They were not solved into runtime geometry. Appearance and dataset archives also have substantial unresolved connector coverage; observed action records remain useful, but do not represent a complete native binding graph.

All frames are local archived AppKit values. Usual bottom-origin interpretation explains the section order, but runtime flipping, dynamic visibility, fonts, scaling, resizing and page insertion were not observed. Archive placeholders/defaults and disabled controls are not production states. No application files, original resources, shared requirement registers or native sessions changed in this pass.

## Column / one-grouping-variable follow-up

The four Column resources were absent from the three retained UI decode records checked. A new focused **public REA `decode-interface-builder`** operation completed successfully with Evidence `ev_ff9c5094b7f4562421c7eeb24cd8c987d2500186575f364afba7c00b229ecc31`. Full output is `/workspace/gp-evidence/rea-pass5/graph-format/column/rea-column-formatting.json`, SHA-256 `9b7c73dccd9e662f6d452c8b46c07de43700ec089822c21f34838782beee1403`.

The new derived partial `.app` carrier contains these four unchanged NIBs plus unchanged original Info.plist and executable, required for the supported bundle-routing workflow. The executable was not run or imported into Ghidra. `copy-manifest.json` retains all original/copy paths and hashes; `decode-command.txt`, `decode-status.json`, `projected-ui-findings.json` and `geometry.json` preserve invocation, results, exact connections and local frames outside Git.

| Original file under `Contents/Resources/Base.lproj/` | SHA-256 |
| --- | --- |
| `FormatGraphOneGroupingVariable.nib` | `28bb7b3bc11132c7685ec12861a1c9901f5ffd884d73001b78f6202c0cbb2e4f` |
| `FormatGraphOneGVAppearanceTab.nib` | `2cebcc2cfff0da4744bae7c7d7afbc1c202bfc48073f9e5764451419a0de38c6` |
| `FormatGraphOneGVDatasetsTab.nib` | `15ee5a4a7cf48a09f2182962bcc57b3300e4b830c38731eb408cd1d437756fd7` |
| `FormatGraphOneGVGraphSettingsTab.nib` | `710c5fe9496db9b8f48fc3f7546b9df142626e485da42c92bd6bf5430b4e664e` |

REA decoded all four archives and reports complete recognized-object coverage. The graph's `truncated` flag is **true**: Appearance has 115 examined connections and 103 unresolved omissions, and the main dialog has 9 examined and 2 unresolved omissions. Dataset and Graph Settings connections report complete coverage with 35 and 34 examined. There is no archive-count omission. The projection contains 71 recognized action connections and 122 outlets; those counts do not mean native binding or behavior is complete.

### Column shell and Appearance

Main content54 archives 682×686; tabs8 are `(13,42,656,638)`. The dialog archives **four** tab items: Appearance14 (label16), DataSets24 (label27 “Data Sets on Graph”), GraphSettings30 (label33), and **Annotations36** (label40, placeholder view38). The fourth page is a further difference from the selected XY shell. Its contents and runtime visibility are not established by these four resources; do not add an inert Annotations tab. Footer type-change81, Apply75, Cancel68 and OK61 retain the same broad arrangement as XY, with respective actions `changeGraphTypeClick:`, `applyClick:`, `cancelClick:` and `okClick:`.

The Column Appearance root603 is **640×534**, shorter than the XY root640×616. It still edits a selected dataset, but its groups differ:

| Group | Exact Column evidence |
| --- | --- |
| Dataset scope | Selector344 `(109,489,349,26)` → `selectDataSet:`; previous884 / next891; Global972 has menu actions `selectAllDataSets:` / `selectSomeDataSets:`. The archived example dataset title is sample construction data, not a default title. |
| Appearance/style | Appearance90 `(114,440,200,26)` → `setAppearance:`. Menu97 includes Scatter dot plot94, Aligned dot plot101, Before-After105, bar109, one-symbol-per-column113, Box and whiskers117, Floating bars121, Violin125 and truncated Violin129. One bar label has an archived typo; do not reproduce it as product text. Plot950 `(392,439,231,26)` → `setPlots:` is labelled Line at944 and contains a placeholder, so summary-statistic choices are not fully recovered. |
| Bars / boxes / violin | Header tab277 `(1,410,664,24)` has distinct Bars and boxes, Bars and Violin plot label/control alternatives. Bars318 → `setShowBars:`. Fill223, border153/162, fill-pattern229/239 and pattern-color263 have separate actions. Mode-specific mean-plus730 → `setShowMeanAsPlus:` and smoothing749 → `setSmoothing:` live in alternate controls. No smoothing algorithm is established. |
| Symbols | Header tab846 `(1,314,639,31)` has label/checkbox alternatives. Symbols876 → `setBarsScatter:`; fill996, shape999, border1021/1045, size1025 each have setters. Placement831 `(98,259,103,26)` → `changeOutliersArrangement:`. This is not XY's `toggleShowSymbols:` selector, and its exact mode effects remain unknown. |
| Error bars / quartiles | Header tab680 `(0,238,639,22)` contains Error bars688 → `setShowErrors:` and a Quartiles label alternative. Color372, direction378, style407, thickness425 and pattern627 are distinct controls. These resources do not prove SD/SEM/CI computation defaults or quartile conventions. |
| Lines / median | Header tab642 `(0,183,639,22)` contains Lines650 → `setShowLines:` and a Median label alternative. Color487, thickness560, style540, pattern518, line/error placement493 → `setLineGoes:`, and mean-length809 → `setMeanLength:` are observed. Do not assume this is XY point-to-point connection behavior. |
| Additional options | Y-axis matrix770 → `selectAxis:`; legend926/45, revert-to-column-title932, row-title labels470 and label color968 have actions. |

Several labels occupy nested alternative tab views, not simultaneous root-level controls. Their selected archive tab does not establish runtime graph-mode eligibility. A safe Column reconstruction can reuse a selected-dataset header and compact color editor, but should use Column-specific supported drawing groups; copying XY's area-fill/connecting-line sections would misrepresent this evidence.

### Column dataset ordering and Graph Settings

**Column dataset heading284 says “Data sets plotted (left to right)”.** This differs directly from XY's front-to-back heading/instruction. Column root282 is 640×525, with list scroll308 `(20,135,490,345)` and right-side Add296 / Replace85 / Remove77. Reorder Top266 / Up274 / Reverse93 / Down59 / Bottom8 use the same action names as XY but act within a differently described ordering context.

Below the list, spacing field225 → `setSpaceBetweenBars:` has a label describing space between the selected dataset and the previous one, expressed as percent of normal. Separator checkbox67 → `setDrawDatasetSeparator:` is accompanied by color111, drawing-order120, pattern149 and thickness188 setters. This is **not** XY's X/Y nudge and row-skip region. Numerical spacing, boundary datasets and rendering order still need verification.

Column Graph Settings root234 is **640×592** and contains:

| Group | Objects/actions and archive layout |
| --- | --- |
| Direction | Header272 at y565; matrix53 `(36,539,172,18)` → `setDirection:` with Vertical57 and Horizontal61 cell labels. Rotation/transposition semantics and supported graphs remain unverified. |
| Baseline | Header282 at y512; matrix27 `(39,488,266,18)` → `setBaseline:` with Automatic31 and Bars begin at Y=37; value8 → `setBarsBeginAt:`; hide119 → `setHideBaseline:`. Auto-baseline and clipping behavior are unknown. |
| Dimensions | Heading292 at y442; space220 → `setSpaceBetweenColumns:` labelled percent of column width; before-first107 → `setGapBeforeFirstColumn:`; after-last71 → `setGapAfterLastColumn:`. |
| Discontinuous axis | Heading239 at y341; checkbox190 → `setMakeBarsDiscontinious:` (original selector spelling), stating that bars or connection lines can also be discontinuous. Geometry and conditions are unknown. |
| Scatter options container | View236 `(22,180,606,133)` and controller317 `PSXScatterPlotAppearanceViewController`. Its injected UI remains outside this four-resource decode; `ScatterPlotAppearance.nib` is still the smallest next resource question. |
| Individual point formatting | Reset198 → `toggleResetHighlighting:` and a Ctrl-click instruction. The reset's archive text contains a construction suffix (“second string.”), which must not be shipped as UI text. |
| Legend key shape | Matrix153 `(36,12,180,18)` → `changeLegendKey:`; Rectangle157 and Square161. |

This new evidence supports keeping a shared shell while making Appearance and Graph Settings table-family-specific. For the immediate GP subset, selected-dataset color editing and list/reorder organization can be shared; Column should retain its left-to-right meaning and its supported bar/box/point groups. Baseline, horizontal orientation, spacing, separator, violin, quartile, median and legend controls require working data-model/rendering support before exposure. The Annotations page and injected scatter settings remain explicit UI coverage gaps. The record establishes controls, labels and construction grouping, not numerical behavior or screenshots. No application code or shared requirement registers changed, and no native session remains open.

## 2026-10-20 implemented XY missing-Y line subset

GP now exposes the archived **Leave a gap / Connect adjacent points** choice
for XY connecting-line graphs in Format Graph → Graph Settings. This is a
**working GP choice only for blank Y cells with a numeric X value**; the original
X/Y cells and statistical calculation inputs are not modified. Matplotlib
exports and browser line paths use NaN gaps, and the setting persists on the
graph sheet. Source-verified native control evidence remains
`ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`.
The REA resource does not establish the native default, semantics for points
beyond manual display limits, or the treatment of blank X cells. Old GP
workbooks intentionally retain their former connect-adjacent default.
The implementation is bounded and does not close broader XY graph parity.
