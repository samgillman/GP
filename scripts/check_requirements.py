"""Validate the completion ledger's identities, provenance coverage and evidence gates."""
import json
import csv
import hashlib
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
audit = manifest.get('parity_audit')
if audit:
    source_path = root / audit['source_path']
    with source_path.open(newline='') as source_file:
        source_reader = csv.DictReader(source_file)
        original_fields = source_reader.fieldnames
        original = list(source_reader)
    with (root / audit['annotated_path']).open(newline='') as planned_file:
        planned_reader = csv.DictReader(planned_file)
        assert planned_reader.fieldnames == original_fields, 'Parity CSV columns changed'
        planned = list(planned_reader)
    register = json.loads((base / audit['register']).read_text())
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == register['source']['sha256'], 'Parity source bytes changed'
    assert len(original) == len(planned) == len(register['requirements']) == audit['rows'], 'Parity rows dropped'
    assert len({row['id'] for row in original}) == len(original), 'Duplicate source audit ID'
    assert [row['id'] for row in register['requirements']] == audit['requirement_ids'], 'Parity requirement order changed'
    for source_row, plan_row, requirement in zip(original, planned, register['requirements']):
        assert all(source_row[key] == plan_row[key] for key in original_fields if key not in {'your_plan', 'your_note'}), source_row['id']
        assert plan_row['your_plan'].strip() and plan_row['your_note'].strip(), source_row['id']
        assert requirement['id'] == 'AUD-' + source_row['id'] and requirement['audit_id'] == source_row['id'], source_row['id']
        assert requirement['submitted_gp_status'] == source_row['gp_status'], source_row['id']
        assert requirement['submitted_gp_finding'] == source_row['gp_finding'], source_row['id']
        assert requirement['implementation_plan'] == plan_row['your_plan'] and requirement['review_note'] == plan_row['your_note'], source_row['id']
        assert requirement['source']['url'] == source_row['source'] and requirement['acceptance'][0] == source_row['prism_detail'], source_row['id']
        assert requirement['dependencies'] and set(requirement['dependencies']) <= ids, source_row['id']
print(f"PASS: {len(rows)} unique requirements; {len(manifest['guide_sections'])} guide sections; {len(manifest['prism11_headings'])} Prism11 headings; 32 coverage families; 152 equations; 82 functions; evidence gates")
if audit:
    print(f"PASS: all {audit['rows']} parity CSV rows, original statuses, findings and sources preserved; individual plans and notes populated")
