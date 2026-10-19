# Excluded values: evidence ledger and GP reconstruction (D001/E007)

Target: Prism 11.1.0 (build 110218) for macOS. Exclusion parity is **not** established. No Prism code was executed, and no running Prism reference is available on the Linux host.

## REA status for this work unit

The REA skill was read from the public `morluto/rea` repository (version 6.7.0, commit `b4938aed58737293a6987630476632619713f5cd`). The 2026-10-19 cloud container held neither the Prism installer/extracted image nor the earlier `/workspace/gp-evidence` exports, so **no new REA analysis was run**. Following the skill's reuse-before-repeat rule, this unit relies on Evidence IDs already recorded in this repository. Native questions below remain open for a session that has the artifacts.

## Evidence by type

| Type | Source | Statement used |
|---|---|---|
| REA static UI (decoded NIB) | `ev_212198e3cb25470fb0235238305c0f50a540af50328dc6518b90657015019b68`, `ContextualMenus.nib` objects 1499 and 6542; see [UI evidence](prism-ui-rea-evidence.md) | A shipped context-menu item labelled **Exclude Values** sends `excludeValues:`. The owning context (data cell versus graph point) and the handler body are not recovered. |
| REA static native | `ev_6b25c51a40a525d29dc111ecf048899a2edda358eea547ef023fcebd64a46d36`; see [freeze evidence](prism-freeze-rea-evidence.md) | Unfreezing a results sheet sends `setValuesInDataTable:selection:excluded:` with `excluded=false` over the result page's table. This concerns results-side exclusions, which GP does not yet implement. |
| Packaged string (via REA projection) | `en.lproj/CoreLegacy.strings` key 1018 | Frozen tables allow excluding values from results tables but do not update the table itself. |
| Packaged schema | `Contents/Resources/PrismXMLSchema.xsd` (see [investigation](prism-investigation.md)) | `Excluded` is an XML Schema Boolean with default zero. |
| Public guide via user audit | P0120, P0121, P0147, P0162 in [the parity CSV](sources/prism-parity.csv) | Excluded values remain visible in blue italics followed by an asterisk and are left out of analyses and graphs. Copy/export can write them as numbers, with an asterisk, or as blanks. Import can treat numbers followed by an asterisk as excluded. |

## GP implementation

- `DataSheet.excluded` maps dataset IDs to row IDs (GP workbook version 4). Entered text is unchanged; `includedProject`/`selectedProject` blank excluded cells for analyses, linked recalculation, plotted points and graph export.
- Exclusions follow row and dataset identities through insert, reorder and delete. Deleting the row or dataset removes the exclusion rather than retargeting another cell.
- The same command is available from the cell/row/column context menu, the Edit menu, the Data toolbar and graph point details. Each use is one undo entry.
- Prism XML import keeps the original number for `Excluded="1"/"true"` cells and for `EVFormat="AsteriskAfterNumber"` values. Excluded cells with no finite number still import as missing, with a notice.
- CSV export and Copy table as CSV ask how to write excluded values when a table has any. GP's CSV import treats a number followed by an asterisk as excluded.
- Frozen data tables reject exclusion changes. Frozen results and graphs keep the exclusions captured with their source snapshot.

### Independent GP choices (not native observations)

- Toggle rule: if every numeric value in the selection is already excluded, the command includes them again; otherwise it excludes all of them.
- Blank and non-numeric draft cells are never excluded.
- Editing or clearing an excluded cell removes its exclusion; moving its row keeps it.
- An excluded XY X value removes that row's points, just as a missing X does.
- Colors, asterisk placement, labels for the graph-point action and the CSV export dialog are GP designs.
- ZIP (`.prism`) import still rejects `EXCLUDED` cell attributes because the committed evidence does not document their row-range encoding.

## Open native questions

1. `excludeValues:` handler: mixed-selection toggle rule, behavior on blank cells, and whether it applies from graph points as well as data cells.
2. Whether editing an excluded value keeps or clears its exclusion.
3. Native key equivalent for Exclude Values in `MainMenu.nib` (not in the committed projection).
4. `setValuesInDataTable:selection:excluded:` at `0x10107fc25`: storage representation, undo and downstream recalculation.
5. ZIP cell-attribute row encoding for `EXCLUDED`, and native export/copy defaults for excluded values.
6. Results-side exclusions (CoreLegacy 1018) and their interaction with freeze.

## Verification

- `web/src/workbook-exclusions.test.ts` (10 tests), `web/src/data.test.ts`, `web/src/data-grid.test.ts` and `tests/test_import_prism.py`.
- `scripts/check_exclusions.py`: 10 Chromium scenario groups on the packaged server build with actual calculations and zero page errors.
- The static self-contained build was not run in this container: its network policy denied `cdn.jsdelivr.net`, which serves the locked Pyodide wheels. CI runs the same check against both builds; that hosted result has not been observed yet.
