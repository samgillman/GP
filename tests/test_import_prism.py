import pytest
from fastapi.testclient import TestClient
from gp.server import app
from gp.import_prism import import_prism
from gp.statistics import AnalysisError


def document(table):
    return '<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm">'+table+'</GraphPadPrismFile>'


def column(name, cells, tag="YColumn", attrs=""):
    return f'<{tag} Subcolumns="1" {attrs}><Title>{name}</Title><Subcolumn>{cells}</Subcolumn></{tag}>'


def test_column_import_preserves_empty_and_excluded_rows():
    xml = document('<Table ID="T1" TableType="OneWay"><Title>My experiment</Title>'+column('A','<d>1</d><d/><d Excluded="1">99</d><d Excluded="0">3</d><d Excluded="false">4</d><d Excluded="true">98</d>')+'</Table>')
    output = import_prism(xml)
    assert output["tables"][0]["columns"][0]["values"] == [1,None,99,3,4,98]
    assert output["tables"][0]["excluded"] == [[0,2],[0,5]]
    assert output["tables"][0]["title"] == "My experiment"
    assert any("2 excluded values imported with their original numbers" in w for w in output["warnings"])


def test_excluded_xy_values_and_asterisk_format_keep_original_numbers():
    table = ('<Table TableType="XY" EVFormat="AsteriskAfterNumber">'
             + column('X', '<d>1</d><d Excluded="1">2</d><d>3</d>', 'XColumn')
             + column('Y', '<d>5*</d><d>6</d><d Excluded="1">bad</d>') + '</Table>')
    output = import_prism(document(table))
    imported = output["tables"][0]
    assert [c["values"] for c in imported["columns"]] == [[1,2,3],[5,6,None]]
    assert imported["excluded"] == [[0,1],[1,0]]
    assert any("1 excluded cells had no finite number" in w for w in output["warnings"])


def test_asterisk_without_excluded_value_format_is_not_reinterpreted():
    table = '<Table TableType="OneWay">'+column('A','<d>5*</d>')+'</Table>'
    output = import_prism(document(table))
    assert not output["tables"]
    assert any("non-numeric" in w for w in output["warnings"])


def test_nested_wrapper_xy_and_mixed_title_ignore_advanced_duplicate():
    table='<Table TableType="XY" XFormat="numbers" YFormat="replicates">'+column('Dose <SUP>2</SUP>','<d>1</d><d>2</d>', 'XColumn')+column('duplicate','<d>999</d>', 'XAdvancedColumn')+column('Response','<d>5</d><d>7</d>')+'</Table>'
    xml='<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">'+document(table)+'</xsl:stylesheet>'
    table=import_prism(xml)["tables"][0]
    assert table["table_type"] == "xy"
    assert len(table["columns"]) == 2
    assert table["columns"][0] == {"name":"Dose 2", "values":[1,2]}


@pytest.mark.parametrize("table", [
    '<Table TableType="Survival"/>',
    '<Table TableType="OneWay" YFormat="SD">'+column('A','<d>1</d>')+'</Table>',
    '<Table TableType="OneWay"><YColumn Subcolumns="2"><Subcolumn><d>1</d></Subcolumn><Subcolumn><d>2</d></Subcolumn></YColumn></Table>',
    '<Table TableType="XY" XFormat="text">'+column('X','<d>A</d>','XColumn')+column('Y','<d>2</d>')+'</Table>',
    '<Table TableType="OneWay">'+column('A','<d>text</d>')+'</Table>',
    '<Table TableType="OneWay">'+column('A','<d>NaN</d>')+'</Table>',
    '<Table TableType="OneWay">'+column('A','<d Excluded="yes">1</d>')+'</Table>',
])
def test_unsupported_tables_are_skipped_with_explicit_warning(table):
    output=import_prism(document(table))
    assert output["tables"] == []
    assert any(w.startswith("Skipped") for w in output["warnings"])


