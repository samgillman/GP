# Prism freeze/unfreeze evidence (W004)

Target: shipped Prism 11.1.0 (110218), inspected statically. Freeze/unfreeze parity is not established. No Prism executable was run.

## Shipped controls

REA `decode-interface-builder` Evidence `ev_212198e3cb25470fb0235238305c0f50a540af50328dc6518b90657015019b68`, retained at `/workspace/gp-evidence/rea-pass4/ui-resources/rea-menus-tooltip.json`, decodes the original selected NIBs in a documented derived partial bundle. `menus-copy-manifest.json` verifies original/copy hashes. This pass reuses that complete record rather than repeating its analysis.

- `Contents/Resources/Base.lproj/MainMenu.nib`, object 1839, places **Freeze Sheet** in **Edit**, action `freezeSheet:` (action archive 1838).
- `Contents/Resources/Base.lproj/ContextualMenus.nib`, object 5537, has **Freeze Sheet**, tag 305, action `freezeSheetFromContextualMenu:` (action archive 7952). Its parent menu 5490 is bound to `PSXContextualMenuContainer.navigatorMenu`. This is evidence for the navigator context menu, not a graph-canvas context menu.
- `Contents/Resources/en.lproj/toolbarInfo.plist`, `Items.PSXToolbarItemFreezeSheet`, explicitly sets `Action=freezeSheet:` and `IsToggle=true`; placement is `Panels.SheetPanel.Rows[0][1]`. Its tooltip says freezing prevents automatic updates when data change.

Both menu items serialize `NSHiddenInRepresentation=true`, and their action destinations are null. Runtime visibility, validation and responder routing are therefore unresolved. No separate Unfreeze action occurs in the 20 previously decoded selected NIBs. The toolbar toggle flag directly supports a toggle interpretation; it does not establish every native transition.

The four-document REA record has complete archive/object traversal; its graph is marked truncated because 15 owner connectors remain unresolved (Document 11, MainMenu 4). These omissions must not be described as complete UI recovery.

## Packaged guidance and diagnostics

The following are statements shipped with Prism, not observed runtime behavior. Source keys and decoded character offsets are preserved in `/workspace/gp-evidence/rea-pass4/freeze/resource-findings.json`.

| Resource | Key | Statement relevant to reconstruction |
|---|---|---|
| `en.lproj/CoreLegacy.strings` |7527| Frozen results retain their values when input data are edited. |
| same |7558| Frozen graphs do not update from changed data and their details cannot be edited. This older text says **Sheet** menu, conflicting with the actual **Edit** menu wiring above. |
| same |262| A frozen sheet cannot change or update from linked data; unfreeze by unchecking Freeze Sheet in Edit or using the toolbar toggle. |
| same |1018| Frozen tables allow excluding values from results tables but do not update the table itself. |
| same |54,59| Some attempted changes prompt unfreezing; selecting/adding graph objects requires unfreezing. |
| same |57473–57476| Compatibility diagnostics for data-sheet formulas describe a special unfreeze path converting calculated values to plain values and losing formula definitions. This is not evidence that every ordinary freeze/unfreeze operation removes formulas. |
| same |2856,2910| Compatibility-frozen analyses can recalculate themselves and linked analyses/graphs on unfreeze under current categorical ordering. |
| same |11868,11869| Frozen upstream simulation/analysis makes Monte Carlo inputs repeat; diagnostics instruct unfreezing it. |
| `en.lproj/Core.strings` |`IDS_COMPATIBILITY_ANALYZESCHECK_MSG`| Freezing selected results avoids an indicated future recalculation when a file is reopened. |

These support separate data-sheet, results-sheet and graph behavior. They do not establish scheduling, undo, dependency propagation, persistence encoding, or exact exceptions. Native binary strings independently include a frozen-results prompt offering unfreeze to change parameters, and a frozen-data-table prompt offering unfreeze to edit properties; strings alone do not identify the branch that presents them.

## Source identities and reproduction

Original bundle root: `/workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app`.

