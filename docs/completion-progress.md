# Completion execution log

## 2026-10-20 continuation: explicit decimal axis numbering

G070 now has optional persistent fixed-decimal tick labels with 0–9 places,
period/comma/middle-dot decimal separators, optional grouping, and literal
prefix/suffix strings. The browser and exports share decimal half-away-from-zero
rounding of the shortest decimal representation; 2,000 seeded cross-runtime
cases matched. This is a tested GP contract, not recovered native rounding.
REA control evidence and archive geometry are recorded in
[axis evidence](prism-axes-rea-evidence.md). Scientific, Power-of-10, Antilog,
native automatic precision and exact runtime layout remain open; G070 stays partial.

An actual export probe found illegal XML control characters could produce an
unreadable SVG. Both import/model and dialog validation now reject those
characters while accepting legal Unicode affixes. Existing graphs without an
explicit format retain their automatic formatting. Screenshot review found formatted Y labels (including `$20·00 µM`) overlap
the Y title with the fixed browser margin. A follow-up layout fix is underway;
the passing behavior checks do not close this visible defect.

Validation: final backend suite **452 passed**; full frontend **223 passed**,
followed by **37 focused tests** after the XML validation correction and
**7 axes tests** after strengthening the frozen-numbering fixture (overlapping
counts, not additional suites). Server
and static production builds passed; the static assembler verified **19** locked
runtime packages. Server Chromium checks passed controls, conflicting separators,
literal hostile text, persistence, undo/redo, restoring automatic numbering,
reload, Cancel and actual SVG/PNG/PDF downloads. Static Chromium checks passed the same scenarios and all three exports with
zero page errors, using a 900000ms per-export allowance on this slow host.
Evidence is retained separately under
`/workspace/gp-evidence/axes-numbering-static`,
`/workspace/gp-evidence/axes-numbering-server` and
`/workspace/gp-evidence/axes-numbering`. These results do not establish native
Prism equivalence or production deployment.

## 2026-10-20 continuation: persistent axes

Resumed from GitHub main `948a451` in `/workspace/gp-status-main`. Reused actual
REA interface decoding Evidence
`ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`,
reverified original NIB hashes, and recorded the bounded controls/unknowns in
[axes evidence](prism-axes-rea-evidence.md). No native Prism execution occurred.

[The implementation](axes-implementation.md) adds a dedicated axis dialog,
persistent ranges/scales/ticks/reversal/visibility/grids, clipping and matching
export interpretation. G060/G062/G064/G066/G067 remain partial. The next evidence
appendix maps decimal precision/separators and additional scales without
inventing Antilog or probability transforms.

Validation: full backend **374 passed** (one existing Starlette deprecation
warning); full frontend **190 passed**, followed by **6 focused axes tests**
including two added tick-count/frozen-conversion regressions; typecheck and both
production builds passed; static assembler verified all **19** runtime packages.
The requirement checker preserved all **2,661** identities and **1,574** original
parity audit rows. Initial Chromium axes editing/persistence checks passed.
Production server and static Chromium checks both passed, including undo/redo,
reload, Cancel and real SVG/PNG/PDF downloads with configured axes. Static cold
startup exceeded the initial 180-second and 300-second download allowances with
no page exception or application error banner. The successful diagnostic run
used `GP_AXES_EXPORT_TIMEOUT=900000`; that override is recorded in the external
evidence at `/workspace/gp-evidence/axes-static/browser-check.json`. The server
evidence is `/workspace/gp-evidence/axes-server/browser-check.json`. CI runs the
same script with its default 300-second export allowance.
These GP checks do not establish native equivalence or deployment.

Checkpoint entries below retain the evidence available when they were written.
The final Column audit section records later inspection of the merged PR #3 CI
run and distinguishes it from validation of the follow-up safeguards.

## Baseline

