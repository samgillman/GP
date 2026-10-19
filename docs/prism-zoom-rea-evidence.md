# Bounded Prism zoom evidence

This pass recovered five static REA/Ghidra pseudocode records from unchanged x86_64 function ranges. It does **not** establish complete zoom parity or justify replacing GP's current graph controls. GP's generic minimum of 25 remains an independent implementation choice until the applicable graph control path is proven.

The original slice is `/workspace/gp-inputs/prism-native/Prism-x86_64`, SHA-256 `8012501cfecab219c1e78494b96d92d37096166d5f28dfc1d5844f3bb41dbbaf`. Its universal executable hash is `854b63fc6df2712b7c67660142b2e6ff7f1bf755a5d78136fb5bec92e6fbc632`. All working evidence is outside Git at `/workspace/gp-evidence/rea-pass4/zoom-fallback/`. `function-ranges.json`, `helper-ranges.json`, and `group-ranges.json` retain exact source offsets, original addresses, next `LC_FUNCTION_STARTS` boundaries, lengths and individual hashes. `final-range-verification.json` verifies all 17 copied ranges against their original bytes and manifest hashes. No Prism code was executed.

## Confirmed bounded REA findings

| Original address | Finding | Evidence ID |
| --- | --- | --- |
| `0x10004599d` | Core minimum function returns 10. | `ev_6fc5259fcbe199a7062bbac4b4f5f2fa0ad305fcf9f16289b2bda5f5ddc4646a` |
| `0x1000459a8` | Core increment chooses the effective-value helper for unsigned mode values below 4, otherwise the integer helper, then sends its result to a setter. | `ev_38da1ffc2d7f964a325e21e0751a97344ec8045db44af6d187364c15f49dad4e` |
| `0x1003ae3c7` | Integer decrement maps 10→10, 25→10, 50→25, 75→50, 100→75, 150→100, 200→150, 400→200, 600→400, 800→600, 1000→800. Every other integer returns 100. | `ev_86b9e02dc415623a3088d7f02964a4b72066011276f3cecb0b30ace1edc21159` |
| `0x1003ae47b` | For finite effective values, increment selects the next strictly greater level from 10, 25, 50, 75, 100, 150, 200, 400, 600, 800, 1000, saturating at 1000. | `ev_4346117d70faefc57bdb1141ac87449e033c6730f4284601b1ecc7918e016c47` |
| `0x1003ae585` | Effective decrement has the unusual low-end behavior described below. | `ev_d04ca948723400760743722c6785fd4a6e335e86801ac0868f45dbe8f434c70c` |

For finite effective decrement input, descending tests return 1000 above 1000, 800 above 800, 600 above 600, 400 above 400, 200 above 200, 150 above 150, 100 above 100, and 75 above 75. The final branches return **25 for 50 < x ≤ 75, and 10 for x ≤ 50**. Thus 50→10, 60→25, and 75→25. This helper has no return of 50; these observations must not be silently replaced with a conventional level sequence. Non-finite input semantics were not reconciled.

`native-evidence-index.json` links the full responses, source identities, warnings, exports and closes. Both individual Core sessions and the contiguous helper session exported their evidence and closed successfully. The unchanged helper group spans `0x1003ae30f` through `0x1003ae66a`, 859 bytes, SHA-256 `5bf7c76167271462441b6f048b6e3b9046f0e12639ee820a9e01ab938b51c1a1`. `stepping-findings.json` records the numerical rules and their evidence boundary.

## Supplementary original-byte context

The separate format-aware resolver and original-address `objdump` output identify the Core globals as `_zoomFactor` and `_zoomValue`, and the selectors as `zoomFactor` and `setZoomFactor:`. These names come from original Mach-O metadata, not the raw import. The Core decompiler warns about overlapping globals and an unrecovered indirect tail jump; supplemental import metadata identifies that jump as `objc_msgSend`.

Supplementary disassembly suggests ordinary integer increment follows the level sequence above, with unknown integers returning 100; however, that function has no completed REA pseudocode record. It also suggests graph increment/decrement use the same mode-based helper dispatch. The graph pair was opened but cancelled before any completed answer, so its control-path applicability remains unconfirmed through REA.

The graph pinch range at `0x1011b08ee` appears to compute `zoomValue × (1 + magnification)` and clamp it to **50–1000** before a fixed-point setter. This is supplementary static evidence and is path-specific: it differs from the confirmed Core minimum of 10. It does not establish a universal minimum. `supplemental-context.json` and `graph-mode-jump-table.json` preserve exact original references, selector/ivar resolution, floating-constant bytes and jump-table entries. Fit modes, cursor anchoring, smart zoom, window routing, and flag meanings still require bounded REA confirmation and runtime comparison.

## Failures, cleanup and remaining scope

The earlier full-image attempt was cancelled after approximately 51 minutes without a first answer; `/workspace/gp-evidence/rea-pass4/native-full-image-attempt.json` records it. Its empty interrupted `zoom-minimum.json` is not Evidence. In this fallback, Core decrement opening failed a Java readiness cleanup check. The first helper address query, for integer increment, failed a Java preflight deadline. Subsequent distinct helper queries produced the three records above. Both failed responses are retained intact.

At the checkpoint the graph pair was intentionally cancelled through the REA MCP's graceful shutdown handler. Its client subsequently reported `Not connected` while attempting a final close; this is not an explicit successful close record. A process check confirmed all recorded worker, MCP and Java PIDs were absent, including the PID reported in the earlier cleanup failure. `checkpoint-status.json` records the exact checks, failure paths and pending queries. No retry remains running.

Headerless imports omit original globals, imports and unrelated function bodies. Next-start boundaries are bounded extraction evidence, not proof of source-level function completeness. Ghidra pseudocode is static analysis, not original source or observed runtime behavior. Ordinary integer increment, graph-control dispatch, complete clamping, fixed-point positioning, pinch/smart zoom, window routing, and native interaction behavior remain unresolved. No application behavior changed in this evidence pass.