| Source relative to bundle | SHA-256 |
|---|---|
| `Contents/MacOS/Prism` |`854b63fc6df2712b7c67660142b2e6ff7f1bf755a5d78136fb5bec92e6fbc632`|
| `Contents/Resources/Base.lproj/MainMenu.nib` |`2cfdd66b236136a8123c3e1a47b499fa8af724dc4bc005be92b0a4db7a90c28a`|
| `Contents/Resources/Base.lproj/ContextualMenus.nib` |`07e3da3482b551150f1539bf915ccf2bd13a626d77ab3e3f4b14a66264da4c86`|
| `Contents/Resources/en.lproj/toolbarInfo.plist` |`cd9160e86f07e0c72d223b5b9d213a9cadf2f7ddaebefc61dd1f4fda517e239b`|
| `Contents/Resources/en.lproj/Core.strings` |`94e23baf68f89f36bfd53972f78dd061d7e10b30847eedcac0ce8471139c4dca`|
| `Contents/Resources/en.lproj/CoreLegacy.strings` |`46c13b4ecb2b728e69c21fc00371a606ddf8dd74dcad5423a9b17fd5ed3a23f8`|

`project_resource_findings.py` projects existing REA records, verifies localized-source hashes, and reads the toolbar with `plistlib`. Supplemental native records come from `/workspace/gp-evidence/native-metadata/{methods,strings,symbols}.jsonl`; their source is the exact x86_64 slice `/workspace/gp-inputs/prism-native/Prism-x86_64`, SHA-256 `8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf`. These supplemental parsers are distinct from REA evidence.

## Bounded native handlers

The raw-range pass uses the public REA MCP launcher with Ghidra. `LC_FUNCTION_STARTS` provides each original start and next-start boundary; this bounds extraction but does not prove every byte belongs to one source-level function. All range bytes and hashes, scripts, complete Evidence records, exports and close snapshots are retained under `/workspace/gp-evidence/rea-pass4/freeze/`. These tiny targets omit original data/import/other-code segments. `raw-context.json` separately resolves referenced selectors, classes, imports, and constants from the original Mach-O. Original artifacts remain unchanged.

| Handler owner / selector | Original x86_64 address | Extracted bytes |
|---|---|---:|
| `PSXResultsSheetController freezeSheet:` |`0x10119f9d6`|1003|
| `PSXGraphsSheetController freezeSheet:` |`0x1012eb807`|166|
| `PSXDataSheetController freezeSheet:` |`0x1013f6fbe`|548|
| `PSXSheetController freezeSheet:` |`0x101375a8d`|647|
| `PSXDocumentWindowController freezeSheetFromContextualMenu:` |`0x101392a4c`|162|
| Results unfreeze callback |`0x10119fdc1`|181|

The resource and native observations are separate: a menu action names a selector; the function bytes and supplementary original-file metadata establish the specific branching described below. No runtime interaction has been observed.

Confirmed control flow, with selectors resolved from the original image:

- **Base sheet handler:** returns in viewer mode. If the sender supplies a `representedObject` conforming to the `PSXSheet` protocol, that object becomes the singleton target; otherwise it uses `selectedSheets`. It enumerates the targets and calls `setFrozen:` with the inverse of **each sheet's own** `isFrozen`. Thus a mixed selection is inverted individually, rather than all being assigned one common state. Evidence `ev_e4cbc92ed21ec879d760db75d62049a38d6983ff1f2940bd57c8c28e6573f113`.
- **Graph handler:** returns in viewer mode; otherwise calls `validateEditing`, then the superclass `freezeSheet:` implementation. Original class metadata makes `PSXSheetController` the direct superclass. Evidence `ev_550b971579fd8d1fc4ead456d0a5149e86f9eb471f6d9c1493f77787824dc283`.
- **Results handler:** validates/aborts a current table editor if present. It resolves `representedSheetFromUIItem:` or uses `selectedSheets`. In the ordinary loop it inverses `isFrozen` through `setFrozen:`; an unfreeze additionally invokes a captured block. A frozen result flagged `isResavedByEarlierVersion` has a distinct single-target path involving `isOrphaned`, input replacement, and editable option revision; that flagged/frozen case is skipped in the ordinary multiple-target loop. This conditional compatibility logic must not be flattened into an unconditional toggle. Evidence `ev_6d1a6243f8a9dff8912dcfc578ebddbd617b1776618d894af078d11615c69259`.
- **Data handler:** returns in viewer mode. It checks `hasTransform` and compares `gatedFeature` with the original `dataCreatedVariables` constant. The matching branch passes four numeric keys matching the unfreeze confirmation, transform-loss explanation, Unfreeze, and Cancel resources to a dialog helper. Helper return 1000 gates `unlinkAllTransforms`; other paths continue without that call. It then validates editing, calls superclass `freezeSheet:`, and updates the sheet's alert sticky note. We have not decompiled the dialog helper or superclass chain in full, so exact cancellation behavior is not established. Evidence `ev_4ea1ac3cfa6f9825ce7231bb18d82a3c08542e24812a20a965bbde1a5d8672c4`.
- **Navigator context handler:** resolves `representedSheetFromUIItem:`; if present, uses the sheet's `kind` to obtain `sheetControllerForSection:` and forwards `freezeSheet:` with the original sender. This explains why one navigator menu action can reach different sheet-family overrides. Evidence `ev_75fb0980dcee73b9cd296ff8de24b2e77dde05f308713075833a646eb4c31a5a`.

