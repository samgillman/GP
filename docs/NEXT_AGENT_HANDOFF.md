# GP handoff to the next agent

Prepared 2026-10-19, America/Chicago. This is a continuation checkpoint, **not completion of Prism parity**.

## XY dataset-order follow-up (2026-10-20)

After the published axes increments, work continued into G045. The XY Format
Graph dataset page now uses one selected list with working membership/reorder
controls. Persisted order remains back-to-front; the UI reverses presentation.
Colors now stay attached to included source datasets through reorder and
same-dialog remove/re-add. Cross-table Add/Replace, removed colors after a
committed removal and dialog reopen, and whole-artist stacking parity remain
open. Column retains its separate left-to-right workflow. Read the newest
execution-log entry for actual validation/publication status.

A new actual REA decode of four Column NIBs produced
`ev_ff9c5094b7f4562421c7eeb24cd8c987d2500186575f364afba7c00b229ecc31`.
The graph evidence report preserves original hashes and unresolved connectors.
It confirms Column differs from XY: left-to-right order, baseline/orientation/
spacing controls and an archived fourth Annotations tab. These missing controls
are not implemented by this ordering increment. Next work should use the
Column/XY-specific evidence, finish dataset-scoped appearance support and stable
style ownership, and retain the wider completion registers; do not claim parity.

## Current continuation: persistent axes (2026-10-20)

The first axes increment was published as `65faec6a81ec272e8abb9490e45f4bb5edf80020`
and verified with `git ls-remote`. Work continued immediately into G070 explicit
decimal numbering, published as `b1eccbe53495164e29ebfec205f282c1aa0deb17`
and verified on GitHub main. Its changes add `AxisSettings.numberFormat`, a
BigInt/Decimal formatter pair, Numbering controls, and strict prefix/suffix
validation after an actual NUL-prefix probe produced an unreadable SVG.
Scientific/Power-of-10/Antilog/native auto formatting remain open. Read the
latest progress entry for validation/publication of this second increment;
do not assume the first axes commit contains the numbering changes.
Both production browser builds passed numbering/export checks. Work then
continued into compact dialog geometry and a visible tick/title overlap fix;
these follow-up edits were published as
`42baa61c4d98029a095c5de9aa08a7d1aaa58376` on user request after typecheck,
focused tests and development-browser checks passed. Production-build checks
continue separately; see the execution log for their actual results.

Active checkout is `/workspace/gp-status-main`, branch `gp-prism-axes`, based on
GitHub main `948a451`. The old `/workspace/GP` checkout is historical; do not push
its old `work` branch over main. This section supersedes the old checkout/status
details below. The local `web/node_modules` symlink reuses `/workspace/GP/web/node_modules`; it is an untracked setup artifact and must not be committed. Activate `/workspace/.gp-tools/activate.sh` for the pinned Node toolchain. The user explicitly objected to stopping at status checkpoints;
continue implementation after answering steering questions.

Read [axes implementation](axes-implementation.md) and
[REA axis evidence](prism-axes-rea-evidence.md). The implementation adds optional
graph axes, a dedicated dialog, matching browser/export bounds and tick rules,
clipping and log display handling. Reused REA Evidence
`ev_7134f710b640d3ba5f9c663eb9791aaaf2af296a4445119788468366552abc5f`
establishes the native control surface, not runtime defaults or algorithms.
The requirement register keeps G060/G062/G064/G066/G067 partial.

Validation during this work: typecheck, 190 frontend checks plus two later
tick/freeze regressions, 81 focused backend checks, initial browser interaction
check, both builds, 19 checksum-verified static runtime packages, requirement
audit. Full backend regression passed 374 tests. Production server and static browser
checks passed all three export formats, undo/redo, reload and Cancel. Static
startup required a diagnostic 900000ms export allowance after shorter timeouts;
see the execution log. No live-site deployment verification is established here.

## Latest update: Column t tests, one-way ANOVA and pairwise brackets (read this first)

