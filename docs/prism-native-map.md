# Prism 11 native metadata and project format map

This pass inspects the supplied Prism 11.1.0 build 110218 bundle without running Prism. It provides native entry-point candidates and a tested raw-table ZIP mapping. It does not establish complete Prism behavior, original source recovery, or full project compatibility. REA/Ghidra decompilation evidence is maintained separately by the main investigation.

## Source identity and reproducibility

The universal `Contents/MacOS/Prism` SHA-256 is `854b63fc6df2712b7c67660142b2e6ff7f1bf755a5d78136fb5bec92e6fbc632`. The analyzed x86-64 slice starts at universal-file offset 16,384, is 57,308,576 bytes long, and has SHA-256 `8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf`. Slice provenance is recorded in `/workspace/gp-evidence/native-pass2/slices.json`.

The portable, read-only parser `/workspace/gp-evidence/native-metadata/inspect_native.py` decodes Mach-O load commands, segment/section layouts, all `LC_SYMTAB` records, Objective-C class and category method lists, and NUL-terminated strings in five explicitly selected string sections. Addresses below are unslid x86-64 virtual addresses; recorded file offsets are relative to the thin slice. Add 16,384 to obtain the corresponding universal-binary byte offset.

The complete bounded output is retained outside the GP repository:

| File under `/workspace/gp-evidence/native-metadata/` | Contents |
| --- | --- |
| `layout.json` | Segment and section ranges, load commands, source hash |
| `symbols.jsonl` | 14,195 symbol records with symbol/string byte offsets |
| `classes.json` | 1,417 defined Objective-C class names and metadata pointers |
| `methods.jsonl` | 38,820 class/category methods with type encodings, implementation addresses, and record offsets |
| `strings.jsonl` | 37,407 `__cstring`, 35,764 selector-name, 2,126 class-name, 3,394 method-type, and 597 Swift reflection strings |
| `summary.json`, `parse-errors.json` | Counts and explicit parse coverage/errors |
| `file-format-inventory.json` | Every bundled `.pzt`, `.prismt`, and `.pzfx` file's magic, size, and SHA-256 |
| `zip-projects.json` | Fourteen ZIP member inventories, source/member hashes, user-sheet relationships, metadata, and CSV cells |
| `zip-table-profiles.json` | Fifteen user-table dimension checks |
| `import-integration.json` | Actual bundled-template importer results, source identities, and warnings |

All 38,820 decoded implementation addresses lie within `__TEXT,__text`; there were no class/category parsing errors. The symbol table has only 176 records in the code section, so symbol-table coverage alone is far smaller than Objective-C metadata coverage. C++ statistical implementation names were not recovered by the bounded statistical-name search. Swift metadata, all C++ RTTI/vtables, dyld fixups, arbitrary non-string-section bytes, and arm64 methods were not decoded by this parser.

## Native anchors for focused REA analysis

These names are stored metadata, not proof of method behavior. Follow their calls and inspect pseudocode before drawing implementation conclusions.

| Stored Objective-C method | Implementation address |
| --- | --- |
| `PSXTTestsDialogController performOK` | `0x1010038b4` |
| `PSXOneWayANOVADialogController performOK` | `0x10100a727` |
| `PSXLinearRegressionDialogController performOK` | `0x100ff72ae` |
| `PSXNonlinearRegressionDialogController performOK` | `0x1010d3471` |
| `PSXDocument readFromURL:ofType:error:` | `0x1014235ae` |
| `PSXDocument writeToURL:ofType:error:` | `0x101423277` |

Persistence-related class names include `PSXDocumentDataFactory`, `PSXDocumentDataLoader`, `PSXNativeDocumentData`, `PSXDocument`, and `PSXLegacyDocument`. Useful literal-reference anchors include `PCFFGRA4` at `0x102862f5d`, `data/tables/` at `0x1028742ce`, `anovaWelchTest` at `0x1028b06d2`, and `logWelchTTestModel` at `0x1028b5c8e`. These are candidates for reference tracing, not evidence that those strings alone describe an executed path.

## Observed container families

The supplied bundle contains three different formats under the `.pzt` extension:

| Extension and magic | Observed files |
| --- | ---: |
| `.pzt`, `PCFFGRA4` legacy binary | 18 |
| `.pzt`, XML | 46 |
| `.pzt`, ZIP | 3 |
| `.pzfx`, XML | 8 |
| `.prismt`, ZIP | 11 |

