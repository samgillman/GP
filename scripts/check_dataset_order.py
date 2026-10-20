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
    # Like Prism, a new graph asks for its type when first viewed; keep it.
    page.get_by_role("dialog", name="Change Graph Type", exact=True).get_by_role("button", name="OK", exact=True).click()
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
    appearance = dialog.get_by_label("Appearance data set", exact=True)
    assert appearance.input_value() == str(original["columnIndices"][0])
    dialog.get_by_role("button", name="Next appearance data set", exact=True).click()
    assert appearance.input_value() == str(original["columnIndices"][1])
    dialog.get_by_role("button", name="Previous appearance data set", exact=True).click()
    assert appearance.input_value() == str(original["columnIndices"][0])
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
    # Persist a custom style while its dataset is absent from the graph.
    print("Checking saved omitted-dataset styles", flush=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    target_index = original["columnIndices"][0]
    target = source_before["project"]["columns"][target_index]
    custom_color = "#7b2cbf"
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_label("Appearance data set", exact=True).select_option(str(target_index))
    dialog.get_by_label(f'{target["name"]} color', exact=True).fill(custom_color)
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    ordered.locator(f'[data-source-index="{target_index}"]').click()
    dialog.get_by_role("button", name="Remove", exact=True).click()
    dialog.get_by_role("button", name="OK", exact=True).click()
    removed = book()
    assert target["id"] not in graph(removed)["datasetIds"]
    assert graph(removed)["datasetColors"][target["id"]] == custom_color
    with page.expect_download() as pending:
        page.get_by_role("button", name="Save workbook", exact=True).click()
    saved = pending.value
    saved_bytes = Path(saved.path()).read_bytes()
    assert json.loads(saved_bytes) == removed
    page.reload()
    page.locator("svg.plot").wait_for()
    assert book() == removed
    # Use the real file importer, including its metadata validation.
    print("Checking workbook file import and dataset re-addition", flush=True)
    page.locator('input[type=file][accept=".json"]').set_input_files({
        "name": "persistent-dataset-styles.json",
        "mimeType": "application/json",
        "buffer": saved_bytes,
    })
    expect(page.get_by_text("Workbook opened. Legacy single-table projects are migrated automatically.", exact=True)).to_be_visible()
    assert book() == removed
    page.get_by_role("button", name="Format Graph…", exact=True).first.click()
    dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
    dialog.get_by_role("button", name="Add…", exact=True).click()
    dialog.get_by_label("Available data sets", exact=True).select_option(str(target_index))
    dialog.get_by_role("button", name="Add data set", exact=True).click()
    dialog.get_by_role("button", name="OK", exact=True).click()
    restored = book()
    assert {s["name"]: s["color"] for s in rendered_series()}[target["name"]] == custom_color
    selected_position = graph(restored)["datasetIds"].index(target["id"])
    assert graph(restored)["graph"]["colors"][selected_position] == custom_color
    page.get_by_role("button", name="Undo", exact=True).click()
    assert book() == removed
    page.get_by_role("button", name="Redo", exact=True).click()
    assert book() == restored
    assert next(s for s in restored["sheets"] if s["id"] == source_id) == source_before
    page.locator(".desktop-menu > summary").filter(has_text="File").first.click()
    print("Checking SVG export with restored dataset color", flush=True)
    with page.expect_download(timeout=int(os.environ.get("GP_DATASET_EXPORT_TIMEOUT", "300000"))) as pending:
        page.get_by_role("menuitem", name="Export graph as SVG…", exact=True).click()
    exported = pending.value
    assert exported.failure() is None
    assert custom_color.encode() in Path(exported.path()).read_bytes()
    assert errors == [], errors
    browser.close()
    print("PASS: XY order/colors, Apply/Cancel, undo/redo, membership, reload, keyboard, saved removed styles, file import, SVG export and source preservation")
