"""Browser check for Prism-style behaviors and toolbar commands.

Welcome window, Change Graph Type on a new graph's first view (with live
preview), Sheet > Highlight, Clipboard Cut/Copy/Paste on the data table,
Change > Color Scheme and Change > Magic (make graphs consistent).
Run against a built, served app: python scripts/check_prism_behaviors.py [base URL].
"""
import json
import os
import sys
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    page = context.new_page()
    page.set_default_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base)

    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    def sheet(predicate):
        return next(s for s in book()["sheets"] if predicate(s))

    def menu(label):
        page.locator(".desktop-menu > summary").filter(has=page.locator(f'[aria-label="{label}"]')).first.click()

    # Welcome window: Prism's CREATE list and Open a File.
    page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
    welcome = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
    expect(welcome.get_by_role("heading", name="Create", exact=True)).to_be_visible()
    expect(welcome.get_by_role("button", name="Open a File…", exact=True)).to_be_visible()
    expect(welcome.get_by_text("Column tables have one grouping variable", exact=False)).to_be_visible()
    welcome.get_by_role("radio", name="Start with sample data", exact=True).check()
    welcome.get_by_role("button", name="Create table and graph", exact=True).click()
    new_data = book()["activeSheetId"]

    # Prism asks for the graph type the first time a new graph is viewed.
    page.get_by_role("button", name="Show graph", exact=True).click()
    chooser = page.get_by_role("dialog", name="Change Graph Type", exact=True)
    expect(chooser).to_be_visible()
    expect(chooser.locator(".graph-type-preview svg.plot")).to_be_visible()
    chooser.get_by_role("tab", name="Mean/median & error", exact=True).click()
    chooser.get_by_role("radio", name="Bars", exact=True).check()
    expect(chooser.locator(".graph-type-name")).to_have_text("Bars")
    chooser.get_by_role("button", name="OK", exact=True).click()
    graph = sheet(lambda s: s["kind"] == "graph" and s["dataId"] == new_data)
    assert graph["graph"]["type"] == "bar" and graph["graph"]["show_points"] is False, graph["graph"]
    # Viewing it again does not ask again.
    page.get_by_role("button", name="Show data table", exact=True).click()
    page.get_by_role("button", name="Show graph", exact=True).click()
    expect(chooser).to_have_count(0)

    # Sheet > Highlight colors the navigator row; undo removes it.
    menu("Highlight sheet")
    page.get_by_role("menuitemradio", name="Green", exact=True).click()
    assert sheet(lambda s: s["id"] == graph["id"]).get("highlight") == "green"
    page.get_by_role("button", name="Show data table", exact=True).click()
    row = page.locator(".sheet-navigator .sheet-link.hl-green")
    expect(row).to_have_count(1)
    page.mouse.move(1200, 600)
    page.wait_for_timeout(600)  # the navigator eases between row colors
    background = row.evaluate("el => getComputedStyle(el).backgroundColor")
    assert background == "rgb(211, 245, 196)", background
    page.get_by_role("button", name="Undo", exact=True).click()
    assert "highlight" not in sheet(lambda s: s["id"] == graph["id"])

    # Clipboard: copy a 2 × 2 block, paste it elsewhere, then cut a cell.
    data = sheet(lambda s: s["id"] == new_data)["project"]["columns"]
    cell = lambda column, row: page.locator(f'input[data-row="{row}"][data-column="{column}"]')
    cell(0, 0).click()
    cell(1, 1).click(modifiers=["Shift"])
    page.get_by_role("button", name="Copy", exact=True).click()
    copied = page.evaluate("navigator.clipboard.readText()")
    assert copied.splitlines() == [f'{data[0]["values"][0]}\t{data[1]["values"][0]}', f'{data[0]["values"][1]}\t{data[1]["values"][1]}'], copied
    cell(3, 0).click()
    page.get_by_role("button", name="Paste", exact=True).click()
    page.wait_for_function("""() => {
      const b = JSON.parse(localStorage.getItem('gp.workbook.v2'));
      const s = b.sheets.find(x => x.id === b.activeSheetId);
      return s.project.columns.length > 4 && s.project.columns[4].values[1] !== undefined && s.project.columns[4].values[1] !== '';
    }""")
    pasted = sheet(lambda s: s["id"] == new_data)["project"]["columns"]
    assert pasted[3]["values"][:2] == data[0]["values"][:2] and pasted[4]["values"][:2] == data[1]["values"][:2]
    cell(0, 2).click()
    page.get_by_role("button", name="Cut", exact=True).click()
    page.wait_for_function("""() => {
      const b = JSON.parse(localStorage.getItem('gp.workbook.v2'));
      return b.sheets.find(x => x.id === b.activeSheetId).project.columns[0].values[2] === '';
    }""")
    assert page.evaluate("navigator.clipboard.readText()").strip() == data[0]["values"][2]

    # Change > Color Scheme recolors every data set on the graph.
    page.get_by_role("button", name="Show graph", exact=True).click()
    menu("Color scheme")
    grays_item = page.get_by_role("menuitem", name="Grays", exact=False)
    # The menu must really be visible: nothing in the toolbar clips it.
    box = grays_item.bounding_box()
    hit = page.evaluate("([x, y]) => document.elementFromPoint(x, y)?.closest('[role=menuitem]')?.textContent", [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2])
    assert hit and "Grays" in hit, hit
    assert page.locator(".pw-ribbon").evaluate("el => el.scrollTop") == 0
    grays_item.click()
    grays = sheet(lambda s: s["id"] == graph["id"])["graph"]["colors"]
    assert grays[:3] == ["#000000", "#9a9a9a", "#5c5c5c"], grays

    # Change > Magic copies that graph's formatting onto a second graph.
    page.locator(".desktop-menu > summary").filter(has_text="Insert").first.click()
    page.get_by_role("menuitem", name="New graph of existing data", exact=True).click()
    expect(chooser).to_be_visible()
    chooser.get_by_role("button", name="Cancel", exact=True).click()
    second = book()["activeSheetId"]
    page.get_by_role("button", name="Magic: make graphs consistent", exact=True).click()
    magic = page.get_by_role("dialog", name="Make Graphs Consistent", exact=True)
    magic.get_by_label("Graph to copy formatting from", exact=True).select_option(graph["id"])
    magic.get_by_role("button", name="OK", exact=True).click()
    after = sheet(lambda s: s["id"] == second)["graph"]
    assert after["colors"][:3] == grays[:3] and after["type"] == "bar" and after["show_points"] is False, after
    page.get_by_role("button", name="Undo", exact=True).click()
    assert sheet(lambda s: s["id"] == second)["graph"]["colors"][:3] != grays[:3]

    assert not errors, errors
    print("PASS: Welcome window, first-view graph type with preview, highlight + undo, clipboard copy/paste/cut, color scheme, Magic + undo")
    browser.close()
