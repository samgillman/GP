# GP completion plan and verification contract

This plan tracks the user's requested complete reconstruction of Prism for macOS as a browser application. The primary artifact target is **Prism 11.1.0, build 110218**. The supplied **Prism 10.3.1, build 464 guide** is a separately versioned reference. Existing GP is a partial implementation. Completing this plan requires closing its requirements with evidence, not merely building screens or implementing mathematically similar routines.

The plan covers the full supplied guide, the existing reconstruction coverage ledger, recovered equation and formula catalogues, UI resources, native observations, known defects and integration/deployment work. Those are the currently known sources, not proof that every Prism feature has already been discovered. Newly discovered features are added to the ledger and cannot be discarded to preserve a completion claim.

The latest **PRISM11_DIFFERENCES.md/HTML** takes precedence over the Prism 10 baseline where it identifies changes. Its 10 embedded screenshots now support visual review; referenced saved projects and research dumps were not supplied. The latest Prism 10 HTML adds a provenance paragraph but leaves feature text and all 51 embedded images unchanged. The author reports their Prism 10 installation was modified; that is a reference-provenance limitation, not a locally verified finding. Behavior-sensitive assertions must be checked against the signed Prism 11 target or independent source-bound fixtures. The unreleased, disabled Copilot integration is tracked as an investigation/integration boundary, not an enabled product feature.

## Authoritative work registers

- [Core requirements](requirements/core.json): provenance, workbook, data tables, editing, navigation, preferences, integrations, performance and release.
- [Analysis requirements and all 152 recovered equations](requirements/analyses.json), with a [readable audit](requirements/analyses.md).
- [Graph, layout and export requirements](requirements/graphs-layouts.json).
- [Native files and all 73 script commands](requirements/formats-scripting.json), with a [readable audit](requirements/formats-scripting.md).
- [All 82 formula functions](requirements/formula-functions.json).
- [Prism 11 changes](requirements/prism11-deltas.json), including the latest uploaded revision.
- [Source traceability manifest](requirements/source-map.json): every guide heading, existing coverage family, recovered equation and formula.
- [Full 1,574-row parity plan](prism-parity-plan.csv), [unaltered submitted audit](sources/prism-parity.csv), and [option-level audit requirements](requirements/parity-audit.json): every supplied row has a concrete plan, verification work, original finding and mapped owners. The AUD-Pxxxx namespace preserves original Pxxxx identifiers without replacing earlier requirements.
- [Shared dependency contracts](requirements/dependency-contracts.json): named infrastructure dependencies and accountable workstreams.
- [Existing implementation coverage](prism-coverage.json): historical bounded evidence, refreshed when implementation changes.
- [Execution log](completion-progress.md): actual completed work, commands/results, current work and remaining blockers. A plan entry is not implementation evidence.

The JSON/Markdown registers together are part of this plan; they enumerate option-level work that would be lost in a high-level milestone list. Run `python3 scripts/check_requirements.py` to check identities, dependency references, source coverage and evidence gates. Section mappings identify owning requirements and include grouping headings; they do not assert those requirements are implemented. All requirement IDs remain stable. Parent requirements are not closed until every required child is closed.

## Current graph work — 2026-10-20 UTC

Persistent axes, decimal numbering and compact dialog/label spacing have been
published and verified as bounded GP increments. G045 then adds a native-informed
XY dataset list with working membership/order controls and fixes positional
color swapping. See the execution log for the latest tested/published state.
A new focused REA decode establishes Column-specific controls and an archived
Annotations tab, preventing accidental reuse of the XY layout as a native claim.

These increments do not close graph parity. Continue with stable persistent
dataset styles and scoped appearance editing, cross-table Add/Replace, complete
Column and XY Graph Settings/Annotations, scientific/other numbering modes,
additional scales, frame/origin/right-axis behavior and native default/layout
comparisons. Every broader graph-register obligation remains tracked.

## Column statistical audit checkpoint — 2026-10-20 UTC

The audit of merged PR #3 adds safeguards and independent numerical regressions;
it does not close the Column analysis families or establish Prism equivalence.
The [audit findings](column-statistical-audit.md) distinguish calculation errors
from correctly evaluated approximations that can change scientific decisions.
The [native validation matrix](prism-native-validation-matrix.md) specifies the
data, options, full-precision output fields, provenance and artifact captures
needed to resolve each remaining native comparison.

