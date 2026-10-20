"""Consequential edge cases: independent enumeration, identities and explicit limits.

These references establish particular numerical conventions, not Prism parity.
No enumerated value below is represented as native GraphPad output.
"""
from fractions import Fraction
from itertools import combinations, permutations, product
from math import comb, erfc, exp, sqrt

import numpy as np
import pytest
from scipy import stats

from gp.column_tests import dunnett_coverage, studentized_range_ppf, t_adjusted
from gp.models import AnalysisRequest
from gp.statistics import AnalysisError, analyze


def run(groups, analysis="one_way_anova", confidence=0.95, **options):
    return analyze(AnalysisRequest(analysis=analysis, confidence=confidence, options=options,
                                  columns=[dict(name=chr(65 + i), values=g) for i, g in enumerate(groups)]))


def value(out, label):
    return next(row["value"] for row in out["results"] if row["label"] == label)


def warnings(out):
    return " ".join(out["warnings"])


def test_tied_mann_whitney_discloses_a_real_small_sample_decision_reversal():
    # Conditional label permutation: only the two completely separated
    # assignments out of C(6,3) attain either extreme of the rank sum.
    ranks = [2, 2, 2, 5, 5, 5]
    sums = [sum(ranks[i] for i in selected) for selected in combinations(range(6), 3)]
    exact = sum(abs(s - 10.5) >= 4.5 for s in sums) / len(sums)
    assert exact == 2 / comb(6, 3) == 0.1
    out = run([[1, 1, 1], [2, 2, 2]], analysis="t_test", gaussian=False)
    # Tie + continuity corrected z, evaluated independently of mannwhitneyu.
    approximate = erfc((4.5 - 0.5) / sqrt(4.05) / sqrt(2))
    assert value(out, "P value") == pytest.approx(approximate, rel=1e-12)
    assert approximate < 0.05 < exact
    assert value(out, "Ties present") == "Yes"
    assert "Small-sample Mann-Whitney" in warnings(out)
    assert "not a tie-aware exact" in warnings(out)
    assert "native Prism equivalence is unverified" in warnings(out)


def test_tie_free_mann_whitney_exact_reproduces_enumerated_tail():
    out = run([[1, 2, 3], [4, 5, 6]], analysis="t_test", gaussian=False)
    assert value(out, "P value") == pytest.approx(2 / comb(6, 3))
    assert value(out, "P value method") == "Exact rank distribution"


def test_tied_wilcoxon_zero_policy_and_small_sample_decision_reversal():
    # Five identical nonzero differences have 2**5 equiprobable sign patterns.
    totals = [sum(signs) for signs in product((-1, 1), repeat=5)]
    exact = sum(abs(total) >= 5 for total in totals) / len(totals)
    out = run([[0] * 6, [1, 1, 1, 1, 1, 0]], analysis="t_test", paired=True, gaussian=False)
    approximate = erfc(sqrt(5) / sqrt(2))
    assert value(out, "P value") == pytest.approx(approximate)
    assert approximate < 0.05 < exact == 0.0625
    assert value(out, "Nonzero pairs analyzed") == 5
    assert value(out, "Zero differences excluded") == 1
    assert "Small-sample Wilcoxon" in warnings(out)
    assert "Pratt and split-zero methods are unsupported" in warnings(out)


@pytest.mark.parametrize("paired,groups,expected", [
    (False, [[1, 4], [2, 3]], Fraction(4, 6)),
    (True, [[0, 0, 0, 0], [1, -2, -3, 4]], Fraction(9, 16)),
])
def test_discrete_one_sided_tail_is_not_half_of_capped_two_sided_p(paired, groups, expected):
    for direction in ("a_greater", "b_greater"):
        out = run(groups, analysis="t_test", gaussian=False, paired=paired, tails=1, alternative=direction)
        reverse = run(groups, analysis="t_test", gaussian=False, paired=paired, tails=1,
                      alternative=direction, reverse_difference=True)
        assert value(out, "P value") == pytest.approx(float(expected))
        assert value(reverse, "P value") == pytest.approx(float(expected))
    two = run(groups, analysis="t_test", gaussian=False, paired=paired)
    assert value(two, "P value") == 1
    assert float(expected) > value(two, "P value") / 2


@pytest.mark.parametrize("paired", [False, True])
def test_one_sided_t_rejects_ambiguous_direction_and_respects_opposite_alternative(paired):
    groups = [[1, 2, 4, 3], [5, 7, 8, 6]]
    with pytest.raises(AnalysisError, match="prespecified direction"):
        run(groups, analysis="t_test", paired=paired, tails=1)
    positive = run(groups, analysis="t_test", paired=paired, tails=1, alternative="b_greater")
    opposite = run(groups, analysis="t_test", paired=paired, tails=1, alternative="a_greater")
    reversed_ = run(groups, analysis="t_test", paired=paired, tails=1,
                    alternative="b_greater", reverse_difference=True)
    assert value(positive, "P value") < 0.05
    assert value(opposite, "P value") > 0.95
    assert value(positive, "P value") + value(opposite, "P value") == pytest.approx(1)
    assert value(positive, "P value") == value(reversed_, "P value")


