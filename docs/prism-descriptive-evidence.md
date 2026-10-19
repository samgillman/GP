# Saved Prism descriptive-statistics comparison

GP's existing descriptive fields match the supplied Prism geometric-mean example. The recoverable gap is additional output and configuration, rather than a discrepancy in the current mean/SD/SEM calculations. This comparison uses saved results bundled in the installer; it does not execute Prism.

## Source identity and mapping

Archive: `Contents/SharedSupport/Portfolio/Graphs to explore/Geometric mean.pzt`.

- Archive SHA-256: `ea28cc2fb2c2db0886a6338c97db2e1c5b77573a04757140d09bf4634556eb67`.
- Analysis: `analyses/FCF1C323-1CB1-46FD-BD40-1A13DF5A60B3/`.
- Parameter JSON SHA-256: `fd4ac0c0acc071b890be91206f92324374aa90c82dcaf95a80919cedab0f7931`.
- Result JSON SHA-256: `b9a334e09328a3b02d3db3ddf8c6026876b8c9a8253f8c7f4d427aa3bcf11787`.
- Input CSV: `data/tables/5FC5F5B6-4829-4522-8FDE-062CCE274C68/data.csv`; SHA-256 `242a2bdcb8f961710fb08d7e3134c2e9ea6d1674ed3ecaed5dedb2c98455b2a9`.

The CSV has a leading blank row-title field, even though row titles are hidden in the saved sheet. Numeric fields 1 and 2 map to Control and Treated through the sheet's ordered dataset references. Each has 14 positive observations, a single subcolumn, and no missing/excluded values. Ignoring the leading field would shift every value into the wrong series.

The full source-bound comparison is `/workspace/gp-evidence/resources-pass2/gp-descriptive-oracle-comparison.json`. It includes exact input values, member hashes, saved options, all numerical checks, quantile alternatives, current GP source hashes and package versions. Reproduce with:

```bash
/workspace/GP/.venv/bin/python /workspace/gp-evidence/resources-pass2/compare_descriptive_oracle.py
```

## What the saved options establish

The example requests sum, geometric mean and geometric-mean confidence intervals, with confidence level 95%, percentile level 90%, four significant digits and replicate handling `AVERAGE`. Other descriptive checkboxes, normality tests and one-sample tests are disabled.

Nevertheless, structured `results.json` contains arithmetic summaries, quartiles, skewness/kurtosis, QC lines and geometric outputs. The visible saved result table contains only count, geometric mean, geometric SD factor, geometric-mean CI and sum. This distinction matters: the saved settings select displayed results; disabled fields are not necessarily absent from the stored computation.

`AVERAGE` cannot establish the averaging algorithm here because every row has exactly one replicate. Likewise, four significant digits affect the visible text table while the stored numerical values retain precision.

## Current GP comparison

All **18 comparisons** pass at relative and absolute tolerance `1e-12`: n, mean, sample SD, SEM, median, minimum, maximum and the two mean-CI endpoints, for both columns. Maximum absolute difference is **1.14 × 10⁻¹³**. No discrepancy was found in those implemented outputs for this fixture.

For example, Control has mean 119.71428571428571, sample SD 184.60328714942654 and a 95% mean interval from 13.127521023498034 to 226.3010504050734. These values agree with sample SD (`ddof=1`) and a Student-t interval with 13 degrees of freedom.

## Recoverable outputs missing from GP

Independent candidate formulas reproduce **38 additional stored numerical values**, with maximum absolute difference **1.42 × 10⁻¹³**. They provide concrete next implementation targets.

| Output | Formula consistent with both saved columns |
|---|---|
| Sum, range | Sum of observations; maximum minus minimum |
| Coefficient of variation | `100 × sample SD / arithmetic mean` |
| Skewness | Adjusted Fisher–Pearson skewness (`scipy.stats.skew(..., bias=False)`) |
| Kurtosis | Unbiased excess kurtosis (`scipy.stats.kurtosis(..., fisher=True, bias=False)`) |
| Quartiles/percentiles | Hyndman–Fan type 6, equivalent to NumPy `method="weibull"` |
| Geometric mean | `exp(mean(log(x)))` |
| Geometric SD factor | `exp(sample SD(log(x)))` |
| Geometric-mean CI | Exponentiated Student-t interval of the log values |
| QC lines | Arithmetic mean ± 1, 2 and 3 sample SDs |

These are empirically corroborated formulas for this saved example. They do not establish all sample-size, missing-data, tied-value or extreme-number conventions.

The geometric means are 35.54819883822085 and 51.99641022615932; geometric SD factors are 6.798249751736781 and 6.248995157046956. Their 95% intervals are [11.75454478657362, 107.505178940242] and [18.050375409870014, 149.78229621355646].

## Quantile convention worth preserving

The observed quartiles differ substantially from NumPy's default linear interpolation:

| Column | Saved Q1 / Q3 | NumPy `linear` Q1 / Q3 |
|---|---|---|
| Control | 7.75 / 138.75 | 12.75 / 105.5 |
| Treated | 12.25 / 311.25 | 15.75 / 200.25 |

The saved values match interpolation at one-based rank `(n+1) × p`, implemented by `method="weibull"`. Nine NumPy quantile methods were compared in the evidence file. The saved `percentileLevel=90` corresponds here to lower **10th** and upper **90th** percentiles, not the 5th and 95th percentiles of a central 90% interval. Saved bounds are [1.5, 505.5] and [3.5, 732.0].

GP's current graph preview uses interpolation at zero-based position `(n−1) × p`; its Matplotlib boxplot export also uses conventional linear percentiles. That differs from these saved descriptive quartiles. It is a candidate graph-compatibility issue, **not proof** that Prism's box geometry uses the same convention as its descriptive statistics. Graph behavior needs its own source or saved-output evidence before changing the renderer.

## Domain evidence and remaining tests

Packaged localization `Resources/en.lproj/CoreLegacy.strings`, key `1587`, states that geometric mean/SD factor and harmonic mean cannot be computed for datasets containing zero or negative values. The comparison JSON records the source hash and character offset. This supports an explicit domain restriction; it does not show whether the UI rejects an entire analysis, omits selected outputs, or displays a per-result diagnostic.

Before treating the next implementation as broadly equivalent, resolve and test:

- Nonpositive inputs, overflow/underflow and very large dynamic ranges.
- Minimum n and undefined cases for sample SD, skewness, kurtosis and confidence intervals.
- Type-6 percentile endpoints, small samples and ties.
- Replicate averaging versus per-subcolumn summaries, exclusions and missing rows.
- Confidence-level selection, enabled-output behavior and visible significant-digit formatting.
- Graph geometric summaries and their multiplicative error representation separately from arithmetic plots.

No GP statistical code or coverage-ledger entries were changed in this investigation.