The immediate work is to keep method and approximation disclosures visible,
reject unsupported one-sided and incomplete matched designs, preserve declared
comparison families, and invalidate unfrozen results computed under the older
analysis revision. Assumed-sphericity and Geisser–Greenhouse posthoc error terms
are separate contracts. One saved paired-t dataset remains the only native
numerical comparison for these new Column methods. Exact tied/small-sample rank
procedures, missing-data mixed models, additional correction methods and native
defaults remain open.

The original merge's [CI run 39335578778](https://github.com/samgillman/GP/actions/runs/39335578778)
has now been inspected: it passed 296 backend tests, 163 frontend tests, the
server and static builds, ten Column browser scenarios per build, and validation
of 19 locked browser-runtime files. Those results establish the recorded
baseline workflow, not acceptance of later changes or native equivalence.
Follow-up validation is recorded separately in the execution log.

## Immediate defect queue from the user’s break test

The [stress, scroll and UX register](requirements/break-test-report.json) adds 36 explicit obligations. Fix the advertised-limit10000×20crash and render recovery first, then numeric errors, independent import defaults, virtualization/selection/scroll, analysis lifecycle, edge-case scientific reporting and storage recovery. Reproduce reported behavior against current code; preserve already verified work and never alter the user’s actual workbook for tests. Broader UI requests map to the original data/analysis/graph/menu requirements and remain open until implemented.

## Status and closure rules

Each requirement has a source, implementation status, dependencies, acceptance checks and evidence links. Use these states:

1. **not_started** — no complete implementation exists.
2. **partial** — some behavior exists, with remaining obligations named.
3. **in_progress** — active implementation, not yet accepted.
4. **implemented_gp_verified** — the specified GP behavior exists and its relevant tests pass; Prism equivalence is still unverified where reference evidence is missing.
5. **verified_equivalent** — implementation and representative numerical/interaction/file/rendering references support the specified versioned scope, including its documented edge cases.
6. **reference_blocked / external_blocked / verification_blocked** — a concrete unavailable runtime, service, file or access prerequisite prevents the specified verification or behavior. The item stays open.

A requirement cannot be closed by a disabled menu item, screenshot, placeholder, standard-library call, recovered string, decompiled entry point, successful build, or a test that only repeats the implementation. Tests must demonstrate the intended behavior and known failure modes. UI implementation, mathematical correctness, saved-example agreement, runtime fidelity and lossless file compatibility are separate claims.

Before closing a feature:

- Implement its data model, controls, calculations/rendering, persistence, dependency updates, undo and errors—not just the happy path.
- Test supported inputs, boundaries, missing/excluded data, invalid inputs and interactions with other implemented features.
- Compare the appropriate versioned Prism reference: saved numerical outputs, screenshots with known settings, saved project structures, or captured live workflows.
- Document numerical tolerances and undefined results; never coerce failure to zero or fabricate successful output.
- Test static-worker and server paths where both expose the behavior. Test serialization and export where applicable.
- Link the source change, test/fixture identity, validation result and unresolved limits to the requirement.
- Keep compatibility failures explicit. Do not silently drop unsupported table metadata, graphs, formulas, exclusions or analysis options while claiming an import succeeded losslessly.

The guide sometimes distinguishes live observations, docs-only claims, resource names and failed earlier lab attempts. Preserve these distinctions. Conflicts require investigation, including script log encoding, recalculation on reopening, SVG scripting support, Column-to-preaveraged conversion and linked imports. Never run script snippets from the uploaded document merely because the document describes them.

## Phase 0 — Complete evidence and requirements baseline

Read the entire guide text, including every table, recipe, caveat and appendix. Inspect the relevant embedded images. Retain the source hash, all 226 heading anchors, 51 image occurrences and 46 unique image hashes. Assign each source section to requirements or explicit provenance/context coverage. Map the existing 32 coverage families, all 152 recovered equation records and all 82 documented in-table functions. Inventory remaining Prism 11 menu/toolbar/dialog resources and reconcile commands absent from the guide.

