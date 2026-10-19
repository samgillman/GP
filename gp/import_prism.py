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


def ordered_tables(document, notices):
    """Use explicit sheet order, retaining unlisted tables with a diagnostic."""
    tables = children(document, "Table")
    by_id = {}
    for table in tables:
        uid = table.get("ID")
        if uid:
            if uid in by_id:
                raise AnalysisError(f"Duplicate XML table ID {uid!r}; table references are ambiguous.")
            by_id[uid] = table
    sequences = children(document, "TableSequence")
    if not sequences:
        return tables
    if len(sequences) != 1:
        raise AnalysisError("Multiple XML TableSequence elements are ambiguous.")
    ordered, seen = [], set()
    for ref in children(sequences[0], "Ref"):
        uid = ref.get("ID")
        if uid not in by_id:
            notices.append(f"TableSequence reference {uid!r} does not identify an available Table; it was not imported.")
        elif uid in seen:
            notices.append(f"Duplicate TableSequence reference {uid!r} was ignored.")
        else:
            ordered.append(by_id[uid])
            seen.add(uid)
    unlisted = [table for table in tables if table.get("ID") not in seen]
    if unlisted:
        notices.append(f"{len(unlisted)} tables were absent from TableSequence; appended in document order.")
    return ordered + unlisted


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
    table_elements = [table for document in documents for table in ordered_tables(document, notices)]
    for index, table in enumerate(table_elements):
        table_title = title(table, f"Table {index+1}")
        try:
            if "ExtTableType" in table.attrib:
                raise AnalysisError(f"unsupported extended table type {table.get('ExtTableType') or 'unknown'}; its grouping or variable semantics cannot be imported as ordinary column or XY data")
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
            excluded_cells, unreadable = [], 0
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
                        marked, text = True, text[:-1].rstrip()
                    if marked:
                        # Keep the original value with its exclusion; an excluded cell
                        # without a finite number can only be represented as missing.
                        try:
                            value = float(text)
                        except ValueError:
                            value = math.nan
                        if math.isfinite(value):
                            excluded_cells.append([column_index, len(numeric)])
                            numeric.append(value)
                        else:
                            numeric.append(None)
                            unreadable += bool(text)
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
            tables.append(dict(id=table.get("ID", f"Table{index}"), title=table_title, table_type=validated.table_type,
                               columns=[c.model_dump() for c in validated.columns], excluded=excluded_cells))
            if excluded_cells:
                notices.append(f"{table_title}: {len(excluded_cells)} excluded values imported with their original numbers and kept excluded.")
            if unreadable:
                notices.append(f"{table_title}: {unreadable} excluded cells had no finite number and were imported as missing.")
        except (AnalysisError, ValidationError) as exc:
            reason = str(exc) if isinstance(exc, AnalysisError) else "table exceeds supported limits (32 columns, 10,000 rows per column, 100,000 cells) or has invalid names/data"
            notices.append(f"Skipped {table_title}: {reason}.")
    if not tables:
        notices.append("No supported raw column or XY tables were found.")
    return dict(tables=tables, warnings=notices)
