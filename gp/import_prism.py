"""Import a deliberately limited subset of the documented Prism XML structure."""
import math
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from .models import AnalysisRequest
from .statistics import AnalysisError


class PrismImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=8*1024*1024)


def tag(element):
    return element.tag.rsplit("}", 1)[-1]


def children(element, name):
    return [child for child in element if tag(child) == name]


def title(element, default):
    titles = children(element, "Title")
    return " ".join("".join(titles[0].itertext()).split()) if titles else default


def import_prism(content):
    if len(content.encode("utf-8")) > 8*1024*1024:
        raise AnalysisError("Prism XML import is limited to 8 MiB.")
    try:
        root = ElementTree.fromstring(content, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except (ElementTree.ParseError, DefusedXmlException, ValueError) as exc:
        raise AnalysisError("Expected valid Prism XML (.pzfx or .xml), without DTDs or entities. Binary .prism files are not supported.") from exc
    documents = [element for element in root.iter() if tag(element) == "GraphPadPrismFile"]
    if not documents:
        raise AnalysisError("This XML does not contain a GraphPadPrismFile document.")
    tables, notices = [], ["Imports raw numeric table data only; saved analyses, formatting, notes, and graphs are not imported."]
    table_elements = [element for document in documents for element in document if tag(element) == "Table"]
    if len(table_elements) > 100:
        raise AnalysisError("At most 100 tables can be imported per file.")
    for index, table in enumerate(table_elements):
        table_title = title(table, f"Table {index+1}")
        try:
            kind = table.get("TableType")
            if kind not in {"OneWay", "XY"}:
                raise AnalysisError(f"unsupported table type {kind or 'unknown'}")
            if table.get("YFormat", "replicates") not in {"replicates"}:
                raise AnalysisError("preaveraged or non-raw Y data are unsupported")
            if kind == "XY" and table.get("XFormat", "numbers") != "numbers":
                raise AnalysisError("only numeric XY X values are supported")
            x_columns, y_columns = children(table, "XColumn"), children(table, "YColumn")
            if kind == "XY" and len(x_columns) != 1:
                raise AnalysisError("XY import requires one numeric X column")
            raw_columns = (x_columns if kind == "XY" else []) + y_columns
            if not y_columns:
                raise AnalysisError("no Y columns were found")
            imported, used_names = [], set()
            excluded = 0
            for column_index, column in enumerate(raw_columns):
                subcolumns = children(column, "Subcolumn")
                if len(subcolumns) != 1 or column.get("Subcolumns", "1") != "1":
                    raise AnalysisError("multiple replicate/error subcolumns are unsupported; import a single raw subcolumn per series")
                name = title(column, "X" if tag(column) == "XColumn" else f"Series {column_index+1}") or f"Series {column_index+1}"
                base, suffix = name, 2
                while name in used_names:
                    name = f"{base} ({suffix})"; suffix += 1
                used_names.add(name)
                numeric = []
                for cell in children(subcolumns[0], "d"):
                    text = "".join(cell.itertext()).strip()
                    exclusion = cell.get("Excluded", "0")
                    if exclusion not in {"0", "1", "false", "true"}:
                        raise AnalysisError("invalid Excluded boolean attribute")
                    marked = exclusion in {"1", "true"}
                    if text.endswith("*") and table.get("EVFormat") == "AsteriskAfterNumber":
                        marked = True
                    if marked:
                        numeric.append(None); excluded += 1
                    elif not text:
                        numeric.append(None)
                    else:
                        try:
                            value = float(text)
                        except ValueError as exc:
                            raise AnalysisError("non-numeric cells are unsupported") from exc
                        if not math.isfinite(value):
                            raise AnalysisError("non-finite numeric values are unsupported")
                        numeric.append(value)
                imported.append(dict(name=name, values=numeric))
            validated = AnalysisRequest(table_type="xy" if kind == "XY" else "column", columns=imported)
            tables.append(dict(id=table.get("ID", f"Table{index}"), title=table_title, table_type=validated.table_type, columns=[c.model_dump() for c in validated.columns]))
            if excluded:
                notices.append(f"{table_title}: {excluded} excluded observations imported as missing cells; row positions preserved.")
        except (AnalysisError, ValidationError) as exc:
            reason = str(exc) if isinstance(exc, AnalysisError) else "table exceeds supported limits (32 columns, 10,000 rows per column, 100,000 cells) or has invalid names/data"
            notices.append(f"Skipped {table_title}: {reason}.")
    if not tables:
        notices.append("No supported raw column or XY tables were found.")
    return dict(tables=tables, warnings=notices)