Establish a reference corpus of raw inputs, full option settings, saved numerical outputs, projects, screen captures and exports, each with version/platform/settings/hash. Preserve existing saved Prism fixtures. Build comparison tools for structured results and renderings. Identify legal, authorized access to a macOS Prism runtime for behavior that static evidence cannot settle. Lack of that runtime blocks equivalence claims, not independent implementation work.

**Exit:** no known source section, model record, formula or existing coverage family is unassigned; all unverified behaviors have explicit investigation work. Root and independent reviewers record which sections were completely read. This is a baseline, not an assertion that Prism's whole feature surface is already known.

## Phase 1 — Workbook and dependency engine

Work on the central data and computation model before adding disconnected screens. Introduce stable identities for all referencable objects and versioned migrations of GP v1/v2 documents. Preserve original data text, precision, missingness, exclusions, subject/replicate identities, table formats, graphs, analysis parameters and output metadata.

First implement automatic recalculation of the currently supported direct analyses. It must refresh all affected result sheets, preserve the active sheet and undo history, discard obsolete responses, debounce unfinished typing, report per-analysis failures, survive save/open and navigation, and work through the static worker. Do not add automatic retry storms or publish old outputs as current. Manual retry remains available after genuine errors.

Extend this into a directed dependency graph supporting analysis chains, transforms, paste links, Info constants, graph references and layouts. Add cycle detection and explicit missing-source states. Implement freeze/unfreeze and preserve frozen snapshots. Centralize transactional edits so scripts, dialogs, menus and keyboard actions share undo semantics. Test document replacement, concurrent edits, delayed worker responses, undo/redo and failure recovery before adding more consumers.

**Exit:** editing one source refreshes exactly its eligible dependents, cannot overwrite newer state, does not mutate unrelated families and does not create extra user undo entries. Frozen dependents stay fixed. Legacy workbooks migrate without loss.

## Phase 2 — Document shell, navigation and sheet lifecycle

Implement all five sheet families and full navigator/family/gallery operations. Build sheet-specific command routing and the compact two-row toolbar; map all native menu actions and shortcuts. Add back/forward, previous-sheet switching, link menus, section switching, sheet search, show/hide panes, status context, zoom, rulers and inspectors. Complete sheet/family duplication, reordering, highlighting, deletion, save/export/print and correct dependency remapping.

Implement Info sheets, typed named constants, link/unlink, default metadata and free notes. Implement floating notes and diagnostic notes with persistent positions, editing and focus behavior. Add new/open/recent/save/save-as/revert/backup/multiple-document handling and distinguish browser autosave from a file saved to disk.

Build the Welcome dialog, per-family options, tutorial chooser, clone/example/template/method workflows and portfolio coverage as the underlying table and reuse features become available. Do not enable a family or menu until its real operation exists. This phase is revisited after dependent table, graph and file phases; opening shell work is not closure of those features.

**Exit:** every implemented command is routed consistently from menu/toolbar/keyboard; document identity and dependencies survive every lifecycle operation; available commands reflect context. Compare all shell/dialog states in light and dark modes to versioned references.

## Phase 3 — All table families and entry formats

Complete Column, XY, Grouped, Contingency, Survival, Parts of whole, Multiple variables and Nested. Include raw single values, replicate subcolumns, paired/repeated observations, experimental versus technical units, mean/SD/SEM/CV with and without N, asymmetric errors and limits, horizontal X errors, dates and elapsed times, typed categorical/text variables, row titles and group titles.

Implement table creation and Format Data Table. Preserve precision and labels when changing display formats; changing SD to SEM labels must not silently convert numbers. Review and make undoable any conversion that reduces subcolumns or discards values. Analysis eligibility must follow table format and available raw information. Native survival tables automatically create the appropriate analysis/graph. Integrate existing standalone grouped and survival functionality into the workbook; retain compatibility for its existing saved input files.

**Exit:** each family has a complete creation→edit→save/open→analysis→graph→export example; missing/zero/excluded/censored data remain distinct; subject and replicate matching survive reorder/import/migration. No unsupported data is silently flattened.

## Phase 4 — Spreadsheet editing, clipboard, import and exclusions

