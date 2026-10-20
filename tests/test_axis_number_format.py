"""Explicit GP decimal formatting, not a native Prism rounding comparison."""
import copy
import xml.etree.ElementTree as ET

import pytest
from fastapi.testclient import TestClient
from matplotlib.figure import Figure
from pydantic import ValidationError

from gp.models import AxisNumberFormat, AxisSettings, ExportRequest
from gp.plotting import export_plot, format_tick_number
from gp.server import app
from gp.statistics import AnalysisError, analyze


SPEC = {"decimals": 2, "decimalSeparator": ".", "thousandsSeparator": "",
        "prefix": "", "suffix": ""}
XY = {"table_type": "xy", "columns": [
    {"name": "X", "values": [-1, 0, 1]},
    {"name": "Y", "values": [1, 2, 3]}]}


def spec(**changes):
    return AxisNumberFormat(**(SPEC | changes))


@pytest.mark.parametrize("value,decimals,expected", [
    (1.005, 2, "1.01"), (-1.005, 2, "-1.01"), (2.675, 2, "2.68"),
    (-2.675, 2, "-2.68"), (1.0049999999999997, 2, "1.00"),
    (-1.0049999999999997, 2, "-1.00"), (0.5, 0, "1"), (-0.5, 0, "-1"),
    (-2.5, 0, "-3"), (2.5, 0, "3"), (-0.0, 3, "0.000"),
    (-0.0004, 3, "0.000"), (-0.0005, 3, "-0.001"),
    (1.0000000005, 9, "1.000000001"), (9.9999999995, 9, "10.000000000"),
    (999.995, 2, "1000.00"), (-999.995, 2, "-1000.00"),
    (1e21, 2, "1000000000000000000000.00"),
    (1e100, 9, "1"+"0"*100+".000000000"),
    (1e101, 2, "1"+"0"*101+".00"),
    (float.fromhex("0x1.fffffffffffffp+1023"), 0, "17976931348623157"+"0"*292),
    (1e-7, 9, "0.000000100"), (5e-324, 9, "0.000000000"),
    (-5e-324, 0, "0"), (1.2345678901, 9, "1.234567890"), (123, 4, "123.0000"),
])
def test_shared_browser_decimal_goldens(value, decimals, expected):
    assert format_tick_number(value, spec(decimals=decimals)) == expected


@pytest.mark.parametrize("changes,expected", [
    ({"thousandsSeparator": ","}, "-1,234,567.50"),
    ({"thousandsSeparator": " ", "decimalSeparator": ","}, "-1 234 567,50"),
    ({"thousandsSeparator": "'", "decimalSeparator": "·"}, "-1'234'567·50"),
    ({"decimals": 0, "thousandsSeparator": ","}, "-1,234,568"),
    ({"prefix": "$\\alpha<", "suffix": ">&"}, "$\\alpha<-1234567.50>&"),
])
def test_grouping_separators_and_affixes_are_literal(changes, expected):
    assert format_tick_number(-1234567.5, spec(**changes)) == expected
    assert format_tick_number(999.995, spec(thousandsSeparator=",")) == "1,000.00"


def test_all_separator_combinations_and_precision_widths():
    for decimal in (".", ",", "·"):
        for thousands in ("", ",", " ", "'"):
            if decimal == thousands:
                continue
            assert format_tick_number(-1234567.5, spec(decimalSeparator=decimal, thousandsSeparator=thousands)) == f"-1{thousands}234{thousands}567{decimal}50"
    for decimals in range(10):
        assert format_tick_number(12., spec(decimals=decimals)) == "12"+("."+"0"*decimals if decimals else "")


@pytest.mark.parametrize("value", [float("inf"), -float("inf"), float("nan")])
def test_formatter_rejects_nonfinite_coordinates(value):
    with pytest.raises(AnalysisError, match="finite"):
        format_tick_number(value, spec())


@pytest.mark.parametrize("changes", [
    {"decimals": -1}, {"decimals": 10}, {"decimals": 2.0}, {"decimals": True},
    {"decimals": "2"}, {"decimalSeparator": ":"}, {"thousandsSeparator": "."},
    {"decimalSeparator": ",", "thousandsSeparator": ","},
    {"prefix": "a"*33}, {"suffix": "b"*33}, {"prefix": 3}, {"suffix": None},
    {"unknown": 1},
])
def test_number_format_schema_rejects_invalid_complete_objects(changes):
    with pytest.raises(ValidationError):
        spec(**changes)


@pytest.mark.parametrize("missing", list(SPEC))
def test_every_number_format_property_is_required(missing):
    partial = {key: value for key, value in SPEC.items() if key != missing}
    with pytest.raises(ValidationError):
        AxisSettings(numberFormat=partial)


@pytest.mark.parametrize("character", ["\0", "\x01", "\x0b", "\x1f", "\ufffe", "\uffff", "\ud800", "\udfff"])
@pytest.mark.parametrize("field", ["prefix", "suffix"])
def test_illegal_export_characters_are_rejected(character, field):
    with pytest.raises(ValidationError):
        spec(**{field: character})


