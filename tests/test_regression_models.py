"""Independent numerical checks; these are not Prism runtime parity tests."""

import math
import json
from pathlib import Path

import numpy as np
import pytest

from gp.regression_models import (
    MODEL_REGISTRY,
    ModelFitError,
    evaluate_model,
    fit_model,
)

INHIBITION_REFERENCE = json.loads(
    (
        Path(__file__).parent / "fixtures/prism_normalized_inhibition_saved.json"
    ).read_text()
)

CASES = [
    ("one_phase_decay", np.linspace(0, 12, 50), {"Y0": 12.0, "Plateau": 2.0, "K": 0.7}),
    (
        "one_phase_association",
        np.linspace(0, 12, 50),
        {"Y0": 2.0, "Plateau": 12.0, "K": 0.7},
    ),
    (
        "two_phase_decay",
        np.linspace(0, 30, 100),
        {"Y0": 12.0, "Plateau": 2.0, "PercentFast": 35.0, "KFast": 1.5, "KSlow": 0.15},
    ),
    ("michaelis_menten", np.linspace(0, 50, 50), {"Vmax": 20.0, "Km": 4.0}),
    ("gaussian", np.linspace(-8, 12, 60), {"Amplitude": 7.0, "Mean": 2.0, "SD": 1.5}),
    ("straight_line", np.linspace(-20, 20, 20), {"YIntercept": -3.0, "Slope": 2.0}),
    (
        "log_dose_stimulation",
        np.linspace(-12, -2, 60),
        {"Bottom": 5.0, "Top": 95.0, "LogEC50": -7.0, "HillSlope": 1.2},
    ),
    (
        "log_dose_inhibition",
        np.linspace(-12, -2, 60),
        {"Bottom": 5.0, "Top": 95.0, "LogIC50": -7.0, "HillSlope": -1.2},
    ),
]


@pytest.mark.parametrize("model,x,parameters", CASES)
def test_synthetic_recovery(model, x, parameters):
    y = evaluate_model(model, x, parameters)
    result = fit_model(model, x, y)
    assert result["parameters"] == pytest.approx(parameters, rel=1e-5, abs=1e-6)
    assert result["r_squared"] == pytest.approx(1.0)
    assert result["residual_df"] == len(x) - len(parameters)
    assert len(result["points"]) == 200
    assert result["source"] == MODEL_REGISTRY[model]["source"]
    assert "Prism optimizer" in result["warnings"][0]


def test_known_curve_values():
    # Hand-derived points protect algebra, units, parameter order and Hill sign.
    assert evaluate_model(
        "one_phase_decay", [0, math.log(2)], {"Y0": 12, "Plateau": 2, "K": 1}
    ) == pytest.approx([12, 7])
    assert evaluate_model(
        "one_phase_association", [0, math.log(2)], {"Y0": 2, "Plateau": 12, "K": 1}
    ) == pytest.approx([2, 7])
    assert evaluate_model(
        "two_phase_decay",
        [0, 1],
        {"Y0": 12, "Plateau": 2, "PercentFast": 30, "KFast": 2, "KSlow": 1},
    ) == pytest.approx([12, 2 + 3 * math.exp(-2) + 7 * math.exp(-1)])
    assert evaluate_model(
        "michaelis_menten", [0, 4, 12], {"Vmax": 20, "Km": 4}
    ) == pytest.approx([0, 10, 15])
    assert evaluate_model(
        "gaussian", [2, 5], {"Amplitude": 7, "Mean": 2, "SD": 3}
    ) == pytest.approx([7, 7 * math.exp(-0.5)])
    assert evaluate_model(
        "straight_line", [-2, 3], {"YIntercept": -3, "Slope": 2}
    ) == pytest.approx([-7, 3])
    for model, midpoint, slope, expected in [
        ("log_dose_stimulation", "LogEC50", 1, [10, 50, 90]),
        ("log_dose_inhibition", "LogIC50", -1, [90, 50, 10]),
    ]:
        assert evaluate_model(
            model,
            [-8, -7, -6],
            {"Bottom": 1, "Top": 99, midpoint: -7, "HillSlope": slope},
        ) == pytest.approx(expected, abs=0.1)


@pytest.mark.parametrize("xscale,yscale", [(1e-8, 1e8), (1e8, 1e-8)])
def test_scaled_units(xscale, yscale):
    x = np.linspace(0, 12, 50) * xscale
    parameters = {"Y0": 12 * yscale, "Plateau": 2 * yscale, "K": 0.7 / xscale}
    fit = fit_model(
        "one_phase_decay", x, evaluate_model("one_phase_decay", x, parameters)
    )
    assert fit["parameters"] == pytest.approx(parameters, rel=1e-5, abs=1e-20)


