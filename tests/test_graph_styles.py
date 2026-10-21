"""Format Graph > Appearance styles reach exported files (web/src/graph-style.ts)."""
import pytest
from fastapi.testclient import TestClient
from matplotlib.figure import Figure
from pydantic import ValidationError

from gp import plotting
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


@pytest.mark.parametrize("field", ["border_width", "error_width", "line_width"])
@pytest.mark.parametrize("value", [True, False, "1"])
def test_style_weights_require_numeric_choices(field, value):
    with pytest.raises(ValidationError) as error:
        ExportRequest(data=XY, graph={"styles": [style("#1e8a80", **{field: value})]})
    assert error.value.errors()[0]["loc"] == ("graph", "styles", 0, field)


@pytest.mark.parametrize("weight", [.25, .5, 1, 1.0, 1.5, 2, 3, 4])
def test_style_weights_keep_supported_integer_and_decimal_numbers(weight):
    requested = style("#1e8a80", border_width=weight, error_width=weight, line_width=weight)
    resolved = ExportRequest(data=XY, graph={"styles": [requested]}).graph.styles[0]
    assert (resolved.border_width, resolved.error_width, resolved.line_width) == (weight,) * 3


@pytest.mark.parametrize("field", ["border_width", "error_width", "line_width"])
def test_api_rejects_boolean_style_weights(field):
    response = client.post("/api/export", json={
        "data": XY, "graph": {"styles": [style("#1e8a80", **{field: True})]},
    })
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "graph", "styles", 0, field]


@pytest.mark.parametrize("table_type", ["column", "xy"])
@pytest.mark.parametrize("configured", [False, True])
def test_hiding_symbols_keeps_all_data_bounds_and_scientific_inputs(monkeypatch, table_type, configured):
    if table_type == "xy":
        data = {"table_type": "xy", "columns": [
            {"name": "X", "values": [1, 2, 3, 4]},
            {"name": "High", "values": [100, 200, 300, 400]},
            {"name": "Low", "values": [1, 2, 3, 4]},
        ]}
        expected_y = (-100, 500) if configured else (-18.95, 419.95)
        expected_x = (0, 5) if configured else (.85, 4.15)
    else:
        data = {"table_type": "column", "columns": [
            {"name": "Outlier", "values": [0, 0, 0, 1000]},
            {"name": "Low", "values": [1, 2, 3, 4]},
        ]}
        expected_y = (-250, 1250) if configured else (-50, 1050)
        expected_x = (-.6, 1.6) if configured else (-.36428571428571427, 1.3642857142857142)
    renders, scientific_requests = [], []
    save, analyze = Figure.savefig, plotting.analyze

    def capture(figure, *args, **kwargs):
        result = save(figure, *args, **kwargs)
        axis = figure.axes[0]
        renders.append((axis.get_xlim(), axis.get_ylim(), len(axis.collections)))
        return result

    def analyze_all(request):
        scientific_requests.append(request.model_dump())
        return analyze(request)

    monkeypatch.setattr(Figure, "savefig", capture)
    monkeypatch.setattr(plotting, "analyze", analyze_all)
    for visibility in ((True, True), (False, True), (False, False)):
        graph = {"type": "scatter", "error": "none", "show_legend": False,
                 "styles": [style(color, symbols=shown, error_bars=False)
                            for color, shown in zip(("#1e8a80", "#cf7a24"), visibility)]}
        if configured:
            graph["axes"] = {}
        request = ExportRequest(data=data, graph=graph)
        original = request.model_dump()
        assert export_plot(request).startswith(b"<?xml")
        assert request.model_dump() == original
        assert scientific_requests[-1] == original["data"]
        xlim, ylim, collections = renders[-1]
        assert xlim == pytest.approx(expected_x)
        assert ylim == pytest.approx(expected_y)
        assert collections == sum(visibility), "hidden symbols must not add artists"
    assert renders[0][:2] == renders[1][:2] == renders[2][:2]


def test_api_exports_styled_pdf_and_png():
    graph = {"type": "box", "styles": [style("#1e8a80")] * 3, "show_legend": True}
    for format, signature in (("pdf", b"%PDF"), ("png", b"\x89PNG")):
        response = client.post("/api/export", json={"data": COLUMN, "graph": graph, "format": format})
        assert response.status_code == 200, response.text
        assert response.content.startswith(signature)
