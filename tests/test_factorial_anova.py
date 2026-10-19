"""Saved-result and independently calculable balanced ANOVA verification."""
import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from gp.factorial_anova import FactorialAnovaRequest, analyze_factorial
from gp.statistics import AnalysisError


FIXTURE = Path(__file__).parent / "fixtures" / "prism_two_way_saved.json"


def saved():
    return json.loads(FIXTURE.read_text())


def simple():
    return {
        "row_levels": ["A", "B"], "column_levels": ["X", "Y"],
        "cells": [
            {"row_level": "A", "column_level": "X", "values": [0, 2]},
            {"row_level": "A", "column_level": "Y", "values": [2, 4]},
            {"row_level": "B", "column_level": "X", "values": [4, 6]},
            {"row_level": "B", "column_level": "Y", "values": [8, 10]},
        ],
    }


def test_every_saved_prism_anova_term():
    fixture = saved()
    actual = analyze_factorial(FactorialAnovaRequest(**fixture["input"]))
    mapping = {"row_factor": "rowFactor", "column_factor": "colFactor",
               "interaction": "rowFactorVsColFactor", "residual": "residual", "total": "total"}
    for term in actual["anova_table"]:
        expected = fixture["expected"]["anova_table"][mapping[term["term"]]]
        for key in ("ss", "df", "ms"):
            if key in expected:
                assert term[key] == pytest.approx(expected[key], rel=2e-13, abs=0)
            else:
                assert term[key] is None
        if "fTest" in expected:
            assert term["f"] == pytest.approx(expected["fTest"]["f"], rel=2e-13, abs=0)
            # Stored decimal values are kept unchanged. The largest observed
            # p-value difference is 1.393e-14 absolute for interaction; separate
            # survival-function implementations differ at floating precision.
            assert term["p"] == pytest.approx(expected["fTest"]["pValue"]["value"], rel=1e-12, abs=0)
            assert term["variation_percent"] == pytest.approx(expected["variation"], rel=2e-13, abs=0)
        else:
            assert term["p"] is None and term["f"] is None
    assert sum(term["ss"] for term in actual["anova_table"][:-1]) == pytest.approx(actual["anova_table"][-1]["ss"], rel=2e-13)
    assert actual["design"]["observations"] == 36
    assert actual["design"]["replicates_per_cell"] == 4


def test_saved_grand_marginal_and_cell_means():
    fixture = saved()
    means = analyze_factorial(FactorialAnovaRequest(**fixture["input"]))["means"]
    expected = fixture["expected"]
    assert means["grand"] == pytest.approx(expected["grand_mean"], rel=2e-13)
    for axis, key in [("rows", "row_means"), ("columns", "column_means")]:
        for item in means[axis]:
            assert item["mean"] == pytest.approx(expected[key][item["level"]], rel=2e-13)
    cells = {(c["row_level"], c["column_level"]): c["mean"] for c in means["cells"]}
    for cell in expected["cell_means"]:
        assert cells[(cell["row_level"], cell["column_level"])] == pytest.approx(cell["mean"], rel=2e-13)


def test_independently_hand_calculated_two_by_two_design():
    output = analyze_factorial(FactorialAnovaRequest(**simple()))
    expected = [(50, 1, 50, 25), (18, 1, 18, 9), (2, 1, 2, 1), (8, 4, 2, None), (78, 7, None, None)]
    for actual, values in zip(output["anova_table"], expected):
        assert (actual["ss"], actual["df"], actual["ms"], actual["f"]) == values
    assert output["means"]["grand"] == 4.5


def test_explicit_labels_and_reordering_control_mapping():
    data = simple()
    baseline = analyze_factorial(FactorialAnovaRequest(**data))
    data["cells"].reverse()
    data["row_levels"].reverse()
    data["column_levels"].reverse()
    actual = analyze_factorial(FactorialAnovaRequest(**data))
    assert actual["anova_table"] == baseline["anova_table"]
    assert actual["means"]["rows"][0]["level"] == "B"


def test_translation_and_scale_preserve_f_tests():
    data = simple()
    baseline = analyze_factorial(FactorialAnovaRequest(**data))
    for cell in data["cells"]:
        cell["values"] = [value * 8 + 1e12 for value in cell["values"]]
    actual = analyze_factorial(FactorialAnovaRequest(**data))
    for before, after in zip(baseline["anova_table"], actual["anova_table"]):
        assert after["ss"] == before["ss"] * 64
        assert after["f"] == before["f"]
        assert after["p"] == before["p"]


@pytest.mark.parametrize("bad", [None, float("nan"), float("inf"), 1e101])
def test_missing_nonfinite_or_out_of_bounds_observation_rejected(bad):
    data = simple()
    data["cells"][0]["values"][0] = bad
    with pytest.raises(ValidationError):
        FactorialAnovaRequest(**data)


def test_missing_cell_rejected():
    data = saved()["input"]
    data["cells"].pop()
    with pytest.raises(ValidationError, match="every combination"):
        FactorialAnovaRequest(**data)


def test_duplicate_cell_rejected():
    data = simple()
    data["cells"][0] = copy.deepcopy(data["cells"][1])
    with pytest.raises(ValidationError, match="exactly once"):
        FactorialAnovaRequest(**data)


def test_unbalanced_rejected():
    data = simple()
    data["cells"][0]["values"].append(5)
    with pytest.raises(ValidationError, match="balanced"):
        FactorialAnovaRequest(**data)


@pytest.mark.parametrize("design", ["repeated_measures", "mixed", "random"])
def test_unsupported_design_not_silently_ordinary(design):
    data = simple()
    data["design"] = design
    with pytest.raises(ValidationError):
        FactorialAnovaRequest(**data)


@pytest.mark.parametrize("levels", [["A", "A"], ["A", " "], ["A"]])
def test_invalid_or_rank_deficient_factor_levels(levels):
    data = simple()
    data["row_levels"] = levels
    with pytest.raises(ValidationError):
        FactorialAnovaRequest(**data)


def test_unknown_level_rejected():
    data = simple()
    data["cells"][0]["row_level"] = "unknown"
    with pytest.raises(ValidationError, match="every combination"):
        FactorialAnovaRequest(**data)


def test_unreplicated_design_rejected():
    data = simple()
    for cell in data["cells"]:
        cell["values"] = cell["values"][:1]
    with pytest.raises(ValidationError):
        FactorialAnovaRequest(**data)


def test_zero_residual_variance_rejected_without_infinity():
    data = simple()
    for cell in data["cells"]:
        cell["values"] = [cell["values"][0]] * 2
    with pytest.raises(AnalysisError, match="residual variance"):
        analyze_factorial(FactorialAnovaRequest(**data))


def test_result_is_finite_json():
    json.dumps(analyze_factorial(FactorialAnovaRequest(**simple())), allow_nan=False)
