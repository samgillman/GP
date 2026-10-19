import json
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from gp.server import app

client = TestClient(app)
fixtures = Path(__file__).parent / 'fixtures'


def test_survival_route_runs_saved_reference_and_rejects_unknown_event_codes():
    fixture = json.loads((fixtures / 'prism_survival_saved.json').read_text())
    payload = {'groups': fixture['groups'], 'confidence': fixture['confidence']}
    response = client.post('/api/survival', json=payload)
    assert response.status_code == 200, response.text
    assert response.json()['logrank']['statistic'] == pytest.approx(115.99638345184422)
    payload['groups']['Vehicle']['events'][0] = 2
    assert client.post('/api/survival', json=payload).status_code == 422


def test_factorial_route_preserves_the_observed_design():
    fixture = json.loads((fixtures / 'prism_two_way_saved.json').read_text())
    response = client.post('/api/factorial', json=fixture['input'])
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['design']['observations'] == 36
    assert result['anova_table'][0]['f'] == pytest.approx(97.1848260277159)
    fixture['input']['cells'][0]['values'].pop()
    assert client.post('/api/factorial', json=fixture['input']).status_code == 422


def test_recovered_model_is_selected_by_request_and_exported():
    data = {'analysis': 'nonlinear_regression', 'regression_model': 'straight_line',
            'table_type': 'xy', 'columns': [{'name': 'X', 'values': [1,2,3,4,5]},
                                           {'name': 'Y', 'values': [3,5,7,9,11]}]}
    response = client.post('/api/analyze', json=data)
    assert response.status_code == 200, response.text
    assert response.json()['fit'][0]['parameters']['Slope'] == pytest.approx(2)
    graph = client.post('/api/export', json={'data': data, 'format': 'svg'})
    assert graph.status_code == 200 and '<svg' in graph.text
    data['regression_model'] = 'unknown_model'
    assert client.post('/api/analyze', json=data).status_code == 422


def test_zip_route_rejects_invalid_encoding_without_internal_error():
    response = client.post('/api/import-prism-zip', json={'content_base64': '%%%='})
    assert response.status_code == 422
    assert 'Invalid encoded' in response.json()['detail']


def test_extended_descriptive_route_matches_saved_values_and_marks_undefined():
    fixture = json.loads((fixtures / 'prism_descriptive_saved.json').read_text())
    payload = {'analysis': 'descriptive', 'columns': [
        {'name': name, 'values': group['values']}
        for name, group in fixture['groups'].items()
    ]}
    response = client.post('/api/analyze', json=payload)
    assert response.status_code == 200, response.text
    for summary in response.json()['summary']:
        expected = fixture['groups'][summary['name']]['expected']
        assert summary['q1'] == pytest.approx(expected['firstQuartile'], abs=1e-12)
        assert summary['geometric_mean'] == pytest.approx(expected['geometricMean'], abs=1e-12)
    payload['columns'][0]['values'][0] = 0
    response = client.post('/api/analyze', json=payload)
    assert response.status_code == 200, response.text
    summary = response.json()['summary'][0]
    assert summary['n'] == 14
    assert summary['geometric_mean'] is None
    assert 'strictly positive' in summary['undefined_reasons']['geometric_mean']
