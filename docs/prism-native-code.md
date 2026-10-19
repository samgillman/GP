# Bounded native-code observations

Target: Prism 11.1.0 build 110218, extracted x86_64 Mach-O slice SHA-256 `8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf`. REA 6.7.0 used Ghidra 12.1.4 on Linux. These are static observations, not execution of Prism.

## Method and retained evidence

The default full-image analysis exceeded its 1,800,000 ms startup deadline. That is a provider timeout, not evidence that Mach-O analysis is unsupported. Logs and thread samples are retained under `/workspace/gp-evidence/native-pass2`. A subsequent full-image pass completed startup in 831 seconds using an 8 GiB heap and a reduced analyzer profile recorded in `/workspace/gp-evidence/native-pass3/analysis-profile.json`. It successfully serves native pseudocode, function dossiers and references. See the full-image findings below.

Separately, six function ranges were extracted using the executable's `LC_FUNCTION_STARTS` boundaries and segment mappings. Each range was opened with REA as raw x86_64 code at its original virtual address. All six produced pseudocode, evidence exports and closed-session snapshots. Source ranges, byte hashes and extraction procedure are retained in `/workspace/gp-evidence/native-pass3/function-ranges.json` and `extract_function_ranges.py`; query records are in `raw-functions/`.

| Function label | Address | Bytes | Pseudocode evidence |
| --- | --- | ---: | --- |
| t-test `performOK` | `0x1010038b4` | 423 | `ev_07fd70841b442aff6173c83cf596968dc269a30e745267e354f4f5f006072e7d` |
| linear regression `performOK` | `0x100ff72ae` | 2074 | `ev_149f1f30de726a6ac8803ceb30a9462613ed5c6e985c28245341e3bb52cf7f39` |
| nonlinear regression `performOK` | `0x1010d3471` | 909 | `ev_56cadb0c21109af9da17001db8d3b34a900175acc6f44a9eaba802fa454a6f3e` |
| ANOVA `performOK` | `0x10100a727` | 552 | `ev_813f2d50ea01527e9383b0d291a690ffc967fefd6a919c4453240a5ef92604c7` |
| file-type dispatch | `0x1001a1758` | 479 | `ev_8766896b673d5750fcfc1f3f7a446bcb70c40234a85996cce431b84a7e48d9f3` |
| document-data loader | `0x1001a1ca3` | 199 | `ev_5023784ee63026c9feb2f18fa8c5ce8375dbb7a696f46c6c0da02067e5868b3c` |

Raw ranges omit other code, globals, imports and exception metadata. The two loader routines have truncated-control-flow warnings, and the linear routine has an unresolved tail jump. Their pseudocode is incomplete and is not recovered original source. `resolve_raw_context.py` separately reads selector references, CFStrings and indirect import indices from the original Mach-O; those bindings are recorded in `raw-function-context.json`.

## Findings and implications

The t-test and ANOVA `performOK` methods save selected option groups as future-analysis defaults and call the superclass implementation. The t-test groups include common and residual options; ANOVA also has repeated-measures defaults. These routines are dialog commit handlers, not the numerical test implementations. Their names alone must not be used to claim the calculations have been reconstructed.

The nonlinear handler references default groups for flagging, diagnostics and confidence settings, the selected equation, recently used equations, viewer mode and comparison type. The linear handler assembles option values from controls, including averaging replicates, forced intercept coordinates, band kind, interpolation confidence settings, line endpoints and number formatting. The option schema and native default values still require further recovery and validation.

Original Objective-C ivar metadata resolves the linear controls referenced by that pseudocode. The bounded mapping below describes construction of its option bit field, not the numerical interpretation of each option:

| Bit | Observed condition in dialog commit handler |
| --- | --- |
| `0x001` | `_forceGoThroughCheckbox` state equals 1 |
| `0x002` | `averageReplicatesRadioButton` state equals 1 |
| `0x004` | `_calculateUnknownsCheckbox` state equals 1 |
| `0x008` | `_runsTestCheckbox` state equals 1 |
| `0x010` | `_testSlopesAndInterceptsDifferCheckbox` state equals 1 |
| `0x020` | `_resudialsCheckbox` state equals 1 (spelling in original metadata) |
| `0x040` | `_lineStartRadioGroup` selected tag equals 1 |
| `0x080` | `_lineEndRadioGroup` selected tag equals 1 |
| `0x100` | Preserved from existing option flags; meaning unresolved here |
| `0x400` | `_x95CICheckbox` state equals 1 |
| `0x800` | `_y95CICheckbox` state equals 1 |

