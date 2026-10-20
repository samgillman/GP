"""Exercise XY dataset ordering without changing the source table."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.set_default_timeout(120000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(sys.argv[1])
    page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
    new = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
    new.get_by_role("button", name="XY", exact=True).click()
    new.get_by_role("radio", name="Start with sample data", exact=True).check()
    new.get_by_role("button", name="Create table and graph", exact=True).click()
    page.get_by_role("button", name="Show graph", exact=True).click()
    page.locator("svg.plot").wait_for()

    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    before = book()
    graph_id = before["activeSheetId"]

    def graph(workbook):
        return next(s for s in workbook["sheets"] if s["id"] == graph_id)

    original = graph(before)
    source_id = original["dataId"]
    source_before = next(s for s in before["sheets"] if s["id"] == source_id)
    assert len(original["columnIndices"]) >= 2
    def rendered_series():
        return page.locator("svg.plot circle:has(title)").evaluate_all("""nodes => {
          const series = [];
          for (const n of nodes) {
            const name = n.querySelector('title').textContent.split(', row ')[0];
            if (!series.length || series[series.length-1].name !== name)
              series.push({name, color: n.getAttribute('fill')});
          }
          return series;
        }""")
    drawn_before = rendered_series()
    assert len(drawn_before) >= 2
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    ordered = dialog.get_by_role("listbox", name="Data sets plotted", exact=True)

    def display_indices():
        return ordered.get_by_role("option").evaluate_all(
            "nodes => nodes.map(n => Number(n.dataset.sourceIndex))")

    assert display_indices() == original["columnIndices"][::-1]
    dialog.get_by_role("button", name="Reverse", exact=True).click()
    assert display_indices() == original["columnIndices"]
    dialog.get_by_role("button", name="Apply", exact=True).click()
    expect(dialog).to_be_visible()
    assert graph(book())["columnIndices"] == original["columnIndices"][::-1]
    assert rendered_series() == drawn_before[::-1], "SVG order or dataset color ownership changed incorrectly"
    applied = book()
    # Cancel after Apply keeps the applied state but discards subsequent edits.
    dialog.get_by_role("button", name="Reverse", exact=True).click()
    dialog.get_by_role("button", name="Cancel", exact=True).click()
    assert book() == applied
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph(book()) == original
    page.get_by_role("button", name="Redo", exact=True).click()
    assert book() == applied
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    first = display_indices()[0]
    ordered.get_by_role("option").first.click()
    dialog.get_by_role("button", name="Bottom", exact=True).click()
    assert display_indices()[-1] == first
    dialog.get_by_role("button", name="Top", exact=True).click()
    assert display_indices()[0] == first
    dialog.get_by_role("button", name="Remove", exact=True).click()
    assert first not in display_indices()
    dialog.get_by_role("button", name="Add…", exact=True).click()
    dialog.get_by_label("Available data sets", exact=True).select_option(str(first))
    dialog.get_by_role("button", name="Add data set", exact=True).click()
    assert first in display_indices()
    dialog.get_by_role("button", name="Apply", exact=True).click()
    assert {s["name"]: s["color"] for s in rendered_series()} == {
        s["name"]: s["color"] for s in drawn_before
    }, "Remove/re-add lost dataset colors"
    applied = book()
    while ordered.get_by_role("option").count():
        ordered.get_by_role("option").first.click()
        dialog.get_by_role("button", name="Remove", exact=True).click()
    expect(dialog.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    expect(dialog.get_by_role("button", name="Apply", exact=True)).to_be_disabled()
    dialog.get_by_role("button", name="Cancel", exact=True).click()
    assert book() == applied
    assert next(s for s in book()["sheets"] if s["id"] == source_id) == source_before
    page.reload()
    page.locator("svg.plot").wait_for()
    assert book() == applied
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    folder = os.environ.get("GP_DATASET_ORDER_EVIDENCE")
    if folder:
        Path(folder).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(Path(folder) / "dataset-order.png"))
    page.set_viewport_size({"width": 390, "height": 844})
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")
    ordered.get_by_role("option").first.click()
    page.keyboard.press("End")
    expect(ordered.get_by_role("option").last).to_have_attribute("aria-selected", "true")
    dialog.get_by_role("button", name="Cancel", exact=True).click()
    assert book() == applied
    assert errors == [], errors
    browser.close()
    print("PASS: XY order, Apply/Cancel, undo/redo, add/remove, empty guard, reload, keyboard and source preservation")
