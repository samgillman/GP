"""Zero-dose boundary and fit-inclusion checks; no Prism runtime-parity claim."""
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from gp.models import AnalysisRequest
from gp.regression_models import ModelFitError, evaluate_model, fit_model
from gp.server import app
from gp.statistics import AnalysisError, analyze


def dose_request(x, y):
    return AnalysisRequest(
        table_type="xy", analysis="dose_response",
        columns=[{"name": "Dose", "values": list(x)}, {"name": "Response", "values": list(y)}],
    )


@pytest.mark.parametrize("hill,expected", [(1, [0, 50, 100/1.1]), (-1, [100, 50, 100/11]), (0, [50, 50, 50])])
def test_zero_dose_evaluation_uses_finite_plateau_limits(hill, expected):
    # Positive/negative/zero slopes have distinct mathematical limits at zero.
    # Raising floating errors ensures the calculation never evaluates log(0).
    with np.errstate(all="raise"):
        result = evaluate_model("normalized_dose_inhibition", [0, 10, 100], {"IC50": 10, "HillSlope": hill})
    assert result == pytest.approx(expected)


@pytest.mark.parametrize("hill", [1.3, -1.3])
@pytest.mark.parametrize("unit", [1e-12, 1.0, 1e12])
def test_four_pl_recovers_zero_controls_in_both_directions_and_units(hill, unit):
    positive = np.geomspace(.01, 1000, 25)*unit
    x = np.concatenate(([0, 0], positive))
    # Independent algebra on positive X; assign zero's known limiting plateau.
    y = np.concatenate(([3 if hill > 0 else 97]*2, 3+94/(1+(4*unit/positive)**hill)))
    with np.errstate(over="raise", divide="raise", invalid="raise"):
        outcome = analyze(dose_request(x, y))
    fit = outcome["fit"][0]
    assert fit["parameters"]["bottom"] == pytest.approx(3, abs=1e-5)
    assert fit["parameters"]["top"] == pytest.approx(97, abs=1e-5)
    assert fit["parameters"]["ec50"] == pytest.approx(4*unit, rel=1e-5, abs=1e-30)
    assert fit["parameters"]["hill_slope"] == pytest.approx(hill, rel=1e-5)
    results = {r["label"]: r["value"] for r in outcome["results"]}
    assert results["Response: Complete pairs"] == len(x)
    assert results["Response: Residual degrees of freedom"] == len(x)-4
    assert len(fit["points"]) == 200
    assert fit["points"][0] == pytest.approx({"x": 0, "y": 3 if hill > 0 else 97}, abs=1e-5)
    assert all(p["x"] > 0 for p in fit["points"][1:])
    assert any("Zero-dose observations are included" in w for w in outcome["warnings"])
    json.dumps(outcome, allow_nan=False)


def test_zero_controls_affect_fitted_free_plateau_not_just_sample_counts():
    positive = np.geomspace(.1, 100, 15)
    positive_y = 3+94/(1+4/positive)
    without = analyze(dose_request(positive, positive_y))["fit"][0]["parameters"]
    # Deliberately discordant zero controls must enter the fit objective.
    x = np.concatenate((np.zeros(10), positive))
    y = np.concatenate((np.full(10, 20.), positive_y))
    with_zero = analyze(dose_request(x, y))["fit"][0]["parameters"]
    assert with_zero["bottom"] > without["bottom"]+5


@pytest.mark.parametrize("hill", [-.8, .8])
@pytest.mark.parametrize("unit", [1e-12, 1., 1e12])
def test_normalized_zero_controls_enter_sse_and_df(hill, unit):
    positive = np.geomspace(.01, 1000, 40)*unit
    positive_y = 100/(1+(10*unit/positive)**hill)
    endpoint = 100 if hill < 0 else 0
    x = np.concatenate(([0, 0, 0], positive))
    y = np.concatenate(([endpoint-10, endpoint, endpoint+10], positive_y))
    with np.errstate(over="raise", divide="raise", invalid="raise"):
        fit = fit_model("normalized_dose_inhibition", x, y)
    assert fit["parameters"]["IC50"] == pytest.approx(10*unit, rel=1e-6, abs=1e-30)
    assert fit["parameters"]["HillSlope"] == pytest.approx(hill, rel=1e-6)
    assert fit["sse"] == pytest.approx(200, abs=1e-8)
    assert fit["residual_df"] == len(x)-2
    assert fit["points"][0] == {"x": 0., "y": float(endpoint)}
    assert len(fit["points"]) == 200
    assert any("Zero-dose observations are included" in w for w in fit["warnings"])
    json.dumps(fit, allow_nan=False)


def test_zero_controls_do_not_create_identifiable_positive_dose_range():
    with pytest.raises(ModelFitError, match="two distinct positive"):
        fit_model("normalized_dose_inhibition", [0,0,0,1,1], [100,98,101,50,51])
    with pytest.raises(AnalysisError, match="four distinct"):
        analyze(dose_request([0,0,1,1,2,2], [3,4,10,11,20,19]))
    with pytest.raises(ModelFitError, match="distinct X"):
        fit_model("normalized_dose_inhibition", [0,0,0], [98,100,101])


