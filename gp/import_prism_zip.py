"""Read observed Prism ZIP raw tables, without executing or extracting members.

Format observations: docs/prism-native-map.md. This is a bounded data importer,
not a complete Prism project loader. Legacy PCFFGRA4 files are unsupported.
"""
import base64
import binascii
import csv
import io
import json
import math
import re
import zipfile
import zlib
from pathlib import PurePosixPath

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .models import AnalysisRequest
from .statistics import AnalysisError

MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
MAX_EXPANDED_BYTES = 64 * 1024 * 1024
MAX_MEMBER_BYTES = 8 * 1024 * 1024
MAX_MEMBERS = 4000
MAX_TABLES = 100
MAX_TOTAL_CELLS = 1000000
SAFE_ATTRIBUTES = {"NUMERIC", "NOTCONV", "USER", "NOAUTODEC", "SCI_NOTATION"}


def _identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
        raise AnalysisError("invalid project object identifier")
    return value


def _integer(value, minimum, maximum):
    if type(value) is not int or not minimum <= value <= maximum:
        raise AnalysisError("table dimensions exceed supported limits or are invalid")
    return value


def _object(value):
    if not isinstance(value, dict):
        raise AnalysisError("expected a JSON object")
    return value


def _no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise AnalysisError("duplicate JSON object keys are unsupported")
        result[key] = value
    return result