No direct `undo`, `userAction`, or corresponding selector is present in the five selected handler ranges. That bounded absence says nothing about undo implemented by invoked setters or document infrastructure. Selection and toggle semantics are better supported than freeze persistence and dependency behavior.

The **results unfreeze callback** is now corroborated by REA Evidence `ev_6b25c51a40a525d29dc111ecf048899a2edda358eea547ef023fcebd64a46d36`. It obtains `currentResultPage.dataTable`, requests `editableDataBoundingSelection` (or uses a zero aggregate if no table exists), and sends `setValuesInDataTable:selection:excluded:` to the captured controller with `excluded=false`. Original Objective-C method metadata and x86_64 instruction `xor %ecx,%ecx` at `0x10119fe5a` resolve the boolean; the 24-byte selection aggregate is passed on the stack. `callback-argument-evidence.json` preserves this check because the raw decompiler invents extra register arguments without original message prototypes. This supports an exclusion-reset request on unfreeze. It does **not** establish downstream recalculation; the setter body at `0x10107fc25` and underlying `setFrozen:` implementations remain untraced.

`native-evidence-index.json` identifies the six pseudocode records, per-record warnings, full exports and close snapshots. `claims.json` gives machine-readable partial findings and remaining gaps. `verification.json` verifies every extracted range byte against the unchanged source slice. No native Evidence target should be mistaken for the full image: each target SHA is a bounded-range SHA linked through its range manifest.

Remaining decompiler limitations are explicit. Base/results handlers warn about bad instruction control flow after the unresolved `__stack_chk_fail` tail; the navigator tail indirect jump is reported as an unrecovered jumptable, and original import mapping identifies it as `objc_release`. All raw decompilations warn about overlapping global symbols because original data segments are absent. Selector/class/import mapping helps interpret these sites but cannot supply omitted callees or prove runtime outcomes. The supplemental full-class ivar parser retains seven errors; no selected handler binding was resolved through those failed ivar records.

The first callback attempt failed in REA's Java preflight process-ownership cleanup, before target analysis. Its complete error and a read-only check showing the reported transient PIDs no longer existed are retained in `failed-callback-attempt1/`. Retrying after the five-handler queue exited succeeded; no process was killed and no provider bypass was introduced.

The highest-priority gaps are underlying frozen-state storage and cached output, dependency invalidation/recalculation, undo/redo, saved/reopened state, exact data-transform dialog cancellation behavior, and runtime control validation. None is marked solved by menu recovery or handler decompilation.

## Bounded GP reconstruction

`web/src/workbook-freeze.ts` implements a Column/XY sheet toggle with copied source and output snapshots. Frozen results and graphs retain their original inputs/output when live values, rows or datasets change. Frozen data rejects value and structural edits; GP permits label/view metadata edits. Thaw remaps stable dataset IDs, invalidates missing inputs, and makes results eligible for GP's recalculation queue. Snapshot import validates captured identities separately from live identities; source deletion keeps GP's existing family cascade, and a graph's captured output can survive deletion of its live result sheet.

These storage, undo integration and recalculation choices are independent GP behavior, tested at the workbook level. They are not evidence that Prism uses copied JSON snapshots, has identical label-edit exceptions, or follows the same undo/recalculation machinery. No orphan support or full W004 equivalence is claimed.
