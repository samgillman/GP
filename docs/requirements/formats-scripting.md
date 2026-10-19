> Planning audit snapshot. Current execution status and evidence are maintained in the companion JSON register and [execution log](../completion-progress.md).

# Format and scripting requirements audit

Exhaustive requirement extraction for guide sections6/7 and AppendicesA–C; not an inventory of all Prism features or other guide chapters.

Fully read every word of guide §6, §7, and Appendices A–C: text lines 7137–9101, 9102–11808, and 12136–12296; sections.json indices142–213 and223–225. All prose, tables, examples, code, warnings and evidence labels were read. The entire PRISM11_DIFFERENCES.md was also read. Document scripts were treated as evidence and were not executed.

Inventory: 167 stable requirements: 67 format/evidence IDs and 100 scripting IDs, including73 individual native commands. These counts are not a completion percentage.

GP currently imports selected raw XML/ZIP tables and persists its own workbook format. It does not implement a PZC interpreter, complete native project roundtrips, or the classic PCFF codec. Version-specific author reports remain distinguished from artifacts directly available here.

## Blockers

- **R1**: No live licensed macOS Prism reference is available here; app execution, reopen/save, GUI, and image behavior require a reference host.
- **R2**: Guide Appendix A references scratch .prism snapshots, DRG pcff.py/prismedit.py, original .pzc examples/logs and before/after files not present in the supplied guide extraction; recover them if available or generate isolated reference fixtures.
- **R3**: Guide is Prism 10.3.1 macOS, installer is Prism 11.1.0 macOS; version-specific claims require cross-version checks rather than blanket transfer.
- **R4**: Guide explicitly leaves this field/behavior undecoded or unverified; controlled differential artifacts/native tracing needed.
- **R5**: Browser cannot silently reproduce native filesystem, Launch Services, Automator, AppleScript, SQL drivers, printing or Office integration; specify browser file/capability adapters and platform compatibility boundaries.
- **R6**: Guide claim is documentation/bundle-only or failed in one lab run; not a verified portable behavior contract.

## Implementation order

1. Source provenance and contradictions: F057–F061, S023–S027.
2. Complete document/table/reference models and unsupported-type guards: F008–F025, F045–F050.
3. Lossless codecs, bounded edits, and complete import/export: F031–F044, F002–F007, F051–F056.
4. Isolated reference reopen/export/save checks: F053.
5. Scripting infrastructure, command handlers, and complete recipes: S001–S022 andS101 onward.

## Requirement inventory

### F001 — Content-based file-family routing

**Status:** partial. **Guide:** 7.1; 7.5.1.

Current: UI routes ZIP magic and XML in known extensions; legacy magic is rejected.

Required: Route ZIP, XML/XSLT wrapper, PCFF, autosave package, method, template and script by bounded content sniffing and declared type. Preserve mismatch diagnostics.

Dependencies: none. Reference blockers: R3.

Acceptance:

- Same content with .pzt/.prism/.prismt names chooses same parser
- Binary renamed .xml fails clearly
- Empty ZIP and malformed headers never become CSV

### F002 — Native complete-project import/export

**Status:** unimplemented. **Guide:** 7.1; 7.2; 7.3.

Current: Only selected raw tables import; GP JSON workbook is a different format.

Required: Load/save complete .prism graph of data, analyses, views, graphs, layouts, info, notes, scripts and opaque members.

Dependencies: F004, F008, F009, F011. Reference blockers: R1, R2, R3.

Acceptance:

- Open→no edit→save preserves all semantic records and unknown member bytes
- Prism opens exported copy and re-save compares
- Unsupported features remain explicitly preserved, not silently dropped

### F003 — Project/template/legacy-method semantics

**Status:** unimplemented. **Guide:** 7.1; 6.4 Files and projects.

Current: ZIP template raw data can import; no native template or method lifecycle.

Required: Distinguish .prism/.prismt/.pzt templates, .pzm methods, Save Template, Save Method and Save Example. Templates create untitled documents; methods preserve reusable analysis settings.

Dependencies: F002. Reference blockers: R1, R2, R3, R4.

Acceptance:

- Open template never overwrites source on unnamed save
- Roundtrip native project/template both ways
- Recover actual method/example extension and storage first

### F004 — ZIP member integrity and bounded parsing

**Status:** partial. **Guide:** 7.2; 7.6.3.

Current: Limits, CRC when read, unsafe/duplicate member rejection and strict JSON keys exist.

Required: Cover member count, compressed/expanded bytes, corrupted deflate, encoding, traversal, duplicate keys and incomplete/mismatched member identities; diagnostic policy must distinguish partial import from full-project opening.

Dependencies: none. Reference blockers: none for independent implementation; runtime parity remains separate.

Acceptance:

- Bomb/member/dimension/cell tests
- Corrupt unreferenced member full-project validation
- Same import through browser worker and server has same result
- Bounded memory for malformed CSV and deep JSON

### F005 — Lossless archive rewrite metadata

**Status:** unimplemented. **Guide:** 7.2; 7.6.3; 7.7.

Current: No native writer.

Required: Preserve member order, names, timestamps, create_system, external attributes, compression and unknown members; change only intended data. Do not require archives to be all stored or all deflated.

Dependencies: F004. Reference blockers: R1, R2.

Acceptance:

- No-op equality of every uncompressed member
- Selected edit changes only allowed members/CRCs
- Archive testzip passes
- Prism reopen accepts preserved metadata and both observed compression types

### F006 — Version and compatibility model

**Status:** partial. **Guide:** 7.1; 7.2.1.

Current: ZIP checks formatVersion starts with 1- only; ignores minimums and sheet compatibility.

Required: Interpret document formatVersion/minFormatVersion/minPrismVersion and sheet minRequiredVersion/compatibility note/disable/warningOpen without guessing unknown policies.

Dependencies: F008. Reference blockers: R1, R3, R4.

Acceptance:

- Future minor/major version cases
- Disabled sheet remains preserved
- Compatibility-mode and converted copies have explicit state
- Prism10/11 cross-open matrix

### F007 — Older-format compatibility checker

**Status:** unimplemented. **Guide:** 7.1.

Current: No .pzfx/.pzf conversion or compatibility report.

Required: Report losses: compact-letter display text, analysis constant links, >80-character titles, Compact numeric format fallback, immutable newer analysis options and frozen symbol-size graphs.

Dependencies: F006, F047. Reference blockers: R1, R3, R6.

Acceptance:

- One fixture per listed loss
- Export refuses silent destruction
- Reference checker report matches version scope
- Keep original project untouched

### F008 — Full document/navigation metadata

**Status:** partial. **Guide:** 7.2.1; 7.3.

Current: GP workbook has own data/results/graph lists and active sheet; native lists only used for data imports.

Required: Preserve native ordered section UUID lists, created/modified metadata, navigator state, currentSheets/currentSheetType/viewMode, highlights and redundant title map.

Dependencies: F004. Reference blockers: R1, R3.

Acceptance:

- All section order roundtrips
- Active references survive deletion/reorder
- No duplicate or dangling UID
- File identity dates and creator semantics explicit

### F009 — UUID/fenID/reference integrity

**Status:** recovered_only. **Guide:** 7.3.

Current: Offline investigation resolved selected graph links; app does not model native IDs.

Required: Preserve per-kind fenID namespaces with gaps; resolve UUIDs and binary IDs, result views, graph sets and layout placements. Separate local text/axis IDs from auto-range flags.

Dependencies: F008, F039. Reference blockers: R1, R2.

Acceptance:

- Graphs resolve raw and computed data
- Duplicate/graft collisions detected
- Nonconsecutive fenIDs roundtrip
- Save/reopen renumbering reindexes semantic objects

### F010 — Autosave packages and recovery

**Status:** unresolved. **Guide:** 7.1.

Current: GP browser recovery is independent; .prismb package unexamined.

Required: Inventory .prismb package structure, lifecycle, lock/recovery behavior and safe browser equivalent.

Dependencies: F002. Reference blockers: R1, R4, R5.

Acceptance:

- Create/crash/recover scratch reference
- Preserve unsaved versions
- Package traversal and damaged recovery diagnostics

### F011 — Rich table model and all table families

**Status:** partial. **Guide:** 7.2.2; 7.5.1.

Current: Workbook raw Column/XY; grouped/survival separate input UI. Native imports only column/xy.

Required: Represent column, xy, grouped, contingency, survival, parts_of_whole, nested, multivariable and result/view distinctly; prevent one-way ExtTableType from silently becoming independent columns.

Dependencies: F008. Reference blockers: R1, R3.