The newest unit makes Analyze → t tests / One-way ANOVA → parameters dialog → tabbed results → graph significance brackets work end to end, with the website warming up its Python engine at startup. Read [column comparisons](column-comparisons.md) and the newest section of [completion-progress.md](completion-progress.md) for the evidence boundary (no new REA analysis; only the saved paired-t case is a Prism comparison), three known differences from guide exact-P statements, and open work. `scripts/check_column_analysis.py` is in CI for both builds; the large-workbook check selects Welch through the parameters dialog. Saved results of `t_test`/`one_way_anova` carry an `options` object; graphs may carry `graph.pairwise`.

## Earlier update: reversible value exclusions

A later session worked in a **fresh cloud container**, not `/workspace`: checkout `/home/user/GP` on branch `claude/vibrant-keller-dzmvpg`, Node 22.22 (repository pins 24.18), Python 3.13. `/workspace/rea`, `/workspace/gp-inputs`, `/workspace/gp-evidence` and `/workspace/.gp-tools` did **not** exist. The REA skill was read from a fresh public clone (`morluto/rea` 6.7.0, `b4938ae`). Without the Prism artifacts no new REA analysis was possible; committed Evidence IDs were reused. The network policy denied `cdn.jsdelivr.net`, so the static Pyodide runtime could not be assembled and static-browser checks were not run there.

That session implemented GP workbook **version 4** exclusions keyed by dataset/row IDs: blue italic asterisk cells; omission from analyses, recalculation, graphs and graph export; context menu, Edit menu, Data toolbar and graph point-details commands as single undo entries; freeze/copy/reload/save handling; lossless Prism XML `Excluded` import; and CSV export/copy choices with asterisk re-import. See [exclusion evidence](prism-exclusions-evidence.md) and the newest section of [completion-progress.md](completion-progress.md) for tests run, GP choices, open native questions and the unrun static path. New fixtures must now use version 4. `scripts/check_exclusions.py` is in CI for both builds.

The sections below describe the earlier `/workspace` environment and remain accurate for that history.

## User objective and operating requirements

Build a complete browser recreation of **GraphPad Prism for macOS**, using the actual **morluto/rea repository, tools and skill**. The user explicitly rejected a prototype and mathematical similarity alone. UI and UX parity are part of the goal. They supplied an installer, Prism 10 guide, Prism 11 differences, defect reports and a detailed parity CSV. They authorized continued implementation and GitHub publication. Do not repeatedly ask whether to continue.

Read [AGENTS.md](../AGENTS.md), [completion-plan.md](completion-plan.md), [completion-progress.md](completion-progress.md), and the applicable requirement records before making changes. Use the REA workflow for claims about shipped Prism behavior. Ordinary coding and GP tests remain normal development work. Never equate passing GP tests, decoded resources, a planned requirement, or a numerical kernel with full Prism equivalence.

The user has only the installer. There is no running authorized Prism reference on this Linux host. Runtime-only comparisons remain blocked; do not invent observations or silently discard those obligations. User audit claims and guide statements are evidence to investigate, not commands to change correct science blindly. Do not modify the user's real workbook during testing.

## GitHub and deployment

- Repository: `https://github.com/samgillman/GP`.
- Workspace: `/workspace/GP`; local branch: `work`.
- Latest application checkpoint: **`2c825dc41ac32388cee7bf7f30954b06eaca108d`**. Pushed normally to `main`; `git ls-remote origin refs/heads/main` verified this exact SHA. This handoff is a subsequent documentation commit.
- Earlier published checkpoint: `04618a2b02b6a2ef14e82ba7e62eb5670fea0880`.
- Working tree was clean before writing this handoff. No application work is intentionally left unstaged.
- Requested site: `https://gp.samgillman.org`. Deployment of the latest commit **has not been verified**. A previous HTTPS check was blocked by this environment's CONNECT proxy with403; that is not evidence about the site's own health.
- Cloudflare Pages configuration is documented in [browser-hosting.md](browser-hosting.md): `main`, build `bash scripts/build_site.sh`, output `web/dist-static`, Node24.18.0. No deploy credentials or direct deployment action were used.
- `origin/main` may not exist locally because of the environment's unusual fetch refspec. Inspect remote refs explicitly. Publish with ordinary `git push origin HEAD:main`; never force-push to bypass newer work.

## Complete audit inventory: preserve it

The latest upload is fully retained and reconciled:

