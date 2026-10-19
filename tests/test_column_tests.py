"""t tests and one-way ANOVA checked against independent SciPy routines and exact identities."""
import inspect
import json
from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy import stats
from gp.models import AnalysisRequest
from gp.server import app
from gp.statistics import AnalysisError, analyze

CONTROL = [42, 38, 45, 41, 39, 44, 40, 43]
TREATED = [58, 62, 55, 64, 61, 59, 63, 57]
THIRD = [72, 78, 75, 81, 73, 79, 76, 74]
PRISM_PAIRED = json.loads((Path(__file__).parent / "fixtures/prism_11_1_paired.json").read_text())


def run(analysis, columns, **options):
    named = [dict(name=name, values=values) for name, values in columns]
    with np.errstate(over="raise", divide="raise", invalid="raise"):
        return analyze(AnalysisRequest(analysis=analysis, columns=named, options=options))


def value(output, label):
    matches = [row["value"] for row in output["results"] if row["label"] == label]
    assert len(matches) == 1, (label, [row["label"] for row in output["results"]])
    return matches[0]


def table(output, title):
    return next(t for t in output["tables"] if t["title"] == title)


def cell(output, title, label):
    rows = [row for row in table(output, title)["rows"] if row and row[0] == label]
    assert rows, (title, label)
    return rows[0][1]


def test_unpaired_t_matches_scipy_and_reports_prism_rows():
    out = run("t_test", [("Control", CONTROL), ("Treated", TREATED)])
    reference = stats.ttest_ind(TREATED, CONTROL)
    assert value(out, "t") == pytest.approx(abs(reference.statistic), rel=1e-12)
    assert value(out, "P value") == pytest.approx(reference.pvalue, rel=1e-9)
    assert value(out, "df") == 14
    diff = np.mean(TREATED) - np.mean(CONTROL)
    assert value(out, "Difference between means") == pytest.approx(diff)
    se = diff / reference.statistic
    half = stats.t.ppf(0.975, 14) * se
    assert value(out, "Difference CI lower") == pytest.approx(diff - half)
    assert value(out, "R squared") == pytest.approx(reference.statistic ** 2 / (reference.statistic ** 2 + 14))
    variances = sorted([np.var(CONTROL, ddof=1), np.var(TREATED, ddof=1)])
    assert value(out, "F") == pytest.approx(variances[1] / variances[0])
    assert value(out, "F test P value") == pytest.approx(min(1, 2 * stats.f.sf(variances[1] / variances[0], 7, 7)))
    assert cell(out, "Unpaired t test", "P value") == "<0.0001"
    assert cell(out, "Unpaired t test", "P value summary") == "****"
    assert cell(out, "Unpaired t test", "Column B") == "Treated"
    assert out["comparisons"] == [dict(a=0, b=1, p=value(out, "P value"), summary="****")]


def test_welch_one_tailed_and_reversed_difference():
    a, b = [1.1, 2.3, 1.9, 2.8, 2.2], [2.9, 4.8, 1.2, 6.5, 3.1, 5.0]
    out = run("t_test", [("A", a), ("B", b)], equal_sd=False)
    reference = stats.ttest_ind(b, a, equal_var=False)
    assert value(out, "P value") == pytest.approx(reference.pvalue, rel=1e-9)
    assert value(out, "df") == pytest.approx(reference.df, rel=1e-12)
    one = run("t_test", [("A", a), ("B", b)], equal_sd=False, tails=1)
    assert value(one, "P value") == pytest.approx(reference.pvalue / 2)
    reversed_ = run("t_test", [("A", a), ("B", b)], equal_sd=False, reverse_difference=True)
    assert value(reversed_, "Difference between means") == pytest.approx(-value(out, "Difference between means"))
    assert value(reversed_, "P value") == value(out, "P value")
    assert "Difference between means (A - B) ± SEM" in [row[0] for row in table(reversed_, "Unpaired t test with Welch's correction")["rows"] if row]


