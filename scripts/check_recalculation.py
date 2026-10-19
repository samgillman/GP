"""Exercise linked recalculation in Chromium against server or static worker builds.
Run: GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_recalculation.py URL
Uses actual scientific calculations, fresh browser storage, and hand-computed means.
"""
import copy
import json
import os
import sys
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8001'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'), args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    engine_events = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda event: engine_events.append({'type': event.type, 'text': event.text[:1000]}))
    page.on('requestfailed', lambda request: engine_events.append({'failed_request': request.url, 'reason': request.failure}))
    page.goto(base)
    page.wait_for_function('localStorage.getItem("gp.workbook.v2") !== null')
    def book():
        return page.evaluate('JSON.parse(localStorage.getItem("gp.workbook.v2"))')
    template = book()
    source = next(s for s in template['sheets'] if s['kind'] == 'data')
    source.update(id='d1', name='Source', revision=1)
    source['project'].update(name='Source', table_type='column', analysis='descriptive', columns=[{'name':'A','values':['1','2','3']}, {'name':'B','values':['4','5','6']}])
    other = copy.deepcopy(source)
    other.update(id='d2', name='Other')
    other['project']['name'] = 'Other'
    other['project']['columns'] = [{'name':'Other Y','values':['10','20','30']}]
    def stale(id, data, columns):
        return {'kind':'results','id':id,'name':id,'dataId':data,'analysis':'descriptive','columnIndices':columns,'sourceRevision':0,'status':'stale','result':None}
    # Deliberately exercise migration of a legacy positional workbook fixture.
    template.update(version=2, activeSheetId='d1', sheets=[source,other,stale('r1','d1',[0]),stale('r2','d1',[1]),stale('r3','d2',[0])])
    page.evaluate('(b) => localStorage.setItem("gp.workbook.v2",JSON.stringify(b))', template)
    page.reload()
    def current(ids):
        try:
            page.wait_for_function('(ids) => {const b=JSON.parse(localStorage.getItem("gp.workbook.v2"));return ids.every(id=>b.sheets.find(s=>s.id===id)?.status==="current") || document.body.innerText.includes("Recalculation failed:")}', arg=ids, timeout=120000)
            assert all(next(s for s in book()['sheets'] if s['id']==id)['status']=='current' for id in ids), page.locator('.alert').all_text_contents()
        except Exception:
            # A data sheet need not display the linked result's failure banner.
            # Keep job/storage and worker diagnostics instead of reporting only
            # an empty .alert list when a cold browser engine does not finish.
            saved = book()
            print('Linked result states:', [
                {key: item.get(key) for key in ('id', 'status', 'sourceRevision', 'frozen', 'selectionInvalid')}
                for item in saved['sheets'] if item['id'] in ids
            ], flush=True)
            print('Browser engine events:', engine_events[-25:], flush=True)
            print('Calculation diagnostic:', page.locator('.alert').all_text_contents(), flush=True)
            print('Page errors:', errors, flush=True)
            raise
    def result(id):
        return next(s for s in book()['sheets'] if s['id']==id)
    current(['r1','r2','r3'])
    assert book()['activeSheetId']=='d1'
    assert [result(r)['result']['summary'][0]['mean'] for r in ['r1','r2','r3']]==[2,5,20]
    expect(page.get_by_role('button', name='Undo', exact=True)).to_be_disabled()
    untouched=result('r3')
    # A draft cannot compute; valid edits resume, while navigation does not cancel.
    page.get_by_label('A, row 1',exact=True).fill('-')
    page.get_by_label('Current sheet',exact=True).select_option('r1')
    expect(page.get_by_text('A, row 1: “-” is not a valid number. Enter a finite number, or leave the cell empty for missing data.',exact=True)).to_be_visible()
    assert result('r1')['status']=='stale' and result('r1')['result'] is None
    page.get_by_label('Current sheet',exact=True).select_option('d1')
    page.get_by_label('A, row 1',exact=True).fill('7')
    page.get_by_label('Current sheet',exact=True).select_option('r2')
    current(['r1','r2'])
    assert book()['activeSheetId']=='r2'
    assert result('r1')['result']['summary'][0]['mean']==4
    assert result('r2')['result']['summary'][0]['mean']==5
    assert result('r3')==untouched
    # Undo/redo are source edits only; completing a derived calculation cannot clear redo.
    page.get_by_role('button', name='Undo',exact=True).click()
    assert result('r1')['status']=='stale' # restores the incomplete '-' draft
    page.get_by_role('button', name='Redo',exact=True).click()
    current(['r1','r2'])
    page.get_by_role('button', name='Undo',exact=True).click()
    page.get_by_role('button', name='Undo',exact=True).click()
    current(['r1','r2'])
    assert result('r1')['result']['summary'][0]['mean']==2
    expect(page.get_by_role('button',name='Undo',exact=True)).to_be_disabled()
    expect(page.get_by_role('button',name='Redo',exact=True)).to_be_enabled()
    # Persisted values survive refresh; a saved stale result is recalculated on open.
    saved=book()
    saved['sheets'][0]['project']['columns'][0]['values'][0]='13'
    saved['sheets'][0]['revision']+=1
    for sh in saved['sheets']:
        if sh['kind']=='results' and sh['dataId']=='d1':sh.update(status='stale',result=None)
    page.evaluate('(b)=>localStorage.setItem("gp.workbook.v2",JSON.stringify(b))',saved)
    page.reload()
    current(['r1','r2'])
    assert result('r1')['result']['summary'][0]['mean']==6
    assert result('r3')==untouched
    # Zero controls remain in the numerical input while log rendering stays finite.
    dose = copy.deepcopy(source)
    dose.update(id='dose', name='Dose', revision=1)
    xs = [0, .01, .1, 1, 10, 100]
    dose['project'].update(name='Dose', table_type='xy', analysis='dose_response', columns=[
        {'name':'Dose','values':[str(x) for x in xs]},
        {'name':'Response','values':[str(10+90*x/(5+x)) for x in xs]},
    ])
    dose['project']['graph']['type']='scatter'
    fit = stale('fit','dose',[1])
    fit['analysis']='dose_response'
    graph = {'kind':'graph','id':'dose-graph','name':'Dose graph','dataId':'dose','graph':dose['project']['graph'],'columnIndices':[1],'resultId':'fit'}
    dose_book = {'version':2,'name':'Zero control','activeSheetId':'dose-graph','sheets':[dose,fit,graph]}
    page.locator('input[type=file][accept=".json"]').set_input_files({
        'name':'zero-control.json', 'mimeType':'application/json',
        'buffer':json.dumps(dose_book).encode(),
    })
    current(['fit'])
    fit_result=result('fit')['result']
    assert next(s for s in fit_result['summary'] if s['name']=='Response')['n']==6
    assert next(r['value'] for r in fit_result['results'] if r['label']=='Response: Complete pairs')==6
    assert abs(fit_result['fit'][0]['parameters']['ec50']-5)<1e-4
    assert fit_result['fit'][0]['points'][0]['x']==0
    expect(page.get_by_text('Zero-dose controls are included in the fit. They cannot be displayed on the logarithmic X axis.',exact=True)).to_be_visible()
    expect(page.locator('svg.plot circle')).to_have_count(5)
    assert 'NaN' not in page.locator('svg.plot').inner_html()
    assert 'Infinity' not in page.locator('svg.plot').inner_html()
    assert not errors, errors
    browser.close()
    print('PASS: automatic multiple-analysis recalculation; independent tables; invalid drafts; navigation; undo/redo; reopen; actual means; zero-dose fit and finite log graph; no page errors')