Acceptance:

- Each family imported with semantics
- Numeric ExtTableType MultipleVariables/Nested is rejected until modeled
- Cross-family conversion reports loss
- Family-specific calculations retain design

### F012 — Raw Column/XY numeric import fidelity

**Status:** partial. **Guide:** 7.2.2–7.2.4; 7.5.1.

Current: Single raw subcolumns, finite numbers and blank alignment tested in both parsers.

Required: Complete numerical precision, empty tables/columns, unequal lengths, duplicate labels, names and bounds handling with source provenance.

Dependencies: F011. Reference blockers: R1.

Acceptance:

- Oracle CSV/XML values and exact blanks retained
- 18-significant-digit numeric strings tested
- All-empty table remains representable
- Browser/server same imported values

### F013 — Replicate descriptors and ranges

**Status:** recovered_only. **Guide:** 7.2.3; 7.2.4; 7.6.2; 7.6.3.

Current: Offline mapping expands ranges; app import explicitly skips all multi-replicates.

Required: Expand replicates and inclusive replicate ranges without shifting physical columns; preserve logical series and each replicate, and recompress equal adjacent descriptors on write.

Dependencies: F011, F012. Reference blockers: R1, R2.

Acceptance:

- 0~2 and 0~1 plus 2 fixtures
- Fill last blank merges ranges without changing design
- Gaps/overlaps/duplicate ranges rejected
- Side-by-side XY/grouped observations never flattened or averaged

### F014 — Preaveraged and asymmetric error formats

**Status:** unimplemented. **Guide:** 7.2.2; 7.5.1.

Current: Importers reject SD/SE/etc.

Required: Map y_sd/y_se/y_cv with or without N, y_high_low/y_plus_minus/y_error and XML SD/SE/CV/SDN/SEN/CVN/low-high/upper-lower-limits preserving statistical roles.

Dependencies: F011, F013. Reference blockers: R1, R3, R6.

Acceptance:

- One source fixture per format
- SD versus SEM/CV never mistaken for observations
- Asymmetric bounds preserve direction
- Roundtrip N and missing uncertainty

### F015 — Generated SeriesReplicate X

**Status:** unimplemented. **Guide:** 7.2.4; 7.6.2; 7.7.

Current: ZIP requires y_single X; XML requires numeric X.

Required: Materialize generated X=startValue+i*interval without consuming CSV column, while preserving generated representation for writeback.

Dependencies: F011, F013. Reference blockers: R1, R2, R4.

Acceptance:

- 1000-row fitted curve with two storedY columns
- ExplicitX versus generatedX curves compare
- Generated userX does not shiftY
- Zero/negative intervals and origin indexes characterized

### F016 — Row/subcolumn titles and rich titles

**Status:** partial. **Guide:** 7.2.3; 7.5.1; 7.6.3.

Current: ZIP drops row labels with warning; XML ignores them; title rich objects are coerced to dict strings in ZIP.

Required: Preserve row titles, subcolumn titles, plain or {string,version} titles, rich inline XML and whitespace; keep identity separate from presentation.

Dependencies: F011. Reference blockers: R1.

Acceptance:

- Quoted comma/newline/Unicode titles
- Rich JSON title string extracted correctly
- Row labels/subcolumn title order preserved
- Duplicate titles do not overwrite objects

### F017 — Multiple-variable typed cells and categories

**Status:** unimplemented. **Guide:** 7.2.3; 7.5.1.

Current: ZIP skips multivariable; XML does not guard ExtTableType.

Required: Handle currentType/isManual/category IDs/order/counts, CellType/UserText, MVType/statDecimals and text/numeric mixtures; preserve categorical design.

Dependencies: F011, F016. Reference blockers: R1, R3.

Acceptance:

- Numeric-looking IDs remain categories
- Category ordering/pivot alignment tests
- Newer-schema extensions retained
- Multi-variable XML cannot silently run as ordinary Column

### F018 — Exclusion/censor flags distinct from missing

**Status:** partial. **Guide:** 7.2.3; 7.5.1; 7.8.

Current: XML excluded becomes None; ZIP rejects unsupported semantic flags.

Required: Preserve original numeric value plus excluded/censored state; support EVFormat rendering independently. Determine native EXCLUDED representation before adding it.

Dependencies: F011. Reference blockers: R1, R4.

Acceptance:

- Exclude/unexclude roundtrip restores value
- Blank versus excluded versus censored remain distinct
- XML 0/1/false/true and asterisk forms
- Native one-cell differential fixture

### F019 — Dataset display and row-range metadata

**Status:** unimplemented. **Guide:** 7.2.3; 7.6.3.

Current: Import ignores firstRow/lastRow and most styling.

Required: Preserve first/last filled bounds, empty -1 bounds, cellAlignments, SCI_NOTATION, SECTION_TITLE, precision and rich cell formats; invalidate stale character runs when edits change strings.

Dependencies: F013, F016. Reference blockers: R1, R2.

Acceptance:

- Fill/delete edge cell adjusts bounds
- Empty column -1/-1
- Formatting ranges remain valid
- Reference reopen after Unicode row-title edits without crash

### F020 — Table dimensions and storage stamps

**Status:** partial. **Guide:** 7.2.4; 7.6.3; 7.8.

Current: Read-only numeric dimension validation exists; .dt preserved only in evidence.

Required: Update content counts and dataset bounds on writes; retain opaque data.dt and parameters.dt without inventing hash semantics; determine regeneration/cache behavior.

Dependencies: F005, F019. Reference blockers: R1, R4.

Acceptance:

- Resize updates every count
- No-op metadata untouched
- Same-data versus changed-data reference stamp diff
- Stale stamp cannot label results current

### F021 — Info sheets/constants/notes

**Status:** unimplemented. **Guide:** 7.2; 7.5.1; 7.8.

Current: No native info import or workbook info type.

Required: Map InfoSequence/Info constants/name/value/notes and native info paths; reference guide inference must be superseded by bundled concrete info members.

Dependencies: F008, F047. Reference blockers: R1, R3, R4.

Acceptance:

- Imported constant names/values preserve types/Unicode
- Empty and duplicate labels
- Info export roundtrip
- Scripting SetInfo/SetValueToInfo update right row

### F022 — Floating notes and automatic warnings

**Status:** recovered_only. **Guide:** 7.2.5; 7.2.6.

Current: Metadata inspected outside app; ignored on import.

Required: Represent rich text inclusive ranges, CR line breaks, position/size/DPI, visibility/read-only/automatic flags and inert help/web links.

Dependencies: F008, F016. Reference blockers: R1.

Acceptance:

- Attach notes to data/analysis/graph
- UTF-8 text index boundaries
- Automatic warnings survive recalculation
- Open/close collapse state roundtrip

### F023 — Saved analysis parameter reconstruction

**Status:** recovered_only. **Guide:** 7.2.6.

Current: Saved parameters extracted as oracles; app imports only raw tables.

Required: Load analysisClass, parameters and options with evidence-qualified mappings; unsupported analysis remains preserved with read-only state rather than recomputed defaults.

Dependencies: F009, F011. Reference blockers: R1, R3, R4.

Acceptance:

- Mapped test/regression options reproduce source
- Unknown options preserved
- Direction/tail/significance/output formatting survive
- No silent generic-analysis substitution

### F024 — Result views and full-precision results

**Status:** recovered_only. **Guide:** 7.2.6; 7.3.

Current: Oracles parsed offline; workbook stores independent GP results.

Required: Map resultSheets→AnalysisView→dataSheet, show hidden/internal/AUTO states correctly; distinguish displayed CSV rounding from full-precision results.json.

Dependencies: F009, F023. Reference blockers: R1.

Acceptance:

- Rounded0.2613 versus full0.2612876773271039
- All view ordering and visibility
- Read-only unsupported cached results identified
- Graph references non-internal curve set

### F025 — Linked recalculation and cache freshness

**Status:** partial. **Guide:** 7.2.6; 7.6.5; 7.7; 7.8.

Current: GP revisions invalidate/recalculate own linked results; no native cache contract.

Required: Track dirty dependencies and frozen sheets; preserve stale cached results as stale; establish recalculation-on-open and .dt role experimentally before claiming native equivalence.

Dependencies: F020, F023, F024. Reference blockers: R1, R4.

Acceptance:

- Edit one cell→save→referenceopen→compare results/view/curve
- Frozen versus live analysis
- Graph never labels stale result current
- In-memory open versus on-disk edit distinguished

### F026 — Graph/data/curve relationship loading

**Status:** recovered_only. **Guide:** 7.2.7; 7.3.