The ivar parser retained 8,036 records and seven class-level parse errors in `native-pass3/ivars.json`; it does not claim a complete inventory. Each resolved control includes its source record offset, class and instance offset. These bit mappings are investigation evidence only; GP does not yet expose or implement all of the associated choices.

The observed file-type-dispatch body iterates registered candidates and compares `matchFileType:weight:` results, updating a candidate only for a strictly higher weight. The raw-range tail is truncated, so this does not establish complete dispatch or tie behavior. The document loader requests a binary-data provider and then an object by key. These observations do not yet supply a legacy project decoder or lossless native round trip.

None of these six routines establishes numerical, visual or workflow equivalence. Their immediate value is narrowing the remaining investigation and distinguishing UI parameter handling from scientific computation. GP's implemented numerical routines remain independent code tested against bounded saved reference cases.

## Graph dialog follow-up

Four further ranges use the same extraction/decompilation procedure, recorded in `native-pass3/ui-function-ranges.json`, with exports and snapshots in `raw-ui/`. `raw-ui-context.json` resolves original selectors and string constants. Class metadata establishes `PSXFormatGraphXYWindowController` → `PSXFormatGraphController` → `PSXWindowController`; the shared graph controller supplies Apply/OK, and the window controller supplies Cancel.

| Handler | Address | Pseudocode evidence |
| --- | --- | --- |
| Graph `applyClick:` | `0x10111f64f` | `ev_f11827d6953b277733aa7b6e9173103dc500ba60190862f7d8c802942e80bf71` |
| Graph `okClick:` | `0x10111f76c` | `ev_9ee1863f717ef08f8a02367afe673b2d75c3041ccde3bdf83e4b31b239d56fbb` |
| Graph `closeWithCode:` | `0x10111c7c5` | `ev_05d61ae97cf53e626af722cf138643d80bc0eee74155238245bceb5d34704ab8` |
| Window `cancelClick:` | `0x100fa8227` | `ev_47c4ded9a5320188f132f34f02ef538d6ea91abcbac19c510c406d7455e8a7ad` |

Apply obtains the document's undo manager, saves `groupsByEvent`, disables that mode, begins a group, calls `performOK`, ends the group, and restores the mode. It then calls `startRecalculatingIfNeeded`, resets the controller's graph reference and requests `updateLazyItems` on the current tab. Its raw pseudocode includes a tail-call warning. This supports an explicit commit and refresh without closing. GP now records graph Apply as one bounded workbook undo transaction; full native grouping and limits remain unverified.

OK checks the `CreateGraphWithoutData` alert-suppression setting and dataset count. With no datasets and no suppression, it presents “Do you want to create a graph with no data?” with Create/Cancel choices and an always-create preference. The completion block and full downstream rendering behavior are outside this four-range pass. GP currently requires at least one selected dataset in Format Graph, so axes-only graphs and this confirmation workflow remain an identified mismatch.

Graph close disables automatic control updates, delegates closing to its superclass and clears graph/appearance-permission references. Window Cancel invokes `closeWithCode:0`; only after successful closing and a flag check does it notify its delegate. These observations alone do not establish complete rollback behavior; GP's Cancel semantics must not yet be described as identical.

A further three-range pass is retained in `ui-close-ranges.json`, `raw-ui-close/` and `raw-ui-close-context.json`:

- Graph `performOK` at `0x10111c83c`, evidence `ev_d1e67308451fdcf39ac34f184171f2c327285282ec654a4704e4ddf12c99aaf4`: references editor/data validation, plot/data-set/parent links, legends, annotations and stale-state updates. The downstream validators and rendering operations remain untraced.
- Window `closeWithCode:` at `0x100fa7e05`, evidence `ev_d0227fb89ad1b23eefdf51e7c4ced7fdddfe246835e6d4ae637dddc6e467804c`: ends editing, checks `windowShouldCloseWithCode:`, invokes `performOK` for code 1 or `performCancel` for code 0, and follows separate sheet/modal/window closing paths.
- Base window `windowShouldCloseWithCode:` at `0x100fa83a9`, evidence `ev_798439c2421c8d843bee8877410daaf47b96a34a46c9dace3787af52bf9c4869`: returns true. Subclass overrides and other delegate paths must be checked before generalizing this behavior to all dialogs.

