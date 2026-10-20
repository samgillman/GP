"""Browser check for Prism-style editing and dialogs.

Navigator rename in place, graph title and axis titles edited on the page,
Analyze Data (category tree, Recently used, analyzing another table) and
File > Export (format, resolution, size, background, saved defaults).
Run against a built, served app: python scripts/check_prism_dialogs.py [base URL].
"""
import io
import json
import os
import sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page.set_default_timeout(60000)
    errors, network = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: network.append({"path": "/" + r.url.split("/", 3)[3], "body": r.post_data_json})
            if r.method == "POST" and "/api/" in r.url else None)
    # The static build sends the same validated payloads to its worker instead.
    page.add_init_script("""(() => {
      const post = Worker.prototype.postMessage;
      window.__gpRequests = [];
      Worker.prototype.postMessage = function (message, ...rest) {
        if (message && typeof message.path === "string")
          window.__gpRequests.push({ path: message.path, body: message.body });
        return post.call(this, message, ...rest);
      };
    })()""")
    page.goto(base)

    def book():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    def sheet(predicate):
        return next(s for s in book()["sheets"] if predicate(s))

    def sent(path):
        return [item["body"] for item in network + page.evaluate("window.__gpRequests || []") if item["path"] == path]

    def wait_book(condition, timeout=240000):
        page.wait_for_function(f"""() => {{
          const book = JSON.parse(localStorage.getItem('gp.workbook.v2'));
          return ({condition})(book);
        }}""", timeout=timeout)

    data = sheet(lambda s: s["kind"] == "data")
    graph = sheet(lambda s: s["kind"] == "graph")
    names = [c["name"] for c in data["project"]["columns"]]

    # Navigator: double-click a sheet to rename it in place. Escape cancels.
    row = page.locator(".sheet-navigator .navigator-section").first.locator(".sheet-link").first
    row.dblclick()
    field = page.get_by_label(f"Rename {data['name']}", exact=True)
    expect(field).to_be_focused()
    field.fill("Ignored name")
    field.press("Escape")
    expect(field).to_have_count(0)
    assert sheet(lambda s: s["id"] == data["id"])["name"] == data["name"]
    row.dblclick()
    field.fill("Dose study")
    field.press("Enter")
    expect(row).to_have_text("Dose study")
    renamed = sheet(lambda s: s["id"] == data["id"])
    assert renamed["name"] == "Dose study" and renamed["project"]["name"] == "Dose study", renamed["name"]
    page.get_by_role("button", name="Undo", exact=True).click()
    assert sheet(lambda s: s["id"] == data["id"])["name"] == data["name"]
    page.get_by_role("button", name="Redo", exact=True).click()
    assert sheet(lambda s: s["id"] == data["id"])["name"] == "Dose study"

    # Graph text: double-click the title or an axis title to edit it on the page.
    page.get_by_role("button", name="Show graph", exact=True).click()
    page.locator("svg.plot").wait_for()
    title = page.locator("svg.plot .graph-title")
    title.dblclick()
    editor = page.get_by_label("Graph title text", exact=True)
    expect(editor).to_be_focused()
    expect(editor).to_have_value(graph["graph"]["title"])
    expect(page.get_by_role("dialog", name="Format Graph", exact=True)).to_have_count(0)
    editor.fill("Cancelled title")
    editor.press("Escape")
    expect(editor).to_have_count(0)
    assert sheet(lambda s: s["id"] == graph["id"])["graph"]["title"] == graph["graph"]["title"]
    title.dblclick()
    editor.fill("Treatment effect")
    editor.press("Enter")
    expect(title).to_have_text("Treatment effect")
    # The Y axis title is kept when clicking away.
    page.locator("svg.plot .axis-label").nth(1).dblclick()
    y_editor = page.get_by_label("Y axis title text", exact=True)
    expect(y_editor).to_be_focused()
    y_editor.fill("Signal (AU)")
    page.mouse.click(1350, 820)
    expect(y_editor).to_have_count(0)
    edited = sheet(lambda s: s["id"] == graph["id"])["graph"]
    assert edited["title"] == "Treatment effect" and edited["y_label"] == "Signal (AU)", edited
    # Each edit is one undo step.
    page.get_by_role("button", name="Undo", exact=True).click()
    undone = sheet(lambda s: s["id"] == graph["id"])["graph"]
    assert undone["y_label"] == graph["graph"]["y_label"] and undone["title"] == "Treatment effect"
    page.get_by_role("button", name="Redo", exact=True).click()

    # Analyze Data: Prism's category tree with the analyses this table allows.
    page.get_by_role("button", name="Show data table", exact=True).click()
    page.get_by_role("button", name="Analyze Data…", exact=True).click()
    dialog = page.get_by_role("dialog", name="Analyze Data", exact=True)
    expect(dialog.get_by_label("Analysis source", exact=True)).to_have_value("builtin")
    expect(dialog.get_by_role("button", name="Recently used", exact=True)).to_have_count(0)
    dialog.get_by_role("button", name="XY analyses", exact=True).click()
    expect(dialog.get_by_role("radio", name="Linear regression", exact=True)).to_be_disabled()
    dialog.get_by_label("Search analyses", exact=True).fill("anova")
    expect(dialog.get_by_role("radio")).to_have_count(1)
    dialog.get_by_label("Search analyses", exact=True).fill("")
    dialog.get_by_role("radio", name="Descriptive statistics", exact=True).check()
    expect(dialog.get_by_text(f"A:{names[0]}", exact=True)).to_be_visible()
    expect(dialog.get_by_role("button", name="Select All", exact=True)).to_be_disabled()
    dialog.get_by_label(names[2], exact=True).uncheck()
    expect(dialog.get_by_role("button", name="Select All", exact=True)).to_be_enabled()
    dialog.get_by_role("button", name="OK", exact=True).click()
    wait_book(f"b => b.sheets.some(s => s.kind === 'results' && s.dataId === '{data['id']}' && s.analysis === 'descriptive' && s.status === 'current')")
    first = sheet(lambda s: s["kind"] == "results")
    assert first["columnIndices"] == [0, 1], first["columnIndices"]

    # A second table, analyzed from the first table's Analyze Data.
    page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
    new_table = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
    new_table.get_by_role("button", name="XY", exact=True).click()
    new_table.get_by_role("radio", name="Start with sample data", exact=True).check()
    new_table.get_by_role("button", name="Create table and graph", exact=True).click()
    xy = sheet(lambda s: s["kind"] == "data" and s["project"]["table_type"] == "xy")
    page.get_by_label("Current sheet", exact=True).select_option(data["id"])
    page.get_by_role("button", name="Analyze Data…", exact=True).click()
    dialog.get_by_role("button", name="Recently used", exact=True).click()
    expect(dialog.locator(".analysis-category").first.get_by_role("radio", name="Descriptive statistics", exact=True)).to_be_visible()
    dialog.get_by_label("Table to analyze", exact=True).select_option(xy["id"])
    expect(dialog.get_by_role("radio", name="t tests (and nonparametric tests)", exact=True)).to_be_disabled()
    dialog.get_by_role("radio", name="Linear regression", exact=True).check()
    xy_names = [xy["project"]["columns"][i]["name"] for i in range(1, len(xy["project"]["columns"]))]
    expect(dialog.get_by_label(xy_names[0], exact=True)).to_be_checked()
    dialog.get_by_role("button", name="OK", exact=True).click()
    wait_book(f"b => b.sheets.some(s => s.kind === 'results' && s.dataId === '{xy['id']}' && s.analysis === 'linear_regression' && s.status === 'current')")
    assert sheet(lambda s: s["id"] == first["id"]) == first, "the first table's results are unchanged"

    # File > Export on a data table saves CSV.
    page.get_by_label("Current sheet", exact=True).select_option(data["id"])
    with page.expect_download() as csv:
        page.get_by_role("button", name="Export…", exact=True).click()
    assert csv.value.suggested_filename.endswith(".csv"), csv.value.suggested_filename

    # File > Export on a graph: Prism's options reach the file.
    page.get_by_label("Current sheet", exact=True).select_option(graph["id"])
    page.locator("svg.plot").wait_for()
    page.get_by_role("button", name="Export…", exact=True).click()
    export = page.get_by_role("dialog", name="Export", exact=True)
    expect(export.get_by_label("Export As:", exact=True)).to_have_value(f"{graph['name']}.pdf")
    expect(export.get_by_label("Resolution", exact=True)).to_be_disabled()
    expect(export.get_by_label("Enlarge/shrink to make width", exact=True)).to_be_disabled()
    export.get_by_label("File Format:", exact=True).select_option("jpeg")
    expect(export.get_by_label("Export As:", exact=True)).to_have_value(f"{graph['name']}.jpg")
    expect(export.get_by_label("Clear", exact=True)).to_be_disabled()
    export.get_by_label("File Format:", exact=True).select_option("png")
    export.get_by_label("Resolution", exact=True).select_option("150")
    export.get_by_label("Enlarge/shrink to make width", exact=True).check()
    export.get_by_label("Width in inches", exact=True).fill("3")
    expect(export.locator(".export-pixels")).to_have_text("450 × 300 pixels")
    export.get_by_label("Clear", exact=True).check()
    export.get_by_label("Make these options become the default", exact=True).check()
    export.get_by_label("Export As:", exact=True).fill("Figure 1.png")
    with page.expect_download(timeout=300000) as pending:
        export.get_by_role("button", name="Export", exact=True).click()
    download = pending.value
    assert download.failure() is None and download.suggested_filename == "Figure 1.png", download.suggested_filename
    request = sent("/api/export")[-1]
    assert {k: request[k] for k in ("format", "dpi", "width_inches", "transparent")} == {
        "format": "png", "dpi": 150, "width_inches": 3, "transparent": True}, request
    image = Image.open(io.BytesIO(Path(download.path()).read_bytes()))
    assert image.size == (450, 300) and round(image.info["dpi"][0]) == 150, (image.size, image.info)
    assert image.getpixel((1, 1))[3] == 0, "clear background"
    # The options were kept as defaults; Restore brings back Prism's.
    page.get_by_role("button", name="Export…", exact=True).click()
    expect(export.get_by_label("File Format:", exact=True)).to_have_value("png")
    expect(export.get_by_label("Resolution", exact=True)).to_have_value("150")
    export.get_by_role("button", name="Restore the original defaults", exact=True).click()
    expect(export.get_by_label("File Format:", exact=True)).to_have_value("pdf")
    expect(export.get_by_label("Export As:", exact=True)).to_have_value(f"{graph['name']}.pdf")

    # Phone width: the dialogs wrap instead of overflowing.
    page.set_viewport_size({"width": 390, "height": 844})
    assert export.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")
    export.get_by_role("button", name="Cancel", exact=True).click()
    page.get_by_role("button", name="Analyze Data…", exact=True).click()
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

    assert not errors, errors
    print("PASS: navigator rename, in-place title and axis title, Analyze Data tree + Recently used + other table, Export options and defaults, CSV export, phone width")
    browser.close()