Current: 104selected graph relationships in graph-map.json; no app native graph import.

Required: Map raw and curve UUIDs/fenIDs, hidden generated curves and two graph engines without substituting incorrect data.

Dependencies: F009, F015, F024. Reference blockers: R1, R2.

Acceptance:

- Sourcegraph contains observed two raw+two fitted sets
- Generated curve X stays aligned
- No missing linkage after clone/reorder

### F027 — Modern MVGraph JSON import/export

**Status:** recovered_only. **Guide:** 7.2.7.

Current: Seven detailed modern records and schema mapped offline.

Required: Preserve axisX/Y, segments/extensions, gdo type/settings layers, matrix/categorical variables, legends/colors/dimensions and opaque binaryData; resolve merge precedence.

Dependencies: F026. Reference blockers: R1, R3, R4.

Acceptance:

- JSON no-op preserves unknown fields
- PC1/PC2/Type source mapping
- Categorical labelsSource resolves table UID versus rowlabels set
- Controlled saved renderer comparisons

### F028 — Native layout graph references

**Status:** recovered_only. **Guide:** 7.2.8; 7.3.

Current: Relevant source artifacts or offline mappings exist, but the application does not implement this native workflow.

Required: Load linkedGraphSheets, placement order, media collections, and native layout geometry.

Dependencies: F009, F031. Reference blockers: R1, R2.

Acceptance:

- Resolve every graph in placement order; preserve missing-reference diagnostics.
- Native layout roundtrip retains page and placement geometry.

### F029 — Font tables and document resources

**Status:** unresolved. **Guide:** 7.2.9; 7.4.4.

Current: The application does not implement this behavior and the reference contract remains partly unresolved.

Required: Decode PCFF font-list references, code pages, and font substitutions; distinguish font IDs from local text-style keys.

Dependencies: F039, F041. Reference blockers: R1, R2, R4.

Acceptance:

- Test Arial, Symbol, and Unicode together.
- Report missing fonts.
- Compare glyphs and text widths with Prism.
- Preserve unknown resource bytes.

### F030 — Pairwise comparison resource blobs

**Status:** unresolved. **Guide:** 7.2.9.

Current: The application does not implement this behavior and the reference contract remains partly unresolved.

Required: Map pairwiseComparisonsDataUid, comparison labels, p-values, and alpha; preserve unresolved records and links.

Dependencies: F009, F023, F040. Reference blockers: R1, R2, R4.

Acceptance:

- Retain full-precision saved comparison values.
- Recalculation updates brackets.
- Older-format export reports comparison-link loss.

### F031 — Lossless PCFF chunk codec

**Status:** unimplemented. **Guide:** 7.4.1.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement a bounded PCFFGRA4 codec: little-endian u16 tag, u32 payload length, payload-free markers when tag & 0x4000, record context, and unknown payload preservation.

Dependencies: F004. Reference blockers: R2, R3.

Acceptance:

- build(parse(blob)) equals the original bytes across all classic bundled blobs and supplied snapshots.
- Reject truncated or oversized records.
- Reject modern non-PCFF blobs.
- Bound nesting, allocation, and decompression.

### F032 — PCFF graph/layout record framing

**Status:** unimplemented. **Guide:** 7.4.2; 7.4.3.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Decode header 0x8001, graph record 0x8012, layout record 0x8035, object list 0x8018, tail 0x8003, and close markers; retain unknown record families.

Dependencies: F031. Reference blockers: R2, R3.

Acceptance:

- Record spans and counts match fixtures.
- Graph and layout frames remain distinct.
- Unknown chunks rebuild unchanged.

### F033 — PCFF names/data-set lists/style references

**Status:** unimplemented. **Guide:** 7.3; 7.4.3.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map NUL-terminated cp1252 sheet name 0x0009; data-set list 0x00a0 with its count and 32-byte entries; data-set fenID at byte 4 of 0x8028. Interpret tags only in their record context.

Dependencies: F009, F031. Reference blockers: R1, R2.

Acceptance:

- JSON and binary data-set references agree.
- Rename updates all redundant titles.
- Text-context 0x002f is never treated as a layout reference.

### F034 — PCFF drawn object identities and geometry

**Status:** unimplemented. **Guide:** 7.4.4.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Decode 0x8020 object kinds, three i16 rectangles, flags, matching i32 rectangles and link ID in 0x00db; retain 0x80fa objects and drawing order.

Dependencies: F031, F032. Reference blockers: R1, R2.

Acceptance:

- Check geometry copies agree.
- Identify text, axes, plots, frames, placements, legends, and additional ticks.
- Object counts match.
- Unknown kinds survive.

### F035 — PCFF text and encoding variants

**Status:** unimplemented. **Guide:** 7.4.1; 7.4.4; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Decode cp1252 text/header/style/paragraph chunks and their UTF-8 variants. Preserve automatic title flag 0xc000, custom flag 0x8000, CR paragraphs, and U+2028 category wrapping.

Dependencies: F031, F029. Reference blockers: R1, R2, R3.

Acceptance:

- Roundtrip Greek letters, subscripts, Symbol-font minus, and Unicode.
- Automatic titles follow sheet renames; custom titles do not.
- Encoded lengths and character-style ranges remain consistent.
- Edits within the last style run preserve earlier styles.

### F036 — Zval/Mval style tree codec

**Status:** unimplemented. **Guide:** 7.4.5.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement bounded Zval/zlib/Zend wrappers and Mval raw/map/array types 1, 5, and 6, including Dkey/Dval/Dfin and Asiz/Aval/Afin. Preserve or explicitly reject unknown types.

Dependencies: F031. Reference blockers: R2, R3.

Acceptance:

- Roundtrip nested maps, arrays, and raw values.
- Check both compressed and expanded lengths.
- Reject malformed tags and decompression bombs.
- Enumerate all observed graph/layout style trees.

### F037 — Drawing-order color/style consistency

**Status:** unimplemented. **Guide:** 7.4.5; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map SEDObject_Array by drawing order, IPGAxis_Array as three axes by three segments, plot/background/grid colors, and additional-tick colors. Preserve unknown style keys.

Dependencies: F034, F036. Reference blockers: R1, R2, R4.

Acceptance:

- Object and style counts agree.
- Removal, hiding, and reordering never recolor neighbors.
- Compare alpha and colors with Prism.
- Do not enable destructive edits before reference verification.

### F038 — PCFF axis group and segment field map

**Status:** unimplemented. **Guide:** 7.4.6; 7.6.4.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map three axis groups and their three segments through IDs. Decode group data/cached limits, length, title ID, segment IDs; decode segment limits, length, interval, first tick, and flags. The segment ID is not an auto-range flag.

Dependencies: F031, F033. Reference blockers: R2, R3.

Acceptance:

- Verify snap1-to-snap2 numeric and ID changes.
- Resolve nonconsecutive segment IDs.
- Check 0x0017 byte 40 against 0x00a5 byte 4.
- Preserve unknown flags.

### F039 — Local object/axis IDs and record index

**Status:** unimplemented. **Guide:** 7.3; 7.4.6; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Index text IDs, segment IDs, group title/segment references, drawn-axis 0x002a references, and 0x00db link IDs. Rebuild semantic lookup after Prism renumbers objects.

Dependencies: F031, F034. Reference blockers: R1, R2.

Acceptance:

- Test nonsequential IDs.
- Rename IDs through a bijective mapping without breaking references.
- Match objects after a Prism save without relying on old array indices.

### F040 — Additional ticks and reference lines

**Status:** unimplemented. **Guide:** 7.4.3; 7.4.6.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map additional-tick value/text/flags in 0x0026, following 0x00fc, style 0x00a2 and grid records, kind-15 drawn labels, and Zval addticks.

Dependencies: F034, F036, F038. Reference blockers: R1, R2, R4.

Acceptance:

- Use the Threshold-at-50 fixture.
- Moving a tick updates both stored doubles and its label.
- No orphan styles.
- Compare tick-only, text-only, and line-only cases.

### F041 — Axis auto/manual, origin and plot size semantics

**Status:** unresolved. **Guide:** 7.4.6; 7.4.7; 7.7; 7.8; Appendix B.

Current: The application does not implement this behavior and the reference contract remains partly unresolved.

Required: Test candidate 0x000c manual-range flags without treating the inference as fact. Locate origin settings. Resize plots through segment/group lengths and frame rectangles. Preserve unknown bits and establish logarithmic units.

Dependencies: F038, F039. Reference blockers: R1, R2, R3, R4.

Acceptance:

- Run the auto A1/manual B1 maximum-150 differential test.
- Re-enabling automatic range discards manual range as observed.
- Compare X-axis at Y=0 versus Lower Left origin.
- Compare resized plot, frame, and layout geometry.

### F042 — Legacy heatmap cell geometry

**Status:** unimplemented. **Guide:** 7.4.3.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Decode source-qualified legacy heatmap 0x80f4 dimensions/cell sizes and 0x00f7 gaps, with color and style associations.

Dependencies: F031, F036. Reference blockers: R1, R2, R3.

Acceptance:

- Compare rows, columns, widths, and gaps against a known fixture.
- Reject inconsistent dimensions.
- Require a rendered reference before enabling writes.

### F043 — PCFF layout placement codec

**Status:** unimplemented. **Guide:** 7.4.8; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map kind-11 placement boxes, graph fenID in 0x002f, placed size in 0x0030, 0x0037 placement list, 0x8018 count, and linkedGraphSheets. Preserve 0x0853 until its update rule is established.

Dependencies: F028, F034, F037. Reference blockers: R1, R2, R4.

Acceptance:

- All placement counts and references agree.
- Geometry uses the observed 1/600-inch units.
- Height changes update both placement box and original placed size.
- Prism opens edited copies without crashing.
- Test whether 0x0853 must change with placement count.

### F044 — Unknown binary fields preservation

**Status:** unimplemented. **Guide:** 7.4.3; 7.4.5; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Preserve every undecoded binary tag and payload, including the 0x8080 block; never zero unknown fields or process a modern graph through the classic codec.

Dependencies: F031. Reference blockers: R2, R3, R4.

Acceptance:

- Unknown payload hashes stay unchanged after bounded edits.
- Unsupported records survive.
- Wrong-magic inputs fail before mutation.

### F045 — XML namespace/root/wrapper/sequence fidelity

**Status:** partial. **Guide:** 7.5.1.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Preserve XML namespaces, document/source versions, ordered TableSequence and InfoSequence references, selected sheets, Created metadata, HelpTopic, DefGraphButton, Table/HugeTable, and unknown extensions. Never execute the XSLT wrapper.

Dependencies: F004, F011. Reference blockers: R1, R3.

Acceptance:

- Test namespace and XSLT wrappers.
- Test sequence order differing from element order.
- Reject duplicate/dangling IDs.
- Report HugeTable support explicitly.
- Confirm stylesheet code is inert.

### F046 — XML full cell/table format fidelity

**Status:** partial. **Guide:** 7.5.1; 7.5.3.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Support each declared TableType, ExtTableType, XFormat, YFormat, and EVFormat with preserved cell roles, exclusions, text, dates, replicates, and XAdvancedColumn. Explicitly reject unsupported semantics.

Dependencies: F011, F013, F014, F015, F016, F017, F018. Reference blockers: R1, R3.

Acceptance:

- Do not double-count XAdvancedColumn.
- Never treat Nested or MultipleVariables as ordinary OneWay.
- Test date/time/error/series X.
- Preserve rich cells and replicate alignment.

### F047 — XML writer and data-only exchange

**Status:** unimplemented. **Guide:** 7.5.2; 7.5.3.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Write ordered Prism XML data tables with blanks, exclusions, Unicode, and metadata. Distinguish data-only XML from complete projects; the obsolete XSD is informative rather than the sole gate.

Dependencies: F045, F046. Reference blockers: R1, R3.

Acceptance:

- GP-to-PZFX-to-GP semantic roundtrip.
- Prism opens the exported file and saves it natively.
- Check namespace, sequence, precision, and missing cells.

### F048 — XML Template blob codec/preservation

**Status:** unimplemented. **Guide:** 7.5.1; 7.5.2.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Decode bounded Template base64, zlib, and PCFFGRA4 layers; preserve analyses, graphs, layouts, and TemplateDescription. Keep data-only and complete-project modes explicit.

Dependencies: F031, F036, F045. Reference blockers: R1, R3.

Acceptance:

- Decode bundled templates with source hashes.
- No-op retains the original blob.
- Reject invalid base64, excessive expansion, and wrong magic.
- Editing data does not destroy opaque Template content.

### F049 — XML embedded scripts inert preservation

**Status:** unimplemented. **Guide:** 6.2; 6.7; 7.5.1.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Preserve embedded Script names, text, and open/close flags without executing them on upload. Explicit trusted execution must enforce the embedded Open prohibition and merge behavior.

Dependencies: F045. Reference blockers: R1, R3, R6.

Acceptance:

- Import and preview never execute scripts.
- Roundtrip flags and text.
- Explicit hooks follow enabled state.
- Merging XML does not automatically run its script.

### F050 — Schema drift and unknown extension policy

**Status:** partial. **Guide:** 7.5.1.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Treat the obsolete or nondeterministic XSD as documentation. Preserve newer CellType, UserText, MVType, statDecimals, and unknown fields with diagnostics.

Dependencies: F045, F046. Reference blockers: R3, R6.

Acceptance:

- Accept known valid Prism output despite old-XSD rejection.
- Reject malformed XML.
- Never ignore unknown semantic flags silently.
- Preserve unknown attributes on roundtrip.

### F051 — Native table editing metadata consistency

**Status:** unimplemented. **Guide:** 7.6.3; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Coordinate CSV edits with content counts, first/last row bounds, replicate descriptors, rich names, stale character formatting, and cached-result invalidation.

Dependencies: F005, F013, F019, F020, F025. Reference blockers: R1, R2.

Acceptance:

- A one-cell/title edit changes only allowed members.
- Filling the final blank merges replicate ranges.
- Resizing updates all counts.
- No-op metadata stays identical.
- Cached results become stale.

### F052 — Native sheet rename/delete/duplicate/graft

**Status:** partial. **Guide:** 7.2.1; 7.3; 7.6.3; 7.7.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Synchronize titles in the document map, sheet JSON, PCFF name, and automatic graph title. Repair navigation and links on deletion. Clone or graft with noncolliding UUIDs/fenIDs and preserved styles.

Dependencies: F005, F008, F009, F033, F035, F037. Reference blockers: R1, R2.

Acceptance:

- Rename every redundant title while keeping custom titles.
- Detect cross-document identity collisions.
- Duplicate families append in every section.
- Deletion leaves no dangling active-sheet or style reference.

### F053 — Native post-edit reopen/export/save validation

**Status:** unimplemented. **Guide:** 7.6.5; 7.6.6; 7.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Validate native edits on isolated new copies: reference open, export, save, then read back numbers, members, and images. Do not compare pre-recalculation caches as if current.

Dependencies: F002, F025, S016. Reference blockers: R1, R2.

Acceptance:

- Require a complete success log.
- Compare fresh full-precision results and view CSV.
- Capture geometry references.
- Modal dialogs and timeouts cannot count as success.
- Never overwrite the source or an open working document.

### F054 — GP workbook persistence boundary

**Status:** partial. **Guide:** 7.2.1; 7.3; 7.6.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Keep GP JSON explicitly distinct from Prism files. Integrate grouped/survival inputs, info, layouts, source metadata, and unsupported preserved fields into workbook persistence without claiming native parity.

Dependencies: F008, F011. Reference blockers: R1.

Acceptance:

- Roundtrip GP v1/v2.
- Reject invalid links and duplicate IDs.
- Preserve stale-result state.
- Give an explicit preservation or loss message for every imported feature.
- Persist advanced workspaces with the workbook.

### F055 — Import losses and warnings visible

**Status:** partial. **Guide:** 7.1; 7.5; 7.7.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Display all per-table unsupported reasons and data-loss notices. Distinguish selecting raw tables from opening a complete native project.

Dependencies: F002, F011, F045. Reference blockers: none for independent implementation; runtime parity remains separate.

Acceptance:

- Show detailed reasons when every XML table is skipped.
- Warn on ZIP exclusions/replicates.
- Preserve multi-table order.
- Do not mislabel rich names or exclusions as fully supported.

### F056 — Capacity and performance compatibility

**Status:** partial. **Guide:** 6.6; 7.2.2.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Inventory target-version capacities separately: script columns/replicates, sheets per section, native data sets/rows, and bounded browser limits. Scale or disclose limitations without silent truncation.

Dependencies: F004, F011. Reference blockers: R1, R3, R6.

Acceptance:

- Exercise each boundary and measure resources.
- Fail before partial mutation when over limits.
- Do not equate GP 500 total sheets with Prism 500 per section.

### F057 — Evidence corpus acquisition and provenance