- Starting source: `cd66723` (partial implementation; full equivalence not achieved).
- Full supplied guide audit: primary agent read sections 1–2 and 8–9; independent reviewers read every word of section 3, sections 4–5, and sections 6–7 plus appendices A–C. Their option-level registers form part of the plan. Section-level coverage is retained in the source manifest.
- Comprehensive plan: [completion-plan.md](completion-plan.md).
- No new feature is marked implemented merely because it is in this plan.

## Latest document revision

All four new uploads are hashed in [source-map.json](requirements/source-map.json). The comparison was reviewed in full including its new sections. Prism 10 HTML differs only in an introductory provenance paragraph; all 51 image sources match the earlier upload. The companion Markdown is retained as a source identity, while the full-guide audit uses the HTML text. All 10 screenshots supplied in the new Prism11 HTML were visually inspected by the team: Welcome/Collaborate, formula table/Inspector, multifactor data/results/comparison graph, survival risk table and axes. Source-only options remain distinct from visually observed ones. New requirements cover the added scientific, graph, settings and provenance details.

## First work unit

W002 — automatic recomputation of existing direct analyses (implementation and results below). Acceptance includes all linked analyses, stale-response rejection, navigation, unrelated edits, undo/redo, invalid drafts, failures without retry loops, recovery/open boundaries, persistence, static worker and server behavior. General transform/constant/layout dependencies are separately tracked by W003.

## External reference and production blockers

- No directly executable Prism macOS reference is available in this Linux workspace. Saved outputs and the user's guide support bounded tests; runtime-only parity remains open.
- Direct HTTPS checks of gp.samgillman.org and GitHub deployment API returned proxy 403 in the prior turn. Latest Git push and live deployment are separate facts. Q004 remains open.
- Third-party cloud/account/office integrations need actual supported access and platform capability; they are not simulated.

## Plan published before implementation

- `9851d36`: complete dependency-ordered plan and detailed registers committed before application changes.
- `c1bad4b`: final new-document graph details integrated and pushed to `main`.
- Baseline inventory: **1,051 unique tracked requirements**, including 152 equations and 82 formula functions; all 226 Prism 10 headings, 21 Prism 11 headings and 32 legacy coverage families mapped. Counts describe inventory, not completeness or percentage achieved.
- Native runtime comparisons, remaining resource discovery, unsupported integrations and production checks are still open. The plan does not waive them.

## Implemented work unit: W002

Existing direct analyses automatically recalculate after source or analysis changes and on reopening stale workbooks. Each result retains its own analysis/model/dataset selection. Updates are debounced and sequential; obsolete replies are rejected using complete input identity and document boundaries. Invalid drafts and changed selections pause the affected result. Failures remain visible without an automatic retry loop.

Derived updates preserve the active sheet, renamed result, independent analyses and undo/redo. They use the normal persistence path without creating user history entries. Manual Recalculate remains available. The static worker cannot physically interrupt Python already executing; aborted replies are discarded. General dependency chains, typed tables and frozen sheets remain W003/W004 work.

Evidence: `web/src/workbook-recalculation.ts`, 17 dedicated tests in `web/src/workbook-recalculation.test.ts`, and `scripts/check_recalculation.py` using actual numerical outputs in Chromium. W002 is **implemented_gp_verified**, not native equivalence verified.

## Scientific correction: part of A197

Raw zero-dose controls now enter current standalone 4PL and normalized-inhibition fits, sample counts, residuals and degrees of freedom. Direction-correct finite endpoints avoid taking log(0). Already-logarithmic dose models keep their original interpretation. Browser and exported log graphs omit zero only from drawing coordinates and explain its presence in the fit.

Tests cover increasing/decreasing fits, concentration-unit scaling, noisy zero controls that alter the objective, missing pairs, invalid concentrations, sufficient distinct positive doses and export coordinates. A browser regression exposed an expensive opposite-direction search after an effectively exact fit. The solver now orders directions using observed trend and skips the second start only when dimensionless mean squared residual is at most double-precision epsilon; noisy data still compare both directions. Existing saved positive-dose reference tolerances are unchanged. Other model parameterizations, native optimizer fidelity, weighting and confidence/profile intervals remain open; A197 is **partial**.

