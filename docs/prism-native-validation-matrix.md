# Native Prism validation matrix and reference evidence

Audit date: 2026-10-20 UTC.
Baseline: PR [#3](https://github.com/samgillman/GP/pull/3), merged commit
`1fec4e165a5b35396e0c675e33e23161526948d2`.

This is an acquisition plan for **missing native evidence**, not a record of
Prism runs. The only saved native numerical oracle in this Column-comparison
scope is the paired-t example in `prism-resources.md`. All numbers identified below as exact
enumeration are independent statistical benchmarks, not Prism outputs.
No new Prism artifacts were analyzed with REA and no new REA Evidence IDs are
claimed. Existing static resources establish option surfaces, not calculations.

## Evidence classes

| Class | What it establishes | What it does not establish |
| --- | --- | --- |
| Original CI logs | Listed builds and assertions succeeded on that commit | Numerical completeness, native Prism behavior, deployed production state |
| SciPy or closed-form agreement | Correctness for the specified calculation and inputs | Selection of the same method, defaults or correction as Prism |
| Exhaustive label/sign enumeration | An exact conditional reference distribution for the stated null and exchangeability assumptions | Prism's two-sided convention, thresholds or actual saved output |
| GraphPad guide or support page | Publicly documented behavior; a reason to investigate discrepancies | Runtime confirmation for Prism 11.1.0 or any other binary |
| Versioned native project plus exported results | Direct comparison for those data/settings/build | Universal equivalence across untested options, sizes or numerical regimes |

## Consequential reference examples

These examples show why an accurately computed approximation can still change
the scientific decision. The approximations below are those used at the PR #3
baseline, reproduced with SciPy 1.17.0. Exact probabilities retain tied
observations as separate experimental units when enumerating assignments.

| Test and complete input | Baseline approximation | Independent exact reference | At alpha 0.05 |
| --- | ---: | ---: | --- |
| Mann–Whitney: A `[1,1,1]`; B `[2,2,2]` | `0.04685417760387376` | `2 / choose(6,3) = 0.1` | Approximation rejects; exact test does not |
| Wilcoxon: A six zeros; B `[1,1,1,1,1,0]`, discard the zero difference | `0.025347318677468252` | `2 / 2^5 = 0.0625` | Approximation rejects; exact test does not |
| Kruskal–Wallis: A `[1,2]`; B `[3,4]`; C `[5,6,7]` | `0.06866117151308508` | `6 / 210 = 0.02857142857142857` | Exact test rejects; approximation does not |
| Kruskal–Wallis with ties: A `[2,3]`; B `[2,3]`; C `[1,1,1]` | `0.08045960674953244` | `6 / 210 = 0.02857142857142857` | Exact test rejects; approximation does not |
| Friedman with ties: three subject rows, each `[1,1,2]` | `0.04978706836786395` | `24 / 216 = 1/9` | Approximation rejects; exact test does not |
| Friedman: two subject rows `[1,2,3,4]` and `[2,3,4,5]` | `0.11161022509471268` | `24 / 576 = 1/24` | Exact test rejects; approximation does not |

For Mann–Whitney the exact criterion is distance of the rank sum from its null
center. Wilcoxon enumerates all sign assignments of the five nonzero ranked
differences. For Kruskal–Wallis and Friedman it is a statistic at least as large as
observed, including equality. Kruskal–Wallis preserves the group sizes; Friedman
permutes treatment labels separately within each subject. The Friedman tied
example has 216 labelled permutations, or equivalently 27 distinct rank
patterns with equal multiplicities. The stated null must justify exchangeability
and the experimental units must be independent; arbitrary permutation is not
valid for clustered or dependent data. These are deliberately tiny stress cases,
not claims about the prevalence or size of bias in a particular experiment.

## Native capture protocol

Use an authorized native Prism installation. Record exact version, build,
operating system and the SHA-256 of the retained installer/application artifact.
Preserve original bytes outside Git. Save a separate native project per case,
the input CSV with explicit blank cells, parameter-dialog screenshots for every
page, and all result tabs as machine-readable exports with maximum available
precision. Capture exact/approximate labels and all warnings. A screenshot of
rounded P values alone is insufficient.

Associate native project/export hashes with REA Evidence IDs when REA inspects
those artifacts. Keep the source of each field explicit: native saved output,
runtime observation, static resource, guide statement, or independent reference.
Do not promote a requirement to equivalent merely because an independent
reference agrees. If only display precision is recoverable, the comparison
tolerance must reflect it and must not be described as full-precision equality.

### Required cases and fields

Unless specified otherwise: two-sided, alpha 0.05, normal distributions for
parametric tests, no transformations, no exclusions, original column order.
`range(a,b)` below includes both integer endpoints. Record all settings even
when they appear to be defaults.

| ID | Inputs and settings | Native outputs needed / question resolved |
| --- | --- | --- |
| MW-TIE | A `[1,1,1]`, B `[2,2,2]`; also A `[1,2,2,4]`, B `[2,3,5,6]` | U, both rank sums, full-precision P, exact/approximate label, sidedness. Resolves tied conditional distribution and two-sided convention. Repeat swapping columns. |
| MW-LIMIT | For `n=50,51,99,100,101`, A odd integers `2i-1`, B even integers `2i`, `i=1..n`; separately A `[1,3,5]`, B the 101 even values `2,4,...,202` | Method label, P, U and warnings. Distinguishes both-group versus smaller-group limits; establishes behavior at the ambiguous 100 boundary. Include a duplicate observation in a second run. |
| WX-TIE-ZERO | A `[10,10,10,10,10,10]`, B `[10,11,11,12,8,13]`; and A six zeros, B `[1,1,1,1,1,0]` | Positive/negative rank sums, W, P and exact/approximate label; zero count, effective N. Run both discard-zero and Pratt options. Resolves zero convention separately from tied nonzero absolute ranks. |
| WX-LIMIT | A zeros, B `range(1,n)` for `n=50,51,199,200,201` | Exact/approximate label and effective pair count; run again with two equal absolute differences and with one zero. Resolves the 200 boundary and whether zero removal precedes method selection. |
| WX-PRECISION | A `[0.5,0.825,0.375,0.5]`, B `[0.525,0.775,0.325,0.55]` | Stored input precision, ranks, P and ties treatment. Resolves subtraction-roundoff handling; compare a separately entered differences column `[-0.025,0.05,0.05,-0.05]`. |
| KW-SMALL | Both Kruskal–Wallis examples in the preceding table, plus A `[1,1]`, B `[2,2]`, C `[3,3]` | H, tie correction/rank sums if available, full P and method label. Record any exact-calculation cancellation and its effect. Add Dunn all pairs and vs-control A; capture z/SE, family size and adjusted P. |
| FR-SMALL | Both Friedman examples in the preceding table; plus rows `[1,2,3]`, `[2,3,1]`, `[3,1,2]` | Friedman statistic, ranks/tie handling, P, method label, analyzed rows. Add Dunn all-pairs/control; capture rank differences, SE/z, correction and family size. |
| FR-LIMIT | Three columns and `n=11,12` rows, row `r` a cyclic rotation by `r mod 3` of `[1,2,3]` | Method labels around the documented `(3!)^n` boundary. A second run duplicates the first two entries within one row to establish whether ties change the switch. |
| RM-SPH | A `[2,4,6,8,10]`, B `[3,6,8,9,12]`, C `[4,10,5,15,8]`; all-pairs and control A. Run sphericity assumed and Geisser–Greenhouse separately | F, uncorrected/corrected numerator and denominator df, epsilon, treatment/subject/residual SS and MS, analyzed N. For each available post-test capture mean difference, SE, df, P and simultaneous CI. Resolves pooled versus per-pair error terms and df. |
| RM-MISSING | RM-SPH with the third B observation blank; separately mark it excluded; separately append a row containing only A=100 | Exact UI choice/default, model name, retained/excluded subjects, df and results. Run ordinary RM and mixed-effects/REML explicitly where offered. Confirms that complete-case deletion must not be described as a mixed model. |
| WELCH-BF | A `[1,2,3]`, B `[2,5,9,12]`, C `[4,4.5,5,5.5,6]` | Welch W and df/P; Brown–Forsythe F*, both df and P. Resolves original versus Mehrotra-corrected Brown–Forsythe conventions. Also run Games–Howell, Dunnett T3 and Tamhane T2 when available, keeping unsupported GP methods as separate targets. |
| MC-FAMILY | A `[4.1,5.2,4.8,5.5,4.9]`, B `[5,6.1,5.4,6.4,5.2]`, C `[6.3,7,6.1,7.6,6.2]`, D `[4,4.2,5.1,4.7,4.5]`; every pair versus control A versus selected A–B | Raw and adjusted P, family size, SE/df, simultaneous CI. Run Bonferroni, Sidak, Tukey, Dunnett, Dunn where appropriate, and Fisher LSD. Establish that hiding graph brackets does not change the family. Unsupported selected-pair or correction choices require separate native fixtures. |
| MC-ALPHA | MC-FAMILY at alpha `0.01`, `0.05`, `0.10` | Reported confidence level, CI endpoints, significance decision, star summary, bracket P/label and show-nonsignificant behavior. P values should not change merely because alpha changes. Record whether Prism links confidence level to alpha or holds it fixed; GP's browser currently keeps 95% intervals. Establish native interval and display conventions independently. |
| T-DIRECTION | A `[1,2,3,4,5]`, B `[2,3,5,6,7]`; Student/Welch/paired; two-sided/one-sided; difference direction normal/reversed | Full P, difference and CI, t/df, method labels and directional warnings. Separately document whether Prism asks for the predicted direction; reversing displayed subtraction must not silently redefine a scientific alternative. |
| NUMERIC-LIMIT | Repeat RM-SPH after adding `10^9` to every value and after multiplying all values by `10^-90` and `10^90`; two-group and very unbalanced multiple-comparison families | F/t, epsilon, df and P invariance; scaled effect/CI; numerical errors. If native input precision cannot retain extreme magnitudes, document that limitation and use representable scales. Include low df and many-group Dunnett/Tukey cases before claiming quadrature coverage outside tested ranges. |

### Dunnett and RM numerical stress fixtures

In addition to RM-SPH, use six subject rows with A all zeros,
B `[1,2,1,2,1,2]`, and C `[-10,10,-20,20,-30,30]`. Capture all-pairs
Bonferroni P, SE, df and intervals under both sphericity settings. The independent
pooled-error calculation gives A–B adjusted P=1, while the pair-specific
calculation gives approximately 0.003343312624522266. These are independent
targets, not native expected-output fixtures.

For a fully specified, highly unbalanced Dunnett fixture, set control A to
`[-sqrt(1/2), sqrt(1/2)]`. For each of B and C, enter 500 observations equal to
`d - sqrt(999/1000)` and 500 equal to `d + sqrt(999/1000)`, where
`d = 2 * sqrt(1/2 + 1/1000)`. Each sample variance is one, pooled residual
df is 1999, and both control contrasts have absolute t=2. Repeat with
`d = 2.2 * sqrt(1/2 + 1/1000)`. Use ordinary ANOVA, Dunnett versus A, all
observations included, 95% simultaneous confidence, alpha 0.05. Capture
full-precision adjusted P and CI, critical value or comparison SE/df when
available, and numeric precision of the entered values. Independent corrected
P targets are approximately 0.048361234590529545 and 0.02971340771933184;
neither is a native Prism oracle until captured and compared.

GP now requires an explicit directional alternative for one-tailed analyses.
The T-DIRECTION captures must record how native Prism represents that choice
or warns about it, rather than assuming that its difference-direction control
has the same meaning.

Capture no-comparison and unsupported-option behavior too: mixed effects,
Holm–Sidak, FDR, Newman–Keuls, Dunnett T3, Tamhane T2, lognormal analyses and Pratt
are separate methods/settings, not alternative spellings of supported GP
procedures. A method selector should not substitute another method silently.

## Primary reference findings

Sources were read during this audit. GraphPad's `/latest/` pages were headed
**Prism 11**, but contain legacy prose and internal inconsistencies. They are
guide evidence, not a substitute for the versioned native captures above.

- **Mann–Whitney:** [GraphPad interpretation guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_mann-whitney_test_works.htm) describes exact tied-label calculations and a smaller-group limit of 100, but later on the same page says fewer than 100. Verify 99/100/101 natively. [SciPy 1.17](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.mannwhitneyu.html) states its non-permutation `exact` method does not correct for ties, and recommends permutation consideration for tiny tied samples. Changing GP to `method="exact"` in tied cases would not resolve the discrepancy.
- **Wilcoxon:** [GraphPad matched-pairs guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_wilcoxon_matched_pairs_test_works.htm) describes exact calculations below 200 pairs including ties and a separate Pratt choice. [SciPy 1.17](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.wilcoxon.html) distinguishes discard-zero, Pratt and split-zero conventions; ordinary untied exact distributions do not become tie-correct merely by selecting `exact`. It also documents subtraction roundoff affecting ranks.
- **Kruskal–Wallis:** [GraphPad guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_kruskal-wallis_test_works.htm) describes exact small-sample calculations, including ties, with approximate fallback. [SciPy 1.17](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.kruskal.html) returns a tie-corrected statistic with a chi-square P and gives five observations per group as a customary approximation rule. Its output therefore cannot establish Prism's small-sample P. The guide's blanket statement about total N at most seven is not used as a numerical oracle; exhaustive unequal-group examples above show why.
- **Friedman:** [GraphPad guide](https://www.graphpad.com/guides/prism/latest/statistics/how_the_friedman_test_works.htm) describes within-row permutations, including ties, and approximate calculation when `(k!)^n > 10^9`. [SciPy 1.17](https://docs.scipy.org/doc/scipy-1.17.0/reference/generated/scipy.stats.friedmanchisquare.html) returns a chi-square P; its notes caution that reliability requires more than ten subjects and more than six repeated samples.
- **Repeated-measures comparisons:** [GraphPad one-way RM guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_multiple_comparisons_after_rep.htm) distinguishes pooled residual MS when assuming sphericity from pair-specific differences otherwise; the GG correction applies to the omnibus P. Merely changing epsilon while keeping the same post-test error term does not implement both documented modes. [Mixed-model guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_anova-approach-vs_-mixed-model.htm) describes a separate approach for missing repeated observations. Deletion and mixed-model fitting must be labeled separately.
- **Brown–Forsythe:** [GraphPad guide](https://www.graphpad.com/guides/prism/latest/statistics/interpreting_welch_browne-forsythe_tests.htm) distinguishes the means test from the equal-variance test and describes numerator df `k-1`. A reference implementation using the Mehrotra numerator correction is a different comparator; disagreement alone does not establish a GP bug. The exact native version remains to be measured.
- **Corrections and intervals:** [GraphPad options](https://www.graphpad.com/guides/prism/latest/statistics/stat_options_tab_1wayanova.htm) distinguishes familywise corrections, FDR and Fisher LSD; the latter has no multiplicity control. It recommends Dunnett T3 for unequal-variance small samples and Games–Howell for large samples. [Bonferroni/Sidak guide](https://www.graphpad.com/guides/prism/latest/statistics/stat_how_the_bonferroni_and_sidak_m.htm) defines per-comparison thresholds from the preselected family. Interpret correction choice, number of comparisons, alpha and simultaneous confidence level together; none is determined by how many brackets are displayed.
- **Dunn error terms:** [GraphPad's formulas](https://www.graphpad.com/guides/prism/latest/statistics/stat_how_the_dunn_method_for_nonpar.htm) distinguish pooled-rank tie correction after Kruskal–Wallis from within-subject ranking after Friedman. The Friedman sum-rank reference SE is `sqrt(n k (k+1)/6)` without an additional tie reduction. Average ranks still account for ties. Obtain native tied outputs before promoting the guide-based convention to verified equivalence.
- **One-sided interpretation:** [GraphPad FAQ 1899](https://www.graphpad.com/support/faq/interpreting-one-tail-p-values/) says its reported one-tail P assumes the predeclared direction was correct; an opposite-direction result needs the complementary tail. A half-two-sided convention requires an explicit directional disclosure. For discrete distributions, obtain the actual chosen-tail probability rather than assuming the two tails are complementary without accounting for point mass.

## CI evidence actually inspected

[Merge workflow run 39335578778](https://github.com/samgillman/GP/actions/runs/39335578778)
and its [job 118344131420](https://github.com/samgillman/GP/actions/runs/39335578778/job/118344131420)
completed successfully on the merged SHA above. The decoded job log shows:

- Python 3.12.15 with SciPy 1.17.0; `296 passed, 1 warning` at
  `2026-10-19T22:32:15Z`. The warning was Starlette's `httpx` deprecation.
- Frontend `163` tests, `163` passes, `0` failures at `22:32:17Z`.
- Both Vite builds succeeded. `scripts/build_browser.py` reported a completed
  static site with **19 verified runtime packages** at `22:32:27Z`.
- The static Column script on port 8001 logged ten passes during `22:34:41–50Z`;
  the server script on port 8002 logged the same ten during `22:34:51–53Z`.
  They covered warm-up, invalid selection, t/Welch results, ANOVA/Tukey,
  brackets, P labels, recalculation, reload and SVG export. The script asserts
  no page errors before successful completion. References are SciPy values.
- Uploaded artifact `browser-evidence`, ID `12226602958`, size `1,409,718`
  bytes, GitHub SHA-256 digest
  `c321a50de1d76c4c81430dd3fafaa0f909721ecfc46abdbfe30afedfe02dde46`.
  Artifact metadata and download availability were verified; the conclusions
  above are from job logs and the versioned script, not an assertion that all
  archive members were independently inspected.

The [PR workflow run 39335496918](https://github.com/samgillman/GP/actions/runs/39335496918)
also has a successful conclusion for head
`5b35065b083f981fba6ca213d03971230a39108e`. The merge job supplies the detailed
evidence used here. This resolves the historical *unobserved static CI build*
gap for PR #3. It does not establish current deployment state, validate all
statistical methods in Pyodide, or add any native Prism numerical comparison.

## Fresh audit CI evidence

The audit code commit `dbea1698d117d43aea18fb2108f2f7594cb97081` in
[draft PR #4](https://github.com/samgillman/GP/pull/4) passed
[run 39371008134](https://github.com/samgillman/GP/actions/runs/39371008134)
and [job 118458637647](https://github.com/samgillman/GP/actions/runs/39371008134/job/118458637647).
The decoded log was inspected and records:

- Python 3.12.15 and server SciPy 1.17.0; `330 passed, 1 warning in 8.16s`
  at `2026-10-20T04:43:27Z`. The warning remains the Starlette/httpx deprecation.
- Frontend `176` tests, `176` passes, `0` failures at `04:43:30Z`.
- Both application builds passed. Static packaging completed with
  **19 verified runtime packages** at `04:43:45Z`.
- Playwright 1.58.0 installed Chromium build 1208 / Chrome 145.0.7632.6.
- The Column script logged **19 passes on static** during `04:47:10–37Z`
  and **19 passes on server** during `04:47:39–48Z`. Both completed after
  the no-page-errors assertion. The new cases include unbalanced Dunnett,
  pooled RM comparisons, missing-subject refusal, rank-test disclosures,
  explicit direction, alpha-based bracket filtering and cache invalidation.
- The complete job succeeded at `04:48:21Z`; existing import, recalculation,
  graph, exclusion, workbook and large-workbook browser checks also passed.
- Artifact `browser-evidence`, ID `12241855332`, size `1,721,066` bytes,
  created at `04:48:17Z`; GitHub SHA-256 digest
  `4fe1d01fe5bc7f1d9eb6d701ae905074b3d2f93639e2a30d719db25d0466f55a`.

The archive was downloaded and its SHA-256 computed from the retrieved bytes;
it matches the GitHub digest above. Inspection was scoped to these members:

- `column-static.json` and `column-server.json`: each contains 19 check records
  and two screenshot references. The static/server unbalanced Dunnett P values
  are respectively `0.04836123459052499` and `0.048361234590529545`. Both record
  RM pooled P=`1` and opposite-direction one-tailed P=`0.9655517861960418`.
- `column-static-mann-whitney-ties-notice.png`: visually reviewed. The method
  and limitations appear above the results, including the normal approximation,
  ties, small-sample risk and unverified native equivalence. The table visibly
  shows P `0.0469`, `Approximate`, a star and a positive threshold decision.
- `column-static-unsupported-rm-tukey.png`: visually reviewed. Unsupported
  Tukey remains selected, the alert states that the method was not replaced,
  the GG pair-specific and native-evidence disclosures are visible, and OK is
  disabled. Both reviewed screenshots are legible without visible overlap or
  clipping in the captured area.

Other archive members, including the server screenshot counterparts, were not
visually reviewed. Local Chromium downloads were incomplete, so the new
successful browser evidence is the CI run.

This later documentation-only update records the completed run on the named
code commit, not a completed run on any subsequent documentation commit.
These are application and independent-calculation checks, not native Prism
outputs or proof of production deployment.
