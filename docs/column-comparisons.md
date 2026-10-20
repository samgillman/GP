# Column t tests, one-way ANOVA and pairwise comparisons

GP provides a Column-table workflow with an analysis-family selector, parameter
dialogs, tabbed results and graph significance brackets. The controls and some
presentation conventions are informed by Prism resources and documentation.
**Passing GP tests does not establish GraphPad Prism equivalence.** Only one
saved paired-t example has been compared with native Prism numerical output.

This document describes the audited implementation. The
[statistical audit](column-statistical-audit.md) records consequential findings,
regression cases and verification. The
[native validation matrix](prism-native-validation-matrix.md) specifies the
missing Prism datasets, settings and outputs.

## Evidence and its limits

| Evidence | What it establishes |
| --- | --- |
| Saved Prism paired-t result in [prism-resources.md](prism-resources.md) | One two-tailed paired-t dataset with reversed difference, alpha 0.05: difference −9.466666666666667; CI [−16.424025314361142, −2.509308018972191]; t 2.918346124408894; df 14; P 0.011227414728918878. The saved-output regression reproduces these values. |
| Earlier static resources and metadata in [prism-resources.md](prism-resources.md) and [prism-native-map.md](prism-native-map.md) | Option surfaces in TTests.nib and OneWayANOVA.nib and candidate controller entry points. These do not establish defaults, enablement, algorithms or numerical parity. The earlier [REA UI pass](prism-ui-rea-evidence.md) decoded other archives, not these two dialogs. |
| Independent calculations | SciPy comparisons, exact enumeration of tiny reference problems and mathematical identities test specified calculations. They do not establish that Prism chooses the same calculation. |
| GraphPad guides and support pages | Publicly documented behavior that motivates safeguards and native comparisons. The current pages include ambiguous thresholds and legacy prose; they are not native runtime evidence. |
| Original merge CI logs | Builds, unit tests and listed browser assertions passed on the original merged commit. Current audit validation is recorded separately below. |

The October 19 implementation read the morluto/rea skill at version 6.7.0,
commit b4938aed58737293a6987630476632619713f5cd, and reused existing resource
evidence. Neither that implementation nor this audit had the necessary native
application artifacts or a running Prism installation to add numerical
comparisons. **No new REA Evidence IDs or native-parity claims are made.**
Proprietary source artifacts remain outside Git.

## Tests and inferential choices

| Procedure | Current GP behavior and limitations |
| --- | --- |
| Student, Welch and paired t | Standard parametric calculations, independently checked against SciPy and identities. One-tailed analyses require an explicit, prespecified A-greater or B-greater alternative. Reversing the displayed subtraction does not change that hypothesis. Intervals remain two-sided. Paired analyses use complete row pairs and report exclusions. |
| Mann–Whitney | Exact untied distribution only when both groups have at most 50 observations; otherwise tie-corrected normal approximation with continuity correction. Method and ties are reported. A stronger warning accompanies small approximate cases. GraphPad describes exact calculations with ties and a different smaller-group threshold; the guide is inconsistent at 100, so that boundary remains a native question. |
| Wilcoxon matched pairs | Zero differences are discarded. Untied nonzero absolute differences use the exact signed-rank distribution through 50 pairs; other cases use a normal approximation without continuity correction. Effective pairs, zeros and method are reported. Ties, small effective N and subtraction roundoff are disclosed. Prism's documented tied exact calculations and Pratt zero handling are not implemented. The inferential assumption includes symmetry of the paired differences. |
| Ordinary one-way ANOVA | Pooled residual variance, with a Brown–Forsythe test of equal SDs and corrected Bartlett test when each group has at least five values. The equal-SD diagnostic is a different procedure from Brown–Forsythe ANOVA for means. |
| Welch / Brown–Forsythe ANOVA for means | Unequal-variance omnibus calculations. Brown–Forsythe uses the original numerator df k−1, as described in GraphPad's guide; a comparator using the Mehrotra numerator correction is a different method. Native version-specific output remains needed. |
| Repeated-measures ANOVA | Complete matched rows only. Sphericity assumed and Geisser–Greenhouse modes have distinct post-test variance models, described below. Partial subject rows are rejected; GP does not fit a mixed model. Centered sums of squares and normalized covariance calculation improve invariance to large subject offsets and changes in units. |
| Kruskal–Wallis | Tie-corrected H with a chi-square P for every design. Every result identifies the approximation; groups smaller than five receive a small-sample warning. This can disagree in significance with an exact permutation calculation, including for seven total observations. It tests distributions/ranks; a median-only interpretation requires comparable distribution shapes. |
| Friedman | At least three matched columns, complete subject rows, tie-corrected statistic and chi-square P. Small-sample approximation warnings apply when there are at most ten subjects or at most six conditions. GP does not implement Prism's documented small-table exact permutation calculation. |

