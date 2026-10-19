"""Check that rejected extended Prism tables preserve both diagnostics and the workbook."""
import os
import sys
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8001'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'), args=['--no-sandbox'])
    page = browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.wait_for_function('localStorage.getItem("gp.workbook.v2") !== null')
    before=page.evaluate('localStorage.getItem("gp.workbook.v2")')
    page.locator('input[type=file][accept*=pzfx]').set_input_files({
        'name':'nested.pzfx','mimeType':'application/xml',
        'buffer':b'<GraphPadPrismFile><Table ID="Table0" TableType="OneWay" ExtTableType="Nested"><Title>Nested biological units</Title><YColumn><Title>A</Title><Subcolumn><d>1</d><d>2</d></Subcolumn></YColumn></Table></GraphPadPrismFile>',
    })
    expect(page.get_by_role('alert')).to_contain_text('unsupported extended table type Nested', timeout=120000)
    assert page.evaluate('localStorage.getItem("gp.workbook.v2")')==before
    assert not errors,errors
    browser.close()
    print('PASS: unsupported native-table reason visible; workbook unchanged; no page errors')
