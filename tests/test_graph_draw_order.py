"""XY export layering: the first listed dataset draws in front.

The shipped Format Graph resource labels its list "Data sets plotted (front to
back)" and says higher datasets draw in front. Matching that in GP's exporter is
a GP rendering rule from that text; these tests do not compare native output.
"""
import pytest

from gp.models import ExportRequest
from gp.plotting import _series_zorder, export_plot

FRONT, BACK, THIRD = "#ff0000", "#0000ff", "#00aa00"


def xy_request(graph_type, axes=None, analysis="descriptive", colors=(FRONT, BACK)):
    graph = {"type": graph_type, "colors": list(colors), "show_points": graph_type == "scatter"}
    if axes is not None:
        graph["axes"] = axes
    return ExportRequest(data={"table_type": "xy", "analysis": analysis, "columns": [
        {"name": "X", "values": [1, 2, 3]},
        {"name": "Front", "values": [2, 2, 2]},
        {"name": "Back", "values": [2, 2, 2]},
    ]}, graph=graph)


def first_style_position(svg, style):
    position = svg.find(style)
    assert position >= 0, style
    return position


def test_zorder_rank_keeps_lines_above_points_and_first_dataset_in_front():
    assert _series_zorder(0, 2, 1) > _series_zorder(1, 2, 1)
    assert 1 < _series_zorder(1, 2, 1) < _series_zorder(0, 2, 1) < 2
    assert 2 < _series_zorder(1, 2, 2) < _series_zorder(0, 2, 2) < 3
    # Point marks of every dataset stay below the lowest line layer.
    assert _series_zorder(0, 50, 1) < _series_zorder(49, 50, 2)


@pytest.mark.parametrize("axes", [None, {"x": {}, "y": {}}])
def test_scatter_marks_of_the_first_dataset_are_written_after_the_others(axes):
    svg = export_plot(xy_request("scatter", axes)).decode()
    assert first_style_position(svg, f"fill: {FRONT}") > first_style_position(svg, f"fill: {BACK}")


@pytest.mark.parametrize("axes", [None, {"x": {}, "y": {}}])
def test_connecting_lines_of_the_first_dataset_are_written_after_the_others(axes):
    svg = export_plot(xy_request("line", axes)).decode()
    assert first_style_position(svg, f"stroke: {FRONT}") > first_style_position(svg, f"stroke: {BACK}")


def test_three_datasets_keep_list_order_front_to_back():
    request = ExportRequest(data={"table_type": "xy", "analysis": "descriptive", "columns": [
        {"name": "X", "values": [1, 2, 3]},
        {"name": "A", "values": [1, 1, 1]},
        {"name": "B", "values": [1, 1, 1]},
        {"name": "C", "values": [1, 1, 1]},
    ]}, graph={"type": "scatter", "colors": [FRONT, BACK, THIRD], "axes": {"x": {}, "y": {}}})
    svg = export_plot(request).decode()
    positions = [first_style_position(svg, f"fill: {color}") for color in (THIRD, BACK, FRONT)]
    assert positions == sorted(positions)


def test_fitted_curves_follow_their_dataset_rank_and_stay_above_marks():
    request = ExportRequest(data={"table_type": "xy", "analysis": "linear_regression", "columns": [
        {"name": "X", "values": [1, 2, 3, 4]},
        {"name": "Front", "values": [1, 2, 3, 4]},
        {"name": "Back", "values": [1, 2, 3, 4]},
    ]}, graph={"type": "scatter", "colors": [FRONT, BACK], "axes": {"x": {}, "y": {}}})
    svg = export_plot(request).decode()
    front_line = first_style_position(svg, f"stroke: {FRONT}")
    back_line = first_style_position(svg, f"stroke: {BACK}")
    assert front_line > back_line
    # Both point layers start before either curve; the legend repeats the
    # styles later, so only first occurrences identify the drawing layers.
    assert min(front_line, back_line) > max(
        first_style_position(svg, f"fill: {FRONT}; stroke: #000000"),
        first_style_position(svg, f"fill: {BACK}; stroke: #000000"))
