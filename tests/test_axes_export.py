"""Axis formatting changes the drawing, never the analyzed observations.

These are GP contract/rendering tests, not native Prism algorithm comparisons.
"""
import copy
import json
import re
import xml.etree.ElementTree as ET

import numpy as np
import pytest
from fastapi.testclient import TestClient
from matplotlib.figure import Figure
from pydantic import ValidationError

from gp.models import AxisSettings, ExportRequest
from gp.plotting import _major_ticks, export_plot
from gp.server import app
from gp.statistics import AnalysisError, analyze

client = TestClient(app)
XY = {"table_type": "xy", "analysis": "descriptive", "columns": [
    {"name": "Time", "values": [0, 1, 2, 3, 4]},
    {"name": "Signal", "values": [-2, 1, 0, 4, 8]},
]}
COLUMN = {"table_type": "column", "analysis": "descriptive", "columns": [
    {"name": "Control", "values": [-4, -2, 4, 10]},
    {"name": "Treated", "values": [2, 3, 5, 8]},
]}


def request(data=XY, x=None, y=None, **graph):
    return ExportRequest(data=data, graph={"axes": {"x": x or {}, "y": y or {}}, **graph})


@pytest.fixture
def drawn(monkeypatch):
    result = {}
    original = Figure.savefig

    def save(figure, *args, **kwargs):
        value = original(figure, *args, **kwargs)
        axis = figure.axes[0]
        result.update(
            xlim=axis.get_xlim(), ylim=axis.get_ylim(),
            xscale=axis.get_xscale(), yscale=axis.get_yscale(),
            xticks=axis.get_xticks().copy(), yticks=axis.get_yticks().copy(),
            lines=[np.array(line.get_xydata(), copy=True) for line in axis.lines],
            offsets=[np.array(collection.get_offsets(), copy=True) for collection in axis.collections],
            patches=[(p.get_x(), p.get_y(), p.get_width(), p.get_height()) for p in axis.patches],
            spines={name: spine.get_visible() for name, spine in axis.spines.items()},
            xgrid=any(line.get_visible() for line in axis.get_xgridlines()),
            ygrid=any(line.get_visible() for line in axis.get_ygridlines()),
            xlabel=axis.xaxis.label.get_visible(), ylabel=axis.yaxis.label.get_visible(),
        )
        return value

    monkeypatch.setattr(Figure, "savefig", save)
    return result


def test_schema_defaults_preserve_absent_axes_and_option_roundtrip():
    assert ExportRequest(data=XY).graph.axes is None
    axis = AxisSettings()
    assert axis.model_dump() == {"scale": "auto", "minimum": None, "maximum": None,
        "majorInterval": None, "reverse": False, "showAxis": True, "showGrid": False}
    configured = request(x={"minimum": 1, "maximum": 4, "reverse": True}, y={"showGrid": True})
    assert ExportRequest.model_validate_json(configured.model_dump_json()) == configured


@pytest.mark.parametrize("settings", [
    {"minimum": float("inf")}, {"maximum": float("nan")}, {"minimum": -1e101},
    {"maximum": 1e101}, {"majorInterval": 1e101}, {"majorInterval": 0},
    {"majorInterval": -1}, {"minimum": 2, "maximum": 2}, {"minimum": 3, "maximum": 2},
    {"scale": "log10", "minimum": 0}, {"scale": "log10", "maximum": -1},
    {"scale": "log10", "majorInterval": 1}, {"scale": "symlog"},
    {"minimum": "1"}, {"minimum": True}, {"reverse": "false"}, {"script": "alert(1)"},
])
def test_schema_rejects_unsafe_or_inconsistent_axis_options(settings):
    with pytest.raises(ValidationError):
        request(y=settings)


@pytest.mark.parametrize("x", [{"scale": "linear"}, {"scale": "log10"}, {"minimum": 0}, {"maximum": 4}, {"majorInterval": 1}])
def test_categorical_x_rejects_numeric_controls(x):
    with pytest.raises(ValidationError, match="Categorical X"):
        request(COLUMN, x=x)


def test_manual_limits_reverse_and_zero_anchored_ticks_are_exact(drawn):
    svg = export_plot(request(x={"minimum": .3, "maximum": 3.7, "majorInterval": 1, "reverse": True},
                              y={"minimum": -3, "maximum": 9, "majorInterval": 3}))
    assert drawn["xlim"] == (3.7, .3)
    assert drawn["ylim"] == (-3, 9)
    np.testing.assert_array_equal(drawn["xticks"], [1, 2, 3])
    np.testing.assert_array_equal(drawn["yticks"], [-3, 0, 3, 6, 9])
    assert b"clipPath" in svg
    ET.fromstring(svg)


