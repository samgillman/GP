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
    assert output["tables"][0]["columns"][0]["values"] == [1,None,None,3,4,None]
    assert output["tables"][0]["title"] == "My experiment"
    assert any("2 excluded" in w for w in output["warnings"])


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