**Status:** partial. **Guide:** Appendix A; Appendix C.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Track Lab, Bundle, Doc, observed, DRG, and inferred evidence separately. Index original snapshots, scripts, logs, menu trees, screenshots, and version provenance; list unavailable companion artifacts.

Dependencies: none. Reference blockers: R2, R3.

Acceptance:

- Hash source fixtures and record evidence grades.
- List missing Appendix A files explicitly.
- Do not infer screenshots or runtime results from prose.
- Link requirements to guide anchors.

### F058 — Contradiction ledger and source priority

**Status:** unimplemented. **Guide:** 6.2 The log file; 6.7; 7.2.6; 7.6.5; 7.8; Appendix B.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Retain and resolve guide contradictions: UTF-32LE versus UTF-16LE logs; recalculation-on-open versus unverified status; version-dependent PZT counts; inferred Info paths versus observed bundle members.

Dependencies: F057. Reference blockers: R1, R2, R3, R4.

Acceptance:

- Preserve both claims with locations.
- Decode real log bytes.
- Test cache refresh in Prism.
- Explain version differences without rewriting source evidence.

### F059 — Reference blockers and regression completion gates

**Status:** partial. **Guide:** Appendix B; Appendix C.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Close requirements only after relevant format roundtrip, numerical, UI/rendering, and runtime evidence exists. Record every unresolved Appendix B probe and never infer parity from inventory counts.

Dependencies: F057, F058. Reference blockers: R1, R2, R3.

Acceptance:

- Every stable ID has status, dependencies, tests, and blockers.
- No percentage computed from item counts.
- Keep full equivalence false while material gates remain open.

### S001 — Flat .pzc interpreter and command registry

**Status:** unimplemented. **Guide:** 6.1; 6.3; 6.4.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement a versioned, case-insensitive .pzc command registry and flat sequential interpreter. Treat AnalyzeData and SaveAs as unknown; distinguish documented, undocumented, and Windows-only commands.

Dependencies: F008. Reference blockers: R1, R3, R6.

Acceptance:

- Run a benign synthetic sequence only through explicit execution.
- Unknown commands stop with the correct line.
- Never silently ignore an unsupported command.

### S002 — Lexer, quoting and file encoding

**Status:** unimplemented. **Guide:** 6.3 Lines, arguments, quoting.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Parse UTF-8 plain text, LF/CRLF, one command per line, quoted Unicode paths/text, comma/space argument separators, and case-insensitive commands. Establish escaping rules experimentally.

Dependencies: S001. Reference blockers: R1, R6.

Acceptance:

- Test documented GoTo spacing variants.
- Preserve spaces and Greek text in quotes.
- Diagnose unterminated quotes or missing arguments.
- Never interpret text as a host-shell command.

### S003 — Comments and placeholder preflight

**Status:** unimplemented. **Guide:** 6.3 Comments; 6.6; Appendix B.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Support whole-line // and multiline /* */ comments and placeholder diagnostics. Keep inline comments, brackets inside quoted text, and DATA tags inside comments as explicit reference questions.

Dependencies: S002. Reference blockers: R1, R4, R6.

Acceptance:

- Test comment forms.
- Report placeholder lines.
- Probe quoted brackets and commented DATA tags on the reference app.
- Reject unestablished syntax clearly.

### S004 — Script size and resource limits

**Status:** unimplemented. **Guide:** 6.3; 6.6.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Preflight the reference 64 KB script limit; bound loops, embedded data, and output resources, and support cancellation with visible partial state.

Dependencies: S001. Reference blockers: R1, R3, R6.

Acceptance:

- Determine byte versus character counting with Unicode.
- Reject oversized scripts before mutation.
- Split jobs preserve state.
- Cancel resource-heavy loops safely.

### S005 — Data-block parser

**Status:** unimplemented. **Guide:** 6.3 Embedded data; 6.4 InsertData.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Parse immediately following, case-insensitive DATA blocks for InsertData and InsertDataLink, including tab/comma cells, text, headers, and blanks.

Dependencies: S002, F011. Reference blockers: R1, R6.

Acceptance:

- Test DATA/Data/data.
- Diagnose missing or nested start/end tags.
- Preserve empty cells and quoted commas.
- Omit raw block rows from command logs.

### S006 — Section/sheet/view coordinates

**Status:** unimplemented. **Guide:** 6.3 Sections; 6.3 Rows; 6.4 GoTo.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Model D/I/R/G/L Navigator sections, one-based sheets and result views, relative movement, title-row and X/row-title coordinates, and one-based subcolumns.

Dependencies: F008, F011, F024, S002. Reference blockers: R1, R6.

Acceptance:

- Test invalid sections, views, and sheets.
- Reordering and appending update numbers.
- Test row 0/-1 and column -1/0/1.
- Accept GoTo R,3,V2 and reject R3V2.

### S007 — Text substitution and single loop level

**Status:** unimplemented. **Guide:** 6.3 Variables; 6.3 Loops.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement %N, %F, %X, %S, text-only %D/%P, and %% substitutions; support one counted, file, or sheet loop at a time. Import without a name uses the file-loop item; Open does not.

Dependencies: S002, S006. Reference blockers: R1, R5, R6.

Acceptance:

- Reject nested or unmatched loops.
- Preserve literal percent signs.
- Diagnose unmatched file patterns.
- Start counters at one.
- Compare all substitutions against Prism.

### S008 — Active project and template state machine

**Status:** unimplemented. **Guide:** 6.1; 6.2; 6.4; 6.6.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Model the active project, already-open in-memory reuse, named Save changing identity, untitled templates requiring a filename, Close without saving, and frozen linked sheets.

Dependencies: F002, F003, F025, S006. Reference blockers: R1, R5.

Acceptance:

- Compare on-disk edits with an already-open reference document.
- Named Save preserves the original.
- Unnamed template Save fails.
- Closing allows the next loop to reload the template.

### S009 — Script errors and state transitions

**Status:** unimplemented. **Guide:** 6.2 The log file; 6.6.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Provide line/step/loop errors and running, failed, stopped, and completed states; stop on the first error and expose partial changes. Preserve verified error wording separately from inferred behavior.

Dependencies: S001, S006, S008. Reference blockers: R1, R6.

Acceptance:

- Test unknown commands, missing sheets/views/documents, bad axes, missing output, and loop errors.
- Later commands never execute after failure.
- Explicitly dismiss/reset failed jobs before the next run.

### S010 — Logging and byte encoding contract

**Status:** unimplemented. **Guide:** 6.2 The log file; 7.6.5.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement full and brief logging, excluding CreateLog itself and DATA contents from echoes. Export compatible UTF-32LE logs without BOM, using LF and no final newline; reconcile the conflicting UTF-16LE guide sentence.

Dependencies: S009, F058. Reference blockers: R1, R2, R3.

Acceptance:

- Compare actual bytes and Unicode.
- Handle partial four-byte writes.
- Test result-only default logs.
- Retain the indented reason preceding a failure line.

### S011 — Script editor, stepper and embedded storage UI

**Status:** unimplemented. **Guide:** 6.2 Option1.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Provide new/open/recent/sample script editing, external or embedded storage, script/log/syntax views, one/twelve-step execution, run/edit/save/delete/close, progress, and Stop.

Dependencies: S001, S009, S010, F049. Reference blockers: R1, R2.

Acceptance:

- Save and reopen drafts.
- Verify one and twelve steps change exactly the expected state.
- Stop within a loop.
- Handle missing recent files.
- Display embedded execution flags clearly.

### S012 — Explicit browser file/output capability adapter

**Status:** unimplemented. **Guide:** 6.2; 6.3 Paths; 6.4 file/text commands.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Map filesystem commands to explicit browser-selected files, a virtual workspace, or download bundles. Preserve path semantics within that adapter without claiming arbitrary native filesystem access.

Dependencies: S001, F004. Reference blockers: R5.

Acceptance:

- Resolve SetPath and quoted relative paths.
- Enforce output-folder and legal-name rules.
- Prevent escaping the selected workspace.
- Keep inputs local unless an explicit external adapter is used.

### S013 — Native launching integrations

**Status:** unimplemented. **Guide:** 6.2 Options2/4/5.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: If a native automation adapter is supplied, implement application-name targeting, asynchronous Launch Services opening, Automator first-item/text input, and log-based completion. Keep AppleScript/Accessibility capabilities explicit.

Dependencies: S010, S016. Reference blockers: R1, R2, R5, R6.

Acceptance:

- Test multiple Automator inputs.
- Detect launch dialogs and timeouts.
- Distinguish launch return from completion.
- Report missing native applications.
- Browser-only mode states which integrations are unavailable.

