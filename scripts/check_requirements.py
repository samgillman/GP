"""Validate the completion ledger's identities, provenance coverage and evidence gates."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = root / 'docs/requirements'
manifest = json.loads((base / 'source-map.json').read_text())
contracts = json.loads((base / 'dependency-contracts.json').read_text())['contracts']
rows = []
for name in manifest['requirement_registers']:
    data = json.loads((base / name).read_text())
    rows.extend(data['requirements'])
    rows.extend(data.get('model_catalog', []))
ids = {row['id'] for row in rows}
assert len(ids) == len(rows) == manifest['requirement_count'], 'Duplicate or missing IDs'
assert ids == set(manifest['requirement_index']), 'Stale requirement index'
allowed = {'not_started', 'partial', 'in_progress', 'implemented_gp_verified', 'verified_equivalent', 'reference_blocked', 'external_blocked', 'verification_blocked'}
for row in rows:
    assert row['title'] and row['acceptance'], row['id']
    assert row['status'] in allowed, (row['id'], row['status'])
    assert set(row.get('dependencies', [])) <= ids | set(contracts), row['id']
    if row['status'] in {'implemented_gp_verified', 'verified_equivalent'}:
        assert row.get('implementation_evidence') and row.get('validation_evidence'), row['id']
    if row['status'] == 'verified_equivalent':
        assert row.get('prism_reference_evidence'), row['id']
for name, contract in contracts.items():
    assert contract['requirement_ids'] and set(contract['requirement_ids']) <= ids, name
old_index = json.loads((root / 'docs/prism10-guide-index.json').read_text())
assert [(s['title'], s['anchor']) for s in manifest['guide_sections']] == [(s['title'], s['anchor']) for s in old_index['sections']]
for item in [*manifest['guide_sections'], *manifest['prism11_headings'], *manifest['existing_coverage_families'].values()]:
    assert item['requirement_ids'] and set(item['requirement_ids']) <= ids, item
coverage = json.loads((root / 'docs/prism-coverage.json').read_text())
assert set(manifest['existing_coverage_families']) == {r['id'] for r in coverage['obligations']}
def model_key(row):
    return row['family'], row['name'], row['source']['sha256'], row['source']['object_index']
assert len(manifest['equations']) == 152
assert {model_key(r) for r in manifest['equations']} == {model_key(r) for r in coverage['model_catalog']}
assert len(manifest['formula_functions']) == 82
assert len({r['name'] for r in manifest['formula_functions']}) == 82
for row in manifest['equations'] + manifest['formula_functions']:
    assert row['id'] in ids and len(row['source']['sha256']) == 64
print(f"PASS: {len(rows)} unique requirements; {len(manifest['guide_sections'])} guide sections; {len(manifest['prism11_headings'])} Prism11 headings; 32 coverage families; 152 equations; 82 functions; evidence gates")