Here “exact” refers to a specified statistical reference distribution, not
verified agreement with native Prism. An accurate implementation of an
approximation may still give a different scientific decision from an exact
test. The audit includes explicit examples in both directions.

## Multiple comparisons

The comparison family is the requested all-pairs or control family. Its size is
reported. Hiding a bracket or a non-significant comparison does not shrink the
family or recalculate a correction.

| Design | Available comparisons and error model |
| --- | --- |
| Ordinary ANOVA, all pairs | Tukey, Bonferroni, Sidak and Fisher LSD; pooled residual MS and residual df. |
| Ordinary ANOVA, versus control | Dunnett, Bonferroni, Sidak and Fisher LSD; pooled residual MS and residual df. |
| Repeated measures, sphericity assumed | Tukey for all pairs; Bonferroni, Sidak and Fisher LSD for all pairs or versus control. The common RM residual MS and df (n−1)(k−1) determine the standard errors and tests. |
| Repeated measures, Geisser–Greenhouse | Bonferroni, Sidak and Fisher LSD on each pair's differences, with n−1 df. Epsilon corrects the omnibus test, not these paired comparisons. Tukey with this pair-specific variance model is rejected. |
| Unequal-variance ANOVA | Games–Howell, all pairs only, using separate variances and approximate df. Control-only families, Dunnett T3 and Tamhane T2 remain unsupported. |
| Kruskal–Wallis / Dunn | Pooled ranks across all selected columns; tie-corrected rank variance; normal z approximation and Bonferroni adjustment over the requested family. Selecting control comparisons does not remove other columns from the rank calculation. |
| Friedman / Dunn | Ranks within each subject; sum-rank standard error sqrt(n k (k+1) / 6), without an additional tie reduction of that reference SE; normal z approximation and Bonferroni adjustment. Average ranks still account for within-row ties. Native tied post-test output is needed. |

**Fisher LSD reports unadjusted P values and individual confidence intervals.**
It does not control the familywise error rate for the requested comparisons.
GP does not require a significant omnibus test before presenting Fisher
comparisons; this choice is disclosed in the dialog and results.

Tukey, Games–Howell and Dunnett use numerical distribution calculations.
The audit adds adaptive treatment of highly correlated Dunnett contrasts,
two-group t identities, expanding critical-value brackets and selected low-df
studentized-range fallbacks. The independent checks cover named numerical
regimes; **there is no universal quadrature error or Prism-equivalence
guarantee**. Sidak uses a stable expression that preserves very small nonzero
P values.

## Direction, alpha, confidence intervals and graph labels

A directional hypothesis must be chosen before looking at the result. GP
requires it explicitly for one-tailed analyses and computes the probability for
that chosen direction even when the observed effect is opposite. Legacy
one-tailed parameters without a direction must be completed before
recalculation. A display-only difference reversal changes the effect and
interval sign, not the alternative or P value. Discrete exact tests use the
actual selected tail, including its observed-statistic point mass, rather than
halving a capped two-sided P.

The browser currently requests two-sided 95% confidence intervals. The analysis
API accepts a separate confidence level; results record it. Significance
decisions use the chosen alpha, and a notice explains when the confidence
level is not 1−alpha. A one-tailed decision and a two-sided interval need not
agree even at their usual default levels.

Asterisks retain fixed thresholds at 0.05, 0.01, 0.001 and 0.0001. Significance
decisions and the graph's hide-non-significant filter use the full-precision
P < alpha. Thus a star is not an assertion of significance at every selected
alpha. Rounded or clipped GraphPad-style P text never drives that decision.
The linked analysis and comparison dialog expose the method, correction,
approximation status and family context; graph legends supplied for publication
must still state the actual test and correction. A bracket alone is not
evidence of Prism equivalence.

## Matched data and descriptive populations

Rows define subjects. A paired t or Wilcoxon analysis uses complete row pairs,
reports the complete and incomplete pair counts, and reports descriptive
statistics for those same complete pairs. Wilcoxon additionally distinguishes
zero differences discarded by its rank test.

Repeated-measures ANOVA and Friedman reject any partial subject row, including a
ragged trailing row. Completely empty padding rows are ignored. Missingness is
not silently treated as a mixed-effects fit.

Graphs continue to summarize the non-excluded source observations in each
column. If a paired analysis omits incomplete pairs, that raw graphical
population can differ from the matched results-table population. GP retains a
separate graph summary so that the plotted mean and its error bar use the same
raw observations, and the results disclose the distinction. A graph attached to
a paired result does not by itself establish that every plotted observation
entered the test.