def test_kruskal_small_unequal_groups_warn_when_exact_inference_reverses():
    # Exhaustive labelled partitions of ranks 1..7, preserving sizes (2,2,3).
    # Comparing sum(R_i**2/n_i) avoids approximation and roundoff in H.
    ranks = set(range(1, 8))
    target = Fraction(3**2, 2) + Fraction(7**2, 2) + Fraction(18**2, 3)
    scores = []
    for a in combinations(sorted(ranks), 2):
        rest = ranks - set(a)
        for b in combinations(sorted(rest), 2):
            c = rest - set(b)
            scores.append(Fraction(sum(a)**2, 2) + Fraction(sum(b)**2, 2) + Fraction(sum(c)**2, 3))
    exact = sum(s >= target for s in scores) / len(scores)
    assert len(scores) == 210 and exact == 6 / 210
    out = run([[1, 2], [3, 4], [5, 6, 7]], gaussian=False, comparisons="none")
    assert value(out, "Kruskal-Wallis statistic") == pytest.approx(Fraction(75, 14))
    assert value(out, "P value") == pytest.approx(exp(-75 / 28))  # chi-square, df=2
    assert exact < 0.05 < value(out, "P value")
    assert "Small-sample Kruskal-Wallis" in warnings(out)
    assert "does not compute exact" in warnings(out)


@pytest.mark.parametrize("rows,exact,approximate", [
    ([[1, 1, 2]] * 3, Fraction(1, 9), exp(-3)),
    ([[1, 2, 3, 4]] * 2, Fraction(1, 24), 0.11161022509471268),
])
def test_friedman_small_designs_can_reverse_decisions_in_either_direction(rows, exact, approximate):
    # Exhaustive within-row relabelling: all distinct permutations equiprobable.
    possible = sorted(set(permutations(rows[0])))
    target = sum(sum(row[j] for row in rows)**2 for j in range(len(rows[0])))
    scores = [sum(sum(row[j] for row in permuted)**2 for j in range(len(rows[0])))
              for permuted in product(possible, repeat=len(rows))]
    assert Fraction(sum(score >= target for score in scores), len(scores)) == exact
    out = run(list(map(list, zip(*rows))), paired=True, gaussian=False, comparisons="none")
    assert value(out, "P value") == pytest.approx(approximate)
    assert (float(exact) < 0.05) != (approximate < 0.05)
    assert "Small-design Friedman" in warnings(out)
    assert "not an exact within-subject" in warnings(out)


@pytest.mark.parametrize("gaussian", [False, True])
@pytest.mark.parametrize("groups", [
    [[1, 2, 3], [2, None, 5], [3, 4, 7]],
    [[1, 2, 3], [2, 4, 5], [3, 4, 7, 8]],
])
def test_incomplete_matched_subjects_are_blocked_including_ragged_ends(gaussian, groups):
    with pytest.raises(AnalysisError, match="incomplete subject row"):
        run(groups, paired=True, gaussian=gaussian, comparisons="none")


def test_fully_empty_padding_is_allowed_and_paired_tests_report_exclusions():
    complete = [[1, 2, 3], [2, 4, 5], [3, 4, 7]]
    plain = run(complete, paired=True, comparisons="none")
    padded = run([c + [None, None] for c in complete], paired=True, comparisons="none")
    assert value(plain, "P value") == value(padded, "P value")
    paired = run([[1, 2, 3, 99], [2, None, 5]], analysis="t_test", paired=True)
    assert value(paired, "Complete pairs analyzed") == 2
    assert value(paired, "Incomplete pairs excluded") == 2
    assert [s["n"] for s in paired["summary"]] == [2, 2]
    assert [s["mean"] for s in paired["summary"]] == [2, 3.5]


def test_rm_sphericity_changes_posthoc_error_term_and_gg_tukey_is_refused():
    groups = [[0] * 6, [1, 2, 1, 2, 1, 2], [-10, 10, -20, 20, -30, 30]]
    pooled = run(groups, paired=True, sphericity="assume", method="bonferroni")
    paired = run(groups, paired=True, sphericity="geisser_greenhouse", method="bonferroni")
    # Exact rational two-way decomposition gives residual SS=5483/3, df=10.
    assert value(pooled, "SS residual") == pytest.approx(Fraction(5483, 3))
    t_pooled = 1.5 / sqrt(2 * (5483 / 30) / 6)
    expected_pooled = min(1, 3 * 2 * stats.t.sf(t_pooled, 10))
    # Paired B-A differences have mean 1.5 and sample variance .3.
    expected_paired = 3 * 2 * stats.t.sf(1.5 / sqrt(0.3 / 6), 5)
    assert value(pooled, "A vs. B: adjusted P") == pytest.approx(expected_pooled)
    assert value(paired, "A vs. B: adjusted P") == pytest.approx(expected_paired)
    assert expected_paired < 0.05 < expected_pooled
    assert "pooled residual variance" in warnings(pooled)
    assert "epsilon is not applied" in warnings(paired)
    with pytest.raises(AnalysisError, match="Tukey comparisons without assumed sphericity"):
        run(groups, paired=True, method="tukey")
    # An explicitly assumed spherical model can use the standard pooled Tukey.
    tukey = run(groups, paired=True, sphericity="assume", method="tukey")
    assert value(tukey, "Multiple comparison method") == "tukey"


