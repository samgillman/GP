# Saved Prism graph and layout formats

The fourteen bundled ZIP projects contain two distinct graph representations. Nineteen `FENGraphSheet` records expose titles and input references while their graph settings remain in legacy `PCFFGRA4` binary payloads. Seven `GraphSheet` records expose detailed `MVGraph` JSON settings. One `FENLayoutSheet` exposes linked graph IDs, with placement retained in a binary payload. This pass decodes the JSON relationships and settings; it does not decode the legacy drawing engine or establish visual parity.

## Evidence and coverage

The corpus and archive/member hashes come from `/workspace/gp-evidence/native-metadata/zip-projects.json`. The read-only script `inspect_graphs.py` in that directory verifies the archive SHA-256 values before inspecting members and writes:

- `graph-map.json`: all 27 graph/layout sheet records, their complete JSON, 104 resolved selected relationships, axes, binary-member identities, and image-search results.
- `graph-schema.json`: observed JSON-pointer paths, value types, bounded short-string vocabularies, and source-bound example pointers.

Every source reference identifies the archive hash, member hash, ZIP local-header offset, compression, CRC, and byte sizes. JSON pointers locate individual settings in the decoded member. No Prism execution, new Ghidra session, importer change, or UI change was performed for this pass.

The 104 relationships cover `inputDataSets`, `linkedGraphSheets`, `dataSheet`, X/Y variables, color/group/label variables, categorical axis label sources, and `settingsSource`. This is a selected relationship vocabulary, not a claim that every possible cross-reference has been decoded.

## Graph-to-data relationships

For `FENGraphSheet`, `inputDataSets` lists IDs resolving to `data/sets/<id>.json`. These can reference raw input or calculated tables. `fenID` and the UID are retained without assuming their relationship to binary object offsets. The title is descriptive text, not proof of axis settings: for example, the saved “Logarithmic axis” title does not independently establish which binary field sets logarithmic scaling.

For `GraphSheet`, `graph.dataSheet` identifies `data/sheets/<id>/sheet.json`, while `graph.xVariables` and `graph.yVariables` identify data sets. The selected data sheet can be an analysis result, so an implementation must follow that sheet's table/storage references rather than substitute the project's original input table.

Color, label, and grouping mappings are explicit in figure settings. For the Wine PCA graph:

| JSON pointer relative to the graph sheet | Resolved meaning |
| --- | --- |
| `/graph/dataSheet` | `PCA of K-means clustering of Wine:PC scores` |
| `/graph/xVariables/0` | PC1 data set |
| `/graph/yVariables/0` | PC2 data set |
| `/graph/gdoSettings/symbols/colorVariable` | Type data set |
| `/graph/gdoSettingsExt/confidence ellipses/groupingVariable` | Type data set |
| `/settingsSource` | PCA analysis sheet |

The categorical heatmap axes illustrate an important distinction: X-axis `labelsSource` points to the **table UID**, while Y-axis `labelsSource` points to the table's row-title **data-set UID**. Both references resolve. A loader that assumes every label source is a numeric data set would lose the heatmap's column labels.

## Modern JSON graph settings

The seven modern records all store `graph.@class = MVGraph`. Their observed figure types are symbols, heatmap, dendrogram, and confidence ellipses. Literal enum values are retained, including `circleFill`, `dataFill`, `hullFill`, `lowRight`, `auto`, and `matrix`; this pass does not invent integer translations or infer omitted defaults.