### S014 — Embedded open/close scripts and trust boundary

**Status:** unimplemented. **Guide:** 6.2; 6.6; 6.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Preserve external/embedded scripts and open/close hooks with explicit execution controls. Embedded scripts cannot Open; merged XML does not autorun scripts.

Dependencies: F049, S008, S011. Reference blockers: R1, R3, R6.

Acceptance:

- Import remains inert.
- Test embedded Open rejection.
- Verify explicitly enabled hook order.
- Show merge behavior.
- Bound recursive hooks.

### S015 — Text output/table-building state machine

**Status:** unimplemented. **Guide:** 6.4 Writing text; 6.4 Building results.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Implement output-file append/CLEAR and delimiters, semicolon tab-joining, ampersand concatenation, and table-output state. Support declared Prism/Text/CSV/HTML/XML targets; keep SQL behind an explicit platform adapter.

Dependencies: S006, S007, S012, F021, F024. Reference blockers: R1, R5, R6.

Acceptance:

- Compare exact output bytes.
- Test append and clear.
- Test transposed selections.
- Reject WText until EndTable.
- Report unavailable SQL capability.

### S016 — Serialized runner and completion detection

**Status:** unimplemented. **Guide:** 6.2 Option3; 6.6; 6.8.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Run jobs serially with stale-log removal, preflight, new terminal-status detection, timeout/cancel, Unicode partial-read handling, and explicit failed-window recovery.

Dependencies: S004, S009, S010, S012. Reference blockers: R1, R2, R5.

Acceptance:

- A stale log cannot report new success.
- Jobs never overlap.
- Distinguish crash, modal wait, and timeout.
- Surface the actual error line.
- Only explicitly submitted scripts execute.

### S017 — Template dependency workflow

**Status:** unimplemented. **Guide:** 6.1; 6.5 Batch import; 6.7.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Reuse template analyses and graph formatting when scripts change data; honor frozen sheets. Clear shorter imports to avoid stale rows. Do not invent commands that create analyses or change analysis options.

Dependencies: F023, F025, F052, S008. Reference blockers: R1, R2.

Acceptance:

- Run two input files of different lengths.
- Recompute linked graphs when allowed.
- Keep frozen results frozen.
- Reject AnalyzeData/SaveAs.
- Verify each output used the intended template.

### S018 — Export behavior and known platform differences

**Status:** partial. **Guide:** 6.4 Export; 6.6; Appendix B.

Current: A bounded GP subset exists; the remaining requirement and tests below are not established.

Required: Make the export command select the format, require a graph/layout, and support the specified options. Verify cropped PDFs, PNG resolution policy, transparency, color modes, TIFF compression, and version-dependent SVG behavior.

Dependencies: F026, F028, S006. Reference blockers: R1, R2, R3, R4, R6.

Acceptance:

- Compare 300/600 pixel density with PDF size.
- Probe 72/100/120/150/400/1200.
- Check wrong-sheet errors.
- Preserve exact SVG success/failure by version.
- Compare fonts, geometry, transparency, and multipage output.

### S019 — Script hard capacities and platform-only commands

**Status:** unimplemented. **Guide:** 6.4; 6.6.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Maintain versioned script limits and explicit Windows-only capabilities: Exit, WMF/EMF, Word, and PowerPoint. Do not confuse native limits with GP limits.

Dependencies: F056, S009. Reference blockers: R1, R3, R5, R6.

Acceptance:

- Test 256-column/replicate and 500-sheets-per-section boundaries.
- Test info rows 2–100.
- Report unsupported platform commands.
- Never truncate silently.

### S020 — Reference recipe acceptance suite

**Status:** unimplemented. **Guide:** 6.5; 6.8; Appendix A.

Current: No corresponding application compatibility implementation was identified in the audited source.

Required: Turn every guide recipe and example into a source-qualified end-to-end fixture, using isolated inputs and captured expected logs and outputs.

Dependencies: S001, S016, S017, S018. Reference blockers: R1, R2.

Acceptance:

- Export all graphs/layouts.
- Set multiple axes.
- Batch-import a template.
- Duplicate and refill a family.
- Run Monte Carlo collection.
- Write selected results and a completion marker.
- Leave originals unchanged.

### S021 — Undocumented command discovery boundary

**Status:** unresolved. **Guide:** 6.1; 6.4.

Current: The application does not implement this behavior and the reference contract remains partly unresolved.

Required: Keep SetTitle, SetImportOption, and ExportAConst explicitly undocumented until resources, handlers, and controlled reference runs establish arguments and behavior.

Dependencies: S001. Reference blockers: R1, R3, R4.

Acceptance:

- Report known-but-unsupported commands.
- Retain source-bound handler evidence.
- Enable only after argument, state, and output tests.

### S022 — Guide unverified script edge cases

**Status:** unresolved. **Guide:** Appendix B; 6.2; 6.3; 6.4.

Current: The application does not implement this behavior and the reference contract remains partly unresolved.

Required: Resolve unverified edge cases: quoted brackets, inline comments, DATA tags in comments, tilde paths, CloseScriptDialog, output append, PNG resolution, and exact SVG errors.

Dependencies: S003, S007, S010, S018, F058. Reference blockers: R1, R2, R3, R4, R6.

Acceptance:

- Probe one variable at a time.
- Retain raw logs and outputs.
- Compare Prism 10 and 11.
- Keep unverified loops/substitutions marked until tested.

### S101 — Open command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Open a quoted project/template path; reuse an already-open document; disallow Open in embedded scripts.

Dependencies: S001, S008, F002. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Open with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Open.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S102 — GoTo command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Select a section, numbered sheet, result view, relative next/previous sheet, or loop-number substitution.

Dependencies: S001, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute GoTo with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for GoTo.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S103 — Close command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Close the active project without saving; allow the next batch iteration to reload the template.

Dependencies: S001, S008. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Close with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Close.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S104 — Save command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Without a name, save to the current identity; with a path, write a new file and change current identity; untitled templates require a name.

Dependencies: S001, F002, S008. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Save with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Save.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S105 — Import command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Import CSV/TSV into row, column, and optional subcolumn coordinates; a missing filename uses the current file-loop item.

Dependencies: S001, F011, S005, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Import with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Import.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S106 — OpenOutput command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Open text output, append by default, truncate with CLEAR, and use a tab or explicit delimiter.

Dependencies: S001, S012, S015. Reference blockers: R1, R3, R6.

Acceptance:

- Execute OpenOutput with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for OpenOutput.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S107 — ForEach command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Start a counted or file-pattern loop; prohibit nested loops.

Dependencies: S001, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ForEach with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ForEach.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S108 — Next command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Complete the active loop body; diagnose unmatched or missing loop delimiters.

Dependencies: S001, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Next with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Next.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S109 — ExportWMF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Provide the documented Windows-only format/application integration, or report an explicit unsupported platform capability.

Dependencies: S001, S018, S019. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute ExportWMF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportWMF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S110 — WText command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write literal text, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WText with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WText.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S111 — WCell command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write one cell, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WCell with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WCell.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S112 — WCol command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a column from a row downward, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WCol with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WCol.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S113 — WRow command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a row from a column onward, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WRow with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WRow.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S114 — WSheet command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a sheet or suffix block, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WSheet with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WSheet.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S115 — Print command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Print the active sheet through the declared browser/native print adapter.

Dependencies: S001, S012, S006. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute Print with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Print.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S116 — CloseOutput command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Flush and close the current output stream; later writes require another OpenOutput.

Dependencies: S001, S015. Reference blockers: R1, R3, R6.

Acceptance:

- Execute CloseOutput with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for CloseOutput.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S117 — Regenerate command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Generate new values only for an active Simulate data result.

Dependencies: S001, F023, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Regenerate with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Regenerate.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S118 — ShortLog command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Select brief logging; establish exact legacy verbosity against the reference.

Dependencies: S001, S010. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ShortLog with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ShortLog.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S119 — SetPath command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set the default folder for relative Open, Import, image export, and OpenOutput paths.

Dependencies: S001, S012. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetPath with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetPath.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S120 — ClearTable command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Clear the whole table or cells below/right of a coordinate while retaining analysis and graph links.

Dependencies: S001, F025, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ClearTable with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ClearTable.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S121 — WDate command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write date/time, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WDate with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WDate.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S122 — Beep command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Request a notification sound through an available browser/native capability.

Dependencies: S001, S012. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Beep with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Beep.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S123 — WTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write active sheet title, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S124 — WTSheet command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a transposed sheet or suffix block, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTSheet with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTSheet.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S125 — ImportLink command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Reimport into an existing linked data object, preserving its saved import options.