def test_independent_categorical_reverse_axis_visibility_and_grid(drawn):
    svg = export_plot(request(COLUMN, x={"reverse": True, "showAxis": False, "showGrid": True},
                             y={"minimum": -5, "maximum": 15, "showAxis": False, "showGrid": True},
                             x_label="Hidden X", y_label="Hidden Y"))
    assert drawn["xlim"][0] > drawn["xlim"][1]
    assert not drawn["spines"]["bottom"] and not drawn["spines"]["left"]
    assert not drawn["xlabel"] and not drawn["ylabel"]
    assert drawn["xgrid"] and drawn["ygrid"]
    assert b"Hidden X" not in svg and b"Hidden Y" not in svg
    assert b"#dddddd" in svg


def test_log_markers_and_line_gaps_do_not_change_analysis(drawn):
    r = request(x={"scale": "log10", "minimum": .5, "maximum": 5},
                y={"scale": "log10", "minimum": .1, "maximum": 10}, type="line")
    before = analyze(r.data)
    export_plot(r)
    assert analyze(r.data) == before
    assert before["summary"][0]["n"] == 5
    assert before["summary"][0]["mean"] == pytest.approx(2.2)
    assert drawn["xscale"] == drawn["yscale"] == "log"
    points = drawn["lines"][0]
    assert np.isnan(points[0]).all() and np.isnan(points[2]).all()
    np.testing.assert_array_equal(points[[1, 3, 4]], [[1, 1], [3, 4], [4, 8]])
    export_plot(r.model_copy(update={"graph": r.graph.model_copy(update={"type": "scatter"})}))
    np.testing.assert_array_equal(drawn["offsets"][0], [[1, 1], [3, 4], [4, 8]])


def test_log_fit_keeps_original_regression_and_masks_nonpositive_curve(drawn):
    data = copy.deepcopy(XY)
    data["analysis"] = "linear_regression"
    data["columns"][1]["values"] = [-3, -1, 1, 3, 5]
    r = request(data, y={"scale": "log10", "minimum": .1, "maximum": 10})
    fit = analyze(r.data)["fit"][0]["parameters"]
    export_plot(r)
    assert fit["slope"] == 2 and fit["intercept"] == -3
    curve = drawn["lines"][0]
    assert np.isnan(curve[:50]).all()
    assert np.all(curve[np.isfinite(curve[:, 1]), 1] > 0)


def test_log_bar_and_crossing_error_stem_use_full_data_without_fake_cap(drawn):
    r = request(COLUMN, y={"scale": "log10", "minimum": 1, "maximum": 20}, type="bar", error="sd", show_points=False)
    export_plot(r)
    # Mean(-4,-2,4,10)=2: a positive-only recalculation would be 7.
    assert drawn["patches"][0][1] == 1
    assert drawn["patches"][0][3] == 1
    assert any(np.array_equal(line, [[0, 2]]) for line in drawn["lines"])
    stems = [line for line in drawn["lines"] if len(line) == 2 and np.all(line[:, 0] == 0)]
    assert stems and stems[0][0, 1] == 1
    assert stems[0][1, 1] == pytest.approx(2 + np.std([-4, -2, 4, 10], ddof=1))
    assert not any(np.array_equal(line, [[0, 1]]) for line in drawn["lines"])


def test_log_box_uses_full_sample_quantiles_and_clips_without_zero_cap(drawn):
    export_plot(request(COLUMN, y={"scale": "log10", "minimum": .5, "maximum": 20}, type="box", show_points=False))
    # Full-sample Q1=-2.5,Q3=5.5,median=1. Positive-only quartiles differ.
    first_box = drawn["patches"][0]
    assert first_box == pytest.approx((-.25, .5, .5, 5.))
    assert any(np.array_equal(line, [[-.25, 1], [.25, 1]]) for line in drawn["lines"])
    assert not any(len(line) == 2 and np.all(line[:, 1] == .5) for line in drawn["lines"])


def test_log_interval_can_show_positive_tail_when_mean_is_nonpositive(drawn):
    data = {"columns": [{"name": "Crossing", "values": [-10, 1, 2]}]}
    export_plot(request(data, y={"scale": "log10", "minimum": .1, "maximum": 10}, type="bar", error="sd", show_points=False))
    assert drawn["patches"] == []
    upper = np.mean([-10, 1, 2])+np.std([-10, 1, 2], ddof=1)
    assert any(np.allclose(line, [[0, .1], [0, upper]]) for line in drawn["lines"] if len(line) == 2)
    assert any(np.allclose(line, [[0, upper]]) for line in drawn["lines"] if len(line) == 1)
    assert not any(np.allclose(line, [[0, .1]]) for line in drawn["lines"] if len(line) == 1)