Implement cell/range/disjoint/row/column selection, keyboard navigation and editing, insert/delete/clear, sort/reverse, numeric/time series creation, row/column titles, decimal display, cell highlighting and point formatting. Add copy/cut/paste, transpose, Paste Special and live linked blocks. Preserve HTML/text clipboard precision and explicit locale handling. Support all documented macOS text import types, options and placement. Implement project merge separately from open and raw-data import.

Add reversible exclusions with native visual indication, source mapping from results, downstream recalculation and clipboard/export policies. Test paste-link update/unlink, cyclic links, source deletion and read-only linked cells. Account for browser clipboard permissions and reserved keyboard shortcuts through visible supported alternatives without pretending to control OS features.

**Exit:** block operations preserve all data/metadata identities, are atomic in history, serialize correctly and propagate exactly once. Excluded original values remain recoverable.

## Phase 5 — Analysis specifications, parameters and structured results

Replace fixed-choice requests with versioned, validated analysis specifications. Implement Analyze selection followed by the correct parameter dialog. Include dataset selection, existing-analysis parameter editing, Analyze Different Data, saved defaults, recent analyses, result subtables, diagnostics, result constants, graphs generated by analyses and analysis chaining.

Use one canonical validated specification in Python, the browser worker and serialized projects. Distinguish invalid input, mathematically undefined output, failed convergence, unreliable/ambiguous estimates and completed results. Keep warning notes and interpretation checklists tied to the relevant outputs. Parameter edits trigger dependency updates and one undo transaction. P-value display formats must not alter inference or significance thresholds.

**Exit:** each added numerical method arrives with its parameter dialog, structured results, defaults, validation, graph integration and persistence—not an isolated backend function.

## Phase 6 — Complete statistical comparisons and summaries

Implement the analysis register's individual choices and options: descriptive/row statistics; normality/lognormality; frequency distributions and outliers; ordinary/paired/one-sample/lognormal/nonparametric t-test families; one-/two-/three-way and general multifactor ANOVA; repeated measures, mixed effects and nested designs; multiple t tests and full multiplicity/FDR procedures; contingency/proportion/goodness-of-fit/diagnostic accuracy; correlation, ROC and Bland–Altman.

For every method implement specified experimental design, tails, direction, alpha/confidence, missing-value rule, tie/zero treatment, assumption checks, effect sizes, intervals, output table structure and multiple-comparison family definition. Cover unequal n, degenerate variance, all-missing/empty groups, rank deficiency, extreme inputs and exact/asymptotic boundaries. Add source-bound Prism examples and independent numerical cross-checks with justified tolerances.

**Exit:** all listed method/option combinations and their edge-case contracts pass; unsupported choices are still tracked as open. A matching standard-library result for one case does not close the whole family.

## Phase 7 — Regression, equations and optimization

Complete simple/constrained/comparative linear regression, Deming, interpolation, logistic/Poisson/multiple regressions, model coding and diagnostics. Implement all 152 recovered equation records individually, including their variables, domains, units, transformations, defaults, constraints and derived outputs. Track each record by source identity rather than counting ten similar formulas as the full catalogue.

Build and validate the nonlinear engine's initialization, bounds, fixed/shared/global parameters, weighting/replicate handling, robust/outlier choices, model comparison, uncertainty/profile likelihood, confidence/prediction bands, convergence and unstable/ambiguous outcomes. Support user equations through a bounded expression language. Correct concentration-versus-log input semantics, including zero-dose controls where defined. Keep numerical implementation and matching Prism optimizer behavior as separate verification obligations.

**Exit:** each equation and engine option has positive/domain/error/identifiability tests plus applicable reference fits. Results and curves agree across browser/server/save/reopen/export paths.

## Phase 8 — Survival, multivariable, clustering and remaining analyses

Complete native survival workflow, KM intervals/censor rendering and all curve comparisons, trend tests, adjusted pairwise comparisons, hazard ratios and Cox models. Complete categorical coding, multivariable regression, PCA, hierarchical/k-means clustering and their associated diagnostics/plots. Implement all catalogue entries not covered earlier: transforms, normalization, extraction/rearrangement, baselines, smoothing/LOWESS/splines, differentiation/integration, AUC/peaks, simulation and formula columns.

