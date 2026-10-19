"""Comparisons with source-hashed saved Prism results, not a live Prism run."""
import json
from pathlib import Path
import pytest
from gp.models import AnalysisRequest
from gp.statistics import analyze

REFERENCE = json.loads((Path(__file__).parent / 'fixtures/prism_11_1_paired.json').read_text())


def test_paired_t_matches_saved_prism_11_1_result_and_direction():
    actual = analyze(AnalysisRequest(analysis='paired_t', columns=REFERENCE['columns']))
    result = {row['label']: row['value'] for row in actual['results']}
    names = {
        't statistic': 't', 'Degrees of freedom': 'df', 'Two-sided p value': 'p',
        'Mean difference (first − second)': 'difference', 'SD of differences': 'sd',
        'SEM of differences': 'sem', 'Difference CI lower': 'ci_low',
        'Difference CI upper': 'ci_high', 'R squared': 'r_squared',
        'Cohen d (paired differences)': 'cohen_d', 'Hedges g (paired differences)': 'hedges_g',
    }
    for label, key in names.items():
        assert result[label] == pytest.approx(REFERENCE['expected'][key], rel=1e-10, abs=1e-12), label
    assert result['t statistic'] > 0 and result['Mean difference (first − second)'] < 0


def test_swapping_paired_groups_flips_direction_but_not_significance():
    actual = analyze(AnalysisRequest(analysis='paired_t', columns=REFERENCE['columns'][::-1]))
    result = {row['label']: row['value'] for row in actual['results']}
    assert result['t statistic'] == pytest.approx(REFERENCE['expected']['t'])
    assert result['Two-sided p value'] == pytest.approx(REFERENCE['expected']['p'])
    assert result['Mean difference (first − second)'] == pytest.approx(-REFERENCE['expected']['difference'])
    assert result['Difference CI lower'] == pytest.approx(-REFERENCE['expected']['ci_high'])