Dependencies: S001, F025, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ImportLink with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ImportLink.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S126 — ExportPNG command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportPNG, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportPNG with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportPNG.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S127 — ExportTIF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportTIF, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportTIF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportTIF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S128 — ExportBMP command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportBMP, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportBMP with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportBMP.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S129 — WTCol command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a column transposed into a row, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTCol with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTCol.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S130 — WTRow command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a row transposed into a column, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTRow with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTRow.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S131 — RecalcAll command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Recalculate linked analyses without creating new analyses or silently changing options.

Dependencies: S001, F025. Reference blockers: R1, R3, R6.

Acceptance:

- Execute RecalcAll with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for RecalcAll.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S132 — InsertData command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Insert the immediately following DATA block at row/column/subcolumn coordinates.

Dependencies: S001, S005, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute InsertData with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for InsertData.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S133 — InsertDataLink command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Use a DATA block to update an existing linked data object.

Dependencies: S001, S005, F025. Reference blockers: R1, R3, R6.

Acceptance:

- Execute InsertDataLink with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for InsertDataLink.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S134 — Copy command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Copy a whole sheet or specified block, including subcolumns, to the selected clipboard adapter.

Dependencies: S001, S006, S012. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Copy with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Copy.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S135 — SetInfo command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set an info constant name, value, or notes at the specified row using field selector 0, 1, or 2.

Dependencies: S001, F021, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetInfo with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetInfo.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S136 — SetTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Retain this native command name as unsupported until its undocumented arguments, state requirements, and effects are recovered.

Dependencies: S001, S021. Reference blockers: R1, R3, R6, R4.

Acceptance:

- Execute SetTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S137 — SetYReplicates command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set the Y subcolumn count from 1 through 256; characterize resizing and existing-data preservation.

Dependencies: S001, F013, S019. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetYReplicates with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetYReplicates.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S138 — DuplicateDataTable command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Append a copy of the active data table only, optionally clearing its data.

Dependencies: S001, F052. Reference blockers: R1, R3, R6.

Acceptance:

- Execute DuplicateDataTable with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for DuplicateDataTable.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S139 — DuplicateFamily command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Append the table, linked analyses, and graphs with prefixed names, preserved styles, new identities, and optional CLEAR.

Dependencies: S001, F052, S017. Reference blockers: R1, R3, R6.

Acceptance:

- Execute DuplicateFamily with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for DuplicateFamily.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S140 — Paste command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Paste the clipboard block at specified row/column/subcolumn coordinates.

Dependencies: S001, S006, S012. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Paste with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Paste.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S141 — ExportJPG command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportJPG, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportJPG with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportJPG.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S142 — SetGraphTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set the active graph title, preserving the distinction between automatic and custom text.

Dependencies: S001, F035, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetGraphTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetGraphTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S143 — SetAxisTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set X, Y, or Y2 axis text; reject a missing right Y axis.

Dependencies: S001, F035, F038. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetAxisTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetAxisTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S144 — ExportEMF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Provide the documented Windows-only format/application integration, or report an explicit unsupported platform capability.

Dependencies: S001, S018, S019. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute ExportEMF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportEMF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S145 — SetScriptDialogTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Update the running-script progress panel title.

Dependencies: S001, S011. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetScriptDialogTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetScriptDialogTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S146 — DeleteAllDataSets command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Delete the active table data sets and their links; establish the optional CLEAR behavior separately.

Dependencies: S001, F011, F025. Reference blockers: R1, R3, R6.

Acceptance:

- Execute DeleteAllDataSets with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for DeleteAllDataSets.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S147 — CloseScriptDialog command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Close the script panel on successful completion; do not assume an unreached final command can dismiss an earlier failure.

Dependencies: S001, S009, S011. Reference blockers: R1, R3, R6.

Acceptance:

- Execute CloseScriptDialog with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for CloseScriptDialog.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S148 — WVersion command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write application version, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WVersion with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WVersion.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S149 — SetProjectName command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set the project name used on the next save.

Dependencies: S001, S008. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetProjectName with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetProjectName.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S150 — SetAxisLimits command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Set X/Y/Y2 BOTTOM, TOP, or INTERVAL, optionally for a named segment; validate limits and axis availability.

Dependencies: S001, F038, F041, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetAxisLimits with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetAxisLimits.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S151 — ApplyColorScheme command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Apply an exact built-in or saved color-scheme name; reject unknown names.

Dependencies: S001, F037. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ApplyColorScheme with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ApplyColorScheme.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S152 — ForEachSheet command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Iterate sheets in the active section in Navigator order, under the one-loop restriction.

Dependencies: S001, S007, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ForEachSheet with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ForEachSheet.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S153 — Table command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Begin a Prism, Text, CSV, HTML, XML, or explicitly supported SQL table output with the documented options.

Dependencies: S001, S015. Reference blockers: R1, R3, R6.

Acceptance:

- Execute Table with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Table.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S154 — WTable command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Append a named output column from an active-sheet cell or substituted text.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTable with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTable.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S155 — NextRow command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Advance to the next row of the output table.

Dependencies: S001, S015. Reference blockers: R1, R3, R6.

Acceptance:

- Execute NextRow with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for NextRow.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S156 — EndTable command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Finish table output and allow ordinary W commands again.

Dependencies: S001, S015. Reference blockers: R1, R3, R6.

Acceptance:

- Execute EndTable with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for EndTable.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S157 — SetSheetTitle command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Rename the active sheet; optionally retain the first K characters.

Dependencies: S001, F052, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetSheetTitle with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetSheetTitle.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S158 — SetValueToInfo command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Copy an active-sheet cell to the specified info table and row, with optional subcolumn and documented row limits.

Dependencies: S001, F021, S006, S019. Reference blockers: R1, R3, R6.

Acceptance:

- Execute SetValueToInfo with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetValueToInfo.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S159 — CreateLog command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Enable full command logging; omit the CreateLog line and embedded DATA rows; distinguish editor log routing.

Dependencies: S001, S010. Reference blockers: R1, R3, R6.

Acceptance:

- Execute CreateLog with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for CreateLog.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S160 — ExportTable command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active data/results/info sheet as TXT, CSV, or XML; XML ALL includes all data and info sheets.

Dependencies: S001, F021, F024, F047. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportTable with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportTable.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S161 — ExportPDF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportPDF, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportPDF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportPDF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S162 — ExportEPS command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportEPS, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportEPS with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportEPS.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S163 — ExportSVG command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportSVG, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportSVG with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportSVG.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S164 — SendToWord command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Provide the documented Windows-only format/application integration, or report an explicit unsupported platform capability.

Dependencies: S001, S018, S019. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute SendToWord with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SendToWord.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S165 — SendToPP command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Provide the documented Windows-only format/application integration, or report an explicit unsupported platform capability.

Dependencies: S001, S018, S019. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute SendToPP with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SendToPP.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S166 — SetImportOption command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Retain this native command name as unsupported until its undocumented arguments, state requirements, and effects are recovered.

Dependencies: S001, S021. Reference blockers: R1, R3, R6, R4.

Acceptance:

- Execute SetImportOption with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for SetImportOption.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S167 — Exit command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: On Windows, close all without saving and quit; report unsupported capability on macOS/browser.

Dependencies: S001, S019. Reference blockers: R1, R3, R6, R5.

Acceptance:

- Execute Exit with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for Exit.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S168 — ExportAConst command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Retain this native command name as unsupported until its undocumented arguments, state requirements, and effects are recovered.

Dependencies: S001, S021. Reference blockers: R1, R3, R6, R4.

Acceptance:

- Execute ExportAConst with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportAConst.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S169 — WBlock command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write selected row/column ranges with an optional label, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WBlock with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WBlock.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S170 — WTBlock command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Write a transposed selected block, applying supported coordinates, substitutions, delimiters, and semicolon/ampersand line joining.

Dependencies: S001, S015, S006, S007. Reference blockers: R1, R3, R6.

Acceptance:

- Execute WTBlock with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for WTBlock.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S171 — CreateLayout command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Append a rows-by-columns layout from a run of graph numbers and orientation; keep the old active sheet until GoTo selects the new layout.

Dependencies: S001, F028, F043, S006. Reference blockers: R1, R3, R6.

Acceptance:

- Execute CreateLayout with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for CreateLayout.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S172 — ExportAllPDF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportAllPDF, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportAllPDF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportAllPDF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### S173 — ExportTIFF command

**Status:** unimplemented. **Guide:** 6.1 binary command table; 6.4 Command reference.

