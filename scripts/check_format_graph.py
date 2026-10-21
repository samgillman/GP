"""Browser check for the graph-sheet window and Format Graph > Appearance.

Covers the window layout from the supplied design reference (menu bar, ribbon
groups, navigator sections, bottom bar), the docked non-modal Format Graph
dialog, Global versus single data set changes, drawing, undo/redo, reload,
legend, double-click scoping and SVG export of the styles.
Run against a built, served app: python scripts/check_format_graph.py [base URL].
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
evidence = os.environ.get("GP_FORMAT_GRAPH_EVIDENCE")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page.set_default_timeout(60000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base)

    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    def graph_sheet():
        return next(s for s in book()["sheets"] if s["kind"] == "graph")

    def shot(name):
        if evidence:
            Path(evidence).mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(Path(evidence) / f"{name}.png"))

    # Window layout from the design reference.
    menus = page.locator(".pw-menubar > .desktop-menu > summary").all_inner_texts()
    assert menus == ["GP", "File", "Edit", "View", "Insert", "Analyze", "Change", "Arrange", "Family", "Window", "Help"], menus
    # Prism for Mac shows Data and Import groups on data tables, Arrange and Draw on graphs.
    groups = page.locator(".pw-ribbon .rb-label").all_inner_texts()
    assert groups == ["File", "Sheet", "Undo", "Clipboard", "Analysis", "Change", "Data", "Import",
                      "Write", "Text", "Export", "Send", "Help"], groups
    sections = page.locator(".sheet-navigator .navigator-section > h2 > button").all_inner_texts()
    assert sections == ["Data Tables", "Info", "Results", "Graphs", "Layouts"], sections
    # Commands GP does not implement stay visible but disabled, and say so.
    transform = page.get_by_role("button", name="Transform", exact=True)
    expect(transform).to_be_disabled()
    assert "not available in GP yet" in transform.get_attribute("title")

    page.get_by_role("button", name="Show graph", exact=True).click()
    plot = page.locator("svg.plot")
    plot.wait_for()
    expect(page.get_by_role("button", name="Show data table", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="Show results", exact=True)).to_be_visible()
    expect(page.get_by_role("toolbar", name="Graph view", exact=True)).to_be_visible()
    groups = page.locator(".pw-ribbon .rb-label").all_inner_texts()
    assert groups == ["File", "Sheet", "Undo", "Clipboard", "Analysis", "Change", "Arrange", "Draw",
                      "Write", "Text", "Export", "Send", "Help"], groups
    # The graph sits on a white letter-size page inside the sheet area.
    page_box = page.locator(".graph-page").bounding_box()
    assert abs(page_box["width"] / page_box["height"] - 612 / 792) < 0.02, page_box
    expect(plot.locator(".graph-title")).to_have_text(graph_sheet()["graph"]["title"])
    data_sheet = next(s for s in book()["sheets"] if s["kind"] == "data")
    table = data_sheet["name"]
    names = [c["name"] for c in data_sheet["project"]["columns"]]
    ids = [c["id"] for c in next(s for s in book()["sheets"] if s["kind"] == "data")["project"]["columns"]]
    original = graph_sheet()

    # Format Graph drops from the top of the sheet area like a macOS sheet,
    # without dimming the window.
    page.get_by_role("button", name="Format Graph…", exact=True).click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    expect(dialog).to_have_attribute("aria-modal", "false")
    expect(page.locator(".desktop-dialog-backdrop")).to_have_count(0)
    canvas_box, dialog_box = page.locator(".graph-canvas").bounding_box(), dialog.bounding_box()
    assert abs(dialog_box["y"] - canvas_box["y"]) < 2, "dialog is attached to the top of the sheet area"
    assert abs((dialog_box["x"] + dialog_box["width"] / 2) - (canvas_box["x"] + canvas_box["width"] / 2)) < 2
    tabs = dialog.get_by_role("tab").all_inner_texts()
    assert tabs == ["Appearance", "Data Sets on Graph", "Graph Settings", "Annotations"], tabs
    dataset = dialog.get_by_label("Appearance data set", exact=True)
    expect(dataset.locator("option:checked")).to_have_text(f"{table}:A:{names[0]}")
    scope = dialog.get_by_label("Apply scope", exact=True)
    expect(scope).to_have_value("global")
    shot("format-graph-open")

    # Global: one change reaches every data set.
    dialog.get_by_label("Shape:", exact=True).select_option("square")
    dialog.get_by_label("Size:", exact=True).select_option("4")
    dialog.get_by_role("button", name="Apply", exact=True).click()
    styles = graph_sheet()["graph"]["dataset_styles"]
    assert all(styles[i]["symbol_shape"] == "square" and styles[i]["symbol_size"] == 4 for i in ids), styles
    expect(plot.locator('path[data-symbol="square"]')).to_have_count(
        sum(len([v for v in c["values"] if v.strip()]) for c in next(s for s in book()["sheets"] if s["kind"] == "data")["project"]["columns"]))
    expect(plot.locator("circle:has(title)")).to_have_count(0)

    # Choosing a data set formats that data set only.
    dataset.select_option(index=1)
    expect(scope).to_have_value("dataset")
    dialog.get_by_label(f"{names[1]} fill color", exact=True).fill("#ff0000")
    dialog.get_by_text("Fill pattern", exact=True).click()
    dialog.get_by_label("Style:", exact=True).select_option("I")
    dialog.get_by_label("Dir.:", exact=True).select_option("both")
    dialog.get_by_label("Plot:", exact=True).select_option("sd")
    dialog.get_by_label("Show legend", exact=True).check()
    before_ok = book()
    dialog.get_by_role("button", name="OK", exact=True).click()
    expect(dialog).to_have_count(0)
    styles = graph_sheet()["graph"]["dataset_styles"]
    assert styles[ids[1]]["fill"] == "#ff0000" and styles[ids[1]]["pattern"] is True, styles
    assert styles[ids[1]]["error_cap"] == "I" and styles[ids[1]]["error_direction"] == "both"
    assert "fill" not in styles[ids[0]] and "fill" not in styles[ids[2]], "other data sets keep their fill"
    assert graph_sheet()["graph"]["error"] == "sd" and graph_sheet()["graph"]["show_legend"] is True
    second = plot.locator(f'g[data-dataset="{names[1]}"]')
    expect(second.locator("rect").first).to_have_attribute("fill", "#ff0000")
    expect(second.locator('rect[fill^="url(#"]')).to_have_count(1)
    expect(second.locator('[data-error-bar="both"]')).to_have_count(1)
    expect(plot.locator(f'g[data-dataset="{names[0]}"] [data-error-bar="above"]')).to_have_count(1)
    expect(plot.locator(".plot-legend .legend-label")).to_have_text(names)
    shot("format-graph-applied")

    # One undo restores the state before OK; redo reapplies it.
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph_sheet()["graph"] == next(s for s in before_ok["sheets"] if s["kind"] == "graph")["graph"]
    page.get_by_role("button", name="Redo", exact=True).click()
    assert graph_sheet()["graph"]["dataset_styles"][ids[1]]["fill"] == "#ff0000"

    # Styles survive a reload.
    page.reload()
    page.locator("svg.plot").wait_for()
    expect(page.locator(f'svg.plot g[data-dataset="{names[1]}"] rect').first).to_have_attribute("fill", "#ff0000")

    # Double-clicking a bar formats that data set.
    page.locator(f'svg.plot g[data-dataset="{names[2]}"] rect').first.dblclick()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    expect(dialog.get_by_label("Appearance data set", exact=True).locator("option:checked")).to_have_text(f"{table}:C:{names[2]}")
    expect(dialog.get_by_label("Apply scope", exact=True)).to_have_value("dataset")
    dialog.get_by_role("button", name="Cancel", exact=True).click()

    # The export draws the same styles.
    page.locator(".desktop-menu > summary").filter(has_text="File").first.click()
    page.get_by_role("menuitem", name="Export…", exact=True).click()
    page.get_by_role("dialog", name="Export", exact=True).get_by_label("File Format:", exact=True).select_option("svg")
    with page.expect_download(timeout=240000) as download:
        page.get_by_role("dialog", name="Export", exact=True).get_by_role("button", name="Export", exact=True).click()
    exported = Path(download.value.path()).read_text()
    assert "#ff0000" in exported and "rotate(-45" in exported, "export keeps fill and slanted labels"
    assert exported.count(names[1]) >= 2, "legend entry exported"

    # Mobile width: the dialog wraps instead of overflowing.
    page.get_by_role("button", name="Format Graph…", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    shot("format-graph-mobile")

    assert not errors, errors
    assert original["graph"]["colors"] == graph_sheet()["graph"]["colors"], "colors unchanged by style edits"
    print("PASS: Prism window layout, Format Graph sheet, Global and per-data-set styles, drawing, undo/redo, reload, legend, double-click scope, SVG export, mobile wrapping")
    browser.close()
