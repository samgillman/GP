"""Chromium acceptance: real XY Format Graph missing-Y controls and path behavior."""
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
    page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
    new = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
    new.get_by_role("button", name="XY", exact=True).click()
    new.get_by_role("radio", name="Start with sample data", exact=True).check()
    new.get_by_role("button", name="Create table and graph", exact=True).click()
    # The source Y row stays blank in the table; no analysis settings change.
    ycell = page.locator('input[data-row="2"][data-column="1"]')
    ycell.fill("")
    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))
    before = book()
    graph_id = next(s["id"] for s in before["sheets"] if s["kind"] == "graph" and s["dataId"] == before["activeSheetId"])
    source_before = next(s for s in before["sheets"] if s["kind"] == "data" and s["id"] == before["activeSheetId"])
    page.get_by_role("button", name="Show graph", exact=True).click()
    # Like Prism, a new graph asks for its type when first viewed; keep it.
    page.get_by_role("dialog", name="Change Graph Type", exact=True).get_by_role("button", name="OK", exact=True).click()
    def graph():
        return next(s for s in book()["sheets"] if s["id"] == graph_id)
    # No fit is included in the sample; the first XY series owns the first line path.
    line = page.locator('svg.plot g[clip-path] path[fill="none"]').first
    expect(line).to_be_visible()
    default_path = line.get_attribute("d")
    assert default_path and default_path.count("M") >= 4

    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    dialog.get_by_role("tab", name="Graph Settings", exact=True).click()
    dialog.get_by_role("radio", name="Leave a gap", exact=True).check()
    dialog.get_by_role("button", name="OK", exact=True).click()
    assert graph()["graph"]["gap_at_missing_y"] is True
    path_with_gap = line.get_attribute("d")
    assert path_with_gap and path_with_gap != default_path
    assert path_with_gap.count("M") == default_path.count("M") - 1
    assert next(s for s in book()["sheets"] if s["id"] == source_before["id"]) == source_before

    page.reload()
    expect(line).to_be_visible()
    assert graph()["graph"]["gap_at_missing_y"] is True
    assert line.get_attribute("d") == path_with_gap

    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Graph Settings", exact=True).click()
    dialog.get_by_role("radio", name="Connect adjacent points", exact=True).check()
    dialog.get_by_role("button", name="OK", exact=True).click()
    assert graph()["graph"]["gap_at_missing_y"] is False
    assert line.get_attribute("d") == default_path
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph()["graph"]["gap_at_missing_y"] is True
    assert line.get_attribute("d") == path_with_gap
    assert errors == [], errors
    browser.close()
    print("PASS: XY missing-Y controls, graph path breaks, reload, undo and unchanged source data")
