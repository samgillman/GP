"""Exercise reversible value exclusions in Chromium with actual calculations.
Run: GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_exclusions.py URL
Covers context menu, toolbar, Edit menu and graph point commands; blue italic asterisk display;
recalculated means; graph points and export input; undo/redo; reload; freeze;
CSV export choices and re-import; and Prism XML import of excluded values.
Optional GP_EXCLUSIONS_EVIDENCE=path.json records the observed outcomes.
"""
import copy
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
evidence = {"url": base, "checks": []}
KEY = "gp.workbook.v2"


def check(name, **details):
    evidence["checks"].append({"name": name, **details})
    print("PASS", name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(accept_downloads=True)
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

    def payloads(path):
        sent = network + page.evaluate("window.__gpRequests || []")
        return [item["body"] for item in sent if item["path"] == path]
    page.goto(base)
    page.wait_for_function(f'localStorage.getItem("{KEY}") !== null')

    def book():
        return page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')

    def sheet(sheet_id, saved=None):
        return next(s for s in (saved or book())["sheets"] if s["id"] == sheet_id)

    template = book()
    data = next(s for s in template["sheets"] if s["kind"] == "data")
    graph = next(s for s in template["sheets"] if s["kind"] == "graph")
    data.update(id="d1", name="Source", revision=0)
    data["project"].update(name="Source", table_type="column", analysis="descriptive",
                           columns=[{"name": "A", "values": ["1", "2", "3", "100"]}, {"name": "B", "values": ["4", "5", "6"]}])
    for item in (data,):
        item.pop("rowIds", None)
        item.pop("excluded", None)
        for column in item["project"]["columns"]:
            column.pop("id", None)
    graph_sheet = {"kind": "graph", "id": "g1", "name": "Source graph", "dataId": "d1", "graph": copy.deepcopy(graph["graph"]),
                   "columnIndices": [0, 1], "resultId": None}
    graph_sheet["graph"].update(type="bar", show_points=True)
    result = {"kind": "results", "id": "r1", "name": "Descriptive", "dataId": "d1", "analysis": "descriptive",
              "columnIndices": [0, 1], "sourceRevision": 0, "status": "stale", "result": None}
    # A positional v2 fixture also exercises migration into v4 identities.
    fixture = {"version": 2, "name": "Exclusions", "activeSheetId": "d1", "sheets": [data, result, graph_sheet]}
    page.evaluate(f'(b) => localStorage.setItem("{KEY}", JSON.stringify(b))', fixture)
    page.reload()

    def wait_means(a, b=5.0, n=None):
        page.wait_for_function(
            '([a, b, n]) => {const w=JSON.parse(localStorage.getItem("gp.workbook.v2")); const r=w.sheets.find(s=>s.id==="r1");'
            ' return r?.status==="current" && Math.abs(r.result.summary[0].mean-a)<1e-9 && Math.abs(r.result.summary[1].mean-b)<1e-9'
            ' && (n===null || r.result.summary[0].n===n)}', arg=[a, b, n], timeout=300000)

    def cell(name):
        return page.get_by_label(name, exact=True)

    def menu(name, action):
        page.locator(".desktop-menu > summary").filter(has_text=name).first.click()
        page.get_by_role("menu", name=f"{name} menu", exact=True).get_by_role("menuitem", name=action, exact=True).click()

    def excluded(sheet_id="d1"):
        source = sheet(sheet_id)
        rows = {row: i for i, row in enumerate(source["rowIds"])}
        cols = {c["id"]: i for i, c in enumerate(source["project"]["columns"])}
        return sorted((cols[uid], rows[r]) for uid, ids in source.get("excluded", {}).items() for r in ids)

    wait_means(26.5, n=4)
    assert book()["version"] == 4
    check("v2 fixture migrated to v4 and computed actual means", mean_a=26.5, mean_b=5)

    # Context menu: exclude the outlier.
    cell("A, row 4").click()
    cell("A, row 4").click(button="right")
    page.get_by_role("menu", name="cell actions").get_by_role("menuitem", name="Exclude Values").click()
    expect(cell("A, row 4, excluded")).to_be_visible()
    assert excluded() == [(0, 3)]
    assert sheet("d1")["project"]["columns"][0]["values"][3] == "100"
    style = cell("A, row 4, excluded").evaluate(
        "(input) => { const td = input.closest('td'); const s = getComputedStyle(input); return [s.fontStyle, s.color, getComputedStyle(td, '::after').content]; }")
    assert style == ["italic", "rgb(29, 95, 196)", '"*"'], style
    wait_means(2, n=3)
    sent = payloads("/api/analyze")[-1]
    assert sent["columns"][0]["values"] == [1, 2, 3, None], sent
    check("context-menu exclusion keeps text, shows blue italic asterisk and recalculates", style=style, mean_a=2, request_values=sent["columns"][0]["values"])

    # Edit menu: the same selection now offers Include.
    page.locator(".desktop-menu > summary").filter(has_text="Edit").first.click()
    include = page.get_by_role("menuitem", name="Include Values", exact=True)
    expect(include).to_be_enabled()
    include.click()
    expect(cell("A, row 4")).to_be_visible()
    assert excluded() == []
    wait_means(26.5, n=4)
    check("Edit menu toggle restores the value and its calculation", mean_a=26.5)

    # Edit menu on a range, then undo/redo as single commands.
    cell("A, row 1").click()
    cell("A, row 2").click(modifiers=["Shift"])
    menu("Edit", "Exclude Values")
    assert excluded() == [(0, 0), (0, 1)]
    wait_means(51.5, n=2)
    page.get_by_role("button", name="Undo", exact=True).click()
    assert excluded() == []
    wait_means(26.5, n=4)
    page.get_by_role("button", name="Redo", exact=True).click()
    assert excluded() == [(0, 0), (0, 1)]
    wait_means(51.5, n=2)
    check("Edit menu range exclusion, undo and redo", mean_a=51.5)

    # Results note and graph points/export input.
    page.get_by_label("Current sheet", exact=True).select_option("r1")
    expect(page.get_by_role("note")).to_contain_text("2 excluded values were left out of this analysis")
    page.get_by_label("Current sheet", exact=True).select_option("g1")
    titles = page.locator("svg circle title").all_text_contents()
    a_points = sorted(t for t in titles if t.startswith("A, row"))
    assert a_points == ["A, row 3: 3", "A, row 4: 100"], titles
    with page.expect_download(timeout=300000):
        menu("File", "Export graph as SVG…")
    exported = payloads("/api/export")[-1]
    assert exported["data"]["columns"][0]["values"] == [None, None, 3, 100], exported
    check("results note, drawn graph points and graph export input omit excluded values", graph_points=a_points,
          export_values=exported["data"]["columns"][0]["values"])

    # Graph point details exclude the clicked observation through the same command.
    page.locator("svg circle", has=page.locator("title", has_text="A, row 3: 3")).click()
    page.get_by_role("button", name="Exclude Values", exact=True).click()
    assert excluded() == [(0, 0), (0, 1), (0, 2)]
    wait_means(100, n=1)
    titles = page.locator("svg circle title").all_text_contents()
    assert sorted(t for t in titles if t.startswith("A, row")) == ["A, row 4: 100"], titles
    page.get_by_role("button", name="Undo", exact=True).click()
    assert excluded() == [(0, 0), (0, 1)]
    wait_means(51.5, n=2)
    check("graph point details exclude the source value; undo restores it", mean_a_after_point_exclusion=100)

    # Persistence across reload.
    page.reload()
    page.get_by_label("Current sheet", exact=True).select_option("d1")
    expect(cell("A, row 1, excluded")).to_be_visible()
    expect(cell("A, row 2, excluded")).to_be_visible()
    check("exclusions persist across reload")

    # CSV export choice and asterisk re-import.
    menu("File", "Export data as CSV…")
    dialog = page.get_by_role("dialog", name="Export data with excluded values")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_label("Followed by an asterisk (12*)")).to_be_checked()
    with page.expect_download() as pending:
        dialog.get_by_role("button", name="Export CSV", exact=True).click()
    csv_text = Path(pending.value.path()).read_bytes().decode()
    assert csv_text == 'A,B\r\n1*,4\r\n2*,5\r\n3,6\r\n100,""', csv_text
    page.locator('input[type=file]:not([accept=".json"])').set_input_files({"name": "excluded.csv", "mimeType": "text/csv", "buffer": csv_text.encode()})
    expect(page.get_by_text("2 numbers followed by * were imported as excluded values", exact=False)).to_be_visible()
    imported = [s for s in book()["sheets"] if s["kind"] == "data" and s["id"] != "d1"][-1]
    assert imported["project"]["columns"][0]["values"] == ["1", "2", "3", "100"]
    assert excluded(imported["id"]) == [(0, 0), (0, 1)]
    check("CSV asterisk export re-imports the same exclusions", csv=csv_text)

    # Prism XML import keeps original excluded numbers.
    xml = ('<GraphPadPrismFile xmlns="http://graphpad.com/prism/Prism.htm"><Table ID="T1" TableType="OneWay"><Title>Outliers</Title>'
           '<YColumn Subcolumns="1"><Title>Y</Title><Subcolumn><d>10</d><d Excluded="1">250</d><d>12</d></Subcolumn></YColumn></Table></GraphPadPrismFile>')
    page.locator('input[type=file]:not([accept=".json"])').set_input_files({"name": "outliers.pzfx", "mimeType": "application/xml", "buffer": xml.encode()})
    page.get_by_role("dialog").get_by_role("button", name="Import table", exact=True).click()
    xml_sheet = [s for s in book()["sheets"] if s["kind"] == "data" and s["name"] == "Outliers"][-1]
    assert xml_sheet["project"]["columns"][0]["values"] == ["10", "250", "12"]
    assert excluded(xml_sheet["id"]) == [(0, 1)]
    expect(cell("Y, row 2, excluded")).to_be_visible()
    check("Prism XML Excluded values import with original numbers")

    # Frozen data tables cannot change exclusions.
    page.get_by_label("Current sheet", exact=True).select_option("d1")
    page.get_by_role("button", name="Freeze sheet", exact=True).click()
    cell("A, row 3").click()
    page.locator(".desktop-menu > summary").filter(has_text="Edit").first.click()
    expect(page.get_by_role("menuitem", name="Exclude Values", exact=True)).to_be_disabled()
    page.keyboard.press("Escape")
    cell("A, row 3").click(button="right")
    expect(page.get_by_role("menu", name="cell actions").get_by_role("menuitem", name="Exclude Values")).to_be_disabled()
    page.keyboard.press("Escape")
    page.get_by_role("button", name="Unfreeze sheet", exact=True).click()
    check("frozen data table disables exclusion commands")

    assert not errors, errors
    browser.close()

evidence["page_errors"] = errors
if os.environ.get("GP_EXCLUSIONS_EVIDENCE"):
    target = Path(os.environ["GP_EXCLUSIONS_EVIDENCE"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(evidence, indent=2))
print("All exclusion browser checks passed.")