def test_log_dose_zero_is_log10_concentration_one_not_a_zero_control():
    # This is an already-log model: X=0 means concentration 1, with negative X allowed.
    result = evaluate_model("normalized_log_dose_inhibition", [-1,0,1], {"LogIC50": 0, "HillSlope": -1})
    assert result == pytest.approx([100/1.1, 50, 100/11])
    x = np.linspace(-3, 3, 31)
    y = 100/(1+10**x)
    fit = fit_model("normalized_log_dose_inhibition", x, y)
    assert fit["parameters"] == pytest.approx({"LogIC50": 0, "HillSlope": -1}, abs=1e-6)
    assert fit["points"][0]["x"] == -3
    assert not any("Zero-dose" in w for w in fit["warnings"])


@pytest.mark.parametrize("analysis", ["dose_response", "nonlinear_regression"])
def test_api_keeps_zero_rows_and_missing_pair_alignment(analysis):
    positive = np.geomspace(.01,1000,24)
    y = (100/(1+positive/10)).tolist()
    payload = {
        "table_type": "xy", "analysis": analysis,
        "regression_model": "normalized_dose_inhibition",
        "columns": [
            {"name": "Dose", "values": [0, None, 0, *positive.tolist()]},
            {"name": "Response", "values": [100, 99999, None, *y]},
        ],
    }
    response = TestClient(app).post("/api/analyze", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    params = result["fit"][0]["parameters"]
    midpoint_key = "ec50" if analysis == "dose_response" else "IC50"
    assert params[midpoint_key] == pytest.approx(10, rel=1e-5)
    values = {r["label"]: r["value"] for r in result["results"]}
    assert values["Response: Residual degrees of freedom"] == len(positive)+1-(4 if analysis == "dose_response" else 2)
    assert result["fit"][0]["points"][0]["x"] == 0
    assert any("Missing observations" in w for w in result["warnings"])
    json.dumps(result, allow_nan=False)


def test_log_export_filters_only_display_coordinates(monkeypatch):
    from matplotlib.axes import Axes
    from gp.models import ExportRequest
    from gp.plotting import export_plot

    positive = np.geomspace(.01,1000,24)
    x = np.concatenate(([0], positive))
    y = np.concatenate(([3], 3+94/(1+4/positive)))
    plotted, scattered = [], []
    original_plot, original_scatter = Axes.plot, Axes.scatter

    def record_plot(self, px, py, *args, **kwargs):
        plotted.append(np.asarray(px))
        return original_plot(self, px, py, *args, **kwargs)

    def record_scatter(self, px, py, *args, **kwargs):
        scattered.append(np.asarray(px))
        return original_scatter(self, px, py, *args, **kwargs)

    monkeypatch.setattr(Axes, "plot", record_plot)
    monkeypatch.setattr(Axes, "scatter", record_scatter)
    result = export_plot(ExportRequest(data=dose_request(x, y), format="svg"))
    assert result.startswith(b"<?xml")
    assert len(scattered[0]) == len(positive)
    assert len(plotted[0]) == 199
    assert np.all(scattered[0] > 0) and np.all(plotted[0] > 0)
    # Export filtering is separate from the full-precision fit endpoint.
    assert analyze(dose_request(x, y))["fit"][0]["points"][0]["x"] == 0


@pytest.mark.parametrize("direction", [1, -1])
def test_effectively_exact_four_pl_stops_after_correct_direction(direction, monkeypatch):
    from gp import statistics
    calls = []
    original = statistics.optimize.curve_fit

    def count_starts(*args, **kwargs):
        calls.append(kwargs["p0"][-1])
        return original(*args, **kwargs)

    monkeypatch.setattr(statistics.optimize, "curve_fit", count_starts)
    x = np.array([0, .01, .1, 1, 10, 100])
    y = 10+90*x/(5+x) if direction > 0 else 100-90*x/(5+x)
    result = analyze(dose_request(x, y))
    assert calls == [float(direction)]
    assert result["fit"][0]["parameters"]["ec50"] == pytest.approx(5, rel=1e-6)
    assert result["fit"][0]["parameters"]["hill_slope"] == pytest.approx(direction, abs=1e-6)


def test_noisy_four_pl_still_compares_both_directions(monkeypatch):
    from gp import statistics
    calls = []
    original = statistics.optimize.curve_fit

    def count_starts(*args, **kwargs):
        calls.append(kwargs["p0"][-1])
        return original(*args, **kwargs)

    monkeypatch.setattr(statistics.optimize, "curve_fit", count_starts)
    x = np.concatenate(([0], np.geomspace(.01,100,15)))
    y = 10+90*x/(5+x)+np.random.default_rng(48).normal(0, .5, len(x))
    result = analyze(dose_request(x, y))
    assert calls == [1., -1.]
    assert np.isfinite(result["fit"][0]["parameters"]["ec50"])