Current: No scripting command implementation; analogous GP UI features do not implement .pzc compatibility.

Required: Export the active graph/layout through ExportTIFF, with its documented resolution, mode, CLEAR, or compression arguments where applicable. ExportAllPDF combines the documented sheets into one PDF.

Dependencies: S001, S018. Reference blockers: R1, R3, R6.

Acceptance:

- Execute ExportTIFF with every documented argument form and compare the resulting state/output against a version-matched reference.
- Test missing/invalid arguments, wrong active-sheet or output state, and platform limits for ExportTIFF.
- Verify no unrelated sheet, file, formatting, or link is changed; check the exact command log and first-error stopping behavior.

### F060 — Prism 11 format/version compatibility matrix

**Status:** partial. **Guide:** PRISM11_DIFFERENCES §5.

Current: No complete version-specific implementation or reference verification identified.

Required: Support observed stamp combinations: old project re-save 1-6-1/1-2-0/10.1.0, formula project 1-6-1/1-6-0/11.0.0, multifactor sample 1-6-1/1-6-1/11.1.0. Do not infer backward compatibility solely from a stamp.

Dependencies: F006, F007, F057. Reference blockers: R1, R2, R3.

Acceptance:

- Acquire and hash all four saved reference files.
- Compare actual Prism10/11 opening, frozen/empty states, and unsupported features.
- Preserve prior source versions.

### F061 — Prism 11 classic binary compatibility evidence

**Status:** unresolved. **Guide:** PRISM11_DIFFERENCES §5.

Current: No complete version-specific implementation or reference verification identified.

Required: Verify the reported 99-member Prism10-to-11 re-save and unchanged PCFF chunk types/counts using actual before/after files; keep it as author-reported until obtained.

Dependencies: F005, F031, F057. Reference blockers: R1, R2, R3.

Acceptance:

- Compare member lists and chunk inventories.
- Run exact no-op codec roundtrip on Prism11 blobs.
- Check semantic differences and retained unknown chunks rather than assuming byte equality of content.

### F062 — Calculated-variable persistence and dependency metadata

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §2.1; §5.

Current: No complete version-specific implementation or reference verification identified.

Required: Preserve multiple-variable data-set transform text, variable types, formulas and dependency links; raw calculated values cannot substitute for the formula contract.

Dependencies: F017, F023, F025. Reference blockers: R1, R3.

Acceptance:

- Roundtrip C-D, E-F, and 2^(-G).
- Distinguish literal values from linked calculated variables.
- Recalculate changed inputs and preserve variable identity.
- Unsupported formula remains preserved and clearly unavailable.

### F063 — Prism 11 categorical graph down-save losses

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §2.5; §5.

Current: No complete version-specific implementation or reference verification identified.

Required: Track new multiple-variable layered graphs and Level Order as version-specific features; old versions may show empty graphs and PZFX may be unavailable.

Dependencies: F007, F027. Reference blockers: R1, R3, R6.

Acceptance:

- A native file retains layers and category order.
- Down-save reports unavailable or lossy features before writing.
- Match Prism10/11.0 empty-graph/update-note behavior when verified.

### F064 — Info-constant slash preservation across versions

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §5.

Current: No complete version-specific implementation or reference verification identified.

Required: Preserve complete info-constant values containing slash. Record the reported macOS11.1 PZF/PZFX truncation as a compatibility defect, not desired destructive behavior; native .prism is reportedly unaffected and11.2 fixes it.

Dependencies: F021, F047, F060. Reference blockers: R1, R3, R6.

Acceptance:

- Roundtrip value A/B without loss in GP and .prism.
- Capture11.1 versus11.2 PZFX/PZF reference outputs.
- Warn on known lossy reference export instead of silently reproducing truncation.

### F065 — Read-only/frozen feature preservation

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §1; §5; §7.

Current: No complete version-specific implementation or reference verification identified.

Required: Preserve frozen data sheets and unsupported feature editability without conflating source entitlement with data validity. Viewing/exporting preserved Pro content differs from editing it.

Dependencies: F006, F025, F027. Reference blockers: R1, R3, R6.

Acceptance:

- Frozen raw data rejects edits.
- Unsupported content remains viewable/preserved where possible.
- Never alter source licensing or activation.
- Record minimum-version and capability reasons separately.

### S023 — Prism 11 SVG success and editable text

**Status:** partial. **Guide:** PRISM11_DIFFERENCES §6.

Current: No complete version-specific implementation or reference verification identified.

Required: Prism11 ExportSVG reportedly produces vector SVG with editable Arial text; supersede the Prism10 lab-failure assumption only for the target version, retaining both histories.

Dependencies: S018, S022. Reference blockers: R1, R2, R3.

Acceptance:

- Acquire source SVG and log.
- Inspect text/vector elements, fonts and transforms.
- Compare graph geometry with PDF/PNG.
- Ensure ExportSVG is not disabled merely because Prism10 failed.

### S024 — Prism 11 measured PNG resolution policy

**Status:** unresolved. **Guide:** PRISM11_DIFFERENCES §6.

Current: No complete version-specific implementation or reference verification identified.

Required: Test the measured150→300,400→300,600→600 px/in behavior. The new400 result contradicts a general snap-up-to-next-resolution rule. Preserve1200 as a recommendation until measured.

Dependencies: S018, S022, F058. Reference blockers: R1, R2, R3.

Acceptance:

- Use a known physical graph width.
- Compare150/400/600 PNG dimensions with PDF inches.
- Probe100/300/1200 separately.
- No unverified Retina scaling explanation.

### S025 — Prism 11 scripting fixes regression cases

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §6.

Current: No complete version-specific implementation or reference verification identified.

Required: Add InsertData within ForEachSheet for projects with four or more data tables, and exported filenames from sheet names containing dots.

Dependencies: S005, S006, S007, S020. Reference blockers: R1, R2, R3, R6.

Acceptance:

- At least four tables receive data at the correct cells exactly once.
- Dotted sheet names export without truncation.
- Preserve intended extension.
- Cross-version reference case records the fixed behavior.

### S026 — Version-specific application and result-cell targeting

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §5; §6.

Current: No complete version-specific implementation or reference verification identified.

Required: Target Prism10/11 by application name because bundle identifiers are shared; positional WCell/WRow references must be version-qualified because result rows can move.

Dependencies: S006, S013, S015, F024. Reference blockers: R1, R3, R5, R6.

Acceptance:

- Two installed/running versions cannot be confused.
- Result-cell extraction checks view identity and expected labels.
- Source version changes invalidate brittle positional mappings.

### S027 — No invented commands for Prism 11 features

**Status:** unimplemented. **Guide:** PRISM11_DIFFERENCES §6.

Current: No complete version-specific implementation or reference verification identified.

Required: Keep formulas, multifactor ANOVA, Level Order and effect-size setup in templates or explicit UI/file workflows; the source reports no corresponding new script commands.

Dependencies: S001, S017, S021, F062. Reference blockers: R1, R3, R6.

Acceptance:

- Registry contains only evidenced commands.
- Unsupported new-feature command fails clearly.
- Templates preserve configured options while scripts replace data.

### F066 — Saved color-scheme file compatibility

**Status:** unimplemented. **Guide:** 7.1; 6.4 ApplyColorScheme.

Current: No complete version-specific implementation or reference verification identified.

Required: Inventory .clr Apple typedstream NSColor/NSString scheme files, names, palettes, and built-in versus user scheme selection. Preserve platform-specific archives; do not assume graph RGBA strings are the same file format.

Dependencies: F037, S001. Reference blockers: R1, R2, R4, R5.

Acceptance:

- Read a source-hashed custom scheme.
- ApplyColorScheme resolves its exact name.
- Palette order, alpha, and Unicode names roundtrip.
- Unsupported native typedstream remains preserved or clearly rejected.

### F067 — Appendix B cross-scope unresolved reference checks

**Status:** unresolved. **Guide:** Appendix B.

Current: No complete version-specific implementation or reference verification identified.

Required: Hand off and retain every non-format Appendix B reference probe in the combined plan: Settings, Format This Point, auto-range checkbox, scatter Line at choices and Global wording, t-test pairwise brackets/tabs, subscript/superscript shortcuts and Symbol minus, ANOVA parameter tabs, and Inspector availability. Do not mark them verified from prose.

Dependencies: F059. Reference blockers: R1, R2, R3, R4.

Acceptance:

- Cross-link each probe to the UI/statistics owner requirement.
- Retain observed versus unverified status.
- Capture controlled screenshots and saved changes where applicable.
- Track the Prism11 Inspector/formula and graph changes separately.
