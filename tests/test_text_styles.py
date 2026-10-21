"""Text toolbar formatting in graph exports (web/src/graph-text.ts)."""
import re

import pytest
from fastapi.testclient import TestClient

from gp.server import app

client = TestClient(app)
COLUMN = {"table_type": "column", "analysis": "descriptive",
          "columns": [{"name": "Control", "values": [1, 2, 3]}, {"name": "Treated", "values": [2, 3, 5]}]}
XY = {"table_type": "xy", "analysis": "linear_regression",
      "columns": [{"name": "Dose", "values": [1, 2, 3]}, {"name": "Response", "values": [2, 4, 7]}]}


def svg(data, graph):
    response = client.post("/api/export", json={"data": data, "graph": graph, "format": "svg"})
    assert response.status_code == 200, response.text
    return response.text


def text_style(document, text):
    """The style attribute of the SVG <text> element that draws `text`."""
    match = re.search(r'<text style="([^"]*)"[^>]*>' + re.escape(text) + "</text>", document)
    assert match, f"{text!r} not drawn as text"
    return match.group(1)


def size(style):
    # Matplotlib writes either font-size or a font shorthand, by version.
    return float(re.search(r"(?:font-size: |font: [^;]*?)([0-9.]+)px", style).group(1))


def bold(style):
    return re.search(r"font-weight: 700|font: [^;]*\b700\b", style) is not None


def test_unformatted_exports_are_unchanged():
    graph = {"title": "Plain", "y_label": "Signal"}
    plain, empty = svg(COLUMN, graph), svg(COLUMN, {**graph, "text_styles": {}})
    for text in ("Plain", "Signal", "Control"):
        assert text_style(plain, text) == text_style(empty, text)


def test_title_axis_titles_and_ticks_follow_the_text_toolbar():
    graph = {"title": "Styled", "y_label": "Signal", "x_label": "Group"}
    plain = svg(COLUMN, graph)
    styled = svg(COLUMN, {**graph, "text_styles": {
        "title": {"size": 36, "color": "#d62728", "italic": True},
        "y_label": {"bold": False, "font": "Times New Roman"},
        "x_ticks": {"size": 7},
    }})
    title = text_style(styled, "Styled")
    # Twice GP's 18 pt on-screen title doubles the export's own title size.
    assert size(title) == pytest.approx(2 * size(text_style(plain, "Styled")))
    assert "fill: #d62728" in title and "italic" in title
    y_title = text_style(styled, "Signal")
    assert "Times New Roman" in y_title and not bold(y_title)
    assert bold(text_style(plain, "Signal"))
    assert size(text_style(styled, "Control")) == pytest.approx(size(text_style(plain, "Control")) / 2)
    assert size(text_style(styled, "Group")) == size(text_style(plain, "Group")), "unformatted objects keep their size"


def test_legend_text():
    styled = svg(XY, {"show_legend": True, "text_styles": {"legend": {"color": "#1f77b4", "size": 24}}})
    plain = svg(XY, {"show_legend": True})
    assert "fill: #1f77b4" in text_style(styled, "Response")
    assert size(text_style(styled, "Response")) == pytest.approx(24 / 13 * size(text_style(plain, "Response")))


@pytest.mark.parametrize("styles,message", [
    ({"title": {"size": 15}}, "Text size must be one of"),
    ({"caption": {"size": 12}}, "Input should be"),
    ({"title": {"color": "red"}}, "String should match pattern"),
    ({"title": {"font": "Comic Sans MS"}}, "Input should be"),
    ({"title": {"underline": True}}, "Extra inputs are not permitted"),
])
def test_invalid_text_styles_are_rejected(styles, message):
    response = client.post("/api/export", json={"data": COLUMN, "graph": {"text_styles": styles}, "format": "svg"})
    assert response.status_code == 422 and message in response.text, response.text