Thirteen bounded function ranges have therefore been queried across the three passes. This count measures retained observations, not feature completion.

## Full-image follow-up

Overview evidence `ev_588d3addaf42a2097581e19c233b688b8f3580ba341dc6ad977c5814e8a03d8b` reports 62 segments, 147,406 Ghidra-defined procedures and 182,989 defined strings. These are provider inventory counts, not counts of reconstructed features or original source functions. The upstream profile digest is `cb24b7ed2bfd3f30f02024266b152605c2a60700068efcd446151904a685afe8`. Six expensive/error-prone analyzers were disabled; unresolved types, references and control flow remain possible. The log includes invalid-instruction, address-space and demangled-table warnings. No native code was executed.

With the full data/import context available:

- Graph Apply (`ev_e0a14ff9afd5b9f2fbb9643a797c17b6ff12c4f6353784b83ecdbaefa4cb0cde`) independently resolves the selector sequence observed in the raw range, including undo grouping, commit, recalculation and refresh. A provider terminal-call limitation still applies.
- Shared graph `setGraph:` (`ev_cab16d5fad88f3a3dece81d562fd2e99a0898a3d9ebac97ebd005545e510942c`) copies plot graphics via `copyWithZone:`, retains dataset/parent mappings, and reloads the tab controllers. The XY override (`ev_fb910bea1b3e58f319a1e2b5db2344446674bb63976580f88cf3e4d72ed9ecad`) refreshes baseline information when its window is loaded and visible. These observations support separate editable graph state, without proving every setting's copy/rollback semantics.
- File dispatch (`ev_6d6894f76b5ecd5c568b48f3759274b2122fa891b0e1f3d6518eb3c5eef7f8a0`) now has a recovered return path: it returns the retained candidate with strictly greatest accepted weight, or nil if no candidate qualifies. Candidates come from a set of registered provider values; stable tie ordering is not established.
- Document loading (`ev_6d330fb4043d152b0b43fb80135c3e44e69daaa419ea872244c05f9edbd98ab1`) returns nil for a nil path; otherwise it obtains a binary provider and requests the `DocumentData` object. Provider implementations and full native-format parsing remain unresolved.

The `welchTTestModel` reference chain leads to structured result serialization. `ev_338f7544e8e22d7d43b52ac5f7dd3a5d386bdc6d01035de79a75de32f5fd6e25` observes sections for the Welch test, difference of means, effect sizes, variance test and AIC model comparison. `ev_017f8eea52dc161eb4f79f0e3e3d627fa8bdc00c7d22a96fb2cccdb3b96f2912` observes t, df, and general/one-tailed/two-tailed P-value fields. Serialization is not calculation; the complete Welch computational path has not been identified.

Student-t distribution references lead to a Boost-named CDF routine at `0x101bfcd70` (`ev_85fe868b13735ab1be67e165e0e611a592e57e17bce1d004af9108a89eb576b0`). Its observed branches check degrees of freedom, handle zero/infinite variates, and evaluate beta-function branches. A distinct tail wrapper at `0x10155f3fc` (`ev_bd82e82de4f278623d5d88434abb071200ff21ee98d1b728f744be12e1151a10`) and noncentral-t callers were retained for further tracing. Decompiled prototypes and some pointer/floating-value representations are unreliable; these findings do not establish that every Prism P value uses the same path or matches GP's SciPy implementation bit for bit.

Full-image query records, logs and the completion status are under `/workspace/gp-evidence/native-pass3`. The session closed successfully after exporting 25 evidence records to `full-image-evidence.json` (SHA-256 `a22354e6e7ae8da21f876cfd47358d0bfc2cd91f5ad80b0eefa4b7b183f5a888`) and saving `full-image-snapshot.json` (SHA-256 `f4f0dcb0bb9b40c3fc54d88dad1ab9f07f6db6491e77f97acd09b58435ab9403`). These preserve queried observations; closing REA deletes its temporary Ghidra database. A new unqueried investigation may require importing the original slice again. The exporter reporting zero recorded unknown objects does not mean there are no unresolved behaviors; the limitations above and coverage ledger remain applicable.
