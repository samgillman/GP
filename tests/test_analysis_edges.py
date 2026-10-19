"""Scientific undefined cases and hostile input at the public API boundary."""
import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from gp.models import AnalysisRequest
from gp.server import app
from gp.statistics import AnalysisError, analyze
from gp.survival import analyze_survival


client = TestClient(app)


def request(kind, values, table_type="column", names=None):
    return AnalysisRequest(
        analysis=kind, table_type=table_type,
        columns=[{"name": names[i] if names else f"C{i}", "values": list(v)}
                 for i, v in enumerate(values)],
    )


def test_two_pairs_keep_t_and_cohen_d_but_hedges_g_is_undefined():
    output = analyze(request("paired_t", [[2, 5], [1, 2]]))
    rows = {row["label"]: row["value"] for row in output["results"]}
    assert rows["Degrees of freedom"] == 1
    assert rows["t statistic"] == pytest.approx(2)
    assert rows["Cohen d (paired differences)"] == pytest.approx(math.sqrt(2))
    assert rows["Hedges g (paired differences)"] is None
    assert any("Hedges g" in text and "undefined" in text and "three complete pairs" in text
               for text in output["warnings"])


def test_xy_descriptive_summarizes_only_y_without_dropping_unpaired_y():
    output = analyze(request("descriptive", [[100, None, 300], [1, 2, 3], [4, None, 6]], "xy"))
    assert [row["name"] for row in output["summary"]] == ["C1", "C2"]
    assert [row["n"] for row in output["summary"]] == [3, 2]
    assert [row["mean"] for row in output["summary"]] == [2, 5]
    assert output["summary"][0]["sum"] == 6


def test_xy_descriptive_requires_y_observations():
    with pytest.raises(AnalysisError, match="series being analyzed"):
        analyze(request("descriptive", [[1, 2, 3], [None, None, None]], "xy"))


@pytest.mark.parametrize("constant_first", [True, False])
def test_constant_dose_series_is_reported_without_losing_valid_fit(constant_first):
    x = np.array([0, .01, .1, 1, 10, 100])
    valid, constant = 10 + 90*x/(5+x), np.full(len(x), 7.)
    y = [constant, valid] if constant_first else [valid, constant]
    names = ["Dose", "Constant", "Valid"] if constant_first else ["Dose", "Valid", "Constant"]
    output = analyze(request("dose_response", [x, *y], "xy", names))
    assert [fit["series"] for fit in output["fit"]] == ["Valid"]
    assert output["fit"][0]["parameters"]["ec50"] == pytest.approx(5)
    rows = {row["label"]: row["value"] for row in output["results"]}
    assert "undefined" in rows["Constant: Fit status"]
    assert rows["Valid: EC50"] == pytest.approx(5)
    assert "Valid: Ec50" not in rows
    assert any(text.startswith("Constant:") and "constant" in text for text in output["warnings"])


def test_only_constant_dose_series_returns_explicit_undefined_error():
    with pytest.raises(AnalysisError, match="No Y series could be fitted.*Y is constant"):
        analyze(request("dose_response", [[0, .01, .1, 1, 10, 100], [4]*6], "xy"))


def test_all_constant_dose_series_returns_named_api_error():
    payload = request("dose_response", [[0, .01, .1, 1, 10, 100], [4]*6, [7]*6], "xy").model_dump()
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "No Y series could be fitted" in detail
    assert "C1: Fit status" in detail and "C2: Fit status" in detail


def test_no_event_logrank_has_explicit_reason_in_both_warning_levels():
    output = analyze_survival({"A": {"times": [1, 2], "events": [0, 0]},
                               "B": {"times": [2, 3], "events": [0, 0]}})
    test = output["logrank"]
    assert test["status"] == "undefined"
    assert "no events" in test["undefined_reason"]
    assert test["undefined_reason"] in test["warnings"]
    assert test["undefined_reason"] in output["warnings"]
    assert test["statistic"] is None and test["p_value"] is None
    assert test["df"] == 0  # Rank of the covariance; not an estimable test.


@pytest.mark.parametrize("value", [1e101, -1e101, 1e200, -1e200, 1e308, -1e308])
def test_extreme_input_validation_is_short_json_without_echoing_input(value):
    payload = {"columns": [{"name": "<script>alert(1)</script>", "values": [value]}]}
    for route, body in [("/api/analyze", payload), ("/api/export", {"data": payload})]:
        response = client.post(route, json=body)
        assert response.status_code == 422
        assert "1e100" in response.json()["detail"][0]["msg"]
        assert "input" not in response.json()["detail"][0]
        assert "pydantic.dev" not in response.text
        assert len(response.text) < 400


def test_numeric_cap_boundary_is_supported():
    response = client.post("/api/analyze", json={"columns": [
        {"name": "Boundary", "values": [-1e100, 0, 1e100]}]})
    assert response.status_code == 200
    assert response.json()["summary"][0]["sd"] == pytest.approx(1e100)


@pytest.mark.parametrize("analysis", ["welch_t", "paired_t", "anova"])
def test_constant_groups_report_scientific_error_even_with_hostile_names(analysis):
    response = client.post("/api/analyze", json={"analysis": analysis, "columns": [
        {"name": "<script>alert(1)</script>", "values": [1, 1, 1]},
        {"name": "__proto__", "values": [2, 2, 2]}]})
    assert response.status_code == 422
    assert "zero variance" in response.json()["detail"] or "variance is zero" in response.json()["detail"]


def test_hostile_names_remain_literal_data_in_json_and_svg():
    name = '<script>alert("x")</script> & $literal$'
    data = {"columns": [{"name": name, "values": [1, 2, 3]}]}
    response = client.post("/api/analyze", json=data)
    assert response.status_code == 200
    assert response.json()["summary"][0]["name"] == name
    export = client.post("/api/export", json={"data": data, "format": "svg"})
    assert export.status_code == 200
    assert "<script>" not in export.text
    assert "&lt;script&gt;" in export.text
