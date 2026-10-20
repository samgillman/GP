"""Real Column bar spacing control and geometry persistence in Chromium."""
import json
import os
import sys
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.set_default_timeout(120000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(sys.argv[1])
    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))
    source = next(s for s in book()["sheets"] if s["kind"] == "data")
    page.get_by_role("button", name="Show graph", exact=True).click()
    def graph():
        return next(s for s in book()["sheets"] if s["kind"] == "graph")
    bar = page.locator('svg.plot g[data-dataset] rect').first
    expect(bar).to_be_visible()
    original_width = float(bar.get_attribute("width"))
    original_graph = graph()
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    dialog.get_by_role("tab", name="Graph Settings", exact=True).click()
    dialog.get_by_label("Space between columns (%)", exact=True).fill("200")
    dialog.get_by_role("button", name="OK", exact=True).click()
    assert graph()["graph"]["column_space_percent"] == 200
    narrow = float(bar.get_attribute("width"))
    assert 0 < narrow < original_width, (original_width, narrow)
    assert next(s for s in book()["sheets"] if s["id"] == source["id"]) == source
    saved = book()

    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph() == original_graph
    assert abs(float(bar.get_attribute("width")) - original_width) < 0.00001
    page.get_by_role("button", name="Redo", exact=True).click()
    assert book() == saved
    assert abs(float(bar.get_attribute("width")) - narrow) < 0.00001
    page.reload()
    expect(bar).to_be_visible()
    assert book() == saved
    assert abs(float(bar.get_attribute("width")) - narrow) < 0.00001
    assert not errors, errors
    browser.close()
    print("PASS: Column bar spacing editor, actual rectangle geometry, undo/redo, reload and source preservation")