def import_prism_zip(content):
    """Return {tables, warnings} for numeric column/XY y_single tables."""
    if not isinstance(content, bytes) or len(content) > MAX_ARCHIVE_BYTES:
        raise AnalysisError("Prism ZIP import is limited to 16 MiB.")
    notices = [
        "Imports raw numeric tables only; saved analyses, formatting, notes, and graphs are not imported.",
        "ZIP support is based on bundled Prism templates; legacy PCFFGRA4 binary projects are unsupported.",
    ]
    tables = []
    total_cells = 0
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > MAX_MEMBERS or sum(m.file_size for m in members) > MAX_EXPANDED_BYTES:
                raise AnalysisError("Prism ZIP exceeds the member count or expanded size limit.")
            seen = set()
            for member in members:
                name = member.filename
                if (name in seen or "\\" in name or "\x00" in name
                        or name.startswith("/") or re.match(r"^[A-Za-z]:", name) or ".." in PurePosixPath(name).parts):
                    raise AnalysisError("Prism ZIP contains duplicate or unsafe member paths.")
                seen.add(name)
                if member.flag_bits & 1 or member.file_size > MAX_MEMBER_BYTES:
                    raise AnalysisError("Encrypted or oversized ZIP members are unsupported.")
                if member.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                    raise AnalysisError("Unsupported ZIP compression method.")

            def read(path):
                try:
                    with archive.open(path) as handle:
                        data = handle.read(MAX_MEMBER_BYTES + 1)
                    if len(data) > MAX_MEMBER_BYTES:
                        raise AnalysisError("Expanded member exceeds the size limit.")
                    return data.decode("utf-8-sig")
                except KeyError as exc:
                    raise AnalysisError(f"missing project member {path}") from exc

            def obj(path):
                return _object(json.loads(read(path), object_pairs_hook=_no_duplicates))

            document = obj("document.json")
            if document.get("@class") != "Document":
                raise AnalysisError("ZIP does not contain a supported Prism Document.")
            if not isinstance(document.get("formatVersion"), str) or not document["formatVersion"].startswith("1-"):
                raise AnalysisError("Unsupported Prism ZIP format version.")
            sheet_ids = _object(document.get("sheets")).get("data", [])
            if not isinstance(sheet_ids, list) or len(sheet_ids) > MAX_TABLES:
                raise AnalysisError("At most 100 raw data sheets can be imported.")
            if len(set(_identifier(uid) for uid in sheet_ids)) != len(sheet_ids):
                raise AnalysisError("Duplicate data sheet identifiers are unsupported.")
            for uid in sheet_ids:
                title = f"Table {uid}"
                try:
                    sheet = obj(f"data/sheets/{uid}/sheet.json")
                    title = str(sheet.get("title", title))[:200]
                    table = _object(sheet.get("table"))
                    kind = table.get("format")
                    if kind not in {"column", "xy"}:
                        raise AnalysisError(f"unsupported table type {kind!r}; categorical/multivariable tables require explicit variable mapping")
                    if table.get("dataFormat") != "y_single":
                        raise AnalysisError("replicate or preaveraged subcolumns are unsupported; observations were not flattened or averaged")
                    ids = table.get("dataSets")
                    if not isinstance(ids, list) or not ids:
                        raise AnalysisError("missing Y data sets")
                    role_ids = []
                    if table.get("rowTitlesDataSet"):
                        role_ids.append(("label", table["rowTitlesDataSet"]))
                    if kind == "xy":
                        if table.get("xDataSetFormat") != "y_single":
                            raise AnalysisError("XY import requires a single raw numeric X data set")
                        role_ids.append(("x", table.get("xDataSet")))
                    elif table.get("xDataSet"):
                        raise AnalysisError("unexpected X data set in column table")
                    role_ids.extend(("y", item) for item in ids)
                    if len(role_ids) > 33:
                        raise AnalysisError("at most 32 numeric columns are supported")
                    _identifier(table.get("uid"))
                    prefix = f"data/tables/{table['uid']}/"
                    storage = obj(prefix + "content.json")
                    if storage.get("version") != 1:
                        raise AnalysisError("unsupported table storage version")
                    width = _integer(storage.get("numberOfColumns"), 1, 33)
                    height = _integer(storage.get("numberOfRows"), 1, 10000)
                    if width != len(role_ids) or width * height > 110000:
                        raise AnalysisError("table storage dimensions do not match its data sets or exceed limits")
                    total_cells += width * height
                    if total_cells > MAX_TOTAL_CELLS:
                        raise AnalysisError("file exceeds the total imported cell limit")
                    rows = []
                    for row in csv.reader(io.StringIO(read(prefix + "data.csv")), strict=True):
                        if len(rows) >= height or len(row) != width:
                            raise AnalysisError("CSV dimensions do not match table metadata")
                        rows.append(row)
                    if len(rows) != height:
                        raise AnalysisError("CSV row count does not match table metadata")
                    columns, used_names = [], set()
                    for index, (role, dsid) in enumerate(role_ids):
                        ds = obj(f"data/sets/{_identifier(dsid)}.json")
                        reps = ds.get("replicates")
                        if not isinstance(reps, list) or len(reps) != 1 or ds.get("replicate ranges"):
                            raise AnalysisError("non-single replicate storage is unsupported")
                        rep = _object(reps[0])
                        if role == "label":
                            if ds.get("format") != "text" or rep.get("valueType") != "string":
                                raise AnalysisError("unexpected row label representation")
                            continue
                        if ds.get("format") != "y_single" or rep.get("valueType") != "real":
                            raise AnalysisError("only raw numeric single-subcolumn data sets are supported")
                        attrs = rep.get("commonAttributes", [])
                        if not isinstance(attrs, list) or not all(isinstance(a, str) and a in SAFE_ATTRIBUTES for a in attrs):
                            raise AnalysisError("unsupported cell flags; excluded or censored observations were not included")
                        for cell in rep.get("cellAttributes", []):
                            cell = _object(cell)
                            attrs = cell.get("attributes", [])
                            if not isinstance(attrs, list) or not all(isinstance(a, str) and a in SAFE_ATTRIBUTES for a in attrs):
                                raise AnalysisError("unsupported cell flags; excluded or censored observations were not included")
                        name = str(ds.get("title") or ("X" if role == "x" else f"Series {len(columns)+1}"))
                        if len(name) > 100:
                            raise AnalysisError("column title exceeds 100 characters")
                        base, suffix = name, 2
                        while name in used_names:
                            name = f"{base[:90]} ({suffix})"
                            suffix += 1
                        used_names.add(name)
                        values = []
                        for row in rows:
                            cell = row[index].strip()
                            if not cell:
                                values.append(None)
                                continue
                            value = float(cell)
                            if not math.isfinite(value):
                                raise AnalysisError("non-finite numeric cells are unsupported")
                            values.append(value)
                        columns.append({"name": name, "values": values})
                    validated = AnalysisRequest(table_type=kind, columns=columns)
                    tables.append({"id": uid, "title": title, "table_type": kind,
                                   "columns": [column.model_dump() for column in validated.columns]})
                    if table.get("rowTitlesDataSet"):
                        notices.append(f"{title}: row labels were omitted; numeric row positions were preserved.")
                except (AnalysisError, ValidationError, ValueError, TypeError, KeyError, OverflowError) as exc:
                    reason = str(exc) if isinstance(exc, AnalysisError) else "invalid or unsupported table metadata/numeric cells"
                    notices.append(f"Skipped {title}: {reason}.")
            if not tables:
                notices.append("No supported raw column or XY tables were found.")
    except AnalysisError:
        raise
    except (zipfile.BadZipFile, zlib.error, RuntimeError, UnicodeError, ValueError, TypeError, KeyError, RecursionError, NotImplementedError, csv.Error) as exc:
        raise AnalysisError("Expected a valid supported Prism ZIP project with UTF-8 JSON and CSV data.") from exc
    return {"tables": tables, "warnings": notices}


class PrismZipImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_base64: str = Field(min_length=4, max_length=4*((MAX_ARCHIVE_BYTES+2)//3))

    def import_tables(self):
        try:
            raw = base64.b64decode(self.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AnalysisError("Invalid encoded Prism ZIP file.") from exc
        return import_prism_zip(raw)