| Area | Observed fields and interpretation |
| --- | --- |
| Page and graph rectangle | Sheet `paperDimensions`, `paperOrientation`, `backgroundColor`; graph `x`, `y`, `width`, `height`, `plotAreaColor`, `shapeType` |
| Axis title | `axisX/axisY.title.text.string`, formatting spans, visibility, docking, rotation |
| Axis line | `strokeThickness`, `strokeColor`, `strokeStyle`, `intersectionPoint`, `orientation` |
| Numeric axis | `segments[*].@class = LinearAxisSegment`, lower/upper limits, interval, starting tick, fixed-limit flags, reverse flag, major/minor ticks and number formatting |
| Categorical axis | `segments_ext[*].@class = CategoricalAxisSegment`, label-source ID, ordered levels, label rotation, level interval |
| Symbols | `BubblesFigure::Settings`, color-variable ID, colormap, `SymbolSizeEvaluator.symbolSize`, shape and border settings, optional label-variable ID |
| Heatmaps | `HeatmapFigure::Settings`, gradient colormap, color legend, `metric`; matrix data-sheet relationship |
| Dendrograms | `DendrogramFigure::Settings` or `DendrogramGraphComponent`, branch/cluster result paths such as `/rows/dendrogram`, line appearance, axis and color settings |
| Confidence ellipses | `ConfidenceEllipsesFigure::Settings`, grouping variable, confidence level, fill and border colormaps |
| Legends | Structured `MVCombinedLegend` children plus separate gradient legends; title, symbol, color, position, and docking metadata |

For example, the saved Wine PCA graph explicitly stores linear X and Y limits of −6 to 6, X interval 5 starting at −5, Y interval 1 starting at −6, and custom zero ticks carrying dotted grid lines. Its symbols have size 3 and filled-circle shape. The confidence-ellipse settings store confidence level 95 and a grouping-variable reference to Type. These are directly observed stored settings; the ellipse-generating algorithm and renderer have not been recovered.

Eight-digit colors such as `#0000ff80` are preserved verbatim. Their pattern is consistent with RGBA, but interpretation of the separate `colorsTransparencyPercent` setting requires renderer or runtime confirmation: some examples contain `100` alongside colors ending in `80`. A reconstruction must not overwrite literal alpha values based on an assumed transparency convention.

## Layered and unresolved settings

The same graph can contain `gdoTypes`, `gdoTypesExt`, and `gdoTypesExtended`, with corresponding settings dictionaries. Categorical axes can contain a minimal linear `segments` entry alongside populated categorical `segments_ext`. Some sheets also retain `settingsSource`, `mergedSettingsStorage`, `analysisSettingsID`, and compatibility instructions for older formats.

These observations show that a single flat settings dictionary is insufficient. The pass preserves each layer and its origin. The exact runtime precedence and merge rules remain unresolved. In particular, a reader must not select the first apparent linear axis and ignore populated categorical extension settings.

Some `graph.binaryData` values are 32-character hexadecimal tokens. Their ownership and encoding were not established, so they remain opaque identifiers. Likewise, branches/cluster paths can point into analysis results; resolving graph settings does not reconstruct the clustering algorithm.

## Legacy graphs, layouts, error bars, and rendered images

Twenty of the 26 graph/layout `.bin` members begin with `PCFFGRA4`; the remaining six have a different opaque binary header. Titles, IDs, source hashes, and input relationships are mapped, but offsets for plot type, logarithmic scaling, error-bar convention, marker styles, or layout placement have not been decoded in these binary members.

The single layout declares two `linkedGraphSheets` in `Time line.pzt`; both resolve to graph sheets. Its binary placement data has not been interpreted. No modern JSON layout is present in this corpus.

A bounded search of graph-sheet JSON paths found no error/whisker/standard-error/standard-deviation setting fields. This does not imply Prism lacks error-bar support: most ordinary graphs in the corpus use the undecoded legacy representation.

No member with a recognized PNG/JPEG/PDF/GIF header or common image extension was found in these fourteen ZIPs. No PNG/PDF/SVG/GIF signature was found inside the 26 inspected graph/layout binaries. This search does not exclude other image encodings or compressed embedded previews. No saved screenshot or rendering oracle was recovered.

The immediately useful reconstruction path is to map modern graph data references and preserve all stored settings layers, then implement a clearly identified subset of the JSON graph features. Legacy graph settings, error-bar semantics, layout geometry, settings precedence, and visual fidelity remain separate open questions.