def test_xml_legal_whitespace_c1_and_unicode_are_valid_literal_affixes():
    for character in ("\t", "\n", "\r", "\x85", "🧪", "\u200d", "\ue000", "\ufffd", "\U0010ffff"):
        assert spec(prefix=character, suffix=character).prefix == character


def test_api_rejects_illegal_affix_without_returning_broken_svg():
    body = {"data": XY, "graph": {"axes": {"y": {
        "numberFormat": SPEC | {"prefix": "\0"},
    }}}}
    response = TestClient(app).post("/api/export", json=body)
    assert response.status_code == 422
    assert "unsupported control characters" in response.json()["detail"][0]["msg"]


def test_omission_is_backward_compatible_but_explicit_null_is_invalid():
    assert "numberFormat" not in AxisSettings().model_dump()
    with pytest.raises(ValidationError):
        AxisSettings(numberFormat=None)
    configured = AxisSettings(numberFormat=SPEC)
    assert AxisSettings.model_validate_json(configured.model_dump_json()) == configured
    assert spec(prefix="🧪"*32).prefix == "🧪"*32
    with pytest.raises(ValidationError):
        spec(prefix="🧪"*33)


def test_categorical_x_rejects_format_but_numeric_y_accepts_it():
    data = {"columns": [{"name": "Group", "values": [1, 2, 3]}]}
    with pytest.raises(ValidationError, match="Categorical X"):
        ExportRequest(data=data, graph={"axes": {"x": {"numberFormat": SPEC}}})
    ExportRequest(data=data, graph={"axes": {"y": {"numberFormat": SPEC}}})


@pytest.fixture
def tick_capture(monkeypatch):
    capture = {}
    save = Figure.savefig

    def recording_save(figure, *args, **kwargs):
        result = save(figure, *args, **kwargs)
        axis = figure.axes[0]
        for name in ("x", "y"):
            tick_axis = getattr(axis, name+"axis")
            capture[name] = {
                "labels": [tick.get_text() for tick in tick_axis.get_majorticklabels()],
                "minor": [tick.get_text() for tick in tick_axis.get_minorticklabels()],
                "math": [tick.get_parse_math() for tick in tick_axis.get_majorticklabels()],
                "formatter": type(tick_axis.get_major_formatter()).__name__,
            }
        return result

    monkeypatch.setattr(Figure, "savefig", recording_save)
    return capture


def test_xy_axis_formats_are_independent_and_literal_svg_preserves_statistics(tick_capture):
    x_format = SPEC | {"prefix": "$x\\alpha$", "suffix": "<&>"}
    y_format = SPEC | {"decimals": 1, "decimalSeparator": ",", "suffix": " mg"}
    request = ExportRequest(data=XY, graph={"axes": {
        "x": {"minimum": -1, "maximum": 1, "majorInterval": 1, "numberFormat": x_format},
        "y": {"minimum": 1, "maximum": 3, "majorInterval": 1, "numberFormat": y_format},
    }})
    before = copy.deepcopy(analyze(request.data))
    svg = export_plot(request)
    assert analyze(request.data) == before
    assert tick_capture["x"]["labels"] == ["$x\\alpha$-1.00<&>", "$x\\alpha$0.00<&>", "$x\\alpha$1.00<&>"]
    assert tick_capture["y"]["labels"] == ["1,0 mg", "2,0 mg", "3,0 mg"]
    assert tick_capture["x"]["math"] == [False]*3
    assert tick_capture["y"]["math"] == [False]*3
    text_nodes = ["".join(node.itertext()) for node in ET.fromstring(svg).iter() if node.tag.endswith("}text")]
    assert "$x\\alpha$1.00<&>" in text_nodes
    assert b"&lt;&amp;&gt;" in svg


def test_explicit_log_format_labels_only_major_ticks(tick_capture):
    request = ExportRequest(data=XY, graph={"axes": {"y": {
        "scale": "log10", "minimum": 1, "maximum": 10,
        "numberFormat": SPEC | {"prefix": "$", "suffix": "$"},
    }}})
    export_plot(request)
    assert tick_capture["y"]["labels"] == ["$1.00$", "$2.00$", "$5.00$", "$10.00$"]
    assert not any(tick_capture["y"]["minor"])
    assert not any(tick_capture["y"]["math"])
    # An omitted format continues to use the pre-existing automatic formatter.
    export_plot(ExportRequest(data=XY, graph={"axes": {"y": {
        "scale": "log10", "minimum": 1, "maximum": 10,
    }}}))
    assert tick_capture["y"]["formatter"] == "LogFormatterSciNotation"


@pytest.mark.parametrize("format,signature", [("svg", b"<?xml"), ("png", b"\x89PNG"), ("pdf", b"%PDF")])
def test_api_exports_genuine_formatted_files(format, signature):
    body = {"data": XY, "format": format, "graph": {"axes": {"y": {
        "numberFormat": SPEC | {"prefix": "$\\literal$", "suffix": "<script>"},
    }}}}
    response = TestClient(app).post("/api/export", json=body)
    assert response.status_code == 200, response.text[:200]
    assert response.content.startswith(signature)
    if format == "svg":
        ET.fromstring(response.content)
        assert b"<script>" not in response.content
        assert b"&lt;script&gt;" in response.content