## Import safeguards: parts of F011/F016/F017/F045/F046/F055

Unsupported numeric Nested and MultipleVariables XML tables are explicitly rejected before ordinary-column parsing. XML TableSequence controls import order; ambiguous IDs reject and broken/duplicate/unlisted references produce diagnostics. ZIP structured titles preserve their text; unsupported or overlong title representations reject explicitly. The browser shows the original unsupported-table reason when no table can be imported and leaves the current workbook intact.

All 11 bundled extended XML examples were correctly rejected; all 14 bundled ZIP templates retained their previous supported/unsupported outcomes. Structured ZIP titles have guide-backed synthetic tests; the bundled ZIP sample set contains no such titles. See [source-bound importer evidence](import-safeguards-evidence.json). These are safeguards, not full support for those table families or lossless native files.

## Earlier validation for the first work units

- Final full backend suite: **241 passed**, including the optimizer performance correction. One existing Starlette/httpx deprecation warning.
- Frontend suite: **42 passed**, including 17 new queue/state/history tests; TypeScript passed.
- Server and self-contained static builds completed; all 19 Pyodide packages verified against their lock hashes. Updated numerical/import module bytes in the browser zip match their source files. The bundled Pyodide runtime uses NumPy2.2.5/SciPy1.14.1; server uses its separately pinned versions, so both paths are tested. The corrected exact zero-dose fit completed in0.401s in the bundled runtime (excluding cold-start loading).
- Chromium actual-calculation checks exercise multiple linked analyses, independent tables, invalid drafts, navigation, undo/redo, saved stale reopening, numerical means, zero-dose fitting and finite log plotting.
- Native-import browser check passed: the specific unsupported-table reason is visible and the workbook is unchanged. Desktop UI/theme/dialog/graph/results/mobile regression checks also passed.
- `python3 scripts/check_requirements.py` passes identities, dependency references, source coverage and evidence gates.
- `.github/workflows/ci.yml` runs the same requirements/unit/build/browser checks on pushes and pull requests. No hosted result had been inspected at this checkpoint; the later merged PR #3 run is verified in the Column audit section below.

## Next work and limits

Continue phase 1 with versioned stable identities and the general dependency graph (W001/W003), then freeze/unfreeze (W004), before extending table families and their analysis/UI contracts. All other open IDs remain in their registers; the new documents' added features have not been declared implemented simply because they were read.

The latest direct HTTPS check of `https://gp.samgillman.org` still failed at the environment's CONNECT proxy with HTTP403. This is not evidence that the site itself is down or current. Source publication and production deployment verification remain separate.

## User stress and interaction reports

The reports are now tracked as B001–B036, including explicit point-hover/navigation, linked selection and durable point-format/exclusion requirements. That checkpoint tracked **1,087 requirements**. The later parity CSV adds1,574 option-level children, for2,661 tracked identities; these are inventories, not completion percentages.

The integrated changes include iterative full-data graph bounds, dense canvas drawing, a virtualized 10,000×30 grid, graph zoom/pan and source-cell hooks, independent import defaults, numeric error cleanup, in-memory render recovery and prominent autosave failure recovery. Backend limits now match the advertised 300,000 cells. The numeric edge fixes cover two-pair Hedges g, Y-only XY descriptions, constant-series isolation in standalone 4PL, and no-event logrank diagnostics. Sheet deletion/duplication helpers preserve dependency consistency and undo snapshots.