Include the Prism 11 RMST/horizon/uncertainty, lognormal variants, profile-versus-Wald intervals and optimal-cluster-count deltas. Track the 17 metric names present in a saved reference individually; the report’s approximate 20-index claim remains a discovery obligation. Implement all 82 documented in-table functions with bounded parsing, types, missing/error behavior, numeric domains and dependency propagation. Define deterministic seeds where randomness is involved. Do not assume a formula name establishes parameter order or native behavior.

**Exit:** every registered catalogue entry has explicit implemented/reference-verified or still-open status; no residual catch-all hides unimplemented methods.

## Phase 9 — Graph model, renderer and complete formatting

Implement a shared graph scene and settings model covering all guide graph families and recovered Prism 11 settings. Complete Create/Change Graph Type, dataset appearance/order/mapping, points/symbols/lines/bars/boxes/violins/error bars, grouped/nested/multivariable/heatmap/survival displays, legends, titles, labels, custom colors and graph dimensions.

Implement Format Axes fully: frame/origin, left/right X/Y mappings, ranges, automatic intervals, transforms/log/date scales, ticks/gridlines/breaks, reference lines/bands, extra labels, fonts, title placement and constant hooks. Implement object selection, movement, grouping, locking, z-order, drawing shapes, rich text/special characters/images/embedded tables and all statistics annotations/CLDs. Link comparisons/asterisks to actual results; manual annotations must be distinguishable.

Use the same canonical scene/settings for preview and exports; reconcile the current independent browser and Matplotlib renderers. Cover double-click/context behaviors, per-dataset versus global settings, live Apply/OK/Cancel transactions, axes-only graphs and meaningful errors. Implement Magic/style consistency and graph defaults without overwriting existing graphs unexpectedly.

**Exit:** each graph family has deterministic reference inputs, settings, screen and export comparisons, persistence and undo tests. No appearance-only mockups count as implemented formatting.

## Phase 10 — Layouts, export, printing and sharing

Implement page orientation/size/background, graph placement and live links, arrangements, multi-selection, object ordering/grouping/locking, alignment, equal spacing, scaling factors and axis alignment. Add text/images/constants/tables and multipanel page handling. Preserve exact axis lengths versus total graph bounds and layout scaling effects on fonts.

Complete all documented graph/layout/data export types and options: resolution, dimensions, color/alpha/background, font handling, vector behavior, clipping, table precision/exclusions and batch/family exports. Implement print/page setup, sheet/section/project/gallery/family output and multipage PDFs. Test pixel dimensions and file validity, including guide-reported differences between requested and effective script resolution.

**Exit:** exported and printed content matches the intended scene, dimensions, labels and data; layouts update correctly from changed graphs and respect freeze. Native office/share adapters remain explicit external/platform requirements, not simulated successes.

## Phase 11 — Native projects, compatibility and reuse

Complete versioned XML and ZIP container readers/writers, legacy binary decoding, object references, nested metadata, excluded values, all table formats, saved analysis settings/results, graph scenes, notes, layouts, scripts and preferences. Investigate the guide's PCFF/chunk/style-tree/axis/object offsets against the actual Prism 11 artifacts. Do not assume Prism 10 binary offsets apply unchanged.

Preserve unknown fields/objects where safely possible; otherwise present a precise compatibility report. Implement Check Compatibility, native open/save/save-copy/merge and backward-format downgrade with explicit losses. Test template/example/method/family formats, clone workflows and cross-platform project features. Validate native-generated→GP→native round trips in the reference app; parse success alone is not round-trip proof.

**Exit:** fixtures from each supported format/version survive round trips with structure and behavior preserved; corrupt/truncated/cyclic/oversized files fail safely. Every unhandled native feature is reported and remains an open fidelity requirement.

## Phase 12 — Preferences, reuse and application-wide behavior

Implement every recorded View, New Graphs, Analysis, File/Printer, File Locations and Info Sheet setting, including scope/default persistence. Complete Magic, Wand, duplicate-family, templates/examples/methods and their previews. Finish help, tutorial coverage, diagnostic logs, version/update information and suppressed-alert management.

**Exit:** preferences affect the documented scope, survive reload/export/import where appropriate and have reset/migration tests; reuse remaps identities and reruns the correct workflows without changing originals.