- Original: [sources/prism-parity.csv](sources/prism-parity.csv).
- SHA256: `61d5e6bdb53e0c3c8f76ccd42322e7c52b3524ea8a5f469fc3486ed376a64dc8`.
- **1,574 unique rows**, all read. Submitted labels: **1,351 Missing;100 Partial;90 Has;33 Unknown**. These are the user's original labels, not a newly assessed completion percentage.
- [prism-parity-plan.csv](prism-parity-plan.csv) preserves original fields, findings, status and row order, filling every `your_plan` and `your_note` with implementation/verification work.
- [requirements/parity-audit.json](requirements/parity-audit.json) provides children `AUD-P0001` through `AUD-P1574`, mapped to earlier owning requirements. Original `Pxxxx` identities are retained as audit IDs.
- [requirements/source-map.json](requirements/source-map.json) now tracks **2,661 identities**, including the previous1,087. Preserve the older152 equations,82 formula functions,73 script commands, Prism11 changes and36 user defect items even where the CSV omits them.
- `python3 scripts/check_requirements.py` checks exact original source hash, every CSV row/field/order/status, nonempty plans/notes, register correspondence, valid parents and evidence gates.
- `.gitattributes` preserves both CSVs' CRLF bytes and treats CR-at-EOL correctly for whitespace checks. Do not normalize the original audit bytes.
- Do not rerun temporary merge/generator scripts in `/tmp`: some overwrite manually updated requirements and duplicate progress sections. Edit the committed registers directly and run the checker.

The full plan remains in the linked registers. Do not replace it with a short list or close a parent while its required option-level children are open.

## What the latest application checkpoint implements

### Workbook v3 identities — W001 remains partial

`web/src/workbook.ts`, `data.ts`, `workbook-actions.ts`, and corresponding tests:

- `Workbook.version` is3; **browser storage key remains `gp.workbook.v2` deliberately** for migration.
- Every workbook dataset has a unique `Column.id`; standalone v1 `Project` keeps that field optional.
- Each `DataSheet.rowIds` covers represented rows, not all10k virtual empty rows or every cell.
- Results and graphs have authoritative ordered `datasetIds`; `columnIndices` is a checked positional compatibility view.
- v1 workbook migration preserves numeric drafts such as `-`; standalone `parseProject` stays strict. v2 migration preserves links/settings/current results and generates identities. v3 rejects missing, duplicate, dangling or inconsistent references.
- `datasetSelection`, `newRowIds`, `representedRowCount`, and `updateData(...,{rowIds})` are shared APIs. Row shrink/reorder needs an explicit mapping. New same-name datasets do not inherit old IDs. Data copies get independent dataset/row identities.
- XY X-identity replacement invalidates dependent selections for review.
- Still absent: complete subjects/replicates, rich graph-object/layout identities and all typed table families. This is GP's independent serialization, not native Prism format compatibility.

### Dependency foundation — W003 remains partial

`web/src/workbook-dependencies.ts/.test.ts`:

- Iterative graph ordering, dependencies/affected/family queries, SCC cycles, missing/wrong-kind/source-mismatch diagnostics, independent-family isolation and frozen update barriers.
- Integrated into workbook validation, direct-result scheduling and Family navigation.
- Tests cover30k chains and130k fan-out without recursive/argument-spread failure.
- Runtime consumers currently cover data, direct results and graphs only. **No analysis-of-analysis execution, transforms, linked blocks/cells, Info constants or layouts yet.** Topological dispatch alone is not upstream-completion scheduling.

### Bounded freeze/unfreeze — W004 remains partial

`web/src/workbook-freeze.ts/.test.ts`, schema/parser, queue, App and DataGrid:

- Real commands in Edit, toolbar and navigator context menu; frozen indicators; data editing/structural guards with copy/navigation retained.
- Results capture `frozenSource`; graphs capture source plus optional `frozenResult`. Upstream edits retain captured scientific inputs/output.
- Frozen work does not recalculate; thaw remaps surviving dataset IDs, marks results stale, and requires selection review where identities were lost.
- Save/reopen, duplicate, undo/redo, rendering and export use captures. A removed snapshot point cannot navigate to a replacement cell.
- Historical frozen results cannot silently create a new live graph against changed inputs; cross-source links reject.
- A queue regression verifies that freezing an undo-restored result aborts older work and ignores late output.
- Limits: Column/XY only; no native formula/compatibility branches or result-exclusion reset semantics; source deletion still uses the existing family cascade, not orphan preservation. Large captures remain subject to20MB workbook/browser storage limits. Snapshot persistence/undo/thaw recalculation are GP choices, not verified native internals.

