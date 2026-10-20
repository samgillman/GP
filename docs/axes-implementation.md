# Persistent axis formatting

This change adds a working subset of Format Axes, guided by the actual retained
REA resource evidence in [prism-axes-rea-evidence.md](prism-axes-rea-evidence.md).
It does not establish native Prism parity.

Double-clicking an axis or its ticks opens the corresponding X or Left Y tab.
The Change menu and Axes toolbar button also open the editor. Controls persist
linear/log10 scale, optional manual bounds, a linear major interval, reversal,
axis visibility, major grids and title text. Apply keeps the dialog open; OK
closes after validation. Cancel discards changes since the last application.
Each successful application participates in workbook undo history.

The optional graph `axes` object preserves old workbooks without migration.
Graph formatting does not edit source values or analysis parameters. Duplicates
retain their settings. Frozen graph snapshots keep their captured table and
formatting when a live XY table is converted to Column; live numeric X settings
reset while direction, visibility, grids and Y settings remain.

Browser geometry and SVG/PNG/PDF exports interpret the settings. Manual limits
clip plotted marks and hit targets. Nonpositive coordinates cannot be drawn on
log axes; the underlying observations remain in analyses and statistical
summaries. Error intervals are clipped without replacing full-population means
or quartiles. Logarithmic bars start at the lower viewport bound, disclosed in
the browser. Exported artwork does not include the explanatory browser notes.
The browser and exporter retain their distinct rendering engines.
The existing 20,000-cell export limit remains; the 300,000-cell graph interaction
tests do not imply that exports support that larger size.

## Explicit GP choices and unfinished work

- Explicit decimal numbering supports 0–9 fixed places, the archived period,
  comma and middot decimal separators, the archived ungrouped/comma/space/
  apostrophe thousands choices, and literal prefixes/suffixes up to 32 Unicode
  codepoints. These are GP support limits, not established Prism maxima.
- Explicit rounding uses the shortest decimal representation, rounds ties away
  from zero, retains trailing zeros and suppresses negative zero. Browser BigInt
  arithmetic and Python Decimal implement this GP rule. Automatic numbering
  remains the legacy formatter; no native automatic precision rule is claimed.
- Prefixes/suffixes are plain text, including dollar signs and backslashes.
  Invalid XML characters are rejected: an actual NUL/U+0001 prefix probe produced
  SVG bytes that could not be parsed. Valid XML Unicode, emoji and whitespace
  remain accepted; this is GP export validation, not a recovered native rule.
  Explicit export formatting suppresses minor-tick labels so only the configured
  major labels appear. Distinct decimal/thousands separators are required.
- Scientific, Power of 10, Antilog, automatic native precision, and custom
  precision beyond this subset remain open. Long fixed labels still use existing
  page margins and may overflow the browser graph page; automatic layout fitting
  is not implemented.
- Blank bounds mean automatic independently; this is not a recovered native
  automatic/manual flag. The native disabled-field behavior is not reproduced.
- Linear intervals are zero-anchored with at most 200 generated ticks.
- Automatic range/tick algorithms and numerical validation are independently
  implemented GP behavior, not recovered Prism algorithms.
- Right Y axes, frame/origin pages, minor ticks, custom starting ticks, tick
  formatting, log2/ln/probability scales, segmented axes and full font controls
  remain open in G060–G072.
- Raw observation log omissions are disclosed. A fit-only nonpositive segment
  is correctly broken but does not independently trigger an omission note.
- Passing implementation tests does not verify macOS appearance or runtime
  behavior. No running Prism reference is available here.

## Reproducible checks

- `npm --prefix web run typecheck`
- From `web`: `node --experimental-strip-types --test --test-isolation=none src/*.test.ts`
- `python -m pytest tests/test_axes_export.py`
- `GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_axes.py URL`
- `python3 scripts/check_requirements.py`

The browser script checks actual double-click entry, correct tabs, invalid-range
rejection, reversed ticks, hostile title text, unchanged source data, reload and
Cancel. Geometry tests cover logarithmic summaries and 300,000-point clipping.
Export tests inspect model validation, numerical geometry, and real output.
The browser check also exercises undo/redo and downloads all three export
formats. A cold static runtime can take several minutes on this workspace;
the test allows five minutes per export, as does the existing Column workflow
check. A timeout is reported as a failure, never counted as a passing export.
`GP_AXES_EXPORT_TIMEOUT` overrides that allowance in milliseconds when diagnosing
a constrained host; record the override with the result.
