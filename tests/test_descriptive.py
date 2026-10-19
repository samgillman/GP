import json
import math
from pathlib import Path

import numpy as np
import pytest

from gp.descriptive import DescriptiveError, EXTRA_FIELDS, extended_summary

REFERENCE = json.loads(
    (Path(__file__).parent / "fixtures/prism_descriptive_saved.json").read_text()
)
SOURCE_FIELDS = {
    "sum": "sum",
    "range": "range",
    "coeffOfVariation": "cv_percent",
    "skewness": "skewness",
    "kurtosis": "excess_kurtosis",
    "firstQuartile": "q1",
    "thirdQuartile": "q3",
    "percentiles.lower": "p10",
    "percentiles.upper": "p90",
    "geometricMean": "geometric_mean",
    "geometricSD": "geometric_sd_factor",
    "geometricMeanCI.lower": "geometric_ci_low",
    "geometricMeanCI.upper": "geometric_ci_high",
    **{
        f"qcLines.mean{sign.title()}{i}SD": f"qc_mean_{sign}_{i}sd"
        for i in (1, 2, 3)
        for sign in ("minus", "plus")
    },
}


@pytest.mark.parametrize("name", REFERENCE["groups"])
def test_all_saved_extended_values(name):
    sample = REFERENCE["groups"][name]
    result = extended_summary(sample["values"], REFERENCE["confidence"])
    assert len(sample["expected"]) == len(SOURCE_FIELDS) == 19
    for source, expected in sample["expected"].items():
        assert result[SOURCE_FIELDS[source]] == pytest.approx(
            expected, rel=1e-12, abs=1e-12
        ), source
    assert result["undefined_reasons"] == {}
    assert result["warnings"] == []


def test_preserves_core_summary_fields_by_not_returning_them():
    result = extended_summary([1, 2, 3, 4])
    assert not {
        "name",
        "n",
        "mean",
        "sd",
        "sem",
        "median",
        "min",
        "max",
        "ci_low",
        "ci_high",
    }.intersection(result)


def test_type6_quantiles_and_percentile_interpretation():
    result = extended_summary(np.arange(1, 20))
    assert (result["q1"], result["q3"]) == (5, 15)
    assert (result["p10"], result["p90"]) == (2, 18)
    # A central90% interval would instead use ranks1 and19 for this dataset.
    small = extended_summary([2, 10])
    assert (small["q1"], small["q3"], small["p10"], small["p90"]) == (2, 10, 2, 10)
    tied = extended_summary([1, 1, 1, 4, 4])
    assert (tied["q1"], tied["q3"], tied["p10"], tied["p90"]) == (1, 4, 1, 4)


def test_geometric_hand_calculation():
    result = extended_summary([1, math.e**2, math.e**4])
    assert result["geometric_mean"] == pytest.approx(math.e**2)
    assert result["geometric_sd_factor"] == pytest.approx(math.e**2)
    # t(.975,2)=4.302652729696142 and sampleSD(log X)=2.
    half = 4.302652729696142 * 2 / math.sqrt(3)
    assert result["geometric_ci_low"] == pytest.approx(math.exp(2 - half))
    assert result["geometric_ci_high"] == pytest.approx(math.exp(2 + half))


@pytest.mark.parametrize("data", [[0, 1, 3], [-1, 1, 3], [-3, -2, -1]])
def test_nonpositive_values_are_not_dropped_for_geometric_metrics(data):
    result = extended_summary(data)
    assert result["sum"] == sum(data)
    for field in EXTRA_FIELDS:
        if field.startswith("geometric_"):
            assert result[field] is None
            assert "not discarded" in result["undefined_reasons"][field]


def test_empty_and_single_observation():
    empty = extended_summary([])
    assert all(empty[field] is None for field in EXTRA_FIELDS)
    assert set(empty["undefined_reasons"]) == set(EXTRA_FIELDS)
    one = extended_summary([4])
    assert one["sum"] == one["q1"] == one["q3"] == 4
    assert one["range"] == 0
    assert one["geometric_mean"] == pytest.approx(4)
    for field in (
        "cv_percent",
        "skewness",
        "excess_kurtosis",
        "geometric_sd_factor",
        "geometric_ci_low",
        "qc_mean_plus_1sd",
    ):
        assert one[field] is None
        assert field in one["undefined_reasons"]


def test_sample_size_and_constant_moment_domains():
    two = extended_summary([1, 2])
    assert two["skewness"] is two["excess_kurtosis"] is None
    three = extended_summary([1, 2, 3])
    assert three["skewness"] == pytest.approx(0)
    assert three["excess_kurtosis"] is None
    four = extended_summary([1, 2, 3, 4])
    assert four["skewness"] == pytest.approx(0)
    assert four["excess_kurtosis"] == pytest.approx(-1.2)
    constant = extended_summary([4] * 5)
    assert constant["skewness"] is constant["excess_kurtosis"] is None
    assert constant["cv_percent"] == 0
    assert constant["geometric_sd_factor"] == 1
    assert constant["geometric_ci_low"] == pytest.approx(4)
    assert constant["geometric_ci_high"] == pytest.approx(4)


@pytest.mark.parametrize("data", [[-1, 1], [-4, -3, -2], [0, 0, 0]])
def test_nonpositive_mean_cv_is_explicitly_unsupported(data):
    result = extended_summary(data)
    assert result["cv_percent"] is None
    assert "positive arithmetic mean" in result["undefined_reasons"]["cv_percent"]


def test_finite_outputs_with_extreme_dynamic_range():
    result = extended_summary([5e-324, 1e100])
    assert result["geometric_mean"] > 0
    assert result["geometric_ci_low"] is None
    assert result["geometric_ci_high"] is None
    assert "numerical range" in result["undefined_reasons"]["geometric_ci_low"]
    for field in EXTRA_FIELDS:
        assert result[field] is None or math.isfinite(result[field])
    # Sample SD and scale-free moments remain usable in very small units.
    tiny = extended_summary([1e-300, 2e-300, 3e-300, 4e-300])
    ordinary = extended_summary([1, 2, 3, 4])
    for field in ("cv_percent", "skewness", "excess_kurtosis"):
        assert tiny[field] == pytest.approx(ordinary[field], abs=1e-12)


def test_location_invariance_of_shape_with_large_baseline():
    base = 2.0**60
    deltas = np.asarray([0, 256, 512, 1024, 2048, 4096], dtype=float)
    shifted, original = extended_summary(base + deltas), extended_summary(deltas)
    assert shifted["skewness"] == pytest.approx(original["skewness"], abs=1e-12)
    assert shifted["excess_kurtosis"] == pytest.approx(
        original["excess_kurtosis"], abs=1e-12
    )


def test_confidence_changes_only_geometric_intervals():
    lower = extended_summary([1, 2, 4, 8], 0.9)
    higher = extended_summary([1, 2, 4, 8], 0.99)
    assert higher["geometric_ci_low"] < lower["geometric_ci_low"]
    assert higher["geometric_ci_high"] > lower["geometric_ci_high"]
    for field in set(EXTRA_FIELDS) - {"geometric_ci_low", "geometric_ci_high"}:
        assert higher[field] == lower[field]


@pytest.mark.parametrize(
    "data", [[None], [np.nan], [np.inf], [1e101], [[1, 2]], ["bad"]]
)
def test_invalid_inputs(data):
    with pytest.raises(DescriptiveError):
        extended_summary(data)


@pytest.mark.parametrize("confidence", [0, 1, np.nan, "95"])
def test_invalid_confidence(confidence):
    with pytest.raises(DescriptiveError):
        extended_summary([1, 2, 3], confidence)