Current full unit runs passed 266 backend and 87 frontend tests. Nineteen grid browser workflows and standalone 200,000-point drawing/selection/zoom checks passed. Integrated server recalculation also passed with the new grid and error text. Static/server builds and all 19 locked browser-runtime packages succeeded. Integrated server stress checks passed for 200,000 and 300,000 observations, including full drawing and graph-setting isolation. Server and static integration checks passed for analysis identity/settings, subset source-cell mapping, hostile names, constant/overflow error layout, quota failure/download, and controlled render failure/download/retry. Static recalculation, native-import diagnostics, desktop/theme/mobile checks and the virtual-grid regression also passed. Recovered zoom presets from 50% through 1000%, shortcut/reset controls, bounded canvas backing stores and unchanged saved graph settings passed in both server and static builds.

A final review found and fixed selected-cell Undo routing and loss of the selected rectangle when switching sheets. Fourteen focused unit tests and six browser regressions passed; the final static production build then passed all 23 grid checks, and the server production build passed the six targeted review regressions; caret editing retains native text Undo, while range clear/paste use workbook history. The selected range and its anchor now survive sheet navigation.

Grid virtualization does **not** close the performance report: whole-workbook serialization/history still makes large-table editing slow. Per-point styling/exclusion, complete axes/text editing, smart zoom, freeze, typed tables and the broader native workflow remain open. View zoom does not imply expanded graph-export capacity; server export still has its separate 20,000-cell limit.

## REA resumed as an explicit reconstruction requirement

The user required continued use of the REA repository tools, not only guide-driven development. `AGENTS.md` now records that workflow. The current checkout is REA 6.7.0 at 255d906e15a141b0f4acee60dc73976f03adc94c. Its public launcher and MCP interface are used directly; Ghidra 12.1.4 is available. The chat's direct tool registration is not aligned, so no connected-tool claim is made.

The public REA compiled-UI decoder recovered 20 selected unchanged Prism archives using documented partial-bundle carriers. See [Prism UI REA evidence](prism-ui-rea-evidence.md) for exact Evidence IDs, source hashes and unresolved connector coverage. This directly established shipped zoom presets through 1000%, per-point overrides/reset controls and source-row actions. The decoder's linked-data-region tooltip is explicitly distinguished from still-unresolved graph-hover behavior. A later full-image Ghidra pass was cancelled after about51minutes in import/analysis without producing query findings. Its queued queries/export did not run; the interrupted empty output is not evidence. The prior25-record snapshot remains unchanged. Source-verified small-range REA follow-ups are now tracing zoom behavior; only completed exported answers count as findings.

## Publication checkpoint requested by the user

The earlier tested application was published to `main` at `04618a2b02b6a2ef14e82ba7e62eb5670fea0880` for user testing. Server and static production builds include the grid review fixes. The new native REA zoom/tooltip queries remain pending and have not been used to claim behavior; their evidence export and closed-session snapshot are queued after the queries. This checkpoint does not close the full-equivalence plan.


## Complete parity CSV reconciliation

The supplied `prism-parity.csv` is retained byte-for-byte at [sources/prism-parity.csv](sources/prism-parity.csv), SHA-256 `61d5e6bdb53e0c3c8f76ccd42322e7c52b3524ea8a5f469fc3486ed376a64dc8`. All1,574 rows and fields were read:177 data-entry,219 workflow,322 graph/layout/export,399 comparison/exploration/survival and457 regression/processing/multivariate/simulation. [prism-parity-plan.csv](prism-parity-plan.csv) fills every `your_plan` and `your_note` field while retaining every original ID, status, finding, source and ordering. The corresponding AUD-Pxxxx requirements supplement, rather than replace, the earlier guide/equation/formula registers.

The submitted labels remain1,351Missing,100Partial,90Has and33Unknown. They are attributed audit findings, not native-runtime observations or current completion grades. Notes identify stale direct-recalculation/grid/zoom/navigation findings, option-level gaps behind existing numerical kernels, and version/platform conflicts. No requirement is closed merely because it now has a plan. The checker verifies full row preservation and all parent mappings.

## Stable identities, immutable snapshots and freeze integration