@pytest.mark.parametrize("text", ['not xml', '<root/>', '<!DOCTYPE GraphPadPrismFile [<!ENTITY steal SYSTEM "file:///etc/passwd">]><GraphPadPrismFile>&steal;</GraphPadPrismFile>'])
def test_rejects_invalid_documents_and_external_entities(text):
    with pytest.raises(AnalysisError):
        import_prism(text)


def test_import_endpoint_and_bad_xml():
    client=TestClient(app)
    xml=document('<Table TableType="OneWay">'+column('A','<d>1</d><d>2</d>')+'</Table>')
    response=client.post('/api/import-prism',json={"content":xml})
    assert response.status_code == 200
    assert response.json()["tables"][0]["columns"][0]["values"] == [1,2]
    assert client.post('/api/import-prism',json={"content":"broken"}).status_code == 422


@pytest.mark.parametrize("extended", ["Nested", "MultipleVariables", "FutureType", ""])
def test_extended_numeric_tables_are_never_reinterpreted_as_columns(extended):
    xml = document(f'<Table TableType="OneWay" ExtTableType="{extended}"><Title>Special design</Title>'
                   + column('A', '<d>1</d><d>2</d>') + '</Table>')
    result = import_prism(xml)
    assert result["tables"] == []
    assert any(f"Skipped Special design: unsupported extended table type {extended or 'unknown'}" in w
               for w in result["warnings"])


def numeric_table(uid, value):
    return f'<Table ID="{uid}" TableType="OneWay">' + column(uid, f'<d>{value}</d>') + '</Table>'


def test_table_sequence_controls_order_without_reassigning_data():
    xml = document('<TableSequence><Ref ID="B"/><Ref ID="A" Selected="1"/></TableSequence>'
                   + numeric_table('A', 11) + numeric_table('B', 22))
    result = import_prism(xml)
    assert [(t["id"], t["columns"][0]["values"]) for t in result["tables"]] == [('B', [22]), ('A', [11])]


def test_table_sequence_missing_duplicate_and_unlisted_refs_are_visible():
    xml = document('<TableSequence><Ref ID="B"/><Ref ID="missing"/><Ref ID="B"/></TableSequence>'
                   + numeric_table('A', 11) + numeric_table('B', 22))
    result = import_prism(xml)
    assert [t["id"] for t in result["tables"]] == ['B', 'A']
    assert any("'missing' does not identify" in w for w in result["warnings"])
    assert any("Duplicate TableSequence reference 'B'" in w for w in result["warnings"])
    assert any("absent from TableSequence" in w for w in result["warnings"])


def test_no_sequence_preserves_document_order():
    result = import_prism(document(numeric_table('B', 22) + numeric_table('A', 11)))
    assert [t["id"] for t in result["tables"]] == ['B', 'A']


@pytest.mark.parametrize("body", [
    numeric_table('A', 11) + numeric_table('A', 22),
    '<TableSequence/><TableSequence/>' + numeric_table('A', 11),
])
def test_ambiguous_xml_references_are_rejected(body):
    with pytest.raises(AnalysisError, match="ambiguous"):
        import_prism(document(body))


def test_empty_import_endpoint_retains_each_unsupported_table_reason():
    xml = document('<Table TableType="OneWay" ExtTableType="MultipleVariables"><Title>Covariates</Title>'
                   + column('Age', '<d>30</d><d>40</d>') + '</Table>'
                   + '<Table TableType="Survival"><Title>Time to event</Title></Table>')
    response = TestClient(app).post('/api/import-prism', json={"content": xml})
    assert response.status_code == 200
    body = response.json()
    assert body["tables"] == []
    assert any("Skipped Covariates: unsupported extended table type MultipleVariables" in w for w in body["warnings"])
    assert any("Skipped Time to event: unsupported table type Survival" in w for w in body["warnings"])
    assert body["warnings"][-1] == "No supported raw column or XY tables were found."
