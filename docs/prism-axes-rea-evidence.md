# Format Axes: bounded REA evidence contract

The shipped Prism 11 resources establish editable range, scale, direction, ticks, frame/grid, visibility and title controls. They do **not** establish their numerical algorithms, runtime defaults, validation, or exact rendering. A useful GP implementation can expose a supported subset with explicit independent behavior; this evidence does not establish Format Axes parity.

## Sources and scope

This pass reuses actual `decode_interface_builder` Evidence `ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`, saved at `/workspace/gp-evidence/rea-pass4/ui-resources/rea-graph-formatting.json` (file SHA-256 `d56dfb61f8e9d0d29d71937b78bc928012b900e88475385a76755d0439463807`). The previous REA operation decoded an explicitly derived partial bundle containing unchanged originals; it did not execute Prism. `formatting-copy-manifest.json` records the original/copy identity and carrier scope. This pass verified the four original NIB hashes again. No repeated REA operation or native session was needed because the retained full record includes the required object values, connections and coverage.

Original files are under `/workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app/Contents/Resources/Base.lproj/`:

| NIB | SHA-256 | Recognized objects; connections |
| --- | --- | --- |
| `FormatAxesDialog.nib` | `a779171a729a42d3392d02755c9ef4cf5df58f7b98c2bc3c6f3e3b67a5f3171d` | 41; 12 resolved, 1 unresolved |
| `FormatAxesAxisTab.nib` | `ec92db2acca5f769c5873ab1dc867da24d06c902a9caa6c601fe82c476a0f61a` | 485; 173 resolved, 2 unresolved |
| `FormatAxesFrameAndOriginTab.nib` | `a66dab37cead25de8cc2d2bceccb770e26e7dbaafed83eb199102b7236cd7fa7` | 290; 92 resolved |
| `FormatAxesTitlesTab.nib` | `78ae0a5cd1de6c114c572dd2fab2a6cd7baebb4d6508fd9fb7346c2763bfce7a` | 269; 105 resolved |

The machine-readable projection `/workspace/gp-evidence/rea-pass5/axes/controls-contract.json` contains all 83 recognized action connections in these four NIBs, owner outlets, labels, original node IDs, archive control/cell values, menu memberships and item tags. It is a projection of the retained Evidence, not a new Evidence ID. Item membership follows explicit `NSMenu` references; its array order is archive-object order, not verified display order. Missing `NSTag` remains absent/null rather than being inferred as zero.

The node-ID convention is `ib:"Contents/Resources/Base.lproj/<file>.nib":object:["<id>"]`; object IDs below are local to the named NIB. Full action-node IDs and destinations are in the external contract.

## Confirmed dialog and axis controls

Dialog page labels are **Frame and Origin** (string object 16), **X Axis** (27), **Left Y Axis** (32), **Right Y Axis** (37), and **Titles & Fonts** (42). Controls 59, 66 and 78 connect to `cancelClick:`, `okClick:` and `applyClick:`. A shipped tooltip says Apply applies settings without closing the dialog. This is a resource statement, not a runtime test; rollback and undo boundaries remain unknown.

The following are observed in `FormatAxesAxisTab.nib`, with owner `PSXFormatAxesAxisTabController`:

| Control / object ID | Observed action | Bounded evidence |
| --- | --- | --- |
| Automatic range and interval / 197 | `setAutoRangeAndInterval:` | One checkbox explicitly couples the two settings. Separate per-bound auto modes are not established. |
| Minimum / 530; maximum / 541 | `setSegmentMinimum:`; `setSegmentMaximum:` | Numeric text fields, owner outlets `_segmentMinimumValueTextField` and `_segmentMaximumValueTextField`. No numerical limits recovered. |
| Scale / 732 | `setScale:` | Cell 734, menu 739: Linear (736, tag absent), Log 10 (743, tag 1), Log 2 (747, tag 2), Ln (751, tag 7), Probability 0..100% (755, tag 3), Probability 0..1 (759, tag 4). Tags are archived UI values, not proven file-format enums. |
| Gaps and Direction / 378 | `setGapsAndDirection:` | Cell 380, menu 385 includes Standard (389, tag 1), Reverse (393, tag 4), and several two-/three-segment choices. Reverse is a choice within this combined control. |
| Major interval / 500 and stepper 893 | `setMajorTicksInterval:` | Also starting point 787 → `setMajorTicksStartingPoint:`. Log interval popup 479 → `setMajorTicksLogInterval:` has placeholder Item1/2/3; actual choices remain unknown. |
| Minor ticks / 550 | `setMinorTicks:` | Menu 556 contains Auto (553, tag −3), 0 (560, tag absent), and 2 through 12 with corresponding tags. No choice labelled 1 in this archive. Counting convention is unknown. |
| Minor-tick log checkbox / 471 | `setMinorTicksLog:` | Distinct from the overall scale popup; its effect is not reconstructed. |
| Tick direction / 826 | `setTicksDirection:` | Only None (830) is present in archived menu 833. Do not invent an exhaustive native direction list from this file. |
| Tick length / 839 | `setTicksLength:` | Very short, Short, Normal, Long, Very long; lengths in pixels/points unknown. |
| Number format / 601 | `setNumberFormat:` | Decimal, Scientific, Power of 10, Antilog are archived choices. Formatting thresholds/precision remain unknown. |
| Decimals / 293; prefix / 630; suffix / 794 | `setDecimalPlaces:`; `setPrefix:`; `setSuffix:` | Additional separator controls 346 and 801 connect to decimal/thousands separator setters. |
| Additional ticks / 125 | `setShowAdditionalTicks:` | With regular ticks / Instead of regular ticks / Only regular ticks; table 16 includes position, Tick, Line, Text and Details. Detail control 89 → `showAdditionalTicksDialog:`. |

