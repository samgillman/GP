"""Check recovered zoom choices without changing saved graph/export settings."""
import os
import sys
from playwright.sync_api import sync_playwright, expect
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8001'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.get_by_role('button',name='Show graph',exact=True).click()
    saved=page.evaluate('localStorage.getItem("gp.workbook.v2")')
    presets=page.get_by_label('Graph zoom preset',exact=True)
    for zoom in ['50','75','100','150','200','400','600','800','1000']:
        presets.select_option(zoom)
        expect(page.get_by_label('Graph zoom',exact=True)).to_have_value(zoom)
    # Zoom in/out live in the View menu; the bottom bar has the slider and presets.
    page.locator('.desktop-menu > summary').filter(has_text='View').first.click()
    expect(page.get_by_role('menuitem',name='Zoom in graph',exact=True)).to_be_disabled()
    page.keyboard.press('Escape')
    page.get_by_label('Graph viewport',exact=True).focus()
    page.keyboard.press('Control+0')
    expect(page.get_by_label('Graph zoom',exact=True)).to_have_value('100')
    page.keyboard.press('Control+=')
    expect(page.get_by_label('Graph zoom',exact=True)).to_have_value('125')
    assert page.evaluate('localStorage.getItem("gp.workbook.v2")')==saved
    assert not errors,errors
    print('PASS: recovered zoom presets50–1000%, bounded controls, reset/shortcut, unchanged workbook graph settings')
    browser.close()
