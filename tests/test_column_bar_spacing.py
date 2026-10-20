"""Column bar spacing is a tested GP rendering contract, not native width parity."""
import copy
import numpy as np
import pytest
from matplotlib.figure import Figure
from pydantic import ValidationError

from gp.models import ExportRequest
from gp.plotting import export_plot
from gp.statistics import analyze

COLUMN = {
    "table_type": "column", "analysis": "descriptive",
    "columns": [
        {"name": "Control", "values": [1., 2., 3.]},
        {"name": "Treated", "values": [2., 4., 6.]},
    ],
}


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize("spacing,expected", [(None, .6), (0, 1.), (100, .5), (400, .2)])
def test_explicit_column_spacing_controls_exported_bar_width(monkeypatch, configured, spacing, expected):
    observed = {}
    original = Figure.savefig
    def capture(figure, *args, **kwargs):
        result = original(figure, *args, **kwargs)
        observed["widths"] = [patch.get_width() for patch in figure.axes[0].patches]
        return result
    monkeypatch.setattr(Figure, "savefig", capture)
    source = copy.deepcopy(COLUMN)
    graph = {"type": "bar", "column_space_percent": spacing}
    if configured:
        graph["axes"] = {"x": {}, "y": {}}
    request = ExportRequest(data=source, graph=graph)
    before = analyze(request.data)
    raw = export_plot(request)
    assert b"<svg" in raw
    assert len(observed["widths"]) == 2
    np.testing.assert_allclose(observed["widths"], [expected, expected])
    assert analyze(request.data) == before
    assert request.data.columns[0].values == [1., 2., 3.]


@pytest.mark.parametrize("value", [-1, 401, 50.5, "100", True, [], {}])
def test_column_spacing_does_not_coerce_invalid_values(value):
    with pytest.raises(ValidationError):
        ExportRequest(data=COLUMN, graph={"type": "bar", "column_space_percent": value})


def test_spacing_on_nonbar_graph_does_not_change_observed_measurements():
    req = ExportRequest(data=COLUMN, graph={"type": "scatter", "column_space_percent": 400})
    assert [c.values for c in req.data.columns] == [[1., 2., 3.], [2., 4., 6.]]