GP workbook version3 assigns stable dataset IDs and represented-row IDs. Migration preserves v1 draft text and v2 links/settings/current results; v3 rejects missing/duplicate/dangling identity metadata and inconsistent positional views. Structural row edits carry explicit row-ID mappings. Linked graph highlights and point-to-cell navigation now use identities, including historical snapshot points; a deleted original cell produces a clear error rather than selecting its replacement. Broader typed subjects/replicates/graph objects/layouts remain open under W001.

One prepared serialization now feeds edit limits, equality, history and autosave. Opt-in incremental deep freezing protects committed state; raw mutable helper inputs are still serialized afresh. A paired helper-only benchmark on identical200k-value workbooks measured median1,265ms versus568ms for ten edits across seven alternating trials, with initial preparation excluded equally and in-memory writes. This does not establish browser editing latency or native Prism performance. Evidence: `/workspace/gp-evidence/serialization-paired.json`. B005 stays partial.

The dependency engine supplies deterministic ordering, family/affected queries, missing-source and cycle diagnostics, and frozen update barriers. It is integrated into import validation, direct-result scheduling and family navigation. It does not yet implement analysis-of-analysis execution, transforms, linked blocks, Info constants or layouts.

Bounded freeze/unfreeze now captures scientific inputs/output for existing results/graphs, prevents data and graph-detail edits, remaps stable inputs on thaw, and integrates with history and direct recalculation. Six actual native freeze handlers/callbacks were recovered through REA; [freeze evidence](prism-freeze-rea-evidence.md) distinguishes those static findings from GP snapshot/undo/recalculation choices. Development and packaged-server browser builds passed nine foundation scenario groups each, including actual fit recalculation and unchanged frozen SVG geometry across save/reopen. Static-browser acceptance remains under investigation; native runtime equivalence remains unverified.

Current frontend validation: **145 unit tests passed**, TypeScript passed, and26 packaged-server grid checks passed with no page errors. The added queue race verifies that freezing an undo-restored result cancels older work and rejects late output. The server direct-recalculation check passed; static recalculation timed out without a visible error and is being diagnosed rather than counted as passing.

The current packaged-server desktop regression also passed: empty-cell expansion and undo, menus, modal focus, graph/results display, mobile dialog containment, system/light/dark appearance persistence and unchanged scientific workbook. Static foundation diagnostics now show successful actual fit/migration/freeze/thaw; first browser SVG export incurs runtime-package initialization. Initial timeout results remain recorded and are not relabeled as passes.

## Current workbook acceptance checkpoint

All nine workbook-foundation browser scenarios now pass in development, packaged-server and self-contained static builds, with zero page errors. The static diagnostic repeat took245.93seconds, including initial scientific/plotting runtime loading. Actual computed fits, immutable frozen inputs/output, shifted/deleted identity navigation, JSON reopening and exported SVG geometry were checked. Original failed/timed-out attempts are retained as such outside Git; the passing repeat did not increase assertion timeouts. A separate static direct-recalculation repeat is still running.

The current server build imported and drew every observation in both200k and300k value fixtures (11.83s and15.42s respectively including import/draw in the automated harness). These are observed host-specific timings, not native performance comparisons. Graph zoom did not change saved graph settings; remaining recovery/analysis integration checks continue.

The large-workbook integration repeat passed analysis identity/isolation, subset source navigation, hostile names, constant/overflow error layout, quota/download recovery and render-boundary recovery. The earlier run had completed both capacity cases but later failed because its injected subset fixture changed only compatibility indices, leaving authoritative v3 dataset IDs inconsistent. The fixture now supplies both references; capacity was not redundantly repeated. Evidence: `/workspace/gp-evidence/large-v3-capacity.json` and `large-v3-integration.json`.