def test_paired_t_matches_saved_prism_11_1_with_swapped_direction():
    columns = [(c["name"], c["values"]) for c in PRISM_PAIRED["columns"]]
    expected = PRISM_PAIRED["expected"]
    out = run("t_test", columns, paired=True, reverse_difference=True)
    for label, key in [("t", "t"), ("df", "df"), ("P value", "p"), ("Mean of differences", "difference"), ("SD of differences", "sd"),
                       ("SEM of differences", "sem"), ("Difference CI lower", "ci_low"), ("Difference CI upper", "ci_high"), ("R squared", "r_squared")]:
        assert value(out, label) == pytest.approx(expected[key], rel=1e-9, abs=1e-12), label
    r = stats.pearsonr(PRISM_PAIRED["columns"][0]["values"], PRISM_PAIRED["columns"][1]["values"])
    assert value(out, "Pairing correlation r") == pytest.approx(r.statistic)
    assert value(out, "Pairing P value (one tailed)") == pytest.approx(stats.pearsonr(*[c["values"] for c in PRISM_PAIRED["columns"]], alternative="greater").pvalue)


def test_mann_whitney_exact_and_tied_approximate_match_scipy():
    a, b = [1.2, 3.4, 2.2, 5.1, 0.7], [4.4, 6.1, 5.5, 7.2, 3.9, 6.6]
    out = run("t_test", [("A", a), ("B", b)], gaussian=False)
    reference = stats.mannwhitneyu(a, b, method="exact")
    assert value(out, "P value") == pytest.approx(reference.pvalue)
    assert value(out, "Mann-Whitney U") == min(reference.statistic, len(a) * len(b) - reference.statistic)
    assert value(out, "Hodges-Lehmann difference") == pytest.approx(np.median(np.subtract.outer(b, a)))
    ranks = stats.rankdata(a + b)
    assert value(out, "Sum of ranks A") == ranks[:5].sum()
    assert cell(out, "Mann Whitney test", "Exact or approximate P value?") == "Exact"
    tied = run("t_test", [("A", [1, 2, 2, 3, 4]), ("B", [2, 3, 3, 5, 6])], gaussian=False)
    assert value(tied, "P value") == pytest.approx(stats.mannwhitneyu([1, 2, 2, 3, 4], [2, 3, 3, 5, 6], method="asymptotic").pvalue)
    assert cell(tied, "Mann Whitney test", "Exact or approximate P value?") == "Approximate"


def test_wilcoxon_excludes_zero_differences_and_matches_scipy():
    a = [10, 12, 9, 15, 11, 13, 14, 8]
    b = [12, 12, 13, 18, 10, 17, 19, 11]
    out = run("t_test", [("A", a), ("B", b)], paired=True, gaussian=False)
    d = np.subtract(b, a)
    nonzero = d[d != 0]
    assert value(out, "P value") == pytest.approx(stats.wilcoxon(nonzero, method="approx").pvalue)
    assert value(out, "Sum of signed ranks (W)") == pytest.approx(stats.rankdata(np.abs(nonzero))[nonzero > 0].sum() - stats.rankdata(np.abs(nonzero))[nonzero < 0].sum())
    assert cell(out, "Wilcoxon matched-pairs signed rank test", "Number of pairs with zero difference (excluded)") == "1"


def test_ordinary_anova_variance_tests_and_tukey_match_scipy():
    groups = [np.asarray(g, dtype=float) for g in (CONTROL, TREATED, THIRD + [70])]
    out = run("one_way_anova", [("A", groups[0]), ("B", groups[1]), ("C", groups[2])])
    f = stats.f_oneway(*groups)
    assert value(out, "F") == pytest.approx(f.statistic)
    assert value(out, "P value") == pytest.approx(f.pvalue, rel=1e-9)
    levene = stats.levene(*groups, center="median")
    assert value(out, "Brown-Forsythe F") == pytest.approx(levene.statistic)
    assert value(out, "Brown-Forsythe P value") == pytest.approx(levene.pvalue)
    assert value(out, "Bartlett statistic") == pytest.approx(stats.bartlett(*groups).statistic)
    tukey = stats.tukey_hsd(*groups)
    interval = tukey.confidence_interval(0.95)
    for i, j in [(0, 1), (0, 2), (1, 2)]:
        names = "ABC"
        assert value(out, f"{names[i]} vs. {names[j]}: adjusted P") == pytest.approx(max(tukey.pvalue[i, j], 0), abs=1e-9)
        assert value(out, f"{names[i]} vs. {names[j]}: difference") == pytest.approx(tukey.statistic[i, j])
    row = table(out, "Multiple comparisons")["rows"][0]
    low, high = (float(x) for x in row[2].split(" to "))
    assert low == pytest.approx(interval.low[0, 1], rel=1e-3) and high == pytest.approx(interval.high[0, 1], rel=1e-3)
    assert table(out, "Multiple comparisons")["columns"][0] == "Tukey's multiple comparisons test"
    assert [(c["a"], c["b"]) for c in out["comparisons"]] == [(0, 1), (0, 2), (1, 2)]


