"""Verified GP contract for missing Y line gaps, not a native Prism runtime oracle."""
import copy
import numpy as np
import pytest
from matplotlib.figure import Figure
from pydantic import ValidationError

from gp.models import ExportRequest
from gp.plotting import export_plot
from gp.statistics import analyze

XY = {
    "table_type": "xy", "analysis": "descriptive",
    "columns": [
        {"name": "X", "values": [1., 2., 3., 4.]},
        {"name": "Y", "values": [10., None, 30., 40.]},
    ],
}


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize("leave_gap", [False, True])
def test_missing_xy_y_changes_only_line_geometry(monkeypatch, configured, leave_gap):
    recorded = []
    original_save = Figure.savefig

    def capture(figure, *args, **kwargs):
        result = original_save(figure, *args, **kwargs)
        recorded.extend(np.asarray(line.get_xydata(), dtype=float).copy()
                        for line in figure.axes[0].lines)
        return result

    monkeypatch.setattr(Figure, "savefig", capture)
    kwargs = {"type": "line", "show_points": True, "gap_at_missing_y": leave_gap}
    if configured:
        kwargs["axes"] = {"x": {}, "y": {}}
    source = copy.deepcopy(XY)
    request = ExportRequest(data=source, graph=kwargs)
    before_result = analyze(request.data)
    svg = export_plot(request)
    assert svg.startswith(b"<?xml") or b"<svg" in svg[:1000]
    assert recorded, "No XY line artist was drawn"
    plotted = recorded[0]
    if leave_gap:
        np.testing.assert_array_equal(plotted[:, 0], [1., 2., 3., 4.])
        np.testing.assert_array_equal(plotted[[0, 2, 3], 1], [10., 30., 40.])
        assert np.isnan(plotted[1, 1])
    else:
        np.testing.assert_array_equal(plotted, [[1., 10.], [3., 30.], [4., 40.]])
    assert analyze(request.data) == before_result
    assert request.data.columns[1].values == [10., None, 30., 40.]


@pytest.mark.parametrize("bad", ["true", 1, [], {}, None])
def test_missing_xy_y_is_strictly_boolean(bad):
    with pytest.raises(ValidationError):
        ExportRequest(data=XY, graph={"type": "line", "gap_at_missing_y": bad})


def test_gap_option_does_not_affect_scatter_or_rewrite_missing_points():
    request = ExportRequest(data=XY, graph={"type": "scatter", "gap_at_missing_y": True})
    assert request.data.columns[1].values[1] is None
    assert b"<svg" in export_plot(request)
