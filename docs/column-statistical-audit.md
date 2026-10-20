# Column statistical-analysis audit

Audit date: 2026-10-20 UTC.
Baseline: [PR #3](https://github.com/samgillman/GP/pull/3), merged commit
1fec4e165a5b35396e0c675e33e23161526948d2.

## Outcome and evidence boundary

The audit found consequential implementation errors as well as consequential
differences between an accurately computed approximation and an exact test.
The changes correct the repeated-measures post-test error term under assumed
sphericity, a highly unbalanced Dunnett integration failure and one-sided tail
selection. They add method-specific warnings, unsupported-option guards,
matched-data protections and saved-result revision handling.

**The changes do not certify GraphPad Prism equivalence.** Native numerical
evidence in this Column-comparison scope remains limited to one saved
two-tailed paired-t example. SciPy
agreement, exhaustive reference enumeration, mathematical identities and
successful application workflows are separate evidence classes. The
[native validation matrix](prism-native-validation-matrix.md) records the
specific missing native captures and their provenance requirements;
[column-comparisons.md](column-comparisons.md) describes current supported
methods and user-facing limits.

## Findings that can change scientific conclusions

### 1. Repeated-measures comparisons used the wrong error term in one mode

The merged implementation used each pair's differences for post-tests under
both sphericity settings. GraphPad's
[repeated-measures comparison guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_multiple_comparisons_after_rep.htm)
describes a common RM residual error term when sphericity is assumed and
pair-specific error terms otherwise.

An independently reproduced example uses six matched subjects:

- A: [0, 0, 0, 0, 0, 0]
- B: [1, 2, 1, 2, 1, 2]
- C: [−10, 10, −20, 20, −30, 30]

With sphericity assumed and Bonferroni adjustment over all three pairs, the
A–B P changes from **0.003343312624522266 to 1.0**. The common residual MS is
5483/30, with 10 residual df; its standard error for a difference is
sqrt(2 × (5483/30) / 6). The omnibus P, approximately 0.9757380366044285,
does not change. This is a numerical consequence of using the declared model,
not a new native Prism comparison.

GP now uses the pooled RM residual variance and df (n−1)(k−1) when sphericity
is assumed. In Geisser–Greenhouse mode, supported Bonferroni, Sidak and Fisher
comparisons use each pair's differences and n−1 df; epsilon applies to the
omnibus ANOVA. Tukey with pair-specific variances is rejected. The alternative
pair-specific calculation can legitimately retain the small A–B P under its
different assumptions. Users must choose the model on scientific grounds,
not select the mode that produces significance.

The regression verifies the pooled formula independently, the different
pair-specific result and refusal of the unsupported Tukey combination. Native
Prism outputs are still needed for both modes, including comparison SE, df,
P, CI and enabled methods.

### 2. Highly unbalanced Dunnett integration could cross alpha

The fixed numerical integration at the baseline could miss narrow conditional
probability transitions when a small control group was shared by much larger
treatment groups. For control N=2, two treatment groups with N=1000 each,
residual df=1999 and equal absolute standardized contrasts, an independent
baseline/current comparison gives:

| Absolute t for both contrasts | Baseline adjusted P | Audited adjusted P |
| ---: | ---: | ---: |
| 2.0 | 0.05319145189378982 | 0.048361234590529545 |
| 2.2 | 0.025223436061190263 | 0.02971340771933184 |

The first case crosses alpha 0.05. The correction uses adaptive integration in
the highly correlated regime, with a convergence check that rejects an
unreliable calculation instead of publishing it. The regression compares the
result with an independent multivariate-t integration using SciPy, a fixed
random generator and a sufficiently large integration budget. That is
independent numerical evidence, not an exact native oracle.

Related protections use the exact t identity for a one-comparison Dunnett
family and for a two-group studentized range, expand critical-value search
brackets instead of imposing the former fixed bound, and use selected low-df
studentized-range fallbacks. Stable Sidak evaluation preserves tiny nonzero
P values rather than losing them to subtraction roundoff.

**No universal integration-error guarantee is established.** GP still uses fast
quadrature in other regimes. An additional independent spot check near the
adaptive transition, with 29 treatments and unequal sample sizes, differed
from higher-order quadrature by about 7.4 × 10^-7 in coverage. The regression
and this check bound claims about tested cases; they do not validate every
sample-size ratio, tail, confidence level or family size. Further native and
independent cases are specified in the matrix.

### 3. A one-tailed P needs an explicit directional hypothesis

The former half-two-sided convention did not require the user to state the
predicted direction. A small result in the opposite direction could therefore
be presented as a small one-tailed P. The
[GraphPad one-tail FAQ](https://www.graphpad.com/support/faq/interpreting-one-tail-p-values/)
explicitly conditions its reported convention on the prediction being correct;
this does not remove the need to state that prediction.

GP now requires A-greater or B-greater for one-tailed analyses. Reversing the
displayed difference changes the effect and interval signs while retaining
the chosen alternative and P. Opposite-direction observations give the
appropriate large selected-tail probability. Previously saved one-tailed
parameters without an alternative cannot be recalculated until completed.

Exact discrete tails require additional care. When a two-sided P is capped at
1, halving it can be wrong even without ties. New central examples have
two-sided P=1 but selected one-sided probabilities 4/6 for Mann–Whitney and
9/16 for Wilcoxon. The regression expectations count the relevant outcomes and
include the observed statistic in the tail. Continuous-distribution complement rules
must not be applied to discrete tails while ignoring their shared point mass.

Intervals remain two-sided and can disagree with a one-tailed decision.
The explicit-direction contract is a GP safeguard; it is not a claim to
reproduce native Prism's directional UI or saved-output conventions.

### 4. Small-sample approximations can reverse a decision in either direction

The following exact probabilities were independently enumerated under the
stated rank or sign randomization, retaining tied observations as distinct
experimental units. They are **not Prism outputs**.

| Procedure and complete input | GP approximation P | Exact reference P | Decision at alpha 0.05 |
| --- | ---: | ---: | --- |
| Mann–Whitney: A [1,1,1], B [2,2,2] | 0.04685417760387376 | 2 / choose(6,3) = 0.1 | Approximation rejects; exact does not |
| Wilcoxon: A six zeros, B [1,1,1,1,1,0]; discard the zero difference | 0.025347318677468252 | 2 / 2^5 = 0.0625 | Approximation rejects; exact does not |
| Kruskal–Wallis: A [1,2], B [3,4], C [5,6,7] | 0.06866117151308508 | 6 / 210 = 0.02857142857142857 | Exact rejects; approximation does not |
| Kruskal–Wallis with ties: A [2,3], B [2,3], C [1,1,1] | 0.08045960674953244 | 6 / 210 = 0.02857142857142857 | Exact rejects; approximation does not |
| Friedman with ties: three rows, each [1,1,2] | 0.04978706836786395 | 24 / 216 = 1/9 | Approximation rejects; exact does not |
| Friedman: rows [1,2,3,4] and [2,3,4,5] | 0.11161022509471268 | 24 / 576 = 1/24 | Exact rejects; approximation does not |

Mann–Whitney uses distance of the rank sum from its null center.
Wilcoxon enumerates signs of the five nonzero ranked differences.
Kruskal–Wallis preserves group sizes and counts H at least as large as observed.
Friedman permutes treatment labels independently within each subject and counts
statistics at least as large as observed. Tied value permutations have their
correct labelled multiplicities.

These exact calculations rely on the stated null exchangeability and
independent experimental units. They are not justification for arbitrary
permutation of clustered or dependent observations, nor universal tests of
median equality. The cases demonstrate a real possibility of changed
conclusions; they do not estimate its frequency in a scientific population.

The implementation retains its current approximations but now discloses their
method, relevant ties and small-sample risk before calculation and in results.
The regressions protect both the numerical result and its warning. Converting
a tied SciPy call to its ordinary untied “exact” distribution would not solve
the problem: the official
[Mann–Whitney](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.mannwhitneyu.html)
and [Wilcoxon](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.wilcoxon.html)
documentation distinguishes those distributions from tie-aware permutation.

## Safeguards against misleading interpretation

| Risk | Safeguard and regression scope |
| --- | --- |
| Partial repeated-measures rows silently deleted or treated as a mixed model | RM ANOVA and Friedman reject incomplete subjects, including ragged trailing rows. All-empty padding is ignored. No mixed-effects/REML fit is claimed. |
| Paired test and descriptive table summarize different subjects | The paired results summary uses complete row pairs and reports complete/incomplete counts. Wilcoxon separately reports discarded zero differences. API tests check the population. |
| A plotted mean and its CI use different observations | A separate raw graph summary keeps source-column mean and error bar consistent. Results-table descriptions remain matched. The warning explains that an unmatched raw observation may appear on a graph without entering the paired test. |
| Dunn correction described as one formula for all designs | Kruskal–Wallis/Dunn uses pooled ranks with tie-corrected SE; Friedman/Dunn uses within-subject ranks and the untied reference SE without an extra tie reduction. Both use normal approximations and Bonferroni over the requested family. |
| Fisher LSD mistaken for a corrected procedure | Tables say unadjusted P and the dialog/results disclose no familywise control and no significant-omnibus gate. Intervals are individual. |
| An unsupported correction silently replaced after a design change | Explicit incompatible methods, scopes and control choices remain visible and block submission. Unknown stored/API values fail validation. Missing options may receive a default; explicit unsupported choices do not. |
| Stars, confidence intervals and selected alpha imply the same criterion | Results expose alpha and confidence separately. Fixed star thresholds remain visible; decisions and hidden-bracket filtering use full-precision P < alpha. A confidence mismatch or one-sided decision is disclosed. |
| Hiding graph brackets changes the inferred comparison family | The requested family controls adjustment regardless of displayed brackets. Context identifies method and family. Graph exports do not embed the new HTML context caption; authors must include test and correction in the figure legend. |
| Saved pre-fix results silently appear current | Revision-2 calculation outputs distinguish the audited engine. Old ordinary outputs become stale. Frozen historical outputs retain their values with a visible warning; unfreezing makes them stale. |

Unsupported procedures remain unsupported: mixed-effects/REML, lognormal
tests, Pratt or split-zero Wilcoxon handling, selected-pair families,
Holm–Sidak, FDR, Newman–Keuls, Dunnett T3 and Tamhane T2. These are not alternate
names for the implemented procedures. In particular, offering Games–Howell
does not provide Prism's documented small-sample Dunnett T3 option.
[GraphPad's options guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_options_tab_1wayanova.htm)
distinguishes these methods.

The [GraphPad Dunn formulas](https://www.graphpad.com/guides/prism/latest/statistics/stat_how_the_dunn_method_for_nonpar.htm)
support the two SE descriptions above. They remain guide evidence pending
native tied post-test output.

## Additional numerical and source qualifications

Repeated-measures sums of squares are computed from centered effects to reduce
cancellation from large subject offsets. Normalizing within-subject values
before forming and squaring the covariance prevents epsilon underflow or
overflow under tested changes of measurement units (10^-90 and 10^90).
Regressions check invariant F, epsilon and P, in addition to the paired-t
identity for a two-condition RM model.

Brown–Forsythe ANOVA for means uses the original k−1 numerator df. The
[GraphPad guide](https://www.graphpad.com/guides/prism/latest/statistics/interpreting_welch_browne-forsythe_tests.htm)
describes that convention. A library that implements the Mehrotra correction
is not an interchangeable oracle, and agreement with it should not be forced
without identifying the target formula.

The [Mann–Whitney guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_mann-whitney_test_works.htm)
uses both “100 or fewer” and “fewer than 100” descriptions. The 99/100/101
boundary remains explicitly unresolved. The
[Kruskal–Wallis guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_kruskal-wallis_test_works.htm)
contains a blanket small-total-N claim that the independently enumerated
unequal-group N=7 example contradicts. Neither statement is used as an
unqualified numerical oracle. Current guide headings identify Prism 11,
but a current web heading does not establish behavior of a specific binary.

## Validation of this change set

Local coordinating validation completed:

- 330 backend tests passed, with the pre-existing Starlette/httpx deprecation
  warning.
- 176 individual frontend tests passed across 18 test files.
- Server build and type checking passed.
- Static Vite build and browser-runtime packaging passed, including 19 verified
  runtime package checksums.

New numerical tests cover exact small-case enumeration, tied/zero ranks,
central one-sided discrete tails, directional alternatives, missing matched
rows, RM error terms and numerical invariance, Dunn family accounting,
Fisher labels, stable Sidak tails, low-df critical intervals, highly unbalanced
Dunnett and separate alpha/confidence settings. API tests check exclusions,
unsupported options, ambiguous legacy one-sided requests and missing RM errors.
Frontend tests check disclosures, parameter preservation/refusal, full-precision
bracket filtering, graph summaries and historical result invalidation.

### Fresh CI and packaged browser validation

The audit code at commit dbea1698d117d43aea18fb2108f2f7594cb97081 in
[draft PR #4](https://github.com/samgillman/GP/pull/4) passed
[run 39371008134](https://github.com/samgillman/GP/actions/runs/39371008134),
[job 118458637647](https://github.com/samgillman/GP/actions/runs/39371008134/job/118458637647).
The decoded job log independently confirms 330 backend passes (one existing
warning, 8.16 seconds), 176 frontend passes with zero failures, successful
server/static builds and 19 verified static runtime packages.

The extended Column script logged **19 successful scenarios on each build**:
static at 04:47:10–37 UTC and server at 04:47:39–48 UTC on October 20.
Both runs reached the final workflow confirmation after the no-page-errors
assertion. The additions cover alpha-dependent bracket visibility without
changing the correction family, explicit one-tailed direction, historical
cache recalculation, tied Mann–Whitney/small Kruskal–Wallis/tied Friedman
warnings, the highly unbalanced Dunnett decision, pooled RM comparisons and
visible refusal of incomplete subjects. The job finished successfully at
04:48:21 UTC. The other existing application browser checks also passed.

The uploaded browser-evidence artifact has ID 12241855332, size 1,721,066 bytes
and GitHub SHA-256 digest
4fe1d01fe5bc7f1d9eb6d701ae905074b3d2f93639e2a30d719db25d0466f55a.
The downloaded archive's bytes match that digest. Both Column JSON reports
were inspected and contain 19 checks each. The unbalanced Dunnett P is
0.04836123459052499 in static and 0.048361234590529545 on server; pooled RM P=1
and the opposite-direction one-tailed P=0.9655517861960418 in both.

Two static-build screenshots were visually reviewed: the tied Mann–Whitney
result visibly identifies its approximate P=0.0469, ties and small-sample risk,
with native-equivalence limitations above the table; the unsupported RM Tukey
dialog retains the requested method, shows the explanatory alert and disables
OK. The inspected text is legible without visible overlap or clipping.
This review covers those two images and the two Column JSON files, not all
archive members. Local Chromium downloads returned incomplete archives, so
successful new browser evidence comes from CI, not a local run.

These results apply to the named code commit. This documentation-only update
records that run; it does not claim that a later documentation commit has
separately completed CI. None of these browser assertions adds native Prism
numerical evidence.

## Original merge CI evidence

The original
[merge run 39335578778](https://github.com/samgillman/GP/actions/runs/39335578778)
and [job 118344131420](https://github.com/samgillman/GP/actions/runs/39335578778/job/118344131420)
were inspected. On merged commit 1fec4e165a5b35396e0c675e33e23161526948d2,
the decoded job log records Python 3.12.15 and SciPy 1.17.0, 296 backend passes,
163 frontend passes, both builds, 19 verified runtime packages and ten Column
browser scenarios on each static and server build. The scenario script asserts
no page errors before successful completion. The PR-head workflow also passed.

This resolves the October 19 uncertainty about whether the external runtime
download and static browser validation succeeded in CI. It does not establish
production deployment state or the success of the audit's new scenarios.
The native matrix records timestamps, artifact ID, size and digest. Artifact
metadata and download availability were checked; individual archive contents
were not all independently inspected.

## Remaining native validation

The only native numerical fixture in this Column-comparison scope remains the
saved two-tailed paired-t case.
No new native artifact analysis or REA Evidence IDs are claimed.

The matrix requests exact input data, all parameter pages, full-precision
results, method/approximation labels, warnings, version/build/OS and artifact
hashes for tied and threshold-boundary rank tests, zero handling, incomplete
subjects, both RM post-test models, Brown–Forsythe df, correction families,
alpha/CI behavior, directional hypotheses and numerical stress cases. Rounded
screenshots alone cannot settle numerical equivalence.

Until those outputs exist, a result can be described as independently checked
for its stated method, as an approximation with disclosed limits, or as an
unverified Prism comparison. Those are different claims and must remain
different in the UI, documentation and requirement records.