There are no `.prism`, `.pzf`, `.pze`, or `.pzm` files in this bounded bundle inventory. Compatibility with arbitrary files bearing those extensions has therefore not been established. The eighteen legacy files' magic is identified, but their binary record layout has not been decoded. File extensions must not select a parser without examining content.

The ZIP templates contain JSON metadata, CSV numeric/text cells, and opaque binary graph/layout objects. Their `document.json` includes format/minimum-version metadata and ordered sheet identifiers. Some templates were saved by older Prism versions; their presence in Prism 11 does not prove every Prism 11 output variant uses exactly the same representation.

## ZIP raw-table mapping

The following relationship was checked against all fourteen available ZIP templates. All fifteen user data tables have CSV row/column counts matching their declared storage dimensions and the reconstructed physical column count.

1. `document.json.sheets.data` lists user data-sheet IDs in order. Do not import every `data/sheets` member as user input: some members are analysis result views.
2. `data/sheets/<sheet-id>/sheet.json` supplies the title and `table` object. `table.uid` identifies storage under `data/tables/<table-id>/`.
3. `content.json` declares storage version, `numberOfRows`, and `numberOfColumns`. `data.csv` carries rows without a header.
4. Physical CSV columns follow an optional `rowTitlesDataSet`, optional `xDataSet`, and ordered `dataSets`. Each ID resolves to `data/sets/<dataset-id>.json`.
5. A data-set record gives its title, format, attributes, and replicate metadata. A `replicates` array enumerates physical subcolumns. Alternatively, `replicate ranges` encodes inclusive ranges such as `0~2`; this must be expanded before counting subcolumns. A replicate count is not a count of independent groups.
6. Empty CSV cells preserve missing values and row alignment. Categorical variables contain text even when related metadata includes numeric storage descriptors. Interpret cell text together with variable type and analysis mapping.
7. `data.dt` is an opaque 32-byte ASCII hexadecimal field in the examined examples. It does not equal the CSV MD5 in the checked dose-response example. Its semantics are unresolved; the importer does not invent an integrity interpretation for it. ZIP CRC checks are performed by Python's ZIP reader, and evidence records add SHA-256 hashes.

For example, `Geometric mean.pzt` has a column table with fourteen rows and three physical columns: row labels, Control, and Treated. `Dose-response curves.pzt` has eleven rows and seven physical columns: X, three No inhibitor replicates, and three Inhibitor replicates. Those replicates cannot be silently collapsed into a single series or averaged without preserving the analysis design.

The MultipleVariables paired-test template contains thirty long-format rows with `Patient_ID`, `Treatment`, and `Blood_Pressure`. Fifteen patient IDs each have Drug_A and Drug_B observations. Correct paired testing requires pivoting by the stored patient identifier and treatment mapping. Merely testing adjacent numeric columns would test the wrong quantities. Numerical oracle work is recorded separately in `/workspace/gp-evidence/resources-pass2/`.

## Implemented importer boundary

`gp/import_prism_zip.py` imports observed raw `column` or `xy` tables with `y_single` subcolumns. It uses in-memory ZIP reads, follows explicit member names, preserves missing-row positions, validates numeric limits, and reports omitted row labels. It skips replicate, preaveraged, categorical/multivariable, and unsupported cell-flag representations with clear warnings. Saved analyses, graphs, layouts, annotations, and model choices are not imported.

The limits are 16 MiB compressed, 64 MiB declared total expanded data, 8 MiB per member, 4,000 ZIP entries, 100 data sheets, 10,000 rows per table, 32 numeric columns, and 100,000 numeric cells per accepted table. Duplicate/unsafe paths, encrypted members, unsupported compression, duplicate JSON keys, non-finite values, and inconsistent CSV dimensions are rejected. Nothing is extracted or executed.

Validation includes 21 synthetic-fixture tests. An integration probe against the actual bundled templates imports one fourteen-row table from `Geometric mean.pzt` and two tables from `Time line.pzt`. It explicitly skips the dose-response replicate table and paired-test multivariable table. Source files and raw proprietary sample contents remain outside the repository. This demonstrates a useful, bounded compatibility path; it does not establish full `.prism` project support or native rendering parity.
