"""Verify native-informed Column left-to-right dataset list, color ownership and history."""
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
    page.get_by_role("button", name="Show graph", exact=True).click()
    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))
    original_book = book()
    original_graph = next(s for s in original_book["sheets"] if s["kind"] == "graph")
    source = next(s for s in original_book["sheets"] if s["kind"] == "data")
    def graph():
        return next(s for s in book()["sheets"] if s["id"] == original_graph["id"])
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    ordered = dialog.get_by_role("listbox", name="Data sets plotted", exact=True)
    def indices():
        return ordered.get_by_role("option").evaluate_all(
            "nodes => nodes.map(n => Number(n.dataset.sourceIndex))")
    assert indices() == original_graph["columnIndices"], "Column list must be left-to-right"
    expect(dialog.get_by_text("left to right", exact=False)).to_be_visible()
    dialog.get_by_role("button", name="Reverse", exact=True).click()
    assert indices() == original_graph["columnIndices"][::-1]
    dialog.get_by_role("button", name="OK", exact=True).click()
    assert graph()["columnIndices"] == original_graph["columnIndices"][::-1]
    assert graph()["graph"]["colors"] == original_graph["graph"]["colors"][:len(original_graph["columnIndices"])][::-1]
    assert next(s for s in book()["sheets"] if s["id"] == source["id"]) == source
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph() == original_graph
    page.get_by_role("button", name="Redo", exact=True).click()
    assert graph()["columnIndices"] == original_graph["columnIndices"][::-1]
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    leftmost = indices()[0]
    ordered.get_by_role("option").first.click()
    dialog.get_by_role("button", name="Bottom", exact=True).click()
    assert indices()[-1] == leftmost
    dialog.get_by_role("button", name="Top", exact=True).click()
    assert indices()[0] == leftmost
    dialog.get_by_role("button", name="Remove", exact=True).click()
    assert leftmost not in indices()
    dialog.get_by_role("button", name="Add…", exact=True).click()
    dialog.get_by_label("Available data sets", exact=True).select_option(str(leftmost))
    dialog.get_by_role("button", name="Add data set", exact=True).click()
    assert indices()[-1] == leftmost, "Column add appends on the right"
    dialog.get_by_role("button", name="OK", exact=True).click()
    assert graph()["datasetColors"][source["project"]["columns"][leftmost]["id"]]
    restored = book()
    page.reload()
    page.locator("svg.plot").wait_for()
    assert book() == restored
    assert next(s for s in restored["sheets"] if s["id"] == source["id"]) == source
    assert errors == [], errors
    browser.close()
    print("PASS: Column left-to-right order, Add/Remove/Top/Bottom, dataset colors, undo/redo, reload and source preservation")