Objects 714 and 161 carry messages that an axis may disallow range changes or additional ticks/gridlines. This proves conditional UI states are anticipated, not which graph types trigger them. The archive contains segment selection and percentage-length controls; segment geometry is outside the bounded single-segment implementation proposal.

## Frame, visibility and titles

In `FormatAxesFrameAndOriginTab.nib`, object 217 connects to `setHideAxes:`. Its menu 224 contains Show both X and Y (221), Hide X. Show Y (228), Hide Y. Show X (232), and Hide both X and Y (236). Tags are absent for these items. This establishes a four-choice UI, but not whether hiding includes tick labels, titles, grid lines or a right Y axis.

Frame style 80 → `setFrameStyle:` includes No frame, Offset X and Y axes, Plain frame, Frame with ticks (mirrored), and Frame with ticks (inward). Major grid 248 → `setMajorGrid:` and minor grid 329 → `setMinorGrid:` each have None, X axis, Y axis, X and Y axes. Explicit item tags are 1 for X, 2 for Y, 3 for both; None lacks a tag. Grid color, thickness and style have separate actions. The archive does not settle whether “X axis” denotes gridlines located by X ticks or lines parallel to X.

Other confirmed actions include `setAxesColor:` (8), `setThicknessOfAxes:` (406), `setPlottingAreaColor:` (375), `setPageBackgroundColor:` (369), axis intersection setters (58, 389), graph width/height setters (210, 121), and `setShowScaleBar:` (396). Scale-bar numerical behavior and origin policies are unresolved.

In `FormatAxesTitlesTab.nib`, separate visibility checkboxes connect to `setShowGraphTitle:` (292), `setShowLeftYAxisTitle:` (300), `setShowRightYAxisTitle:` (308), and `setShowXAxisTitle:` (316). Thus title visibility is represented separately from the frame page's axis visibility. Fonts, distances, left/right title rotation and placement also have distinct controls. This page does not contain an observed editable title-text action; title-content editing elsewhere is not established by these resources.

## Implementation boundary

A bounded GP implementation may provide per-X/per-left-Y manual minimum/maximum, automatic range, supported linear/log scales, reverse direction, explicit major interval, selected minor ticks, axis visibility, major/minor grid switches and title visibility. These controls have direct resource support. For a single-segment Column/XY scope, omit right-Y, probability scales, broken axes and additional custom ticks until their data/rendering paths exist; do not expose inert choices.

The following must remain documented GP decisions unless independently corroborated: finite ascending manual limits, positive domains for logarithmic display, invalid/nonpositive data handling, automatic padding and rounding, tick interval units and starting points on log scales, minor-tick counts, reverse ordering, grid orientation, title/label effects when an axis is hidden, Apply/Cancel history semantics, and identical SVG/PNG/browser output. Mathematical convention or passing GP tests alone does not establish Prism's choices. No runtime observations or guide-derived behavioral rules were added in this pass.

Archive state is especially unsafe as a default: scale 732 and direction 378 store `NSEnabled=false`; direction cell 380 stores selected index 5 and a three-segment label. Many menu items store `NSHiddenInRepresentation=true`. These are serialized construction fields, not proof of disabled/hidden runtime controls or user defaults. Dynamic item construction and runtime validation remain unknown.

## Focused future native seeds

Supplementary original Mach-O method metadata, preserved separately in `/workspace/gp-evidence/rea-pass5/axes/supplemental-method-seeds.json`, identifies `setScale:` at `0x1011002fb`, automatic range at `0x101100c92`, minimum at `0x1011018b3`, maximum at `0x101101ce8`, major interval at `0x101102170`, minor ticks at `0x1011024e6`, and hide axes at `0x10110b4d5`. `setGapsAndDirection:` has base, left-Y and Y-axis implementations at `0x1010ff683`, `0x10110fff3`, and `0x1013a3e92`; tracing only the base may miss axis-specific behavior. Apply is at `0x1010c0b9c`. These are seeds for bounded follow-up, not decompiled semantics.

