import math
import numpy as np
import pytest
from gp.models import AnalysisRequest
from gp.statistics import AnalysisError, analyze


def request(kind, columns, table_type="column", confidence=.95):
    return AnalysisRequest(analysis=kind, table_type=table_type, columns=[{"name": chr(65+i), "values": list(v)} for i,v in enumerate(columns)], confidence=confidence)


def result_map(output):
    return {r["label"]: r["value"] for r in output["results"]}


def test_sample_sd_sem_and_t_mean_interval():
    output = analyze(request("descriptive", [[2,4,4,4,5,5,7,9], [None, 7]]))
    a, b = output["summary"]
    assert a["n"] == 8
    assert a["mean"] == 5
    assert a["sd"] == pytest.approx(math.sqrt(32/7))
    assert a["sem"] == pytest.approx(math.sqrt(4/7))
    assert a["ci_low"] == pytest.approx(5-2.364624251*math.sqrt(4/7))
    assert a["ci_high"] == pytest.approx(5+2.364624251*math.sqrt(4/7))
    assert a["median"] == 4.5
    assert b["mean"] == 7 and b["sd"] is None and b["ci_low"] is None


def test_welch_reference_equal_variance_case():
    output = result_map(analyze(request("welch_t", [[1,2,3], [4,5,6]])))
    assert output["Mean difference (first − second)"] == -3
    assert output["t statistic"] == pytest.approx(-math.sqrt(13.5))
    assert output["Degrees of freedom"] == 4
    assert output["Two-sided p value"] == pytest.approx(.0213116411287567)
    assert output["Difference CI lower"] == pytest.approx(-3-2.776445105*math.sqrt(2/3))


def test_welch_unequal_sizes_and_variances_against_scipy():
    from scipy.stats import ttest_ind
    a, b = [1,2,3,4], [2,8,13,17,25,31]
    output = result_map(analyze(request("welch_t", [a,b])))
    expected = ttest_ind(a,b,equal_var=False)
    assert output["t statistic"] == pytest.approx(expected.statistic)
    assert output["Degrees of freedom"] == pytest.approx(expected.df)
    assert output["Two-sided p value"] == pytest.approx(expected.pvalue)


def test_paired_does_not_compress_missing_rows():
    output = result_map(analyze(request("paired_t", [[1,None,3,4,8], [0,9,1,None,4]])))
    assert output["Complete pairs"] == 3
    assert output["Mean difference (first − second)"] == pytest.approx(7/3)
    assert output["t statistic"] == pytest.approx(math.sqrt(7))
    assert output["Two-sided p value"] == pytest.approx(1-math.sqrt(7)/3)


def test_anova_analytical_reference():
    output = result_map(analyze(request("anova", [[1,2,3],[4,5,6],[7,8,9]])))
    assert output["F statistic"] == 27
    assert output["p value"] == pytest.approx(.001)
    assert output["Eta squared"] == .9
    assert output["Between-group degrees of freedom"] == 2
    assert output["Within-group degrees of freedom"] == 6


def test_linear_regression_matches_manual_least_squares():
    output = analyze(request("linear_regression", [[1,2,None,3,4], [2,4,100,5,4]], "xy"))
    results = result_map(output)
    assert results["B: Slope"] == pytest.approx(.7)
    assert results["B: Intercept"] == pytest.approx(2)
    assert results["B: R squared"] == pytest.approx(2.45/4.75)
    assert results["B: Complete pairs"] == 4
    assert len(output["fit"][0]["points"]) == 200


def test_constant_y_regression_reports_undefined_r_squared():
    output = result_map(analyze(request("linear_regression", [[1,2,3,4], [5,5,5,5]], "xy")))
    assert output["B: Slope"] == 0
    assert output["B: R squared"] is None
    assert output["B: Two-sided slope p value"] is None


@pytest.mark.parametrize("hill", [1.3, -1.3])
def test_four_parameter_logistic_recovers_known_parameters(hill):
    x = np.geomspace(.01,1000,25)
    y = 3 + (97-3)/(1+(4/x)**hill)
    output = analyze(request("dose_response", [x,y], "xy"))
    params = output["fit"][0]["parameters"]
    assert params["bottom"] == pytest.approx(3, abs=1e-5)
    assert params["top"] == pytest.approx(97, abs=1e-5)
    assert params["ec50"] == pytest.approx(4, rel=1e-5)
    assert params["hill_slope"] == pytest.approx(hill, rel=1e-5)


@pytest.mark.parametrize("kind,columns,table_type", [
    ("welch_t", [[1],[2,3]], "column"),
    ("welch_t", [[1,1],[2,2]], "column"),
    ("paired_t", [[1,2,3],[2,3,4]], "column"),
    ("anova", [[1,1],[2,2]], "column"),
    ("linear_regression", [[1,1,1],[2,3,4]], "xy"),
    ("dose_response", [[0,1,2,3,4,5],[1,3,4,5,6,7]], "xy"),
    ("dose_response", [[1,2,3,4,5],[1,3,4,5,6]], "xy"),
    ("descriptive", [[None]], "column"),
    ("linear_regression", [[1,2,3],[2,3,4]], "column"),
])
def test_degenerate_or_incompatible_data_give_actionable_error(kind, columns, table_type):
    with pytest.raises(AnalysisError):
        analyze(request(kind, columns, table_type))