def test_pooled_bonferroni_sidak_fisher_and_dunnett():
    groups = [[4.1, 5.2, 4.8, 5.5, 4.9], [5.9, 6.3, 5.4, 6.8], [4.5, 5.0, 5.6, 4.7, 5.1, 5.3]]
    named = [("Ctrl", groups[0]), ("X", groups[1]), ("Y", groups[2])]
    n = np.array([len(g) for g in groups])
    mse = sum(np.sum((np.array(g) - np.mean(g)) ** 2) for g in groups) / (n.sum() - 3)
    raw = 2 * stats.t.sf(abs(np.mean(groups[0]) - np.mean(groups[1])) / np.sqrt(mse * (1 / 5 + 1 / 4)), n.sum() - 3)
    assert value(run("one_way_anova", named, method="fisher"), "Ctrl vs. X: adjusted P") == pytest.approx(raw)
    assert value(run("one_way_anova", named, method="bonferroni"), "Ctrl vs. X: adjusted P") == pytest.approx(min(1, 3 * raw))
    assert value(run("one_way_anova", named, method="sidak"), "Ctrl vs. X: adjusted P") == pytest.approx(1 - (1 - raw) ** 3)
    dunnett = run("one_way_anova", named, comparisons="vs_control", method="dunnett")
    # SciPy integrates the same multivariate t probability by randomized QMC.
    reference = stats.dunnett(groups[1], groups[2], control=groups[0], random_state=0)
    assert value(dunnett, "Ctrl vs. X: adjusted P") == pytest.approx(reference.pvalue[0], abs=2e-4)
    assert value(dunnett, "Ctrl vs. Y: adjusted P") == pytest.approx(reference.pvalue[1], abs=2e-4)
    assert value(dunnett, "Ctrl vs. Y: difference") == pytest.approx(np.mean(groups[0]) - np.mean(groups[2]))
    # The CI half-width uses the critical value whose coverage is exactly 95%.
    row = table(dunnett, "Multiple comparisons")["rows"][0]
    low, high = (float(x) for x in row[2].split(" to "))
    critical = (high - low) / 2 / np.sqrt(mse * (1 / 5 + 1 / 4))
    lambdas = [np.sqrt(4 / 9), np.sqrt(6 / 11)]
    from gp.column_tests import dunnett_coverage
    assert dunnett_coverage(critical, lambdas, n.sum() - 3) == pytest.approx(0.95, abs=2e-3)
    with pytest.raises(AnalysisError, match="not available"):
        run("one_way_anova", named, comparisons="vs_control", method="tukey")


def test_dunnett_with_one_comparison_equals_the_pooled_t_test():
    groups = [[4.1, 5.2, 4.8, 5.5, 4.9], [5.9, 6.3, 5.4, 6.8]]
    out = run("one_way_anova", [("C", groups[0]), ("T", groups[1])], comparisons="vs_control", method="dunnett")
    assert value(out, "C vs. T: adjusted P") == pytest.approx(stats.ttest_ind(*groups).pvalue, rel=1e-6)


def test_welch_and_brown_forsythe_anova_reduce_to_welch_t_for_two_groups():
    a, b = [1.1, 2.3, 1.9, 2.8, 2.2], [2.9, 4.8, 1.2, 6.5, 3.1, 5.0]
    out = run("one_way_anova", [("A", a), ("B", b)], equal_sd=False, method="games_howell")
    welch = stats.ttest_ind(a, b, equal_var=False)
    for label in ["Welch W", "Brown-Forsythe F*"]:
        assert value(out, label) == pytest.approx(welch.statistic ** 2)
    for label in ["Welch DFd", "Brown-Forsythe DFd"]:
        assert value(out, label) == pytest.approx(welch.df)
    assert value(out, "A vs. B: adjusted P") == pytest.approx(welch.pvalue, rel=1e-6)