## Phase 13 — Scripting and external/platform integrations

Implement the complete command register, grammar, addressing, quoting, control flow, loops/variables, table/analysis/graph/layout operations, imports/exports, save/close behavior, logging and failure semantics. Build editor, syntax reference, run/stop, step/12-step, execution log, stored/external scripts and lifecycle-hook handling. Browser execution must use explicitly selected files/workspaces and cannot silently assume native unrestricted filesystem/Launch Services access. Imported project scripts do not auto-execute merely because a file was opened by GP.

Implement supported wrappers/adapters for native invocation, batch workflows, LabArchives, office destinations, share/email, cloud publication, sample-size/power and account services only with genuine APIs, authorized access and verified behavior. Keep every unavailable integration in the register. Do not imitate GraphPad authentication/licensing success or claim access to its private services. Windows-only behavior in the guide is documented as outside the selected macOS target, not silently mistaken for a missing macOS feature.

**Exit:** all commands have parser/execution/error/logging and regression cases; cancellation and file boundaries are enforced; unsupported platform/service functions remain explicitly unresolved until a real solution or user-approved scope decision exists.

## Phase 14 — Hardening and cross-browser verification

Exercise large projects, all table formats, many linked sheets, large fits and graphic scenes. Virtualize UI, enforce visible resource limits, detect cycles, validate untrusted formats, bound expression/script execution and recover worker/storage failures. Test Chromium, Firefox and Safari/WebKit, macOS keyboard behavior, accessibility, high DPI, browser-reserved shortcuts and mobile fallback. Test static cold-start/offline-cache behavior and server execution separately.

**Exit:** no unresolved critical data-loss, stale-result, incorrect-computation or unsupported-input-as-success defect. Performance budgets are based on measured representative fixtures; arbitrary limits are documented rather than silently clipping user data.

## Phase 15 — Production delivery and verification

Keep reproducible pinned builds and CI. Include immutable source/build identity in the served application and exported diagnostics. Verify Cloudflare production branch/build/output configuration, deployment outcome, gp.samgillman.org response/assets/build identity, cache behavior and representative scientific workflows. Exercise rollback and failed-build reporting. A GitHub push is not proof of deployment. Network/hosting access blockers stay explicit until production can actually be checked.

**Exit:** the live domain is independently verified to serve the intended commit and pass production smoke checks. Keep the source, documentation, fixtures and supported build instructions on GitHub; exclude proprietary installers and sensitive artifacts.

## Phase 16 — Full acceptance audit

Re-run the guide's complete ten-minute tour and every subsequent recipe against GP and the applicable reference. Cover every table family, analysis family, equation, formula function, graph family, dialog option, native file format, script command and integration. Review unknowns in REA evidence and contradictions in the guide. Reconcile all parent/child requirements and all source-map entries; investigate discovered differences rather than adjusting tests to bless them.

Full completion requires no unimplemented material requirement, no unresolved required runtime behavior, and demonstrated scientific, format, workflow, rendering and production outcomes. Browser or third-party limitations do not disappear because the independent core works. If any feature cannot be reproduced in the chosen platform, the requirement stays open until a real adapter exists or the user explicitly changes scope. No percentage, phase count, screenshot gallery or passing build substitutes for this gate.

## Execution order and working discipline

Use the phase order as the default critical path. Respect each requirement's concrete dependencies; some shell/preference work starts early but cannot close until later data/graph/file work exists. Independent numerical/format/reference work can run in parallel with disjoint file ownership and shared fixture contracts. Do not make concurrent edits to central schemas without coordinating the version change.

For each work unit: reproduce/define the gap → inspect relevant reference evidence → implement model/behavior/UI/persistence together → add meaningful tests → run focused tests and affected regression checks → compare reference → update requirement evidence → commit/push tested changes → continue the next unblocked unit. Stop expanding a test run after its relevant checks pass unless a new failure/change justifies more testing.

After the baseline plan is complete, the first implementation unit is **W002: automatic recomputation of existing direct analyses**, because all richer tables, formulas, graphs and layouts depend on reliable update propagation. Subsequent work extends the same dependency foundation instead of building isolated features that must later be replaced.