### Linked selection and serialization performance foundation

- `workbook-selection.ts/.test.ts` maps graph highlights/navigation by dataset and row IDs. DataGrid restores per-sheet selection; explicit point-focus navigation wins over cached selection.
- `workbook-snapshot.ts/.test.ts` prepares one serialization for limits/equality/history/autosave. Immutable handles use WeakMap metadata; raw mutable inputs are freshly serialized.
- `deepFreezeWorkbookState` incrementally freezes committed plain state and does not trust merely shallow-frozen branches. Preserve this immutability invariant when sharing references.
- Paired helper benchmark: seven alternating trials of ten edits on identical200k-value workbooks, median1265.1ms old versus567.9ms prepared+freeze. Initial preparation excluded equally; writes in-memory. Evidence `/workspace/gp-evidence/serialization-paired.json`.
- **B005 is still partial.** Latest browser grid edit including Playwright measured2670ms under concurrent load. Do not claim browser performance solved from the helper benchmark; whole-workbook processing remains.

### Earlier implemented fixes remain relevant

The prior published batch includes iterative plot bounds, dense canvas drawing of all observations, a virtualized10k×30 grid, pinned rows/headers, per-sheet scrolling/resizing, range selection and keyboard editing, neutral CSV defaults, semicolon support, safe numeric errors/limits, result rerun identity, sheet deletion/duplication, quota recovery, render-boundary recovery, view zoom/pan and graph point navigation. Scientific edge fixes include two-pair Hedges g undefined reporting, Y-only XY descriptions, isolated constant-series4PL failures and no-event logrank diagnostics. See the36-item break register for exact scope; exclusions/per-point styles and many graph editing interactions remain open.

## Verification actually completed

Latest checkpoint:

- **145 frontend tests passed**, zero failures; TypeScript passed.
- **266 backend tests passed in the earlier batch**. No Python science changed in this batch, so the full backend suite was not needlessly repeated. Do not present this as a new run.
- Server and static production builds completed; all19 locked Pyodide packages restored/verified by `scripts/build_browser.py`.
- `scripts/check_workbook_foundations.py`: all9 scenario groups passed, zero page errors, in dev106.63s, packaged server115.34s and static245.93s. Real fitting, freeze/thaw, identity shifts/deletion, JSON save/reopen and SVG geometry consistency are checked without mocking API calculations.
- `scripts/check_recalculation.py`: actual server and static computations passed, including independent jobs, drafts, undo/redo, reopening, numerical means and zero-dose fit/log rendering.
- `scripts/check_grid_ui.py`:26 current server checks passed, zero errors; bounded DOM and AD10000 persistence included.
- `scripts/check_desktop_ui.py`: current server desktop/menu/modal/mobile/theme regression passed.
- Capacity:200k and300k values imported and fully drawn without crash; observed harness timings11.83s and15.42s. Saved graph settings unchanged by view zoom.
- Large-workbook integration repeat passed result identity/settings isolation, subset navigation, hostile names, constant/overflow notification layout, quota download and render-error recovery.
- Requirement checker passed2,661 identities and full1,574-row preservation; CI YAML parsed; final whitespace check passed.
- `.github/workflows/ci.yml` adds server/static foundation checks and separate uploaded artifact directories. **Hosted CI results have not been observed.**

Failures were retained, not relabeled as passes:

- Initial static checks timed out under concurrent load; a diagnostic foundation repeat and separate recalculation repeat passed without increasing assertion timeouts. The script now preserves progress/worker events and original failures before screenshots can mask them.
- Capacity run later failed at an injected subset-navigation fixture that modified `columnIndices` without matching v3 `datasetIds`. The validator correctly rejected it. Corrected the fixture and reran integration only; did not repeat successful capacity work.

Local evidence, not committed proprietary artifacts:

```text
/workspace/gp-evidence/workbook-foundations-dev/results.json
/workspace/gp-evidence/workbook-foundations-server/results.json
/workspace/gp-evidence/workbook-foundations-static-diagnostic/results.json
/workspace/gp-evidence/grid-v3/
/workspace/gp-evidence/desktop-v3/
/workspace/gp-evidence/large-v3-capacity.json
/workspace/gp-evidence/large-v3-integration.json
/workspace/gp-evidence/serialization-paired.json
```

Final foundation script SHA256: `88ce75f559815f25aff9caebd1e1356d22ff6898e9c6bd7dad92b857bf60e577`. Earlier dev/server result source hashes differ because diagnostics were added afterward; assertions were not weakened. External evidence may disappear in a fresh cloud workspace; committed reports retain bounded findings and provenance, not all raw answers.

## REA: actual tools, source artifacts and findings

Read `/workspace/rea/.agents/skills/reverse-engineer-anything/SKILL.md` and its connection/native references when continuing native investigation. Repo `/workspace/rea`, REA6.7.0, commit `255d906e15a141b0f4acee60dc73976f03adc94c`. Use the public repo launcher/MCP interface. Direct chat registration was misaligned; **do not claim it was registered/connected**. Existing working helpers use stdio MCP through `/workspace/rea/scripts/rea.mjs`. Preserve successful exports and close sessions; do not restart setup or repeat expensive full analysis without a reason.

Native target: **Prism11.1.0 build110218 macOS**.

```text
Original app: /workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app
Thin x86_64: /workspace/gp-inputs/prism-native/Prism-x86_64
Thin SHA256: 8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf
Universal SHA256: 854b63fc6df2712b7c67660142b2e6ff7f1bf755a5d78136fb5bec92e6fbc632
```

Keep installers, extracted binaries, NIBs and copied native assets outside Git. No Prism application code was executed. Exact extract/source hashes, static REA findings, supplementary shell inspection, guide statements and GP choices must stay distinguished.

- [Compiled UI evidence](prism-ui-rea-evidence.md):20 selected unchanged archives;9,251 objects and3,176 connections, with164 unresolved connectors and truncation limits. Zoom menu presets50–1000 confirmed; point overrides/reset and source-row actions recovered. The decoded DataTableToolTip is a linked-data-region tooltip, not proof of graph hover behavior.
- [Freeze evidence](prism-freeze-rea-evidence.md):six exported native handler/callback records. Per-selected-sheet toggle, graph editing validation, special result/data unfreeze branches, and exclusion-clear callback are bounded static findings. Actual setFrozen/storage/undo/recalculation internals remain unresolved.
- [Zoom evidence](prism-zoom-rea-evidence.md):five exported native pseudocode records. Core minimum10; Core increment dispatch; integer decrement; effective increment/decrement. Effective decrement has unusual50→10,60→25,75→25 behavior. Ordinary integer increment and actual graph-control dispatch are not fully corroborated. Supplementary pinch code suggests50–1000 path-specific bounds; **do not apply Core min10 universally**. GP min25 and +/-25 remain independent choices. No zoom code changed in this pass.
- Prior full-image pass3:25 records and snapshot retained under `/workspace/gp-evidence/native-pass3/`. Evidence hash `a22354e6e7ae8da21f876cfd47358d0bfc2cd91f5ad80b0eefa4b7b183f5a888`; snapshot hash `f4f0dcb0bb9b40c3fc54d88dad1ab9f07f6db6491e77f97acd09b58435ab9403`. Reuse it.
- Later pass4 full-image attempt was cancelled after about51minutes in import/analysis without a first answer. Queued queries/export did not run; its empty `zoom-minimum.json` is invalid evidence. Cancellation record: `/workspace/gp-evidence/rea-pass4/native-full-image-attempt.json`.
- Fallback evidence lives under `/workspace/gp-evidence/rea-pass4/freeze/` and `zoom-fallback/`.17 zoom extracts verified byte-for-byte. Java readiness/preflight failures are retained separately from unresolved functions. Graph-pair analysis was intentionally cancelled before any answer. All owned native processes were confirmed stopped; there are no pending REA queries to resume automatically.