def test_shifted_gaussian():
    x = np.linspace(1e8 - 8, 1e8 + 12, 60)
    parameters = {"Amplitude": 7, "Mean": 1e8 + 2, "SD": 1.5}
    fit = fit_model("gaussian", x, evaluate_model("gaussian", x, parameters))
    assert fit["parameters"] == pytest.approx(parameters, rel=1e-7)


@pytest.mark.parametrize("model,x,parameters", CASES)
def test_source_identity(model, x, parameters):
    metadata = MODEL_REGISTRY[model]
    assert metadata["parameters"] == list(parameters)
    assert metadata["source"]["relative_path"].startswith(
        "SharedSupport/Equations/Cache/"
    )
    assert len(metadata["source"]["sha256"]) == 64
    assert metadata["source"]["object_index"] >= 0


@pytest.mark.parametrize(
    "x,y",
    [
        ([], []),
        ([1, 2, math.nan], [1, 2, 3]),
        ([1, 2, 3], [1, 2, math.inf]),
        ([1, 1, 1], [1, 2, 3]),
        ([1, 2, 3], [1, 2]),
        ([1e101, 2, 3], [1, 2, 3]),
    ],
)
def test_invalid_fit_data(x, y):
    with pytest.raises(ModelFitError):
        fit_model("straight_line", x, y)


def test_parameter_domains():
    for model, x, parameters in CASES:
        if MODEL_REGISTRY[model]["x_domain"] == "nonnegative":
            with pytest.raises(ModelFitError, match="nonnegative"):
                evaluate_model(model, [-1], parameters)
        for parameter in ("K", "KFast", "KSlow", "Km", "SD"):
            if parameter in parameters:
                with pytest.raises(ModelFitError, match="strictly positive"):
                    evaluate_model(model, x, {**parameters, parameter: 0})
        with pytest.raises(ModelFitError, match="exactly"):
            evaluate_model(model, x, {**parameters, "typo": 1})
    with pytest.raises(ModelFitError, match="PercentFast"):
        evaluate_model("two_phase_decay", [0], {**CASES[2][2], "PercentFast": 101})
    with pytest.raises(ModelFitError, match="Unknown"):
        fit_model("unknown", [1], [1])


def test_constant_data_and_weak_identification():
    with pytest.raises(ModelFitError, match="Constant Y"):
        fit_model("one_phase_decay", np.arange(10), np.ones(10))
    result = fit_model("straight_line", np.arange(10), np.ones(10))
    assert result["r_squared"] is None
    # A single exponential fitted with two components cannot identify both rates.
    x = np.linspace(0, 20, 50)
    y = 2 + 10 * np.exp(-x * 0.5)
    result = fit_model("two_phase_decay", x, y)
    assert any("weakly" in message for message in result["warnings"])


def test_log_dose_extreme_values_are_stable_and_direction_is_preserved():
    p = {"Bottom": 5, "Top": 95, "LogIC50": -7, "HillSlope": -2}
    assert evaluate_model("log_dose_inhibition", [-1e10, -7, 1e10], p) == pytest.approx(
        [95, 50, 5]
    )
    x = np.linspace(-12, -2, 60)
    fit = fit_model(
        "log_dose_inhibition",
        x,
        evaluate_model("log_dose_inhibition", x, {**p, "HillSlope": 2}),
    )
    assert fit["parameters"]["HillSlope"] > 0
    assert any("opposite" in warning for warning in fit["warnings"])


@pytest.mark.parametrize("model,x,parameters", CASES)
def test_noisy_data_fit_is_finite(model, x, parameters):
    expected = evaluate_model(model, x, parameters)
    y = expected + np.random.default_rng(491).normal(0, np.ptp(expected) * 0.01, len(x))
    result = fit_model(model, x, y)
    assert result["r_squared"] > 0.99
    assert result["sse"] > 0
    assert all(np.isfinite(list(result["parameters"].values())))


def test_insufficient_range_warns_for_saturation_fit():
    x = np.linspace(0, 1, 30)
    y = evaluate_model("michaelis_menten", x, {"Vmax": 20, "Km": 5})
    result = fit_model("michaelis_menten", x, y)
    assert any("extrapolated" in warning for warning in result["warnings"])


