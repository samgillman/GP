"""Format Graph > Appearance styles reach exported files (web/src/graph-style.ts)."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from gp.models import ExportRequest
from gp.plotting import export_plot
from gp.server import app
from gp.statistics import AnalysisError

client = TestClient(app)
COLUMN = {"table_type": "column", "columns": [
    {"name": "Control", "values": [42, 38, 45, 41, 39, 44, 40, 43]},
    {"name": "Treatment A", "values": [58, 62, 55, 64, 61, 59, 63, 57]},
    {"name": "Treatment B", "values": [72, 78, 75, 81, 73, 79, 76, 74]},
]}
XY = {"table_type": "xy", "columns": [
    {"name": "Dose", "values": [1, 2, 3, 4]},
    {"name": "Response", "values": [2, 4, 5, 8]},
]}


def style(color, **overrides):
    resolved = {
        "color": color, "fill": "#d2e8e6", "pattern": False, "border_width": 2,
        "symbols": True, "symbol_color": color, "symbol_shape": "circle", "symbol_size": 3,
        "error_bars": True, "error_color": color, "error_cap": "T", "error_direction": "above",
        "error_width": 1, "line_width": 1.5,
    }
    return resolved | overrides


def svg(data, graph):
    return export_plot(ExportRequest(data=data, graph=graph, format="svg")).decode()


@pytest.mark.parametrize("axes", [None, {}])
def test_bar_styles_draw_fill_border_symbols_and_error_colors(axes):
    styles = [style("#1e8a80", fill="#abcdef"), style("#cf7a24", symbol_color="#123456"),
              style("#5469a6", error_color="#fedcba", pattern=True)]
    graph = {"type": "bar", "error": "sd", "styles": styles, "x_tick_rotation": 45}
    if axes is not None:
        graph["axes"] = axes
    drawn = svg(COLUMN, graph)
    for color in ("#abcdef", "#1e8a80", "#cf7a24", "#123456", "#5469a6", "#fedcba"):
        assert color in drawn, color
    # The patterned data set is hatched; slanted category labels are rotated.
    assert 'id="h' in drawn and "pattern" in drawn
    assert "rotate(-45" in drawn
    # Without styles the earlier export keeps black borders and error bars.
    plain = svg(COLUMN, {"type": "bar", "error": "sd"})
    assert "#abcdef" not in plain and "rotate(-45" not in plain


def test_hidden_symbols_and_error_bars_are_not_drawn():
    shown = svg(COLUMN, {"type": "bar", "error": "sd", "styles": [style("#1e8a80")] * 3})
    hidden = svg(COLUMN, {"type": "bar", "error": "sd", "styles": [
        style("#1e8a80", symbols=False, error_bars=False)] * 3})
    assert hidden.count("<use ") < shown.count("<use ")
    assert len(hidden) < len(shown)


def test_legend_follows_show_legend_for_column_and_xy():
    with_legend = svg(COLUMN, {"type": "bar", "styles": [style("#1e8a80")] * 3, "show_legend": True})
    assert with_legend.count("Treatment A") == 2, "tick label plus legend entry"
    xy_styles = [style("#1e8a80", error_direction="both")]
    assert "Response" in svg(XY, {"type": "line", "styles": xy_styles})
    assert "Response" not in svg(XY, {"type": "line", "styles": xy_styles, "show_legend": False})


def test_symbol_shapes_change_the_marker():
    circles = svg(COLUMN, {"type": "scatter", "styles": [style("#1e8a80")] * 3})
    squares = svg(COLUMN, {"type": "scatter", "styles": [style("#1e8a80", symbol_shape="square")] * 3})
    assert circles != squares


def test_style_count_and_values_are_validated():
    with pytest.raises(AnalysisError):
        svg(COLUMN, {"type": "bar", "styles": [style("#1e8a80")]})
    with pytest.raises(ValidationError):
        ExportRequest(data=COLUMN, graph={"styles": [style("#1e8a80", border_width=2.2)] * 3})
    with pytest.raises(ValidationError):
        ExportRequest(data=COLUMN, graph={"styles": [style("url(#x)")] * 3})
    with pytest.raises(ValidationError):
        ExportRequest(data=COLUMN, graph={"styles": [style("#1e8a80", extra=True)] * 3})
    with pytest.raises(ValidationError):
        ExportRequest(data=COLUMN, graph={"x_tick_rotation": 30})


def test_api_exports_styled_pdf_and_png():
    graph = {"type": "box", "styles": [style("#1e8a80")] * 3, "show_legend": True}
    for format, signature in (("pdf", b"%PDF"), ("png", b"\x89PNG")):
        response = client.post("/api/export", json={"data": COLUMN, "graph": graph, "format": format})
        assert response.status_code == 200, response.text
        assert response.content.startswith(signature)
