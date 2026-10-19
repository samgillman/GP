"""Isolated Chromium regressions for import capacity, recovery and graph interaction."""
import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8003'
report={'base':base,'capacity':[],'checks':[],'scope':'integration_only' if os.environ.get('GP_SKIP_CAPACITY')=='1' else 'full'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page.set_default_timeout(45000)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    print('Opened application',flush=True)
    report['build_scripts']=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(node=>node.src)')
    page.wait_for_function('localStorage.getItem("gp.workbook.v2") !== null')
    def book(): return page.evaluate('JSON.parse(localStorage.getItem("gp.workbook.v2"))')
    def source():
        b=book(); return next(s for s in b['sheets'] if s['id']==b['activeSheetId'])
    def upload(text,name):
        print(f'Uploading {name}: {len(text):,} bytes',flush=True)
        page.locator('input[type=file]:not([accept=".json"])').set_input_files({'name':name,'mimeType':'text/csv','buffer':text.encode()})
    original=book()
    for n in ([] if os.environ.get('GP_SKIP_CAPACITY')=='1' else [20,30]):
        # Separate workbook contexts keep the test below autosave quota until the explicit quota test.
        if n==30:
            page.evaluate('(b)=>localStorage.setItem("gp.workbook.v2",JSON.stringify(b))',original)
            page.reload()
        csv=','.join(f'G{i}' for i in range(n))+'\n'+'\n'.join(','.join(str((r+i)%100) for i in range(n)) for r in range(10000))
        start=time.monotonic(); upload(csv,f'large{n}.csv')
        page.wait_for_function('(n)=>JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.some(s=>s.name===`large${n}`)',arg=n)
        # Read only bounded metadata across CDP; repeatedly transferring every
        # cell measures the harness's JSON bridge rather than app responsiveness.
        metadata=page.evaluate('()=>{const b=JSON.parse(localStorage.getItem("gp.workbook.v2"));const p=b.sheets.find(s=>s.id===b.activeSheetId).project;return {analysis:p.analysis,title:p.graph.title,y:p.graph.y_label,columns:p.columns.length}}')
        assert metadata=={'analysis':'descriptive','title':f'large{n}','y':'Value','columns':n}
        print(f'Confirmed {n*10000:,} imported values; opening graph',flush=True)
        assert 0<page.locator('.data-grid-cell input').count()<2400
        assert page.locator('svg.plot').count()==0, 'inactive graph must not render during data edits'
        page.get_by_role('button',name='Show graph',exact=True).click()
        expect(page.locator('svg.plot')).to_be_visible()
        expect(page.locator('canvas').first).to_have_attribute('aria-label',f'{n*10000:,} observations rendered in full. Overlapping observations may cover one another.')
        assert page.locator('svg.plot circle').count()<100
        elapsed=time.monotonic()-start
        report['capacity'].append({'observations':n*10000,'import_and_draw_seconds':round(elapsed,2)})
        print(f'{n*10000} values imported and drawn in {elapsed:.2f}s; no JS errors',flush=True)
        graph_state='()=>{const b=JSON.parse(localStorage.getItem("gp.workbook.v2"));return b.sheets.find(s=>s.id===b.activeSheetId).graph}'
        original_graph=page.evaluate(graph_state)
        page.get_by_role('button',name='Zoom in graph',exact=True).click()
        expect(page.get_by_label('Graph zoom',exact=True)).to_have_value('125')
        print('Zoom button confirmed; checking keyboard zoom',flush=True)
        page.get_by_label('Graph viewport',exact=True).focus()
        page.keyboard.press('Control+=')
        expect(page.get_by_label('Graph zoom',exact=True)).to_have_value('150')
        page.keyboard.press('Control+0')
        expect(page.get_by_label('Graph zoom',exact=True)).to_have_value('100')
        print('Keyboard zoom confirmed',flush=True)
        assert page.evaluate(graph_state)==original_graph
        assert not errors,errors
    # Exercise analysis identity and source-cell mapping on an isolated small table.
    page.evaluate('(b)=>localStorage.setItem("gp.workbook.v2",JSON.stringify(b))',original)
    page.reload()
    upload('A,B\n1,4\n2,6\n3,5','links.csv')
    page.wait_for_function('JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.some(s=>s.name==="links")')
    source_id=source()['id']
    page.get_by_role('button',name='Run analysis',exact=True).click()
    page.wait_for_function('(id)=>{const b=JSON.parse(localStorage.getItem("gp.workbook.v2"));return b.sheets.some(s=>s.kind==="results"&&s.dataId===id&&s.id===b.activeSheetId)}',arg=source_id, timeout=120000)
    first_result=source()
    page.get_by_label('Current sheet',exact=True).select_option(source_id)
    page.get_by_role('button',name='Run analysis',exact=True).click()
    page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("gp.workbook.v2")).activeSheetId===id',arg=first_result['id'])
    assert len([s for s in book()['sheets'] if s['kind']=='results' and s['dataId']==source_id])==1
    page.get_by_role('button',name='Analyze Data…',exact=True).click()
    page.get_by_role('dialog',name='Analyze Data',exact=True).get_by_role('button',name='Create analysis',exact=True).click()
    page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.filter(s=>s.kind==="results"&&s.dataId===id).length===2',arg=source_id, timeout=120000)
    second_result=source()
    assert second_result['id']!=first_result['id']
    page.get_by_label('ANALYSIS',exact=True).select_option('welch_t')
    page.wait_for_function('(id)=>{const b=JSON.parse(localStorage.getItem("gp.workbook.v2"));return b.sheets.some(s=>s.id===id&&s.analysis==="welch_t"&&s.status==="current")}',arg=second_result['id'])
    assert next(s for s in book()['sheets'] if s['id']==first_result['id'])==first_result
    assert next(s for s in book()['sheets'] if s['id']==source_id)['project']['analysis']=='descriptive'
    print('Analysis rerun reuses identity; explicit Create analysis is independent',flush=True)
    report['checks'].append('analysis rerun identity, explicit creation, and settings isolation')
    mapped=book()
    subset=next(s for s in mapped['sheets'] if s['kind']=='graph' and s['dataId']==source_id)
    subset['columnIndices']=[1]
    # v3 persists authoritative dataset identities alongside compatibility
    # indices. A mismatched pair deliberately fails workbook validation.
    subset_source=next(s for s in mapped['sheets'] if s['id']==source_id)
    subset['datasetIds']=[subset_source['project']['columns'][1]['id']]
    mapped['activeSheetId']=subset['id']
    page.evaluate('(b)=>localStorage.setItem("gp.workbook.v2",JSON.stringify(b))',mapped)
    page.reload()
    point=page.locator('svg.plot circle').filter(has=page.locator('title',has_text='B, row 2: 6'))
    point.click()
    details=page.get_by_role('group',name='Point details',exact=True)
    expect(details).to_contain_text('B · Row 2')
    details.get_by_role('button',name='Go to cell',exact=True).click()
    expect(page.get_by_label('B, row 2',exact=True)).to_be_focused()
    expect(page.get_by_label('B, row 2',exact=True)).to_have_value('6')
    assert source()['id']==source_id
    print('Graph subset point maps back to the correct original source column/row',flush=True)
    report['checks'].append('subset-series to original source-cell navigation')
    # Small hostile names remain literal; cells reject unbounded numeric input without traceback footer.
    upload('"<img src=x onerror=window.hostile=true>";B\n2;2\n2;2\n2;2','hostile.csv')
    page.wait_for_function('JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.some(s=>s.name==="hostile")')
    assert len(source()['project']['columns'])==2
    assert page.evaluate('window.hostile') is None
    page.get_by_label('ANALYSIS',exact=True).select_option('welch_t')
    grid_top=page.locator('.data-grid-viewport').bounding_box()['y']
    page.get_by_role('button',name='Run analysis',exact=True).click()
    expect(page.locator('.workbook-notifications .error')).to_be_visible(timeout=120000)
    error=page.locator('.workbook-notifications .error').inner_text()
    assert 'gp.statistics' not in error and 'errors.pydantic' not in error,error
    assert page.locator('.data-grid-viewport').bounding_box()['y']==grid_top
    page.get_by_label('<img src=x onerror=window.hostile=true>, row 1',exact=True).fill('1e200')
    page.get_by_role('button',name='Run analysis',exact=True).click()
    expect(page.locator('.workbook-notifications .error')).to_contain_text('1e100')
    assert 'errors.pydantic' not in page.locator('.workbook-notifications .error').inner_text()
    print('Plaintext names and stable constant/overflow error notifications confirmed',flush=True)
    # Quota error leaves the last successful autosave untouched and offers current-memory download.
    saved=book()
    page.evaluate('()=>{Storage.prototype.setItem = function(){throw new DOMException("Quota","QuotaExceededError")};}')
    page.get_by_label('B, row 1',exact=True).fill('17')
    expect(page.locator('.storage-warning')).to_be_visible()
    assert book()==saved
    with page.expect_download() as pending:
        page.locator('.storage-warning').get_by_role('button',name='Download workbook',exact=True).click()
    recovered=json.loads(Path(pending.value.path()).read_text())
    data=next(s for s in recovered['sheets'] if s['name']=='hostile' and s['kind']=='data')
    assert data['project']['columns'][1]['values'][0]=='17'
    print('Quota failure preserved prior save and downloaded current edits',flush=True)
    # Force a render fault to test the real React boundary, without a production test hook.
    page.evaluate('()=>{window.originalMin=Math.min; Math.min=()=>{throw Error("Controlled render failure")};}')
    page.get_by_label('Sheet name',exact=True).fill('recovery check')
    expect(page.get_by_role('heading',name='The workbook could not be displayed')).to_be_visible()
    page.evaluate('()=>{Math.min=window.originalMin;}')
    with page.expect_download() as pending:
        page.get_by_role('button',name='Download workbook',exact=True).click()
    recovered=json.loads(Path(pending.value.path()).read_text())
    assert any(s['name']=='recovery check' for s in recovered['sheets'])
    page.get_by_role('button',name='Retry display',exact=True).click()
    expect(page.get_by_label('Sheet name',exact=True)).to_have_value('recovery check')
    expect(page.get_by_label('B, row 1',exact=True)).to_have_value('17')
    assert book()==saved
    assert all('Controlled render failure' in error for error in errors),errors
    if report['capacity']:
        report['checks'].append('graph zoom leaves saved settings unchanged')
    report['checks'] += ['hostile names remain plaintext','constant/overflow errors preserve layout','quota recovery preserves prior save','render boundary downloads latest edits and retries without clearing storage']
    report['unexpected_page_errors']=[error for error in errors if 'Controlled render failure' not in error]
    evidence=Path(os.environ.get('GP_BROWSER_EVIDENCE','/tmp/gp-large-workbook-evidence.json'))
    evidence.write_text(json.dumps(report,indent=2))
    print(f'Evidence: {evidence}',flush=True)
    print(f"PASS ({report['scope']}): "+'; '.join(report['checks']),flush=True)
    browser.close()