@pytest.mark.skipif("equal_var" not in str(inspect.signature(stats.f_oneway)), reason="SciPy without Welch f_oneway")
def test_welch_anova_matches_scipy_for_three_groups():
    groups = [[1.1, 2.3, 1.9, 2.8, 2.2], [2.9, 4.8, 1.2, 6.5, 3.1, 5.0], [3.3, 3.1, 3.9, 3.6]]
    out = run("one_way_anova", [("A", groups[0]), ("B", groups[1]), ("C", groups[2])], equal_sd=False, comparisons="none")
    reference = stats.f_oneway(*groups, equal_var=False)
    assert value(out, "Welch W") == pytest.approx(reference.statistic)
    assert value(out, "Welch P value") == pytest.approx(reference.pvalue)


def test_kruskal_wallis_and_dunn_match_scipy_and_two_group_identity():
    groups = [[1, 3, 3, 5, 7], [4, 6, 6, 8, 9, 10], [2, 2, 3, 4]]
    out = run("one_way_anova", [("A", groups[0]), ("B", groups[1]), ("C", groups[2])], gaussian=False)
    reference = stats.kruskal(*groups)
    assert value(out, "Kruskal-Wallis statistic") == pytest.approx(reference.statistic)
    assert value(out, "P value") == pytest.approx(reference.pvalue)
    two = run("one_way_anova", [("A", groups[0]), ("B", groups[1])], gaussian=False)
    assert value(two, "A vs. B: adjusted P") == pytest.approx(stats.kruskal(groups[0], groups[1]).pvalue)
    assert table(out, "Multiple comparisons")["columns"][1] == "Mean rank diff."


def test_repeated_measures_reduces_to_paired_t_and_epsilon_matches_contrast_formula():
    a, b, c = [10, 12, 9, 15, 11, 13], [12, 15, 13, 18, 12, 17], [11, 16, 12, 21, 14, 15]
    two = run("one_way_anova", [("A", a), ("B", b)], paired=True, method="fisher")
    paired = stats.ttest_rel(b, a)
    assert value(two, "F") == pytest.approx(paired.statistic ** 2)
    assert value(two, "P value") == pytest.approx(paired.pvalue)
    assert value(two, "Geisser-Greenhouse epsilon") == pytest.approx(1)
    three = run("one_way_anova", [("A", a), ("B", b), ("C", c)], paired=True)
    data = np.column_stack([a, b, c]).astype(float)
    contrasts = np.linalg.qr(np.column_stack([np.ones(3), np.eye(3)[:, :2]]))[0][:, 1:]
    s = contrasts.T @ np.cov(data, rowvar=False) @ contrasts
    epsilon = np.trace(s) ** 2 / (2 * np.trace(s @ s))
    assert value(three, "Geisser-Greenhouse epsilon") == pytest.approx(epsilon)
    f = value(three, "F")
    assert value(three, "P value") == pytest.approx(stats.f.sf(f, 2 * epsilon, 10 * epsilon))
    assumed = run("one_way_anova", [("A", a), ("B", b), ("C", c)], paired=True, sphericity="assume")
    assert value(assumed, "P value") == pytest.approx(stats.f.sf(f, 2, 10))


def test_friedman_matches_scipy_with_ties():
    a, b, c = [10, 12, 9, 15, 11, 13], [12, 12, 13, 18, 12, 17], [11, 16, 12, 21, 14, 15]
    out = run("one_way_anova", [("A", a), ("B", b), ("C", c)], paired=True, gaussian=False)
    reference = stats.friedmanchisquare(a, b, c)
    assert value(out, "Friedman statistic") == pytest.approx(reference.statistic)
    assert value(out, "P value") == pytest.approx(reference.pvalue)


@pytest.mark.parametrize("analysis,columns,options,message", [
    ("t_test", [("A", [1, 2]), ("B", [3, 4]), ("C", [5, 6])], {}, "exactly two"),
    ("t_test", [("A", [1, 1, 1]), ("B", [2, 2, 2])], {}, "zero variance"),
    ("t_test", [("A", [1, 2, 3]), ("B", [2, 3, 4])], {"paired": True}, "identical"),
    ("one_way_anova", [("A", [1, 1]), ("B", [2, 2]), ("C", [3, 3])], {}, "zero variance"),
    ("one_way_anova", [("A", [1, 2]), ("B", [2, 3]), ("C", [3, 5])], {"equal_sd": False, "comparisons": "vs_control"}, "Games-Howell"),
    ("one_way_anova", [("A", [5, 5, 5]), ("B", [5, 5, 5])], {"gaussian": False}, "varying"),
])
def test_degenerate_or_unsupported_designs_fail_with_explanations(analysis, columns, options, message):
    with pytest.raises(AnalysisError, match=message):
        run(analysis, columns, **options)