REA's recognized-object coverage is complete for these four selected archives, with the three unresolved connections noted above. Private/unrecognized fields, dynamic controls, constraints, runtime visibility, rendering geometry and native numerical behavior remain outside that claim. No application source, shared completion register, original artifact, or REA configuration changed.

## G070 numeric formatting and G066 additional scales

This focused follow-up uses the same retained Evidence and AxisTab hash, without repeating the producer. `/workspace/gp-evidence/rea-pass5/axes/numeric-formatting-and-scales.json` retains the selected controls, menu membership, custom-precision objects and supplementary native seeds.

| Formatting control | Exact archived choices / objects | What remains unknown |
| --- | --- | --- |
| Number format 601; `setNumberFormat:` | Menu 608: Decimal 612, Scientific 616, Power of 10 620, Antilog 605. No item tags archived. | Choice availability by scale; mantissa/exponent convention; superscripts; rounding; Antilog base and whether it transforms labels only. |
| Decimal places 293; `setDecimalPlaces:` | Menu 296: Auto 300; 0 through 9 at objects 304, 308, 312, 316, 320, 324, 328, 332, 336, 340. No item tags archived. | Auto precision, significant figures versus decimal places in each number format, tie rounding, trailing zeros and negative zero. |
| Decimal separator 346; `setDecimalSeparator:` | Menu 353: Period `1.23` (350, tag absent), Comma `1,23` (357, tag 1), Middot `1·23` (361, tag 3). | Conflict handling with thousands separators, locale influence and effects on editing versus display. |
| Thousands separator 801; `setThousandsSeparator:` | Menu 804: `100000` (808, tag absent), `100,000` (812, tag 1), `100 000` (816, tag 2), `100'000` (820, tag 3). | Grouping of very large, fractional, scientific and negative values; whitespace character used at runtime. |
| Prefix 630 / suffix 794 | `setPrefix:` / `setSuffix:`, with matching owner outlets. | Escaping, maximum lengths, symbol markup, spacing and interactions with exponents. |

**Nine is not an established native precision maximum.** The same REA record contains custom-decimal stepper 878, its cell 880, text field 881/cell 883 and `PSXFloatFormatter` 884. The owner has `customDecimalsStepper` and `customDecimalsFormatter` outlets. Cell 880 archives `NSMinValue=1`, `NSMaxValue=14`, `NSIncrement=1`, `NSValue=1`; the control itself archives zero-valued stepper bounds and is disabled. These conflicting construction-level fields are retained verbatim, not promoted to runtime validation. Their presence establishes an additional precision mechanism; its applicability, effective bounds and initialization require native/runtime evidence.

Supplementary method metadata identifies `populateNumberFormatPopUp` (`0x1010f5e7c`), `populateDecimalPlacesPopUp` (`0x1010f6c5a`), `shouldDecimalPlacesPopUpContainAutoValue` (`0x1010f6bb3`), `menuItemTagForNumberFormat:scaleType:` (`0x1010f9511`), `isCustomDecimalPlacesAvailable` (`0x1010f56d3`) and `setCustomDecimalPlaces:` (`0x1010f578e`). These names are useful bounded follow-up seeds and caution against assuming a static exhaustive menu; they are not decompiled behavior.

For G066, the exact additional scale choices remain Log 2 (747/tag 2), Ln (Natural Log) (751/tag 7), Probability (0..100%) (755/tag 3), and Probability (0..1) (759/tag 4), all connected through scale control 732 and `setScale:`. Mathematical log-base-2 and natural-log transforms are implementable conventions, but resource labels do not establish Prism's domain handling, auto limits, tick locations or minor ticks. In particular, the two probability labels do **not** identify a probability-paper transform: probit, logit, endpoint clipping and special percent labeling are unresolved. No specific probability algorithm should be attributed to Prism from these labels.

The recommended next subset is explicit decimal formatting with a bounded fixed precision of 0–9, literal prefix/suffix, and the observed separator choices; label this as GP's supported subset rather than Prism's precision limit. A scientific format can follow with its mantissa/exponent notation and rounding explicitly defined as GP behavior. Use the same formatter in browser and exports, but treat that consistency as GP verification only. Keep existing automatic formatting independent until native examples or code establish its rules.

Log 2 and Ln are the next bounded scale additions, using positive finite data and explicit transform/tick policies chosen for GP. Preserve source values and numerical analyses; this is a proposed GP display contract, not a recovered Prism data-mutation guarantee. Defer Antilog, probability scales, native automatic precision, custom precision beyond the supported subset and exact Power-of-10 typography until the missing behavior is corroborated. No application code changed in this follow-up.
