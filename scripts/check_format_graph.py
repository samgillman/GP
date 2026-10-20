"""Exercise GP's Format Graph dialog contract in a real browser (not native parity).
GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_format_graph.py URL

Checks the selected-dataset color editor, the front-to-back dataset list with
its action column, color ownership through reorder/remove/add, first-listed
dataset drawn in front, the Change Graph Type hand-off, double-click entry,
Apply/OK/Cancel/undo/reload persistence and narrow-screen editing.
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

PALETTE = ["#20867e", "#df9b51", "#7186b3", "#b57d9e", "#87a365", "#aa845a"]
SET_COLOR = """(element, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.set_default_timeout(120000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: print("Browser error:", message.text, flush=True)
            if message.type == "error" else None)
    page.goto(sys.argv[1])
    page.get_by_role("button", name="Show graph", exact=True).click()
    page.locator("svg.plot").wait_for()
    folder = os.environ.get("GP_FORMAT_GRAPH_EVIDENCE")
    if folder:
        Path(folder).mkdir(parents=True, exist_ok=True)

    def workbook():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    def graph_sheet(book=None):
        book = book or workbook()
        return next(s for s in book["sheets"] if s["id"] == book["activeSheetId"])

    def names(indices, book=None):
        book = book or workbook()
        data = next(s for s in book["sheets"] if s["kind"] == "data")
        return [data["project"]["columns"][i]["name"] for i in indices]

    def bar_fills():
        return page.evaluate("""() => [...document.querySelectorAll('svg.plot rect[stroke="#000"]')]
            .map(rect => rect.getAttribute('fill'))""")

    def category_labels():
        return page.locator('[data-axis="x"] text').all_text_contents()

    before = workbook()
    data_before = [s for s in before["sheets"] if s["kind"] == "data"]
    start = graph_sheet(before)
    assert names(start["columnIndices"]) == ["Control", "Treatment A", "Treatment B"]
    # The first listed dataset draws in front: SVG marks appear back to front.
    assert bar_fills() == [PALETTE[2], PALETTE[1], PALETTE[0]], bar_fills()

    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
    expect(dialog).to_be_visible()
    expect(dialog.get_by_role("tab", name="Appearance")).to_have_attribute("aria-selected", "true")
    chooser = dialog.get_by_label("Data set", exact=True)
    expect(chooser).to_have_value("0")
    dialog.get_by_role("button", name="Next data set", exact=True).click()
    dialog.get_by_role("button", name="Next data set", exact=True).click()
    expect(chooser).to_have_value("2")
    expect(dialog.get_by_role("button", name="Next data set", exact=True)).to_be_disabled()
    color = dialog.get_by_label("Data set color", exact=True)
    expect(color).to_have_value(PALETTE[2])
    color.evaluate(SET_COLOR, "#ff0000")
    expect(color).to_have_value("#ff0000")
    dialog.get_by_role("button", name="Apply", exact=True).click()
    applied = graph_sheet()
    assert applied["graph"]["colors"] == [PALETTE[0], PALETTE[1], "#ff0000"], applied["graph"]["colors"]
    assert applied["columnIndices"] == start["columnIndices"]
    expect(dialog).to_be_visible()
    if folder:
        page.screenshot(path=str(Path(folder) / "appearance.png"))

    dialog.get_by_role("tab", name="Data Sets on Graph").click()
    listbox = dialog.get_by_role("listbox", name="Data sets plotted (front to back)")
    expect(listbox.get_by_role("option")).to_have_text(["Control", "Treatment A", "Treatment B"])
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Treatment B")
    expect(dialog.get_by_role("button", name="Down", exact=True)).to_be_disabled()
    dialog.get_by_role("button", name="Top", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Treatment B", "Control", "Treatment A"])
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Treatment B")
    dialog.get_by_role("button", name="Apply", exact=True).click()
    moved = graph_sheet()
    assert names(moved["columnIndices"]) == ["Treatment B", "Control", "Treatment A"]
    # The color stays with its dataset through the move.
    assert moved["graph"]["colors"] == ["#ff0000", PALETTE[0], PALETTE[1]], moved["graph"]["colors"]
    assert category_labels() == ["Treatment B", "Control", "Treatment A"]
    assert bar_fills() == [PALETTE[1], PALETTE[0], "#ff0000"], bar_fills()
    if folder:
        page.screenshot(path=str(Path(folder) / "datasets.png"))

    dialog.get_by_role("button", name="Remove", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Control", "Treatment A"])
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Control")
    dialog.get_by_role("button", name="Add…", exact=True).click()
    adder = dialog.get_by_role("group", name="Add data sets from Treatment response study")
    expect(dialog.get_by_role("button", name="Add selected", exact=True)).to_be_disabled()
    adder.get_by_label("Treatment B", exact=True).check()
    dialog.get_by_role("button", name="Add selected", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Control", "Treatment A", "Treatment B"])
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Treatment B")
    expect(dialog.get_by_role("button", name="Add…", exact=True)).to_be_disabled()
    dialog.get_by_role("button", name="Reverse", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Treatment B", "Treatment A", "Control"])
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Treatment B")
    listbox.focus()
    page.keyboard.press("End")
    expect(listbox.get_by_role("option", selected=True)).to_have_text("Control")
    dialog.get_by_role("button", name="Up", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Treatment B", "Control", "Treatment A"])
    dialog.get_by_role("button", name="OK", exact=True).click()
    expect(dialog).not_to_be_visible()
    final = graph_sheet()
    assert names(final["columnIndices"]) == ["Treatment B", "Control", "Treatment A"]
    # Removing and re-adding a dataset gives it the next cycle color.
    assert final["graph"]["colors"] == [PALETTE[0], PALETTE[0], PALETTE[1]], final["graph"]["colors"]
    assert [s for s in workbook()["sheets"] if s["kind"] == "data"] == data_before

    # Cancel discards edits made since the last Apply; undo reverts the OK.
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Data Sets on Graph").click()
    dialog.get_by_role("button", name="Bottom", exact=True).click()
    expect(listbox.get_by_role("option")).to_have_text(["Control", "Treatment A", "Treatment B"])
    dialog.get_by_role("button", name="Cancel", exact=True).click()
    expect(dialog).not_to_be_visible()
    assert graph_sheet() == final
    page.get_by_role("button", name="Undo", exact=True).click()
    assert graph_sheet() == moved
    page.get_by_role("button", name="Redo", exact=True).click()
    assert graph_sheet() == final

    # Double-clicking a dataset's marks opens Format Graph on that dataset.
    page.locator(f'svg.plot rect[fill="{PALETTE[1]}"]').first.dblclick()
    expect(dialog).to_be_visible()
    expect(dialog.get_by_label("Data set", exact=True)).to_have_value("2")
    expect(listbox).to_have_count(0)
    dialog.get_by_label("Title", exact=True).fill("Dialog hand-off")
    dialog.get_by_role("button", name="Change Graph Type…", exact=True).click()
    expect(dialog).not_to_be_visible()
    type_dialog = page.get_by_role("dialog", name="Change Graph Type", exact=True)
    expect(type_dialog).to_be_visible()
    assert graph_sheet()["graph"]["title"] == "Dialog hand-off"
    type_dialog.get_by_role("button", name="Cancel", exact=True).click()
    expect(type_dialog).not_to_be_visible()

    page.reload()
    page.locator("svg.plot").wait_for()
    reloaded = graph_sheet()
    assert names(reloaded["columnIndices"]) == ["Treatment B", "Control", "Treatment A"]
    assert reloaded["graph"]["title"] == "Dialog hand-off"
    assert category_labels() == ["Treatment B", "Control", "Treatment A"]

    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    expect(dialog).to_be_visible()
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1"), "Narrow dialog overflows horizontally"
    dialog.get_by_role("tab", name="Data Sets on Graph").click()
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1"), "Narrow dataset page overflows"
    box = dialog.bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 391
    if folder:
        page.screenshot(path=str(Path(folder) / "narrow-datasets.png"))
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    assert errors == [], errors
    if folder:
        (Path(folder) / "browser-check.json").write_text(json.dumps({
            "url": sys.argv[1], "scope": "GP browser implementation, not native Prism parity",
            "checks": ["selected-dataset color", "front-to-back list and action column",
                       "color ownership through top/remove/add/reverse/up", "first dataset drawn in front",
                       "Apply/OK/Cancel", "undo/redo", "double-click entry", "Change Graph Type hand-off",
                       "reload", "narrow viewport"],
            "page_errors": errors, "final_graph": reloaded["graph"], "final_order": names(reloaded["columnIndices"]),
        }, indent=2) + "\n")
    browser.close()
    print("PASS: Format Graph dataset editor, front-to-back ordering, color ownership, hand-off, persistence; zero page errors")