REA completed and exported five additional zoom pseudocode records. [Zoom evidence](prism-zoom-rea-evidence.md) records the Core minimum and stepping helpers, including a nonstandard low-end decrement. The applicable graph-control dispatch remains unresolved; no app rule was changed from supplemental evidence. All native sessions are stopped. These records and the six freeze records are static findings, not a running Prism comparison.

The separate static direct-recalculation repeat also passed, including three independent linked jobs, invalid drafts, undo/redo, reopen, actual numerical means and the zero-dose fit/log graph. No timeout threshold was increased. Final validation for this checkpoint is145 frontend tests, TypeScript, requirement preservation2661/1574, server/static builds and applicable browser checks; backend remains at the prior266-test result because this batch changes no Python scientific code. Production deployment has not been verified.

## Reversible value exclusions (D001/E007/B024/B036 partial)

Session context, 2026-10-19: a fresh cloud container at `/home/user/GP` (Node 22.22, Python 3.13). It held no Prism installer, extracted image or `/workspace/gp-evidence` exports. The REA skill was read from the public repository (6.7.0, `b4938ae`); no native target was available, so no new REA analysis ran. This unit reuses committed REA Evidence IDs; see the [exclusion evidence ledger](prism-exclusions-evidence.md), which separates guide statements, decoded UI, native freeze findings, schema evidence, GP choices and open native questions.

GP workbook version 4 stores exclusions by stable dataset and row IDs. Entered values stay visible in blue italics with an asterisk, while analyses, linked recalculation, plotted points and graph export treat them as missing. Exclusions follow row/dataset identity through insert, reorder and delete, and are dropped when their cell is edited, cleared or removed. One command, with one undo entry, is reachable from cell/row/column context menus, the Edit menu, a Data toolbar button and graph point details. Frozen data tables reject exclusion changes; frozen results/graphs keep captured exclusions, and an equal-revision source with different exclusions is now treated as historical data when linking or freezing graphs. Data copies remap exclusions to fresh identities. Prism XML import keeps the original numbers of excluded cells. CSV export/copy offers numbers, asterisks or blanks when exclusions exist; GP CSV import reads asterisked numbers as excluded.

Validation actually run in this container:

- 157 frontend tests (10 new exclusion tests plus CSV/grid helper tests) and TypeScript passed.
- 268 backend tests passed (two new XML exclusion tests).
- Requirement checker passed: 2,661 identities and all 1,574 parity rows preserved.
- Packaged server build: `scripts/check_exclusions.py` passed 10 scenario groups with zero page errors. Recalculation, import diagnostics, desktop UI, grid UI (26 checks), graph zoom, all 9 workbook-foundation groups and the 200k/300k large-workbook checks also passed against this build.
- **Not run in that container:** the self-contained static build. The container's network policy denied `cdn.jsdelivr.net`, so `scripts/build_browser.py` could not fetch the locked Pyodide wheels. The Vite static bundle compiled; its browser runtime was not assembled. CI runs the exclusion check against both builds; the later merged PR #3 run was inspected during the Column audit below.

Still open: per-point formatting, results-side exclusions, grid range copy/copy preferences for excluded values, TXT/XML export, ZIP exclusion flags, native key equivalent and native handler semantics, typed text/date/censored cells. No Prism equivalence is claimed. Production deployment was not checked.

## Prism-style sheet correction (P001/P002/D011/G018/G022/G025/G062 partial)

After the user reported that GP still did not feel or work like Prism, GP-specific chrome was removed from the data and graph sheets and each function moved to a menu, dialog or toolbar location. The changes: Change Graph Type and Format Data Table dialogs; nonlinear model choice inside Analyze Data; sample data from the New Table dialog; graph export in the File menu; a compact zoom strip. Graphs use journal-style black axes with outward ticks and no gridlines, and the Matplotlib export uses the same styling. Results appear as a numbered, lettered grid with notes below. See [the UI correction](ui-macos-correction.md) for the basis of each change. Styling is a GP choice: no Prism screenshots could be compared in this container.

