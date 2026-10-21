# Completion execution log

## 2026-10-20 continuation: existing dataset styles survive identity changes

This continuation integrates with main `f5d3eed` (PR #15) and preserves the newer
macOS shell, first-view graph chooser, non-modal Format Graph, Magic/palettes,
in-place text editors, Analyze Data and Export dialogs. A prior unpublished
appearance branch (`e6e6d45`, based on `490be1e`) became obsolete while main
advanced. It was kept as local history and was not merged. The following results
validate the current-main follow-up, not that older branch.

- Single-table JSON imports, Add Data and data-sheet duplication now remap
  `graph.dataset_styles` when assigning fresh source-column IDs. New graphs
  inherit the copied table's appearance without sharing mutable style objects.
- Source deletion removes dangling styles. Graph-only removal retains them
  through save, reload, import and re-addition. Frozen graphs retain captured
  source styles until thaw; same-name replacement columns inherit no deleted
  identity. Well-formed stale keys from older v4 files are cleaned during import,
  while invalid field values still fail validation.
- Dense canvas and sparse SVG use the same existing symbol geometry, size and
  color. Hidden series no longer draw or block visible point selection. Larger
  marks can be selected at their outer extent. Visibility affects the dense
  rendering threshold without discarding scientific observations.
- Default-axis Matplotlib exports retain bounds when symbol visibility changes.
  Line/observation inputs and statistical requests remain unchanged. Numeric
  style weights and export width reject booleans or numeric strings instead of
  coercing them into valid values.

**Verification:** 530 backend tests, 298 frontend tests, TypeScript and both
production builds passed. Static assembly verified 19 locked runtime packages.
The new `check_style_identity.py` passed all seven groups on both packaged-server
and static builds, including real file import/save, current-dialog Apply/Cancel,
undo/redo, data duplication, actual SVG export, dense/sparse pixel comparisons,
hidden overlapping targets and a size-10 diamond at 200% zoom. The existing
Format Graph check also passed both builds. Both focused runs reported zero
page/console errors. Reports and reviewed screenshots are retained in
`docs/validation/style-identity/`; CI now runs the new check on both builds.
The 390-pixel viewport check establishes horizontal containment only: the
existing tall window chrome leaves much of the dialog below its first viewport.

**Evidence boundary:** [style identity](style-identity.md) records the retained
XY/Column REA IDs and original Appearance NIB hashes. No original resource was
available to rehash and no native Prism execution or fresh REA analysis ran.
The stable-ID map, marker geometry and hit tolerance are GP implementation
choices. The separately recorded user/macOS observations from PRs #12–15 remain
intact. G031/G033/G045 and AUD-P1171–1173 remain partial; native physical units,
defaults, exact rendering, arbitrary subset edits and remaining style channels
are open. All 1,574 audit rows and 2,661 requirement identities are preserved.
The original large audit register is unchanged. Current AUD-P1171–1173
assessments live in `requirements/parity-audit-progress.json`, linked from the
source map and applied by the requirement checker before evidence gates. This
small update record avoids the repeatedly timing-out full-file upload while
validating its baseline hash, IDs and immutable source fields.
GitHub publication, hosted CI and site deployment are separate verification
steps; consult this increment's PR for their current state.

## 2026-10-20 continuation: XY missing-Y connecting-line gaps (PR #9)

Implemented a real XY Format Graph → Graph Settings choice between **Leave a gap**
and **Connect adjacent points** at a missing Y value with a numeric X.
The optional graph field `gap_at_missing_y` is validated as a boolean and
persists through workbook save/import, modification, and undo. Old workbooks
retain GP's prior connected-line default when the field is absent. Browser
line geometry and Matplotlib exports both retain absent Y values as NaN gaps
without changing data-table values, observed-point counts, statistical masks,
regression fits or other analyses. CSV exports remain unchanged.

Source basis: retained native interface decoding
`ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`
(see `prism-graph-format-evidence.md`) and documented GraphPad controls.
The native runtime default, off-scale Y behavior, missing X positioning and
precise rendering are **not** verified. GP only implements missing Y with a
known X, not the full archived gap/off-scale contract. Keep graph requirements
partial; do not infer full Prism equivalence from passing tests.

**Verification:** [GitHub Actions 39479595971](https://github.com/samgillman/GP/actions/runs/39479595971)
passed for head `62fff85b2502268c729373ef5e49dc53c299fa97`:
462 backend tests, 256 frontend tests, both application builds, requirement
checks, and packaged-server/static Chromium gap-choice/undo/reload checks.
This is tested GP code, not an executed Prism 11 native comparison. Publication
and deployment must be verified independently.

## 2026-10-20 continuation: persistent dataset colors

GraphSheet now optionally stores `datasetColors`, keyed by stable source-column
ID, including columns temporarily omitted from the graph. Existing positional
`graph.colors` remains the browser/export authority and seeds or refreshes active
metadata. Both Column and XY dialogs preserve colors across committed removal,
close, save/import and later re-addition. Source deletion prunes removed IDs;
source reordering/renaming retains identity. Frozen graphs use captured source
IDs; unfreezing remaps/prunes against live data. Duplicate and undo/redo paths
preserve independent maps. Existing v4 files without metadata remain supported.
Editing this newer metadata with older builds is not guaranteed compatible.

This closes the previously recorded removed-color persistence defect for the
supported same-source workflows. It does not implement other per-dataset style
properties, cross-table Add/Replace or native file/storage parity. Reused REA
XY/Column control evidence is in the graph-format report; the stable-ID storage
scheme is a GP design, not a recovered Prism serialization algorithm.

Validation: **254 frontend tests passed**, plus typecheck and both production
builds. The static assembler verified **19** locked runtime packages. Current
packaged-server and static Chromium checks passed actual workbook download,
reload/file import, omitted-dataset color restoration, active colors, ordering,
Apply/Cancel, undo/redo, keyboard/narrow-layout checks and SVG export with the
restored color, with unchanged source data and zero page errors. Evidence lives
under `/workspace/gp-evidence/dataset-colors-{model,server,static}`. Static export
used the existing diagnostic 900000ms allowance. A development check pointed
at the historical backend on port8000 and was stopped; it is not counted as a
current-build pass. The verified current backend runs from this checkout on8012.

The onboarding startup instructions were saved as a draft using the setup skill;
this does not establish publication/restoration of that environment or app
site deployment. Original Prism artifacts remain outside Git.

## 2026-10-20 continuation: XY dataset membership and ordering

Using the retained REA XY graph-dialog contract, the next unit replaces its
inclusion/order dual panes with one selected list and adjacent Add, Remove,
Top, Up, Reverse, Down and Bottom actions. Stored order remains unchanged;
the UI reverses it so the frontmost observations appear first. Column retains
its separate ordering workflow. Same-source single-dataset addition is a GP
implementation choice; cross-table Add/Replace and native runtime equivalence
remain open. Curves and other artists have separate browser/export layers, so
this is not a promise of whole-dataset layering across all graph elements.

Before the color correction, the full frontend suite passed 231 tests, but the
new actual browser check failed after Reverse→Apply: dataset colors followed
positions rather than dataset identity. The fix must preserve active dataset
colors on reorder and removed colors on re-add within the dialog, including
Appearance edits. The existing schema cannot recover a removed dataset's old
color after committing removal and closing/reopening the dialog; persistent
style ownership across that workflow remains open.

Final validation: eight focused ordering/color tests and typecheck passed after
the color correction. Both production builds passed; the static assembler
verified all 19 locked runtime packages. Actual Chromium checks passed on the
development, packaged-server and static builds: SVG order and dataset colors,
Apply/Cancel, undo/redo, membership changes, empty-selection refusal, reload,
keyboard navigation, narrow-window layout and unchanged source data. Zero page
errors occurred. Screenshots are retained under
`/workspace/gp-evidence/dataset-order-{dev,server,static}`; the development
screenshot was visually reviewed. The requirement audit preserves all 2,661
requirement identities and 1,574 original parity rows. These checks are now wired
into CI; hosted execution and live-site deployment have not been verified.

The new Column resource decode is actual REA Evidence
`ev_ff9c5094b7f4562421c7eeb24cd8c987d2500186575f364afba7c00b229ecc31`.
All four requested archives decoded, with 71 recognized actions and 105
unresolved connectors preserved. Original bytes/hashes remain outside Git.
Column controls and its archived Annotations tab are documented separately;
this UI increment does not implement or close them.

## 2026-10-20 continuation: axes dialog geometry and label spacing

After publishing numbering as `b1eccbe` (verified against GitHub main), work
continued into the visible Y-title overlap and dialog layout. The dialog now
uses REA-recovered broad spatial grouping with responsive GP dimensions.
Browser label measurement reserves title space and reprojects the same data;
clipping and hit targets follow the adjusted frame. See the implementation
notes for remaining long-label and dense-tick limitations.

Development Chromium checks passed at 1280×800 and 390×844: the full desktop
Decimal dialog fits without scrolling, the narrow dialog has no horizontal
overflow and remains editable, and actual transformed SVG bounds show the
Y title separated from every formatted tick. Screenshots were visually reviewed
under `/workspace/gp-evidence/axis-layout-dev`. Typecheck passed; four focused
frontend test files passed including projection/selection/clipping coverage.
Both production builds passed and the static assembler verified all 19 locked
runtime packages. Packaged server and static Chromium layout checks passed
the same desktop/narrow-screen and title-separation assertions, with zero page
errors. The packaged-server behavior suite also rechecked editing, separator
validation, undo/redo, reload, Cancel and SVG/PNG/PDF exports successfully.
Evidence screenshots are under `/workspace/gp-evidence/axis-layout-server`
and `/workspace/gp-evidence/axis-layout-static`. These are GP observations, not
a native Prism screenshot comparison. The application changes were published
on user request as `42baa61c4d98029a095c5de9aa08a7d1aaa58376`, verified against
GitHub main; deployment remains unverified.

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

## User design reference: graph sheet and Format Graph window (2026-10-20)

The user supplied a design reference, "Graph sheet + Format Graph dialog"
(`Graph.dc.html`, 1440 × 900 artboard), and asked for its layout to be
replicated completely. This work follows that reference. It is **not** native
Prism evidence: no REA analysis or Prism execution was used, and no parity
status changes.

Implemented on branch `feat/graph-sheet-format-graph-mockup`:

- Window layout from the reference: ten-item menu bar (adds Arrange, Window and
  Help), a ribbon with the reference's 15 groups and icons, a 250 px navigator
  with Data Tables / Info / Results / Graphs / Layouts sections and a Family
  panel, a grey graph canvas with a dotted white page, and a bottom bar with
  previous/next sheet, family view buttons, the sheet field and the zoom
  slider. Ribbon commands GP does not implement (highlight, pin, cut/paste
  buttons, statistical shortcuts, checklist, analyze by example, sort, color
  scheme, magic, decimal format, draw, write, text formatting, print layout,
  send and tips) are visible but disabled, and their tooltips say they are not
  available in GP yet. GP has no Info or Layout sheets, so those navigator
  sections are empty.
- Format Graph docks beside the page as a non-modal window with four tabs
  (Appearance, Data Sets on Graph, Graph Settings, Annotations). Appearance has
  the reference's data set selector with ‹ › and a Global / Data set scope,
  Style, Bars and boxes (fill, border weight and color, fill pattern), Symbols
  (color, shape, size), Error bars (color, T/I cap, direction, thickness), Lines
  (XY only), and Additional options (legend; the right Y axis is shown disabled
  because GP graphs have one Y axis). Titles moved to Graph Settings; pairwise
  bracket display options are on Annotations.
- New optional graph metadata `dataset_styles` (keyed by stable source data-set
  ID, like `datasetColors`) and `show_legend`, with strict validation. Unset
  fields follow the data set color and graph-wide choices, so earlier workbooks
  draw from their colors as before, with the reference's tinted fills, colored
  borders and above-only bar error bars as the new defaults.
- Column graphs are drawn on the reference's portrait page (70 px per data set,
  220 px plotting height, title inside the page, bold Arial text, category
  labels slanted 45° when wider than their slot). XY graphs keep their frame.
- Exports receive the resolved styles, legend choice and label rotation
  (`GraphOptions.styles`, `show_legend`, `x_tick_rotation`); requests without
  styles keep the earlier export styling.

After PR #11 (Column bar spacing) merged into `main`, this branch merged it.
The **Space between columns (%)** control now sits in a Column dimensions
section of the redesigned Graph Settings tab. Its bar-width rule applies to
both the restyled browser bars and the styled export.

Validation on macOS (Python 3.12 with `requirements.lock`, Node 24) after
merging `main` at `49e2e8c`: 485 backend tests (7 new export-style tests), 269
frontend tests (10 new style and page layout tests), `scripts/check_requirements.py`,
both builds, and 26 of 27 browser checks. Those include the new
`scripts/check_format_graph.py` and PR #11's `check_column_spacing.py` on the
static and packaged-server builds. `check_grid_ui.py` fails on this host
because it presses Control+Z, which is not the macOS undo key; it passes in
Linux CI on `main`. Five existing checks and PR #11's spacing check were updated
for controls the reference moves or restyles: the zoom-in command is in View,
Exclude/Include Values in Edit, new graph of existing data in Insert, the graph
title is edited from Graph Settings, and bars are no longer black-outlined.
Hosted CI for this branch has not yet been observed.

## Window restyled after Prism for macOS (2026-10-20)

The user compared GP with their installed Prism (11.1.0 on macOS) and asked for
its look. Reference screenshots came from that app: an unsaved scratch project
with the Column "Ordinary one-way ANOVA" sample (data table, graph, all four
Format Graph tabs, toolbar, navigator and bottom bar). The scratch project was
discarded and the user's own project was not modified. These are visual
observations, not REA evidence, and no parity status changes.

- Window: macOS-style menu bar with a GP application menu, and a title bar with
  the workbook name, save state and engine status. The toolbar has Prism's
  labelled two-row groups. They change with the sheet: Data and Import on data
  tables, Arrange and Draw on graphs. The navigator uses Prism's dense rows: the
  first header and the Family header are banded, sheets in the current family
  are bold, and the current sheet is highlighted. New Info…/New Layout… are shown
  disabled. The bottom bar spans the window with a navigator toggle,
  previous/next and find, sheet-type buttons, the sheet field, status, and
  ⊖ slider ⊕ zoom. Dark values were measured from the user's Prism; light
  values are macOS equivalents.
- Sheets: graphs sit on a white US-letter page (612 × 792 px at 100%, graph one
  inch from the top) inside the sheet surround. Data tables use Prism's banded
  header rows. Format Graph drops from the top of the sheet area like a macOS
  sheet, with Prism's tab and row layout, the table-named data set label, and
  Apply / Cancel / OK.
- Loading: the browser worker reports runtime, package, code and graph-export
  stages. The title bar shows the stage and step; a banner appears when an
  analysis or export is waiting for the engine.

Validation on macOS: 485 backend and 269 frontend tests, both builds, and
26 of 27 browser checks. `check_grid_ui.py` uses Control+Z, which is not the
macOS undo key; it passes in Linux CI. `check_format_graph.py` was updated for
the Prism groups, the letter page and the sheet position. A fresh static visit
reached "Analysis engine ready" and exported a PDF in 7.6 s, with every stage
shown. Hosted CI for this branch has not yet been observed.

## Prism behaviors and toolbar commands, batch 1 (2026-10-20)

The user asked for GP to work like their Prism, with the most-used toolbar
commands and Prism behaviors first. This batch follows what was observed in the
user's Prism 11.1 for Mac. It is not REA evidence, and no parity status changes.

- New Data Table and Graph uses the Welcome-window layout: a CREATE list, an
  OPEN › Open a File… entry, and the table family's description as the heading.
- A graph the user has just created asks for its type the first time it is
  viewed, as in Prism. Change Graph Type now has the family, Prism's tabs
  (Individual values, Mean/median & error, Box and violin for Column), picture
  tiles and a live preview of the graph. Keeping the current type does not
  create an undo step.
- Sheet › Highlight colors a sheet's navigator row (seven colors or none). It
  is saved as optional, validated `highlight` sheet metadata and is also offered
  in the navigator context menu.
- Clipboard Cut, Copy and Paste work on the selected data-table cells through
  the system clipboard. Copy without a selection copies the table as CSV.
- Change › Color Scheme applies one of seven palettes to every data set and
  clears per-data-set color overrides.
- Change › Magic (make graphs consistent) copies another graph's type, plot,
  per-data-set appearance, colors and/or axis settings. Data sets are matched
  by position; data, titles and linked analyses are untouched, and one undo
  reverses it.
- GP's dialogs follow the dark appearance, like Prism's. Toolbar drop-down
  menus are no longer clipped by the toolbar: Export ▾ and New sheet ▾ from the
  previous change were affected.

Validation on macOS: 274 frontend tests (5 new for Magic, color schemes and
highlights), 485 backend tests, both builds, and 28 of 29 browser checks,
including the new `scripts/check_prism_behaviors.py` (added to CI). Five
existing checks now accept the first-view Change Graph Type prompt.
`check_grid_ui.py` stops on this host at its Control+Z step, before its prompt
change; it passes in Linux CI. Hosted CI for this branch has not yet been
observed.

## Prism behaviors, batch 2: editing in place, Analyze Data and Export (2026-10-20)

Batch 1 (PR #14) passed hosted CI and is live at gp.samgillman.org. This
batch follows dialogs observed in the user's Prism 11.1 for Mac (Analyze Data
and File › Export captured from a discarded sample project). It is not REA
evidence, and no parity status changes.

- The graph title and the X and Y axis titles are edited in place: double-click
  the text, then Enter or clicking away keeps it and Escape restores it. Each
  edit is one undo step. Frozen graphs keep the previous double-click editors.
- Double-clicking a sheet in the navigator renames it in place, and Rename
  sheet in the Edit and navigator menus does the same. The bottom bar's name
  field is used when the row is hidden.
- Analyze Data has Prism's layout: Use (built-in analysis); Which analysis?,
  with search and a collapsible tree (Recently used, XY analyses, Column
  analyses); Analyze which data sets?, with a Table chooser, `A:Name` data set
  rows and Select All / Deselect All; then Cancel / OK. Analyses that need the
  other table type are listed but unavailable. Choosing another table opens it
  and analyzes it. The sheet-name prefix field is gone, since Prism's dialog has
  none.
- File › Export and the toolbar Export button open Prism's Export sheet for
  graphs: Export As, File Format (PDF, TIFF, PNG, JPEG, SVG) with a description,
  Resolution (72–1200 dpi, bitmaps only, with the pixel size shown), Size
  (Actual, or Enlarge/shrink to make width), Background Color (White or Clear),
  and Make these options become the default / Restore the original defaults
  (kept in this browser). On a data table, Export saves CSV.
- `/api/export` accepts `tiff` and `jpeg`, plus `dpi`, `width_inches` (1–20)
  and `transparent`. Enlarging or shrinking scales the whole graph, text
  included; bitmaps record the chosen dpi. Requests are refused when they
  cannot be honored: JPEG with a clear background, a resolution for vector
  formats, a width for PDF (GP exports PDF at actual size), or bitmaps over 60
  megapixels. Requests without the new fields export exactly as before.

Validation on macOS: 279 frontend tests (5 new for export options), 499
backend tests (21 new in `tests/test_export_options.py`), both builds, and 29
of 31 local browser checks, including the new `scripts/check_prism_dialogs.py`
(added to CI) against the static build and the server. Six checks now export
through the Export dialog and four press Analyze Data's OK. `check_grid_ui.py`
again stops at its macOS-only Control+Z step. `check_dataset_order.py` timed
out once on its static SVG download while the full suite ran and passed when
rerun alone. Hosted CI for this branch has not yet been observed.