def test_api_returns_tables_and_comparisons_and_validates_options():
    client = TestClient(app)
    payload = dict(table_type="column", analysis="one_way_anova", columns=[dict(name="A", values=CONTROL), dict(name="B", values=TREATED), dict(name="C", values=THIRD)],
                   options=dict(method="sidak"))
    body = client.post("/api/analyze", json=payload).json()
    assert [t["title"] for t in body["tables"]] == ["ANOVA results", "ANOVA table", "Multiple comparisons"]
    assert len(body["comparisons"]) == 3
    assert client.post("/api/analyze", json={**payload, "options": {"method": "magic"}}).status_code == 422
    assert client.post("/api/analyze", json={**payload, "options": {"alpha": 0.9}}).status_code == 422


@pytest.mark.parametrize("k,df", [(2, 1), (3, 5), (5, 21), (10, 120), (20, 3000)])
def test_fast_studentized_range_matches_scipy(k, df):
    from gp.column_tests import studentized_range_ppf, studentized_range_sf
    q = np.array([0.2, 1.0, 2.5, 4.0, 6.0, 10.0])
    assert studentized_range_sf(q, k, df) == pytest.approx(stats.studentized_range.sf(q, k, df), abs=2e-8)
    assert studentized_range_ppf(0.95, k, df) == pytest.approx(stats.studentized_range.ppf(0.95, k, df), rel=1e-8)


def test_bracket_levels_match_screen_layout():
    from gp.models import GraphAnnotation
    from gp.plotting import bracket_levels
    pairs = [GraphAnnotation(a=0, b=2, label="**"), GraphAnnotation(a=1, b=0, label="*"), GraphAnnotation(a=1, b=2, label="ns")]
    placed = bracket_levels(pairs, {0: 10.0, 1: 12.0, 2: 11.0}, 1.0)
    # Adjacent spans sit lowest; the wide span stacks above both of them.
    assert placed == [(0, 1, 12.6, "*"), (1, 2, 13.6, "ns"), (0, 2, 14.6, "**")]
    assert bracket_levels([GraphAnnotation(a=0, b=3, label="*")], {0: 1.0, 1: 2.0}, 1.0) == []


def test_export_draws_pairwise_brackets_and_validates_them():
    client = TestClient(app)
    data = dict(table_type="column", analysis="descriptive", columns=[dict(name="A", values=CONTROL), dict(name="B", values=TREATED)])
    graph = {"type": "bar", "annotations": [{"a": 0, "b": 1, "label": "P=0.0123"}]}
    response = client.post("/api/export", json={"data": data, "graph": graph, "format": "svg"})
    assert response.status_code == 200, response.text[:200]
    assert "P=0.0123" in response.text
    for bad in [{"a": 0, "b": 30, "label": "*"}, {"a": 0, "b": 1, "label": ""}, {"a": 0, "b": 1, "label": "*", "x": 1}]:
        assert client.post("/api/export", json={"data": data, "graph": {"annotations": [bad]}, "format": "svg"}).status_code == 422


def test_graphpad_p_style_extremes_and_bartlett_minimum_size():
    from gp.column_tests import p_equation, p_text
    assert [p_text(p) for p in (0.00001, 0.0001, 0.5, 0.99989, 0.99991, 1.0)] == ["<0.0001", "0.0001", "0.5000", "0.9999", ">0.9999", ">0.9999"]
    assert [p_equation(p) for p in (0.00001, 0.02, 1.0)] == ["P<0.0001", "P=0.0200", "P>0.9999"]
    # Identical groups give an adjusted P of 1, shown as Prism shows it.
    out = run("one_way_anova", [("A", [1, 2, 3, 4]), ("B", [1, 2, 3, 4]), ("C", [5, 6, 7, 9])])
    first = table(out, "Multiple comparisons")["rows"][0]
    assert first[0] == "A vs. B" and first[-1] == ">0.9999" and first[-2] == "ns"
    # Four values per column: Brown-Forsythe is reported, Bartlett is not.
    sections = table(out, "ANOVA results")["rows"]
    assert ["Brown-Forsythe test"] in sections and ["Bartlett's test"] not in sections
    assert any("at least five values" in note for note in out["warnings"])
