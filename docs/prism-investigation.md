# Prism 11.1.0 investigation and GP implementation

## Source identity

The user supplied eight consecutive 24 MiB split parts (`aa` through `ah`, with a shorter final part). The reconstructed `InstallPrism11.dmg` is 176,386,621 bytes; SHA-256:

`3a3e6700325df42937fe560b473d02bc881f4878b3fad11785004374870012f5`

The UDIF footer is present. 7-Zip 25.01, obtained through signed Debian package metadata, successfully extracted the DMG/HFS filesystem with checksum verification. Reassembly records and original parts are retained outside this repository. A checksum from the user's original unsplit file was not supplied, so the recorded hash establishes the identity analyzed here, not an independent comparison with that original.

`Prism 11.app/Contents/Info.plist` reports version **11.1.0**, build **110218**, identifier `com.GraphPad.Prism`, executable `Prism`, and minimum macOS version 12.0. These are observations from the extracted bytes.

## REA evidence

REA 6.7.0 was used through its CLI with the reverse-engineer-anything workflow.

- DMG inspection: `ev_4c9edfcbeb1eced54c622e820ba4476869d0a7b7da2f9be466f71bf39eef9672`. REA verified the root identity but explicitly reported that native DMG child inventory requires macOS. This result alone did not inspect the contents.
- Extracted bundle inspection: `ev_4603ba47f833cde812c91edb0411496c352b2efbafa386d2b035143064b46289`.
- Bundle inventory: `ev_aa792543d2ca4e4d953ed69598fc5a1e99e1bdf4d765683ca61f262fb76991bb`, 1,240 nodes and 2,589 occurrences, complete within the container-entry inventory scope. Extraction preserved filesystem metadata streams as additional files; these counts are not counts of features or functions.

Full JSON records are in `/workspace/gp-evidence/rea-dmg.json` and `/workspace/gp-evidence/rea-prism-bundle.json`. REA's target-free `inspect_macho` operation requires native macOS utilities unavailable on Linux. This is distinct from its Ghidra provider, which accepts the extracted x86_64 Mach-O slice for static native analysis. Static analysis does not execute the original app or establish runtime equivalence.

The subsequent [resource pass](prism-resources.md) recovered 152 equation records, 323 interface archives, 82 documented in-table functions, and saved analysis outputs. REA cross-checked all eight records in the exponential equation archive (`ev_aabbaa1a43fb026eec06a396027e90ab2c45cab2b190e184bc36aca00ec664fc`). The [native metadata pass](prism-native-map.md) mapped 38,820 Objective-C methods and the JSON/CSV structure of 14 modern ZIP projects. The [graph pass](prism-graph-format.md) resolved 104 selected graph/data/settings references. These bounded inventories retain source hashes and unresolved fields; they are not complete behavioral specifications.

The [bounded native-code pass](prism-native-code.md) also produced REA pseudocode for six source-addressed function ranges. These reveal dialog option handling and portions of document dispatch, with explicit missing context and decompiler warnings. They do not establish recovery of Prism's numerical core.

## Observed table format

The bundled `Contents/SharedSupport/SampleData` contains Column/OneWay, XY, Grouped/TwoWay, Contingency, PartsOfWhole, and Survival tables. The scoped XML survey found 67 tables in these families. Resources and schemas were parsed as data; embedded XSL transformations and other executable content were not run.

The Column unpaired-t-test and XY linear-regression examples establish:

- `GraphPadPrismFile` may be namespaced and nested within an XSL stylesheet wrapper.
- `Table` carries the family, identifier, and title.
- Direct `XColumn` and `YColumn` elements contain titles and `Subcolumn/d` observations.
- Titles can contain nested formatting elements. Empty observations retain their row positions.
- `XAdvancedColumn` can duplicate `XColumn`; importing both would incorrectly duplicate the independent variable.
- Dose-response examples contain replicate subcolumns and zero-dose controls. These require treatment beyond a single-series importer and are not silently flattened or averaged.
- `Contents/Resources/PrismXMLSchema.xsd` declares `Excluded` as an XML Schema Boolean with default zero. The importer follows those Boolean values, rather than treating mere attribute presence as exclusion.

These observations informed GP's explicit table types, row-paired missing-value handling, Prism XML importer, analysis selection, and graph workflow. The importer has deliberately narrower scope than Prism's schema.

## Implementation and validation boundaries

GP's statistics are new code using NumPy/SciPy; graph exports use Matplotlib. The interface and examples are independently authored. The native Prism executable has not been reconstructed, and the original macOS GUI has not been run in this Linux environment.

Automated tests check standard statistical results and edge cases, import behavior, and graph export formats. Additional integration checks use the supplied bundle's raw single-subcolumn tables without adding those files to GP. Compact numerical fixtures retain source hashes for saved Prism output comparisons:

- Paired t-test: test statistic, degrees of freedom, P value, difference and interval, SD/SEM of differences, R squared, Cohen's d, and Hedges' g. Signed difference and unsigned t follow the observed saved case.
- Descriptive statistics: 18 existing summary outputs and 38 additional outputs agree with two saved columns. The latter include type-6 quartiles/percentiles, geometric summaries, unbiased shape statistics, and mean ± SD reference lines. The saved percentile-level setting yields P10/P90 here; those bounds contain the central 80%, not 90%.
- Two saved log-dose four-parameter fits: parameter estimates agree within 0.000046 absolute and residual sums of squares within 0.000000012.
- Three normalized inhibitor fits: IC50 agrees within 0.000000329, HillSlope within 0.00000000348, and residual sums of squares within 0.000000000000739. Concentration and log-concentration formulations are independently exercised; saved profile-likelihood intervals are not reproduced.
- Balanced 3×3×4 two-way ANOVA with interaction: sums of squares, degrees of freedom, mean squares, F/P values, variation percentages, and means agree with the saved example.
- Three survival groups totaling 135 subjects: all 714 populated curve-table values, medians and median bounds, and global logrank results agree with the saved example. The recovered interval convention is log-log Greenwood.

The survival and two-way ANOVA comparisons also run through the real browser interface using the self-contained static build, including input save/open, reload persistence, and exports. No analysis API or external-host requests were observed. Passing these particular saved cases does not establish general numerical, workflow, or visual parity.

Remaining major work includes general grouped/replicate data, repeated-measures and mixed-effects analyses, multiple comparisons, broader survival models and comparisons, the remaining regression/model families, native Prism project fidelity, graph-layout parity, and reference-runtime comparisons. The user currently has only the installer. The [coverage ledger](prism-coverage.json) keeps the full-equivalence goal open and distinguishes implementation from verification.
