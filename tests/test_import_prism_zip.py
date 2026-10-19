"""Synthetic format fixtures; no proprietary Prism sample files are embedded."""
import io
import json
import zipfile

import pytest

from gp.import_prism_zip import import_prism_zip
from gp.statistics import AnalysisError


def fixture(kind="column", *, csv_text="row1,1,3\nrow2,,4\n", changes=None):
    role = "xDataSet" if kind == "xy" else "rowTitlesDataSet"
    table = {"uid": "TABLE", "format": kind, "dataFormat": "y_single",
             role: "FIRST", "dataSets": ["A"] if kind == "xy" else ["A", "B"]}
    if kind == "xy":
        table["xDataSetFormat"] = "y_single"
    files = {"document.json": {"@class": "Document", "formatVersion": "1-5-0", "sheets": {"data": ["SHEET"]}},
             "data/sheets/SHEET/sheet.json": {"title": "Synthetic", "table": table},
             "data/tables/TABLE/content.json": {"version": 1, "numberOfColumns": 2 if kind == "xy" else 3, "numberOfRows": 2},
             "data/tables/TABLE/data.csv": csv_text}
    for uid in ["FIRST", "A", "B"]:
        label = uid == "FIRST" and kind != "xy"
        files[f"data/sets/{uid}.json"] = {"uid": uid, "title": uid, "format": "text" if label else "y_single",
            "replicates": [{"valueType": "string" if label else "real", "commonAttributes": ["NUMERIC"]}]}
    if changes:
        changes(files)
    return pack(files)


def pack(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, value in files.items():
            archive.writestr(path, value if isinstance(value, str) else json.dumps(value))
    return output.getvalue()


def test_column_preserves_missing_rows_and_omits_labels():
    result = import_prism_zip(fixture())
    assert result["tables"][0]["columns"] == [{"name": "A", "values": [1, None]}, {"name": "B", "values": [3, 4]}]
    assert any("row labels were omitted" in text for text in result["warnings"])


def test_xy_preserves_alignment_and_order():
    result = import_prism_zip(fixture("xy", csv_text="1,3\n2,\n"))
    assert result["tables"][0]["table_type"] == "xy"
    assert result["tables"][0]["columns"] == [{"name": "FIRST", "values": [1, 2]}, {"name": "A", "values": [3, None]}]


def test_replicates_rejected_without_flattening():
    def change(f):
        f["data/sheets/SHEET/sheet.json"]["table"]["dataFormat"] = "y_replicates"
    result = import_prism_zip(fixture(changes=change))
    assert result["tables"] == []
    assert any("not flattened or averaged" in text for text in result["warnings"])


def test_multivariable_requires_explicit_mapping():
    def change(f):
        f["data/sheets/SHEET/sheet.json"]["table"]["format"] = "multivariable"
    result = import_prism_zip(fixture(changes=change))
    assert not result["tables"]
    assert any("explicit variable mapping" in text for text in result["warnings"])


@pytest.mark.parametrize("attribute", ["EXCLUDED", "CENSORED", "UNKNOWN"])
def test_semantic_flags_do_not_silently_include_data(attribute):
    def change(f):
        f["data/sets/A.json"]["replicates"][0]["cellAttributes"] = [{"rows": "0", "attributes": [attribute]}]
    result = import_prism_zip(fixture(changes=change))
    assert not result["tables"]
    assert any("unsupported cell flags" in text for text in result["warnings"])


@pytest.mark.parametrize("text", ["x,1,2\n", "x,1,2\ny,3,4\nz,5,6\n", "x,1\ny,3\n", "x,NaN,2\ny,3,4\n", "x,1e101,2\ny,3,4\n"])
def test_invalid_dimensions_and_values_skip_table(text):
    assert not import_prism_zip(fixture(csv_text=text))["tables"]


@pytest.mark.parametrize("path", ["../document.json", "/document.json", "data\\bad.json"])
def test_unsafe_paths_rejected(path):
    with pytest.raises(AnalysisError, match="unsafe"):
        import_prism_zip(pack({path: "{}"}))


def test_duplicate_member_rejected():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("document.json", "{}")
        with pytest.warns(UserWarning):
            archive.writestr("document.json", "{}")
    with pytest.raises(AnalysisError, match="duplicate"):
        import_prism_zip(output.getvalue())


def test_duplicate_json_keys_rejected():
    with pytest.raises(AnalysisError, match="duplicate JSON"):
        import_prism_zip(pack({"document.json": '{"@class":"Document","@class":"Other"}'}))


def test_member_expansion_limit(monkeypatch):
    monkeypatch.setattr("gp.import_prism_zip.MAX_MEMBER_BYTES", 10)
    with pytest.raises(AnalysisError, match="oversized"):
        import_prism_zip(fixture())


def test_archive_limit(monkeypatch):
    monkeypatch.setattr("gp.import_prism_zip.MAX_ARCHIVE_BYTES", 10)
    with pytest.raises(AnalysisError, match="16 MiB"):
        import_prism_zip(fixture())


def test_invalid_archive_and_missing_document():
    for value in [b"PCFFGRA4", b"not a zip", pack({"other": "{}"})]:
        with pytest.raises(AnalysisError):
            import_prism_zip(value)


def test_future_format_is_not_assumed_compatible():
    def change(f):
        f["document.json"]["formatVersion"] = "2-0-0"
    with pytest.raises(AnalysisError, match="format version"):
        import_prism_zip(fixture(changes=change))
