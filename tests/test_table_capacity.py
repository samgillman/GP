"""Advertised 10,000-row by 30-column analysis capacity, including API use."""
import math

import pytest
from fastapi.testclient import TestClient

from gp.server import app


client = TestClient(app)


def payload(rows=10000, columns=30, table_type="column"):
    values = list(range(1, rows + 1))
    return {"table_type": table_type, "analysis": "descriptive", "columns": [
        {"name": f"C{i}", "values": values} for i in range(columns)
    ]}


@pytest.mark.parametrize("table_type,expected_summaries", [("column", 30), ("xy", 29)])
def test_full_advertised_table_can_be_analyzed(table_type, expected_summaries):
    response = client.post("/api/analyze", json=payload(table_type=table_type))
    assert response.status_code == 200, response.text[:500]
    summaries = response.json()["summary"]
    assert len(summaries) == expected_summaries
    for row in summaries:
        assert row["n"] == 10000
        assert row["mean"] == 5000.5
        assert row["sum"] == 50005000
        assert row["sd"] == pytest.approx(math.sqrt(10000 * 10001 / 12))


@pytest.mark.parametrize("rows,columns", [(10000, 31), (10001, 30), (1, 31), (10001, 1)])
def test_exceeding_row_or_column_capacity_is_rejected(rows, columns):
    response = client.post("/api/analyze", json=payload(rows, columns))
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert errors[0]["type"] == "too_long"
    if columns > 30:
        assert errors[0]["loc"] == ["body", "columns"]
        assert "30" in errors[0]["msg"]
    else:
        assert errors[0]["loc"] == ["body", "columns", 0, "values"]
        assert "10000" in errors[0]["msg"]