def test_rm_inference_is_invariant_to_large_subject_offsets():
    data = np.array([[1, 2, 4], [2, 5, 6], [3, 4, 9], [5, 7, 8], [4, 6, 7]], dtype=float)
    offsets = np.array([1e8, -2e8, 3e8, -4e8, 5e8])[:, None]
    baseline = run(data.T.tolist(), paired=True, comparisons="none")
    shifted = run((data + offsets).T.tolist(), paired=True, comparisons="none")
    for label in ("F", "P value", "SS treatment", "SS residual", "Geisser-Greenhouse epsilon"):
        assert value(shifted, label) == pytest.approx(value(baseline, label), rel=2e-7, abs=1e-10)


@pytest.mark.parametrize("scale", [1e-90, 1e90])
def test_rm_epsilon_and_p_are_invariant_to_measurement_units(scale):
    data = np.array([[2, 4, 6, 8, 10], [3, 6, 8, 9, 12], [4, 10, 5, 15, 8]], dtype=float)
    baseline = run(data.tolist(), paired=True, comparisons="none")
    scaled = run((scale * data).tolist(), paired=True, comparisons="none")
    for label in ("F", "P value", "Geisser-Greenhouse epsilon"):
        assert value(scaled, label) == pytest.approx(value(baseline, label), rel=1e-12)


def test_dunn_family_uses_requested_comparisons_and_all_column_ranks():
    groups = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    all_pairs = run(groups, gaussian=False, method="dunn")
    control = run(groups, gaussian=False, method="dunn", comparisons="vs_control")
    # All-data mean ranks 2,5,8: SE=sqrt(9*10/12 * (1/3+1/3))=sqrt(5).
    raw = erfc(3 / sqrt(5) / sqrt(2))
    assert value(all_pairs, "A vs. B: adjusted P") == pytest.approx(3 * raw)
    assert value(control, "A vs. B: adjusted P") == pytest.approx(2 * raw)
    assert value(all_pairs, "Comparison family size") == 3
    assert value(control, "Comparison family size") == 2


def test_fisher_is_labelled_unadjusted_without_omnibus_gate():
    out = run([[0] * 6, [1, 2, 1, 2, 1, 2], [-10, 10, -20, 20, -30, 30]], paired=True, method="fisher")
    assert value(out, "P value") > 0.05
    assert value(out, "A vs. B: unadjusted P") < 0.05
    multiple = next(t for t in out["tables"] if t["title"] == "Multiple comparisons")
    assert multiple["columns"][-1] == "Unadjusted P Value"
    assert "not gated on the omnibus" in warnings(out)


def test_sidak_preserves_tiny_nonzero_p_values_and_endpoints():
    adjusted, _ = t_adjusted("sidak", 1e-20, 435, 0.95)
    assert adjusted == pytest.approx(435e-20, rel=1e-14, abs=0)
    assert adjusted > 0
    assert t_adjusted("sidak", 0, 3, 0.95)[0] == 0
    assert t_adjusted("sidak", 1, 3, 0.95)[0] == 1


def test_studentized_range_low_df_extreme_interval_uses_t_identity():
    # For k=2 and df=1, |t| has the absolute Cauchy distribution.
    expected = sqrt(2) * np.tan(np.pi * (0.999 / 2))
    assert studentized_range_ppf(0.999, 2, 1) == pytest.approx(expected, rel=1e-10)
    out = run([[0, 1], [2]], confidence=0.999)
    assert np.isfinite(value(out, "A vs. B: CI lower"))
    assert np.isfinite(value(out, "A vs. B: CI upper"))


@pytest.mark.parametrize("critical,expected", [(2.0, 0.9516387654094705), (2.2, 0.9702865922806682)])
def test_dunnett_highly_unbalanced_control_matches_independent_multivariate_t(critical, expected):
    # Fixed 96-node Hermite integration formerly erred by .00449 at this point.
    lam = sqrt(1000 / 1002)
    correlation = np.array([[1, lam * lam], [lam * lam, 1]])
    reference = stats.multivariate_t.cdf([critical, critical], shape=correlation, df=1999,
                                        lower_limit=[-critical, -critical], maxpts=200000, random_state=1847)
    actual = dunnett_coverage(critical, [lam, lam], 1999)
    assert actual == pytest.approx(reference, abs=3e-6)
    assert actual == pytest.approx(expected, abs=1e-10)


def test_confidence_alpha_mismatch_is_explicit_and_changes_neither_silently():
    out = run([[1, 2, 3], [3, 4, 5]], analysis="t_test", alpha=0.01, confidence=0.95)
    assert value(out, "Confidence level") == 0.95
    assert value(out, "Significance threshold alpha") == 0.01
    assert "confidence level is not 1 - alpha" in warnings(out)
    assert "Asterisks use fixed P-value cutoffs" in warnings(out)
