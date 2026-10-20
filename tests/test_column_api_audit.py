"""API boundaries for statistical safeguards; no claim of native Prism parity."""
import pytest
from fastapi.testclient import TestClient
from gp.server import app

client = TestClient(app)
BASE = {
    "analysis": "t_test",
    "columns": [{"name": "A", "values": [1, 2, None, 4]},
                {"name": "B", "values": [2, None, 4, 8]}],
}


def test_paired_descriptions_use_the_same_subjects_as_the_test():
    response = client.post("/api/analyze", json={**BASE, "options": {"paired": True}})
    assert response.status_code == 200
    body = response.json()
    assert body["analysis_revision"] == 2
    assert [s["n"] for s in body["summary"]] == [2, 2]
    assert [s["mean"] for s in body["summary"]] == [2.5, 5]
    assert [s["n"] for s in body["graph_summary"]] == [3, 3]
    assert [s["mean"] for s in body["graph_summary"]] == pytest.approx([7 / 3, 14 / 3])
    assert any("complete matched rows" in w for w in body["warnings"])


@pytest.mark.parametrize("options", [
    {"method": "holm_sidak"}, {"method": "fdr"}, {"mixed_effects": True},
    {"zero_method": "pratt"}, {"alternative": "automatic"},
])
def test_unsupported_options_do_not_fall_back_to_supported_tests(options):
    response = client.post("/api/analyze", json={**BASE, "options": options})
    assert response.status_code == 422
    assert "results" not in response.json()


def test_legacy_one_tailed_request_requires_an_explicit_direction():
    response = client.post("/api/analyze", json={**BASE, "options": {"tails": 1}})
    assert response.status_code == 422
    assert "direction" in response.text.lower()


def test_incomplete_repeated_measures_returns_an_error_not_complete_case_p_values():
    response = client.post("/api/analyze", json={
        **BASE, "analysis": "one_way_anova", "options": {"paired": True},
    })
    assert response.status_code == 422
    assert "results" not in response.json()
    assert "missing" in response.text.lower() or "incomplete" in response.text.lower()
