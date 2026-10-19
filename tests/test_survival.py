import json
from pathlib import Path

import numpy as np
import pytest

from gp.survival import SurvivalError, analyze_survival, kaplan_meier, logrank

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures/prism_survival_saved.json").read_text()
)


def test_all_saved_prism_risk_event_censor_and_curve_cells():
    result = analyze_survival(FIXTURE["groups"])
    curves = {
        name: {r["time"]: r for r in curve["table"]}
        for name, curve in result["curves"].items()
    }
    counts = {}
    for table in FIXTURE["expected"]["tables"]:
        kind = table["kind"]
        counts[kind] = 0
        for row in table["rows"]:
            time = row[0]
            for group_index, group in enumerate(table["group_order"]):
                if kind == "Survival proportions":
                    value, plus, minus = row[1 + 3 * group_index : 4 + 3 * group_index]
                    if value is None:
                        continue
                    actual = curves[group][time]
                    assert actual["survival"] * 100 == pytest.approx(value, abs=2e-12)
                    counts[kind] += 1
                    # Saved y_plus_minus columns are distances above/below Y,
                    # independently established by comparing every populated CI.
                    if plus is not None:
                        assert (
                            actual["ci_upper"] - actual["survival"]
                        ) * 100 == pytest.approx(plus, abs=2e-12)
                        assert (
                            actual["survival"] - actual["ci_lower"]
                        ) * 100 == pytest.approx(minus, abs=2e-12)
                        counts.setdefault("CI distances", 0)
                        counts["CI distances"] += 2
                else:
                    value = row[1 + group_index]
                    if value is None:
                        continue
                    key = {
                        "# at risk": "at_risk",
                        "# deaths/events": "events",
                        "# censored subjects": "censored",
                    }[kind]
                    assert curves[group][time][key] == value
                    counts[kind] += 1
    assert counts == {
        "# deaths/events": 129,
        "# censored subjects": 129,
        "Survival proportions": 129,
        "CI distances": 198,
        "# at risk": 129,
    }


def test_saved_prism_medians_confidence_limits_counts_and_global_logrank():
    result = analyze_survival(FIXTURE["groups"])
    for name, expected in FIXTURE["expected"]["summaries"].items():
        actual = result["curves"][name]
        assert actual["n"] == expected["eventCount"] + expected["censoredCount"]
        assert actual["events"] == expected["eventCount"]
        assert actual["censored"] == expected["censoredCount"]
        assert actual["median"] == expected["medianSurvival"]
        assert actual["median_ci_lower"] == expected["medianSurvivalCI"]["lower"]
        assert actual["median_ci_upper"] == expected["medianSurvivalCI"]["upper"]
    expected = FIXTURE["expected"]["logrank"]
    assert result["logrank"]["statistic"] == pytest.approx(
        expected["chiSquared"], abs=1e-11
    )
    assert result["logrank"]["df"] == expected["df"]
    assert result["logrank"]["p_value"] == pytest.approx(
        expected["pValue"]["value"], rel=1e-12, abs=0
    )


def test_tied_events_use_risk_set_before_censoring():
    result = kaplan_meier([1, 1, 1, 2, 3], [1, 1, 0, 1, 0])
    first = result["table"][1]
    assert first["at_risk"] == 5
    assert first["events"] == 2
    assert first["censored"] == 1
    assert first["survival"] == pytest.approx(3 / 5)
    second = result["table"][2]
    assert second["at_risk"] == 2
    assert second["survival"] == pytest.approx(3 / 10)
    assert result["median"] == 2


def test_time_zero_events_and_boundary_intervals():
    result = kaplan_meier([0, 0, 1], [1, 0, 1])
    assert len(result["table"]) == 2
    assert result["table"][0]["at_risk"] == 3
    assert result["table"][0]["survival"] == pytest.approx(2 / 3)
    assert result["table"][-1]["survival"] == 0
    assert result["table"][-1]["ci_lower"] is None
    assert result["table"][-1]["ci_upper"] is None


def test_all_censored_has_no_identifiable_logrank_test():
    data = {
        "A": {"times": [1, 2], "events": [0, 0]},
        "B": {"times": [2, 3], "events": [0, 0]},
    }
    result = analyze_survival(data)
    assert result["curves"]["A"]["median"] is None
    assert all(r["survival"] == 1 for r in result["curves"]["A"]["table"])
    assert result["logrank"]["statistic"] is None
    assert result["logrank"]["p_value"] is None
    assert result["logrank"]["df"] == 0
    assert result["logrank"]["warnings"]


def test_hand_calculated_tied_logrank():
    # At t=1: risk=(3,3), events=(2,1), E_A=1.5,
    # Var_A=3*(6-3)/(6-1)*(1/2)*(1/2)=.45.
    data = {
        "A": {"times": [1, 1, 2], "events": [1, 1, 0]},
        "B": {"times": [1, 1, 2], "events": [1, 0, 0]},
    }
    result = logrank(data)
    assert result["statistic"] == pytest.approx(0.5**2 / 0.45)
    assert result["covariance"][0][0] == pytest.approx(0.45)
    assert result["expected"] == {"A": 1.5, "B": 1.5}


def test_permutation_and_time_unit_invariance():
    baseline = analyze_survival(FIXTURE["groups"])
    changed = {
        k: {
            "times": [t * 24 for t in reversed(v["times"])],
            "events": list(reversed(v["events"])),
        }
        for k, v in reversed(list(FIXTURE["groups"].items()))
    }
    result = analyze_survival(changed)
    assert result["logrank"]["statistic"] == pytest.approx(
        baseline["logrank"]["statistic"]
    )
    for name, curve in result["curves"].items():
        assert curve["median"] == pytest.approx(baseline["curves"][name]["median"] * 24)


def test_confidence_width_and_single_group():
    narrower = kaplan_meier([1, 2, 3, 4], [1, 1, 0, 1], 0.9)
    wider = kaplan_meier([1, 2, 3, 4], [1, 1, 0, 1], 0.99)
    assert narrower["table"][1]["ci_lower"] > wider["table"][1]["ci_lower"]
    assert narrower["table"][1]["ci_upper"] < wider["table"][1]["ci_upper"]
    assert analyze_survival({"A": {"times": [1], "events": [1]}})["logrank"] is None
    with pytest.raises(SurvivalError, match="two groups"):
        logrank({"A": {"times": [1], "events": [1]}})


@pytest.mark.parametrize(
    "times,events",
    [
        ([], []),
        ([1], []),
        ([np.nan], [1]),
        ([np.inf], [1]),
        ([-1], [0]),
        ([1], [np.nan]),
        ([1], [2]),
        ([1], [0.5]),
        ([1], [None]),
        ([[1]], [[1]]),
        ([1e101], [0]),
    ],
)
def test_invalid_observations(times, events):
    with pytest.raises(SurvivalError):
        kaplan_meier(times, events)


@pytest.mark.parametrize("confidence", [0, 1, np.nan, "95"])
def test_invalid_confidence(confidence):
    with pytest.raises(SurvivalError):
        kaplan_meier([1], [1], confidence)


@pytest.mark.parametrize(
    "groups", [{}, {"": {"times": [1], "events": [1]}}, {"A": {}}, {"A": []}]
)
def test_invalid_groups(groups):
    with pytest.raises(SurvivalError):
        analyze_survival(groups)
