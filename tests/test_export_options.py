"""File > Export options: format, resolution, enlarge/shrink and background."""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from gp.models import ExportRequest
from gp.server import app

client = TestClient(app)
DATA = {"table_type": "column", "analysis": "descriptive",
        "columns": [{"name": "Control", "values": [1, 2, 3]}, {"name": "Treated", "values": [2, 3, 5]}]}


def export(**options):
    return client.post("/api/export", json={"data": DATA, **options})


@pytest.mark.parametrize("fmt,dpi,width,size", [
    ("png", None, None, (1200, 800)),      # unchanged default: 7.5 x 5 in at 160 dpi
    ("png", 300, None, (2250, 1500)),
    ("png", 300, 3.75, (1125, 750)),        # shrink to half width, same resolution
    ("tiff", 600, None, (4500, 3000)),
    ("jpeg", 150, 15, (2250, 1500)),        # enlarge to 15 in wide
])
def test_raster_resolution_and_size(fmt, dpi, width, size):
    options = {"format": fmt}
    if dpi:
        options["dpi"] = dpi
    if width:
        options["width_inches"] = width
    response = export(**options)
    assert response.status_code == 200, response.text
    image = Image.open(io.BytesIO(response.content))
    assert image.format == {"png": "PNG", "tiff": "TIFF", "jpeg": "JPEG"}[fmt]
    assert image.size == size
    assert round(image.info["dpi"][0]) == (dpi or 160)
    assert response.headers["content-type"] == {"png": "image/png", "tiff": "image/tiff", "jpeg": "image/jpeg"}[fmt]


def test_clear_background_is_transparent():
    clear = Image.open(io.BytesIO(export(format="png", transparent=True).content))
    white = Image.open(io.BytesIO(export(format="png").content))
    assert clear.getpixel((2, 2))[3] == 0
    assert white.getpixel((2, 2)) == (255, 255, 255, 255)


def test_svg_scales_uniformly_with_its_viewbox():
    actual = export(format="svg").text
    scaled = export(format="svg", width_inches=15).text
    assert 'width="540pt" height="360pt" viewBox="0 0 540 360"' in actual
    assert 'width="1080.000pt" height="720.000pt" viewBox="0 0 540 360"' in scaled


@pytest.mark.parametrize("options,message", [
    ({"format": "jpeg", "transparent": True}, "JPEG cannot store a clear background"),
    ({"format": "pdf", "width_inches": 3}, "PDF exports at the graph's actual size"),
    ({"format": "svg", "dpi": 300}, "Resolution applies only to PNG, TIFF and JPEG"),
    ({"format": "png", "dpi": 1200, "width_inches": 20}, "exceed 60 megapixels"),
    ({"format": "png", "dpi": 299}, "Input should be"),
    ({"format": "png", "width_inches": 0.5}, "greater than or equal to 1"),
    ({"format": "gif"}, "Input should be"),
])
def test_invalid_export_options_are_rejected(options, message):
    response = export(**options)
    assert response.status_code == 422
    assert message in response.text


@pytest.mark.parametrize("width", [True, False, "3.5"])
def test_export_width_rejects_boolean_and_text_coercion(width):
    response = export(format="svg", width_inches=width)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "width_inches"]


@pytest.mark.parametrize("width", [None, 1, 3.75, 20])
def test_export_width_keeps_optional_integer_and_decimal_numbers(width):
    request = ExportRequest(data=DATA, width_inches=width)
    assert request.width_inches == width
