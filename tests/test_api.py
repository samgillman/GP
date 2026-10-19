import pytest
from fastapi.testclient import TestClient
from gp.server import app

client = TestClient(app)
DATA = {"table_type":"column", "analysis":"descriptive", "columns":[{"name":"Control", "values":[1,2,3,4]}, {"name":"Treated", "values":[3,4,6,7]}]}


def test_health_and_unknown_routes():
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/no-such-route").status_code == 404


def test_analysis_json_contract():
    response = client.post("/api/analyze", json=DATA)
    assert response.status_code == 200
    assert set(response.json()) == {"analysis", "summary", "results", "warnings", "fit"}
    assert response.json()["summary"][0]["mean"] == 2.5


@pytest.mark.parametrize("format,signature,media", [("svg",b"<?xml", "image/svg+xml"), ("png",b"\x89PNG", "image/png"), ("pdf",b"%PDF", "application/pdf")])
def test_graph_exports_are_real_images(format, signature, media):
    response = client.post("/api/export", json={"data": DATA, "graph":{"type":"bar", "error":"ci", "title":"Experiment"}, "format":format})
    assert response.status_code == 200, response.text[:200]
    assert response.content.startswith(signature)
    assert response.headers["content-type"].startswith(media)
    assert len(response.content) > 1000


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", "1e101"])
def test_nonfinite_or_extreme_inputs_are_rejected_as_json(value):
    response = client.post("/api/analyze", content='{"columns":[{"name":"A","values":['+value+']}] }', headers={"content-type":"application/json"})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_duplicate_names_and_invalid_colors_rejected():
    response = client.post("/api/analyze", json={"columns":[{"name":"A","values":[1]},{"name":"A","values":[2]}]})
    assert response.status_code == 422
    response = client.post("/api/export", json={"data":DATA,"graph":{"colors":["url(https://example.com)"]},"format":"svg"})
    assert response.status_code == 422


def test_xy_export_with_regression_and_literal_math_title():
    data = {"table_type":"xy", "analysis":"linear_regression", "columns":[{"name":"Time", "values":[1,2,3,4]}, {"name":"Signal", "values":[3,5,6,9]}]}
    response = client.post("/api/export", json={"data":data,"graph":{"title":"$not math$ <test>"},"format":"svg"})
    assert response.status_code == 200
    assert "$not math$ &lt;test&gt;" in response.text


def test_body_limit():
    response = client.post("/api/import-prism", content=b"x"*(10*1024*1024+1), headers={"content-type":"application/json"})
    assert response.status_code == 413


def test_array_size_limit():
    response = client.post("/api/analyze", json={"columns":[{"name":"A","values":[1]*10001}]})
    assert response.status_code == 422