@pytest.mark.parametrize("group", INHIBITION_REFERENCE["groups"])
def test_normalized_inhibition_saved_estimates_and_sse(group):
    sample = INHIBITION_REFERENCE["groups"][group]
    raw = fit_model("normalized_dose_inhibition", sample["x"], sample["y"])
    logarithmic = fit_model(
        "normalized_log_dose_inhibition", np.log10(sample["x"]), sample["y"]
    )
    expected = sample["expected_parameters"]
    # Tolerance allows numerical optimizer variation; no claims about native
    # iteration counts, standard errors, or profile-likelihood confidence limits.
    assert raw["parameters"]["IC50"] == pytest.approx(expected["IC50"], rel=2e-7)
    assert raw["parameters"]["HillSlope"] == pytest.approx(
        expected["HillSlope"], rel=2e-7
    )
    assert logarithmic["parameters"]["LogIC50"] == pytest.approx(
        expected["logIC50"], abs=2e-7
    )
    assert logarithmic["parameters"]["HillSlope"] == pytest.approx(
        expected["HillSlope"], rel=2e-7
    )
    for result in (raw, logarithmic):
        assert result["sse"] == pytest.approx(sample["expected_sse"], rel=2e-10)
        assert result["r_squared"] == pytest.approx(
            sample["expected_r_squared"], abs=2e-10
        )
        assert result["residual_df"] == sample["expected_df"] == 16
        assert "confidence intervals have not been reproduced" in result["warnings"][0]


def test_normalized_inhibition_hand_values_and_raw_log_equivalence():
    raw = {"IC50": 10, "HillSlope": -1}
    logged = {"LogIC50": 1, "HillSlope": -1}
    assert evaluate_model(
        "normalized_dose_inhibition", [1, 10, 100], raw
    ) == pytest.approx([100 / 1.1, 50, 100 / 11])
    assert evaluate_model(
        "normalized_log_dose_inhibition", [0, 1, 2], logged
    ) == pytest.approx([100 / 1.1, 50, 100 / 11])
    x = np.geomspace(1e-50, 1e50, 40)
    assert evaluate_model("normalized_dose_inhibition", x, raw) == pytest.approx(
        evaluate_model("normalized_log_dose_inhibition", np.log10(x), logged)
    )
    assert MODEL_REGISTRY["normalized_dose_inhibition"]["source"]["object_index"] == 209
    assert (
        MODEL_REGISTRY["normalized_log_dose_inhibition"]["source"]["object_index"]
        == 108
    )


@pytest.mark.parametrize("scale", [1e-12, 1.0, 1e12])
def test_normalized_inhibition_synthetic_recovery_and_units(scale):
    x = np.geomspace(0.01, 1000, 40) * scale
    params = {"IC50": 10 * scale, "HillSlope": -0.8}
    y = evaluate_model("normalized_dose_inhibition", x, params)
    result = fit_model("normalized_dose_inhibition", x, y)
    assert result["parameters"] == pytest.approx(params, rel=1e-6, abs=1e-20)
    assert result["sse"] < 1e-12


def test_normalized_inhibition_domains_and_direction():
    params = {"IC50": 10, "HillSlope": -1}
    for invalid in (0, -1):
        with pytest.raises(ModelFitError, match="positive"):
            evaluate_model("normalized_dose_inhibition", [invalid], params)
        with pytest.raises(ModelFitError, match="positive"):
            fit_model(
                "normalized_dose_inhibition", [invalid, 1, 10, 100], [90, 80, 50, 20]
            )
        with pytest.raises(ModelFitError, match="positive"):
            evaluate_model(
                "normalized_dose_inhibition", [1], {**params, "IC50": invalid}
            )
    x = np.geomspace(0.01, 1000, 40)
    y = evaluate_model("normalized_dose_inhibition", x, {**params, "HillSlope": 1})
    result = fit_model("normalized_dose_inhibition", x, y)
    assert result["parameters"]["HillSlope"] > 0
    assert any("opposite" in warning for warning in result["warnings"])
    with pytest.raises(ModelFitError, match="Constant"):
        fit_model("normalized_dose_inhibition", x, np.full(len(x), 50.0))


def test_normalized_inhibition_does_not_rescale_observations():
    # The reference contains responses over 100; these are noisy observations,
    # not values to clip or normalize before fitting fixed 0/100 plateaus.
    sample = INHIBITION_REFERENCE["groups"]["Inhibitor C"]
    assert max(sample["y"]) > 100
    result = fit_model("normalized_dose_inhibition", sample["x"], sample["y"])
    clipped = fit_model(
        "normalized_dose_inhibition", sample["x"], np.clip(sample["y"], 0, 100)
    )
    assert abs(result["parameters"]["IC50"] - clipped["parameters"]["IC50"]) > 0.1