## Unsupported choices and saved results

Unsupported procedures include mixed-effects/REML models, lognormal tests,
Pratt or split-zero Wilcoxon handling, selected-pair comparison families,
Holm–Sidak, FDR, Newman–Keuls, Dunnett T3 and Tamhane T2. Unsupported combinations
within supported methods are also rejected, including pair-specific RM Tukey
and control-only unequal-variance comparisons.

An explicit unsupported method or comparison scope is preserved for review in
the parameter dialog and blocks submission; GP does not silently choose a
different supported correction. Unknown API or workbook option values fail
validation. Default selection applies only when an option was not supplied.

New t-test and one-way results carry analysis revision 2. When a workbook
contains an older ordinary result, GP marks it stale and recalculates rather
than relabeling its cached output. A frozen historical result remains frozen
and carries a visible warning in results and linked graph context. Unfreezing
marks it stale. Frozen historical output does not become validated merely
because a current application displays it.

## Verification status

The original merge workflow reported 296 backend and 163 frontend tests.
Inspection of its job log confirms successful server and static builds,
19 verified static runtime packages, and ten Column browser scenarios on
**each** build. This closes the original uncertainty about whether static CI
ran successfully; it does not add a native Prism comparison.

For the audit code at commit
dbea1698d117d43aea18fb2108f2f7594cb97081, the
[fresh CI run 39371008134](https://github.com/samgillman/GP/actions/runs/39371008134)
and [job 118458637647](https://github.com/samgillman/GP/actions/runs/39371008134/job/118458637647)
passed **330 backend tests**, with the existing Starlette/httpx deprecation
warning, and **176 individual frontend tests**. Both builds and type checking
passed; static packaging verified 19 runtime packages. The extended Column
script passed **19 scenarios on the static build and 19 on the server build**,
including the unbalanced Dunnett calculation and the scientific safeguards.
Local tests and builds also passed, but the local Chromium download returned
incomplete archives; the successful new browser evidence comes from CI.

The uploaded browser-evidence archive was downloaded and its SHA-256 verified.
Both Column JSON reports were inspected, along with two static-build
screenshots showing the tied Mann–Whitney disclosure and the disabled
unsupported RM Tukey choice. The [native matrix](prism-native-validation-matrix.md)
records the artifact ID, size, digest and exact inspection scope. These
assertions apply to the named code commit. This later
documentation-only update records that completed run and does not claim a
separate completed CI run on a subsequent documentation commit.

Numerical regressions are in tests/test_column_audit.py and
tests/test_column_tests.py; API behavior is covered by
tests/test_column_api_audit.py. Frontend coverage includes column-analysis,
analysis-version, workbook and plot-geometry tests. These establish the
specific calculations and safeguards tested, with the limits recorded in the
[audit](column-statistical-audit.md) and
[native matrix](prism-native-validation-matrix.md).

## Primary references

- [GraphPad Mann–Whitney calculation and ties](https://www.graphpad.com/guides/prism/latest/statistics/how_the_mann-whitney_test_works.htm)
- [GraphPad Wilcoxon calculation and zero handling](https://www.graphpad.com/guides/prism/latest/statistics/how_the_wilcoxon_matched_pairs_test_works.htm)
- [GraphPad Kruskal–Wallis calculation](https://www.graphpad.com/guides/prism/latest/statistics/how_the_kruskal-wallis_test_works.htm)
- [GraphPad Friedman calculation](https://www.graphpad.com/guides/prism/latest/statistics/how_the_friedman_test_works.htm)
- [GraphPad repeated-measures comparisons](https://www.graphpad.com/guides/prism/latest/statistics/stat_multiple_comparisons_after_rep.htm)
- [GraphPad Dunn formulas](https://www.graphpad.com/guides/prism/latest/statistics/stat_how_the_dunn_method_for_nonpar.htm)
- [GraphPad Welch and Brown–Forsythe interpretation](https://www.graphpad.com/guides/prism/latest/statistics/interpreting_welch_browne-forsythe_tests.htm)
- [GraphPad comparison options](https://www.graphpad.com/guides/prism/latest/statistics/stat_options_tab_1wayanova.htm)
- [GraphPad one-tailed P interpretation](https://www.graphpad.com/support/faq/interpreting-one-tail-p-values/)
- [SciPy 1.17 Mann–Whitney](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.mannwhitneyu.html), [Wilcoxon](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.wilcoxon.html), [Kruskal–Wallis](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.kruskal.html) and [Friedman](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.friedmanchisquare.html)