Validation: 157 frontend tests, TypeScript and 268 backend tests passed. All eight browser suites passed on the packaged server build after their selectors were updated for the relocated controls: exclusions, desktop, grid, graph zoom, recalculation, import diagnostics, workbook foundations and large workbook. The export-dependent checks were repeated after restarting the server with the new renderer. The static build was not run (cdn.jsdelivr.net blocked).

## Column t tests, one-way ANOVA and pairwise brackets (A063–A139/A159/G100/G101 partial)

The user asked for the Column t test / ANOVA workflow to work end to end like Prism, on the website. GP now follows Prism's sequence: **Analyze → "t tests (and nonparametric tests)" or "One-way ANOVA (and nonparametric or mixed)" → parameters dialog (Experimental Design, Multiple Comparisons, Options) → tabbed results → Add Pairwise Comparisons on the graph**. The backend (`gp/column_tests.py`) adds Student/Welch/paired t, Mann–Whitney, Wilcoxon, ordinary/Welch/Brown–Forsythe/repeated-measures ANOVA, Kruskal–Wallis and Friedman, with Tukey, Dunnett, Bonferroni, Šídák, Fisher LSD, Games–Howell and Dunn's comparisons. Parameters persist with the result and drive recalculation; **Parameters…** changes a result in place. Graph brackets come from one linked result, follow data edits and are drawn identically on screen and in SVG/PNG/PDF export. The static website warms up its Python engine at first paint. See [column comparisons](column-comparisons.md) for evidence classes, GP decisions, three known differences from guide statements (Mann–Whitney/Kruskal–Wallis/Friedman exact-P rules) and open native questions.

Session context: the same 2026-10-19 container (no Prism artifacts, no `/workspace/gp-evidence`). The REA skill was re-read from `/home/user/rea-src/rea` (6.7.0, `b4938ae`); no native target was available, so no new REA analysis ran. The only Prism comparison is the earlier saved paired-t case, now reproduced through the new parameters.

Validation actually run in this container:

- 296 backend tests passed, including 28 in `tests/test_column_tests.py` against SciPy, closed forms and the saved paired case.
- 163 frontend tests and TypeScript passed.
- Requirement checker passed (2,661 identities; all 1,574 parity rows preserved). 66 rows moved to or stayed at **partial** with implementation and validation evidence; none is marked equivalent.
- Packaged server build: the new `scripts/check_column_analysis.py` passed 10 scenarios with zero page errors. Recalculation, desktop UI, grid UI, graph zoom, exclusions, workbook foundations and the large-workbook integration checks also passed against this build; the large-workbook check now selects Welch through the parameters dialog.
- **Not run in that implementation container:** the static (Pyodide) build, which could not be assembled because cdn.jsdelivr.net was denied. The subsequent audit inspected successful server/static builds and both ten-scenario Column checks in the merged PR #3 CI run. Production deployment was not checked.

Still open: lognormal and mixed-effects designs, Holm–Šídák/Newman–Keuls/Dunnett T3/Tamhane T2/FDR, selected-pair families, effect sizes and residual diagnostics, guide exact-P rules, closable result tabs, pairwise formatting/selection and one-click add, one-sample and multiple t tests, and every saved/native family comparison.

## Column statistical audit — 2026-10-20 UTC

