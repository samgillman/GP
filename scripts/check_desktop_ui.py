"""Browser regression checks for the desktop shell; requires Playwright + Chromium.
Run against a built, served static app: python scripts/check_desktop_ui.py [base URL].
Set GP_CHROMIUM to use an installed executable instead of Playwright's Chromium.
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8001'
shots = Path(os.environ.get('GP_SCREENSHOTS', '/tmp/gp-desktop-ui'))
shots.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    def workbook():
        return page.evaluate('JSON.parse(localStorage.getItem("gp.workbook.v2"))')
    page.screenshot(path=str(shots / 'data.png'))
    # Empty visible cells create real editable data, with one undo restoring the table.
    original = workbook()
    page.locator('.data-grid-viewport').evaluate('(el) => { el.scrollTop = 24 * 25; el.scrollLeft = 7 * 112; el.dispatchEvent(new Event("scroll")); }')
    page.get_by_label('Series 8, row 30', exact=True).fill('123')
    changed = workbook()
    source = next(s for s in changed['sheets'] if s['kind'] == 'data')
    assert source['project']['columns'][7]['values'][29] == '123'
    page.get_by_role('button', name='Undo', exact=True).click()
    assert workbook()['sheets'] == original['sheets']
    # Menu commands open real dialogs; outside clicks dismiss menus.
    menu = page.locator('.desktop-menu').filter(has=page.locator('summary', has_text='File')).first
    menu.locator('summary').click()
    page.get_by_label('Sheet name', exact=True).click()
    assert menu.get_attribute('open') is None
    new = page.get_by_role('button', name='New Data Table and Graph', exact=True)
    new.click()
    d = page.get_by_role('dialog', name='New Data Table and Graph', exact=True)
    page.screenshot(path=str(shots / 'new-table.png'))
    # Focus cannot escape the modal; Escape restores its launch control.
    d.get_by_role('button', name='Create table and graph', exact=True).focus()
    page.keyboard.press('Tab')
    expect(d.get_by_role('button', name='Close New Data Table and Graph', exact=True)).to_be_focused()
    page.keyboard.press('Shift+Tab')
    expect(d.get_by_role('button', name='Create table and graph', exact=True)).to_be_focused()
    page.keyboard.press('Escape')
    expect(d).not_to_be_visible()
    expect(new).to_be_focused()
    page.get_by_role('button', name='Analyze Data…', exact=True).click()
    page.screenshot(path=str(shots / 'analyze.png'))
    page.keyboard.press('Escape')
    page.get_by_role('button', name='Show graph', exact=True).click()
    expect(page.locator('.data-card')).not_to_be_visible()
    expect(page.locator('svg.plot')).to_be_visible()
    page.screenshot(path=str(shots / 'graph.png'))
    page.get_by_role('button', name='Format Graph…', exact=True).first.click()
    page.screenshot(path=str(shots / 'format-graph.png'))
    page.keyboard.press('Escape')
    # Graph type changes through Change Graph Type, not on-page buttons.
    page.get_by_role('button', name='Change Graph Type…', exact=True).click()
    page.get_by_role('dialog', name='Change Graph Type').get_by_role('radio', name='Scatter dot plot').check()
    page.get_by_role('dialog', name='Change Graph Type').get_by_role('button', name='OK', exact=True).click()
    assert next(s for s in workbook()['sheets'] if s['kind'] == 'graph')['graph']['type'] == 'scatter'
    page.get_by_role('button', name='Analyze Data…', exact=True).click()
    page.get_by_role('dialog', name='Analyze Data').get_by_role('button', name='Create analysis', exact=True).click()
    expect(page.get_by_role('heading', name='Summary statistics', exact=True)).to_be_visible(timeout=120000)
    page.screenshot(path=str(shots / 'results.png'))
    assert page.locator('.analysis-output tbody tr').count() > 0
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    new.click()
    bounds = d.bounding_box()
    assert bounds and bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= 390
    assert bounds['y'] >= 0 and bounds['y'] + bounds['height'] <= 844
    page.screenshot(path=str(shots / 'mobile-dialog.png'))
    page.keyboard.press('Escape')
    page.set_viewport_size({'width': 1440, 'height': 900})
    # Appearance follows the OS unless explicitly selected, persists separately,
    # and never changes the scientific workbook or its saved graph colors.
    snapshot = workbook()
    page.emulate_media(color_scheme='dark')
    expect(page.locator('.app')).to_have_attribute('data-theme', 'dark')
    page.locator('.desktop-menu > summary').get_by_text('View', exact=True).click()
    page.get_by_role('menuitemradio', name='Light appearance', exact=True).click()
    expect(page.locator('.app')).to_have_attribute('data-theme', 'light')
    assert workbook() == snapshot
    page.reload()
    expect(page.locator('.app')).to_have_attribute('data-theme', 'light')
    page.locator('.desktop-menu > summary').get_by_text('View', exact=True).click()
    page.get_by_role('menuitemradio', name='Dark appearance', exact=True).click()
    page.emulate_media(color_scheme='light')
    expect(page.locator('.app')).to_have_attribute('data-theme', 'dark')
    assert workbook() == snapshot
    page.get_by_role('button', name='Show data table', exact=True).click()
    page.screenshot(path=str(shots / 'dark-data.png'))
    assert page.locator('.data-grid-cell:not(.is-selected)').first.evaluate('(cell) => getComputedStyle(cell).backgroundColor') == 'rgb(255, 255, 255)'
    page.get_by_role('button', name='Analyze Data…', exact=True).click()
    page.screenshot(path=str(shots / 'dark-analyze.png'))
    expect(page.get_by_role('dialog', name='Analyze Data', exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    page.locator('.desktop-menu > summary').get_by_text('View', exact=True).click()
    page.get_by_role('menuitemradio', name='Use system appearance', exact=True).click()
    expect(page.locator('.app')).to_have_attribute('data-theme', 'light')
    assert not errors, errors
    (shots / 'checks.json').write_text(json.dumps({'passed': ['empty-cell editing and undo', 'menu dismissal', 'modal focus trap and restoration', 'graph sheet visibility', 'analysis result display', 'mobile viewport containment', 'system appearance changes', 'explicit appearance persists and overrides OS', 'theme leaves workbook unchanged', 'dark chrome keeps data cells white'], 'page_errors': errors}, indent=2))
    browser.close()
    print('PASS: desktop shell, editable grid expansion, menus, modal focus, graph/results views, and mobile dialog bounds')