Useful future native questions: underlying `setFrozen` implementations; `setValuesInDataTable…` at0x10107fc25; graph zoom helper dispatch, ordinary integer increment, fixed-point/pinch/smart zoom and window routing. Use bounded source-verified ranges and supported readiness recovery rather than repeatedly launching the full image. Report files contain exact Evidence IDs and limitations.

## Environment and practical commands

These paths/processes are session-local, not guaranteed in the next environment:

- Tool activation: `. /workspace/.gp-tools/activate.sh` (Node24.18, Java21, Ghidra12.1.4).
- Python backend: `/workspace/GP/.venv/bin/python`; system `python3` has Playwright; Chromium `/usr/bin/chromium`.
- Static8001 serves `web/dist-static`; packaged server8003 serves `web/dist`; dev5174 proxies API8000. Backend8000 was started for dev testing. Older8002 was stale and should not be used as final evidence. Inspect listeners before restarting anything; do not kill unrelated processes.
- Rebuilding static assets with Vite removes copied browser runtime assets: follow with `python3 scripts/build_browser.py`.

```bash
cd /workspace/GP
. /workspace/.gp-tools/activate.sh
python3 scripts/check_requirements.py
npm --prefix web test
npm --prefix web run typecheck

# After relevant application changes:
npm --prefix web run build
npm --prefix web run build:static
python3 scripts/build_browser.py

# Only if a corresponding server is not already running:
GP_PORT=8000 bash scripts/start.sh
python3 -m http.server 8001 --bind 127.0.0.1 --directory web/dist-static

# In another shell; set unique evidence directories per run:
GP_CHROMIUM=/usr/bin/chromium GP_FOUNDATIONS_EVIDENCE=/tmp/gp-foundations-static python3 scripts/check_workbook_foundations.py http://127.0.0.1:8001
GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_recalculation.py http://127.0.0.1:8001
```

Do not rerun the entire expensive matrix for documentation edits. Recheck affected behavior after real changes. CI runs the full required suite. New fixture code must obey v3 dataset/row identity invariants or explicitly declare a legacy migration fixture.

## Next work: resume implementation, not another inventory rewrite

1. Verify checkout/remote state and read the completion plan's critical path. Preserve this tested checkpoint. Do not spend the next turn rebuilding the same audit plan or repeating completed native passes.
2. Continue W001/W003 typed workbook foundations into the first missing table families and their actual creation/edit/save/analysis/graph contracts. Current New Table disables six families; implementing an enabled-looking shell does not close them. Use the existing dependency contracts and owning D/P/W requirements to pick a bounded vertical slice with tests and native evidence.
3. Keep W004 partial while recovering applicable native freeze internals and building missing formulas/result exclusions/orphan behavior. Do not undo the verified independent snapshot safety in pursuit of an unproven native claim.
4. Advance the high-frequency gaps from the user reports: durable excluded values/per-point formatting, full graph/axes/text editing, complete table/menu/keyboard behavior, and view-only zoom semantics. Existing selection/tooltip/navigation is partial. Confirm graph-path applicability before applying newly recovered zoom helpers.
5. Measure large-grid latency in a controlled browser run, profile remaining whole-workbook costs, and introduce appropriately bounded history/persistence changes. Helper-only speedups are not closure of B005.
6. Work through remaining scientific options/models, transforms/formulas/chains, typed analyses, layout/shared rendering/export, native-file fidelity and script/reuse workflows in dependency order. Existing kernels and saved examples do not close complete option contracts. Every one of the1,574 audit children remains individually accountable.
7. Preserve evidence conflicts explicitly: survivalX=0 inclusion versus the audit's ignore claim; confidence ranges; paired summary-mask behavior; growth-inflection/probit conventions; transpose capacity; ambiguous proportion intervals. Do not change validated computations just to match unverified prose.
8. Browser/platform external integrations (OLE/XLS/WMF etc.) remain real obligations with adapters or explicit external blockers, not pretend controls. A user scope change is needed before discarding required behavior.
9. Update implementation, requirement evidence/limitations, progress and coverage hashes together. Keep publication and actual production verification separate. Publish normal reviewed/tested checkpoints; do not claim full parity until the completion contract is met.

The honest current state is substantial partial GP functionality with a complete tracked plan, **not a functionally identical Prism recreation**. Continue doing concrete work while preserving that distinction.