def test_automatic_extent_does_not_clip_large_finite_observations(drawn):
    data = {"columns": [{"name": "Large", "values": [1e99, 5e99, 1e100]}]}
    export_plot(request(data))
    assert drawn["ylim"][1] > 1e100


def test_automatic_linear_ticks_keep_first_extent_rounding(drawn):
    data = {"table_type": "xy", "columns": [
        {"name": "X", "values": [0, 100]},
        {"name": "Y", "values": [1, 2]}]}
    export_plot(request(data))
    assert drawn["xlim"] == (-25, 125)
    np.testing.assert_array_equal(drawn["xticks"], [-25, 0, 25, 50, 75, 100, 125])


def test_log_no_positive_values_produces_empty_view_not_fake_observations(drawn):
    data = {"columns": [{"name": "Negative", "values": [-3, 0, -1]}]}
    export_plot(request(data, y={"scale": "log10"}, type="bar"))
    assert drawn["ylim"] == (1, 10)
    assert drawn["patches"] == []
    assert all(not len(offset) for offset in drawn["offsets"])


def test_linear_override_displays_zero_dose_after_same_fit(drawn):
    x = np.array([0, .01, .1, 1, 10, 100])
    data = {"table_type": "xy", "analysis": "dose_response", "columns": [
        {"name": "Dose", "values": x.tolist()},
        {"name": "Y", "values": (10+90*x/(5+x)).tolist()}]}
    export_plot(request(data))
    assert drawn["xscale"] == "log"
    assert len(drawn["offsets"][0]) == 5
    export_plot(request(data, x={"scale": "linear", "minimum": 0, "maximum": 100}))
    assert drawn["xscale"] == "linear"
    assert len(drawn["offsets"][0]) == 6
    assert drawn["offsets"][0][0, 0] == 0
    for invalid in ({"minimum": 0}, {"majorInterval": 1}):
        with pytest.raises(ValidationError):
            request(data, x=invalid)


def test_tick_generation_is_bounded_and_numerically_safe():
    assert len(_major_ticks(0, 199, 1)) == 200
    assert len(_major_ticks(.1, 200.9, 1)) == 200
    assert _major_ticks(.3, .7, .1) == [.3, .4, .5, .6]
    with pytest.raises(AnalysisError, match="precision"):
        _major_ticks(1e100, 1e100+1e85, 1e84)
    for bounds in [(0, 200, 1), (0, 1, 1e-100), (-1e100, 1e100, 5e-324)]:
        with pytest.raises(AnalysisError, match="200"):
            _major_ticks(*bounds)


@pytest.mark.parametrize("axis,settings", [("x", {"minimum": 100}), ("y", {"maximum": -100}), ("y", {"minimum": 0, "maximum": 200, "majorInterval": 1})])
def test_resolved_range_and_tick_failures_are_actionable_api_errors(axis, settings):
    r = request(**{axis: settings})
    response = client.post("/api/export", json=r.model_dump())
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert "axis" in response.json()["detail"] or "tick" in response.json()["detail"]


@pytest.mark.parametrize("format,signature", [("svg", b"<?xml"), ("png", b"\x89PNG"), ("pdf", b"%PDF")])
def test_configured_exports_are_real_files_with_safe_literal_labels(format, signature):
    r = request(x={"minimum": 0, "maximum": 5, "showGrid": True},
                y={"scale": "log10", "minimum": .1, "maximum": 10, "reverse": True},
                title='<script>alert("x")</script> $literal$')
    response = client.post("/api/export", json={**r.model_dump(), "format": format})
    assert response.status_code == 200, response.text[:200]
    assert response.content.startswith(signature) and len(response.content) > 1000
    if format == "svg":
        ET.fromstring(response.content)
        assert b"<script>" not in response.content
        assert b"&lt;script&gt;" in response.content
        for match in re.findall(rb'<path[^>]* d="([^"]+)"', response.content):
            assert not re.search(rb'\b(?:nan|inf)\b', match, re.I)


def test_nonfinite_axes_rejected_as_json_without_raw_input_echo():
    body = {"data": XY, "graph": {"axes": {"x": {"minimum": float("inf")}}}}
    response = client.post("/api/export", content=json.dumps(body), headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert "input" not in response.json()["detail"][0]


def test_existing_export_cell_bound_is_preserved():
    data = {"columns": [{"name": str(i), "values": [1]*10000} for i in range(3)]}
    with pytest.raises(AnalysisError, match="20,000"):
        export_plot(request(data))


def test_absent_axes_keeps_legacy_export_path(monkeypatch):
    import gp.plotting as plotting
    monkeypatch.setattr(plotting, "_draw_configured", lambda *args: pytest.fail("legacy path used new axis renderer"))
    assert export_plot(ExportRequest(data=XY)).startswith(b"<?xml")
