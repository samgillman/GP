"""Browser check for graph text formatting, row sorting and data set order.

Select graph text with a click and format it from the Text toolbar (size,
font, larger/smaller, bold, italic, color), with undo, reload and export;
Edit › Sort by X Value and Reverse Row Order; Change › Reverse Data Set Order.
Run against a built, served app: python scripts/check_prism_text.py [base URL].
"""
import json
import os
import re
import sys
from pathlib import Path
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

    def menu(name, item):
        page.locator(".pw-menubar > .desktop-menu > summary").filter(has_text=re.compile(f"^{name}$")).click()
        page.get_by_role("menu", name=f"{name} menu", exact=True).get_by_role("menuitem", name=item, exact=True).click()

    data = sheet(lambda s: s["kind"] == "data")
    graph_id = sheet(lambda s: s["kind"] == "graph")["id"]
    graph = lambda: sheet(lambda s: s["id"] == graph_id)["graph"]
    size_box, font_box = page.get_by_label("Font size", exact=True), page.get_by_label("Font", exact=True)

    # Text toolbar: nothing to format until graph text is selected.
    page.get_by_role("button", name="Show graph", exact=True).click()
    page.locator("svg.plot").wait_for()
    expect(size_box).to_be_disabled()
    expect(page.get_by_role("button", name="Bold", exact=True)).to_be_disabled()
    title = page.locator("svg.plot .graph-title")
    title.click()
    expect(page.locator('svg.plot .text-selection[data-selected-text="title"]')).to_have_count(1)
    expect(size_box).to_be_enabled()
    expect(size_box).to_have_value("18")
    expect(font_box).to_have_value("Arial")
    expect(page.get_by_role("button", name="Bold", exact=True)).to_have_attribute("aria-pressed", "true")
    size_box.select_option("28")
    page.get_by_role("button", name="Italic", exact=True).click()
    page.locator(".desktop-menu > summary").filter(has=page.locator('[aria-label="Text color"]')).click()
    page.get_by_role("menuitemradio", name="Red", exact=True).click()
    assert graph()["text_styles"] == {"title": {"size": 28, "italic": True, "color": "#d62728"}}, graph()
    style = title.get_attribute("style")
    assert "28px" in style and "italic" in style and "rgb(214, 39, 40)" in style.replace("#d62728", "rgb(214, 39, 40)"), style
    expect(page.get_by_role("button", name="Italic", exact=True)).to_have_attribute("aria-pressed", "true")
    # Each command is one undo step.
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph()["text_styles"] == {"title": {"size": 28, "italic": True}}, graph()
    page.get_by_role("button", name="Redo", exact=True).click()

    # Y axis labels: larger text steps through Prism's sizes; the font changes.
    page.locator('svg.plot [data-text="y_ticks"]').first.click()
    expect(page.locator('svg.plot .text-selection[data-selected-text="y_ticks"]')).to_have_count(1)
    expect(size_box).to_have_value("14")
    page.get_by_role("button", name="Larger text", exact=True).click()
    page.get_by_role("button", name="Larger text", exact=True).click()
    font_box.select_option("Times New Roman")
    page.get_by_role("button", name="Bold", exact=True).click()
    assert graph()["text_styles"]["y_ticks"] == {"size": 18, "font": "Times New Roman", "bold": False}, graph()
    tick_font = page.locator('svg.plot [data-text="y_ticks"]').first.evaluate("el => getComputedStyle(el).font")
    assert "18px" in tick_font and "Times New Roman" in tick_font and "700" not in tick_font, tick_font

    # Clicking the plotting area or pressing Escape deselects.
    page.locator('svg.plot [data-text="x_label"]').click()
    expect(size_box).to_have_value("16")
    page.keyboard.press("Escape")
    expect(page.locator("svg.plot .text-selection")).to_have_count(0)
    expect(size_box).to_be_disabled()
    title.click()
    box = page.locator("svg.plot").bounding_box()
    page.mouse.click(box["x"] + 5, box["y"] + box["height"] - 5)
    expect(size_box).to_be_disabled()

    # Formatting survives a reload and reaches the exported file.
    page.reload()
    page.locator("svg.plot").wait_for()
    expect(page.locator("svg.plot .graph-title")).to_have_attribute("style", re.compile("28px"))
    menu("File", "Export…")
    export = page.get_by_role("dialog", name="Export", exact=True)
    export.get_by_label("File Format:", exact=True).select_option("svg")
    with page.expect_download(timeout=300000) as pending:
        export.get_by_role("button", name="Export", exact=True).click()
    assert sent("/api/export")[-1]["graph"]["text_styles"] == graph()["text_styles"]
    svg = Path(pending.value.path()).read_text()
    title_style = re.search(r'<text style="([^"]*)"[^>]*>' + re.escape(graph()["title"]) + "<", svg).group(1)
    assert "fill: #d62728" in title_style and "italic" in title_style, title_style
    assert "Times New Roman" in svg

    # Change › Reverse Data Set Order: data sets keep their colors.
    def series_fills():
        return page.evaluate("""() => Object.fromEntries([...document.querySelectorAll('svg.plot g[data-dataset]')]
          .map(g => [g.dataset.dataset, g.querySelector('rect')?.getAttribute('stroke')]))""")
    before_order = sheet(lambda s: s["id"] == graph_id)["columnIndices"]
    fills = series_fills()
    menu("Change", "Reverse Data Set Order")
    assert sheet(lambda s: s["id"] == graph_id)["columnIndices"] == list(reversed(before_order))
    assert series_fills() == fills, "each data set keeps its color"
    names = page.locator("svg.plot [data-text=x_ticks]").all_text_contents()
    assert names == [data["project"]["columns"][i]["name"] for i in reversed(before_order)], names
    page.get_by_role("button", name="Undo", exact=True).click()
    assert sheet(lambda s: s["id"] == graph_id)["columnIndices"] == before_order

    # Data › Sort on a column table: reverse rows; Sort by X needs XY.
    page.get_by_role("button", name="Show data table", exact=True).click()
    page.locator(".desktop-menu > summary").filter(has=page.locator('[aria-label="Sort"]')).click()
    expect(page.get_by_role("menuitem", name="Sort by X Value", exact=True)).to_be_disabled()
    page.get_by_role("menuitem", name="Reverse Row Order", exact=True).click()
    reversed_data = sheet(lambda s: s["id"] == data["id"])
    count = len(data["rowIds"])
    padded = lambda values: values + [""] * (count - len(values))
    for before, after in zip(data["project"]["columns"], reversed_data["project"]["columns"]):
        assert after["values"] == list(reversed(padded(before["values"]))), (before, after)
    assert reversed_data["rowIds"] == list(reversed(data["rowIds"]))
    page.get_by_role("button", name="Undo", exact=True).click()
    assert sheet(lambda s: s["id"] == data["id"])["project"] == data["project"]

    # XY table: reverse, then Sort by X Value restores ascending X.
    page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
    new_table = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
    new_table.get_by_role("button", name="XY", exact=True).click()
    new_table.get_by_role("radio", name="Start with sample data", exact=True).check()
    new_table.get_by_role("button", name="Create table and graph", exact=True).click()
    xy = sheet(lambda s: s["kind"] == "data" and s["project"]["table_type"] == "xy")
    menu("Edit", "Reverse Row Order")
    shuffled = sheet(lambda s: s["id"] == xy["id"])
    assert shuffled["rowIds"] == list(reversed(xy["rowIds"]))
    menu("Edit", "Sort by X Value")
    restored = sheet(lambda s: s["id"] == xy["id"])
    x = [float(v) for v in restored["project"]["columns"][0]["values"] if v.strip()]
    assert x == sorted(x), x
    assert restored["rowIds"][:len(x)] == xy["rowIds"][:len(x)], "rows keep their IDs"
    for column, original in zip(restored["project"]["columns"][1:], xy["project"]["columns"][1:]):
        assert column["values"][:len(x)] == original["values"][:len(x)]

    assert not errors, errors
    print("PASS: graph text selection, Text toolbar formatting + undo + reload + export, reverse data set order, reverse rows, sort by X")
    browser.close()