Baseline: merged PR [#3](https://github.com/samgillman/GP/pull/3), commit
`1fec4e165a5b35396e0c675e33e23161526948d2`. See the
[scientific audit](column-statistical-audit.md) and
[native capture matrix](prism-native-validation-matrix.md) for complete findings,
independent references and the still-missing Prism outputs.

The audit corrected assumed-sphericity RM posthoc error terms, directional
one-tailed inference (including discrete tails), unstable Dunnett quadrature for
highly unequal group sizes, tiny Šídák probabilities, low-df interval roots and
RM numerical scaling. Incomplete matched one-way subjects are rejected; paired
t/Wilcoxon counts and descriptions use their complete pairs. Method-specific
dialog/results disclosures distinguish exact from approximate P values,
unsupported models and corrections, Fisher LSD's unadjusted inference,
confidence level, alpha and fixed star thresholds. Bracket filtering uses the
selected alpha. The graph preview and bracket dialog show method and comparison
family context; users must include the method and adjustment in exported figure
legends because the HTML context caption is not embedded in exported graphs.
Pre-audit unfrozen result caches are invalidated by the analysis revision;
frozen historical outputs remain identified as historical snapshots.

Independent exhaustive label/sign/within-subject permutations demonstrate that
the retained small-sample Mann–Whitney, Wilcoxon, Kruskal–Wallis and Friedman
approximations can disagree with an exact reference at alpha 0.05. Those exact
benchmarks are not native Prism outputs. The numerical audit suite contains 26
passing regressions; the full backend suite passed **330 tests** using the pinned
dependencies. One existing Starlette/httpx deprecation warning was emitted.
The frontend passed **176 individual tests across 18 test files**, with direct
file execution confirming the count. TypeScript and the packaged-server build
passed. The static Vite build and `scripts/build_browser.py` also passed, with
all **19 locked browser-runtime files** verified. The expanded browser script
contains 19 scenarios (ten existing and nine audit scenarios). Its follow-up
execution is now verified in the separately scoped CI run below.

Verified historical CI: [run 39335578778](https://github.com/samgillman/GP/actions/runs/39335578778),
[job 118344131420](https://github.com/samgillman/GP/actions/runs/39335578778/job/118344131420).
The logs establish 296 backend and 163 frontend tests, both server and static
builds, all 19 locked browser-runtime files, and **10 Column browser scenarios
with zero page errors in each build**. This resolves the earlier missing hosted
static-build observation for that merge. It does not verify deployment, the
follow-up changes or Prism equivalence.

Verified follow-up CI: draft PR [#4](https://github.com/samgillman/GP/pull/4),
[run 39371008134](https://github.com/samgillman/GP/actions/runs/39371008134),
[job 118458637647](https://github.com/samgillman/GP/actions/runs/39371008134/job/118458637647),
tested code head `dbea1698d117d43aea18fb2108f2f7594cb97081`. Decoded logs confirm
**330 backend tests passed**, with one existing Starlette/httpx deprecation
warning, and **176 frontend tests passed with zero failures**. Both application
builds passed and all 19 locked browser-runtime files were verified. The Column
check passed **19 scenarios on the static build and 19 on the packaged-server
build**, including the nine added audit scenarios for directional inference,
tied-rank warnings, matched-data refusal, RM error terms, Dunnett integration,
alpha-aware filtering and invalidation of old results. Static checks ran from
04:47:10 to 04:47:37 UTC and server checks from 04:47:39 to 04:47:48 UTC; the job
completed successfully at 04:48:21 UTC on 2026-10-20.

The retained `browser-evidence` artifact is ID `12241855332`, 1,721,066 bytes,
SHA-256 `4fe1d01fe5bc7f1d9eb6d701ae905074b3d2f93639e2a30d719db25d0466f55a`.
This CI evidence applies to the tested code head above. It does not claim that
the subsequent documentation-only evidence update has itself completed CI,
that the change has been merged or deployed, or that native Prism parity has
been established.

The original 66 Column requirement rows remain **partial**. Sixteen additional
directly affected option rows now record bounded implementation/safeguard
evidence and remain partial. Original submitted findings, acceptance criteria,
source hashes, historical evidence hashes and the prior implementation snapshot
are preserved. Only current implementation-source references are refreshed.
No new Prism execution, REA Evidence ID or equivalence claim is added. Remaining
work includes every native case in the matrix, exact small/tied rank procedures,
mixed-effects estimation, additional comparison methods/families, complete
formatting controls and the wider reconstruction plan.
