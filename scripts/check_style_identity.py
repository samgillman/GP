"""Check current Format Graph styles across identities and both renderers.

Uses the real workbook importer, Format Graph, sheet duplication and Export
dialogs. A deterministic sparse XY project and its 6,261-observation twin keep
the same isolated marks, so canvas pixels can be checked against SVG pixels.
This is a GP regression, not a comparison with a running Prism application.

Run against a freshly built server/static app. GP_STYLE_IDENTITY_EVIDENCE sets
the report/artifact directory; a partial report and screenshot survive failure.
"""
import copy
import hashlib
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
OUT = Path(os.environ.get("GP_STYLE_IDENTITY_EVIDENCE", "/tmp/gp-style-identity"))
OUT.mkdir(parents=True, exist_ok=True)
COLORS = ["#0077bb", "#cc3366", "#ee7733", "#663399", "#00ff00"]
NAMES = ["Circle", "Square", "Triangle", "Diamond", "Hidden"]
SHAPES = ["circle", "square", "triangle", "diamond", "circle"]
SIZES = [3, 6, 8, 10, 10]


def fixture(dense=False):
    rows = 1257 if dense else 6
    columns = [{"id": "original-x", "name": "X", "values": ["20", "40", "60", "80", "20", "90"] + ["5"] * (rows - 6)}]
    for i, name in enumerate(NAMES):
        values = [""] * 6
        values[i] = "50"
        if name == "Hidden":
            values[5] = "20"
        values += [str(80 + i * 2)] * (rows - 6)
        columns.append({"id": f"original-{name.lower()}", "name": name, "values": values})
    axis = {"scale": "linear", "minimum": 0, "maximum": 100, "majorInterval": 20,
            "reverse": False, "showAxis": True, "showGrid": False}
    return {"version": 1, "name": "Style identity regression", "table_type": "xy",
            "columns": columns, "analysis": "descriptive",
            "graph": {"type": "scatter", "error": "none", "title": "Dataset appearance",
                      "x_label": "X", "y_label": "Y", "colors": COLORS,
                      "show_points": True, "show_legend": False,
                      "axes": {"x": copy.deepcopy(axis), "y": copy.deepcopy(axis)},
                      "dataset_styles": {columns[i + 1]["id"]: {
                          "symbols": name != "Hidden", "symbol_shape": SHAPES[i],
                          "symbol_size": SIZES[i], "symbol_color": COLORS[i],
                      } for i, name in enumerate(NAMES)}}}


# Safe distances from the marker boundary make these insensitive to subpixel
# antialiasing. The colored corner distinguishes a square from a same-size dot;
# the triangle apex and diamond tip distinguish those shapes from old circles.
SAMPLES = [
    {"name": "circle center", "series": 0, "dx": 0, "dy": 0, "inside": True},
    {"name": "circle outside", "series": 0, "dx": 5, "dy": 0, "inside": False},
    {"name": "square corner", "series": 1, "dx": 4.5, "dy": 4.5, "inside": True},
    {"name": "square outside", "series": 1, "dx": 7, "dy": 0, "inside": False},
    {"name": "triangle apex", "series": 2, "dx": 0, "dy": -7, "inside": True},
    {"name": "triangle outside corner", "series": 2, "dx": 7, "dy": -7, "inside": False},
    {"name": "diamond tip", "series": 3, "dx": 0, "dy": -10.5, "inside": True},
    {"name": "diamond outside corner", "series": 3, "dx": 8, "dy": 8, "inside": False},
    {"name": "hidden isolated point", "series": 4, "x": 90, "y": 20, "dx": 0, "dy": 0, "inside": False},
]

report = {"base": BASE, "scope": "current-main GP style identity and renderer regression; no native parity claim",
          "started_utc": datetime.now(timezone.utc).isoformat(), "checks": [], "page_errors": [],
          "console_errors": [], "fixtures": {}}
started = time.monotonic()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page.set_default_timeout(60000)
    report["browser"] = browser.version
    page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
    page.on("console", lambda message: report["console_errors"].append(message.text) if message.type == "error" else None)
    requests = []
    page.on("request", lambda request: requests.append(request.post_data_json)
            if request.method == "POST" and request.url.endswith("/api/export") else None)
    page.add_init_script("""(() => {
      const post = Worker.prototype.postMessage;
      window.__styleExportRequests = [];
      Worker.prototype.postMessage = function(message, ...rest) {
        if (message?.path === '/api/export') window.__styleExportRequests.push(message.body);
        return post.call(this, message, ...rest);
      };
    })()""")

    def book():
        return page.evaluate("JSON.parse(localStorage.getItem('gp.workbook.v2'))")

    def sheet(identity, workbook=None):
        return next(item for item in (workbook or book())["sheets"] if item["id"] == identity)

    def check(name, **details):
        report["checks"].append({"name": name, **details})
        print(f"PASS: {name}", flush=True)

    def menu_action(menu, action):
        page.locator(".desktop-menu > summary").filter(has_text=re.compile(f"^{re.escape(menu)}$")).click()
        page.get_by_role("menu", name=f"{menu} menu", exact=True).get_by_role("menuitem", name=action, exact=True).click()

    def select(identity):
        page.get_by_label("Current sheet", exact=True).select_option(identity)
        page.wait_for_function("id => JSON.parse(localStorage.getItem('gp.workbook.v2')).activeSheetId === id", arg=identity)

    def import_file(content, name):
        previous = book()
        page.locator('input[type=file][accept=".json"]').set_input_files({
            "name": name, "mimeType": "application/json", "buffer": content})
        expect(page.get_by_text("Workbook opened. Legacy single-table projects are migrated automatically.", exact=True)).to_be_visible()
        if json.loads(content).get("version") == 1:
            page.wait_for_function("id => JSON.parse(localStorage.getItem('gp.workbook.v2')).activeSheetId !== id", arg=previous["activeSheetId"])

    def import_fixture(dense=False):
        project = fixture(dense)
        content = json.dumps(project, separators=(",", ":")).encode()
        name = "dense" if dense else "sparse"
        report["fixtures"][name] = {"sha256": hashlib.sha256(content).hexdigest(),
                                      "observations": sum(bool(v) for c in project["columns"][1:] for v in c["values"])}
        import_file(content, f"{name}-styles.json")
        current = book()
        source = next(item for item in current["sheets"] if item["kind"] == "data")
        graph = next(item for item in current["sheets"] if item["kind"] == "graph")
        old_ids = {column["id"] for column in project["columns"]}
        ids = {column["id"] for column in source["project"]["columns"]}
        assert old_ids.isdisjoint(ids), "a single-table import must allocate new dataset identities"
        for column, original in zip(source["project"]["columns"][1:], project["columns"][1:]):
            expected = project["graph"]["dataset_styles"][original["id"]]
            assert source["project"]["graph"]["dataset_styles"][column["id"]] == expected
            assert graph["graph"]["dataset_styles"][column["id"]] == expected
        assert set(graph["graph"]["dataset_styles"]) == ids - {source["project"]["columns"][0]["id"]}
        page.get_by_role("button", name="Show graph", exact=True).click()
        page.locator("svg.plot").wait_for()
        return source, graph

    def format_graph():
        page.get_by_role("button", name="Format Graph…", exact=True).click()
        dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
        expect(dialog).to_have_attribute("aria-modal", "false")
        return dialog

    def raster_samples(dense):
        return page.locator("svg.plot").evaluate("""async (svg, options) => {
          const rect = svg.querySelector('clipPath rect');
          const left = +rect.getAttribute('x'), top = +rect.getAttribute('y');
          const width = +rect.getAttribute('width'), height = +rect.getAttribute('height');
          let canvas = svg.querySelector('canvas'), ratio = 2;
          if (options.dense) ratio = canvas.width / svg.viewBox.baseVal.width;
          else {
            const clone = svg.cloneNode(true);
            clone.setAttribute('width', svg.viewBox.baseVal.width * ratio);
            clone.setAttribute('height', svg.viewBox.baseVal.height * ratio);
            clone.style.width = ''; clone.style.height = '';
            const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], {type:'image/svg+xml'}));
            const img = new Image();
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
            canvas = document.createElement('canvas');
            canvas.width = svg.viewBox.baseVal.width * ratio;
            canvas.height = svg.viewBox.baseVal.height * ratio;
            canvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
          }
          const context = canvas.getContext('2d');
          return options.samples.map(sample => {
            const x = left + width * (sample.x ?? (20 + 20 * sample.series)) / 100 + sample.dx;
            const y = top + height * (1 - (sample.y ?? 50) / 100) + sample.dy;
            return {...sample, rgba: Array.from(context.getImageData(Math.floor(x * ratio), Math.floor(y * ratio), 1, 1).data)};
          });
        }""", {"dense": dense, "samples": SAMPLES})

    def validate_samples(samples):
        for sample in samples:
            expected = tuple(int(COLORS[sample["series"]][i:i + 2], 16) for i in (1, 3, 5))
            colored = sample["rgba"][3] > 240 and all(abs(a - b) <= 5 for a, b in zip(sample["rgba"][:3], expected))
            assert colored == sample["inside"], sample

    def point_location(x, y, dx=0, dy=0, center=False):
        return page.locator("svg.plot").evaluate("""(svg, p) => {
          const rect = svg.querySelector('clipPath rect');
          const point = new DOMPoint(+rect.getAttribute('x') + +rect.getAttribute('width') * p.x / 100 + p.dx,
                                    +rect.getAttribute('y') + +rect.getAttribute('height') * (1 - p.y / 100) + p.dy);
          let screen = point.matrixTransform(svg.getScreenCTM());
          if (p.center) {
            const viewport = svg.closest('[aria-label="Graph viewport"]');
            const box = viewport.getBoundingClientRect();
            viewport.scrollLeft += screen.x - box.left - box.width / 2;
            viewport.scrollTop += screen.y - box.top - box.height / 2;
            screen = point.matrixTransform(svg.getScreenCTM());
          }
          return {x: screen.x, y: screen.y};
        }""", {"x": x, "y": y, "dx": dx, "dy": dy, "center": center})

    try:
        page.goto(BASE)
        page.wait_for_function("localStorage.getItem('gp.workbook.v2') !== null")
        report["build_scripts"] = page.locator("script[src]").evaluate_all("nodes => nodes.map(node => node.src)")
        source, graph = import_fixture()
        source_id, graph_id = source["id"], graph["id"]
        original_source = copy.deepcopy(source)
        expected_styles = copy.deepcopy(graph["graph"]["dataset_styles"])
        expect(page.locator("svg.plot canvas")).to_have_count(0)
        for i, column in enumerate(source["project"]["columns"][1:]):
            marks = page.locator(f'svg.plot g[data-dataset-id="{column["id"]}"] [data-observation="true"]')
            expect(marks).to_have_count(0 if column["name"] == "Hidden" else 1)
            if column["name"] != "Hidden":
                expect(marks).to_have_attribute("data-symbol", SHAPES[i])
                expect(marks).to_have_attribute("fill", COLORS[i])
        sparse_samples = raster_samples(False)
        validate_samples(sparse_samples)
        report["sparse_samples"] = sparse_samples
        page.screenshot(path=str(OUT / "sparse.png"))
        check("single-table import remaps source and graph styles to new IDs; sparse SVG shapes/colors/sizes")

        # Current non-modal Format Graph: selected-source fields and transaction.
        dialog = format_graph()
        dialog.get_by_label("Appearance data set", exact=True).select_option("2")
        expect(dialog.get_by_label("Apply scope", exact=True)).to_have_value("dataset")
        dialog.get_by_label("Shape:", exact=True).select_option("triangle")
        dialog.get_by_label("Size:", exact=True).select_option("9")
        dialog.get_by_role("button", name="Apply", exact=True).click()
        applied = book()
        target = source["project"]["columns"][2]
        expected_styles[target["id"]].update(symbol_shape="triangle", symbol_size=9)
        assert sheet(graph_id)["graph"]["dataset_styles"] == expected_styles
        dialog.get_by_label("Size:", exact=True).select_option("1")
        dialog.get_by_role("button", name="Cancel", exact=True).click()
        assert book() == applied
        page.get_by_role("button", name="Undo", exact=True).click()
        assert sheet(graph_id)["graph"] == graph["graph"]
        page.get_by_role("button", name="Redo", exact=True).click()
        assert book() == applied
        assert sheet(source_id) == original_source
        check("selected dataset Apply/edit/Cancel and undo/redo keep other styles and source cells")

        # An omitted source is still a valid owner of graph-local appearance.
        dialog = format_graph()
        dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
        dialog.get_by_role("listbox", name="Data sets plotted", exact=True).locator('[data-source-index="2"]').click()
        dialog.get_by_role("button", name="Remove", exact=True).click()
        dialog.get_by_role("button", name="OK", exact=True).click()
        removed = book()
        assert target["id"] not in sheet(graph_id)["datasetIds"]
        assert sheet(graph_id)["graph"]["dataset_styles"] == expected_styles
        with page.expect_download() as pending:
            page.get_by_role("button", name="Save workbook", exact=True).click()
        saved = Path(pending.value.path()).read_bytes()
        assert json.loads(saved) == removed
        page.reload()
        page.locator("svg.plot").wait_for()
        assert book() == removed
        import_file(saved, "omitted-styles.json")
        assert book() == removed
        dialog = format_graph()
        dialog.get_by_role("tab", name="Data Sets on Graph", exact=True).click()
        dialog.get_by_role("button", name="Add…", exact=True).click()
        dialog.get_by_label("Available data sets", exact=True).select_option("2")
        dialog.get_by_role("button", name="Add data set", exact=True).click()
        dialog.get_by_role("button", name="OK", exact=True).click()
        restored = book()
        assert sheet(graph_id)["graph"]["dataset_styles"] == expected_styles
        expect(page.locator(f'svg.plot g[data-dataset-id="{target["id"]}"] [data-observation="true"]')).to_have_attribute("data-symbol", "triangle")
        page.get_by_role("button", name="Undo", exact=True).click()
        assert book() == removed
        page.get_by_role("button", name="Redo", exact=True).click()
        assert book() == restored
        assert sheet(source_id) == original_source
        check("omitted styles survive save/reload/file import/re-addition and undo/redo by source ID")

        # A data-sheet copy owns new IDs; inherited defaults follow those IDs.
        select(source_id)
        old_ids = {item["id"] for item in book()["sheets"]}
        menu_action("Edit", "Duplicate sheet")
        page.wait_for_function("ids => JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.some(s => !ids.includes(s.id))", arg=list(old_ids))
        copied = next(item for item in book()["sheets"] if item["id"] not in old_ids)
        assert copied["kind"] == "data"
        originals = original_source["project"]["columns"]
        copies = copied["project"]["columns"]
        assert {c["id"] for c in originals}.isdisjoint(c["id"] for c in copies)
        for original, column in zip(originals, copies):
            assert (original["name"], original["values"]) == (column["name"], column["values"])
            if original["id"] in original_source["project"]["graph"]["dataset_styles"]:
                assert copied["project"]["graph"]["dataset_styles"][column["id"]] == original_source["project"]["graph"]["dataset_styles"][original["id"]]
        assert set(copied["project"]["graph"]["dataset_styles"]) == {c["id"] for c in copies[1:]}
        menu_action("Insert", "New graph of existing data")
        chooser = page.get_by_role("dialog", name="Change Graph Type", exact=True)
        expect(chooser.locator(".graph-type-preview svg.plot")).to_be_visible()
        chooser.get_by_role("button", name="OK", exact=True).click()
        copied_graph = sheet(book()["activeSheetId"])
        assert copied_graph["dataId"] == copied["id"]
        assert copied_graph["graph"]["dataset_styles"] == copied["project"]["graph"]["dataset_styles"]
        for column in copies[1:-1]:
            expect(page.locator(f'svg.plot g[data-dataset-id="{column["id"]}"] [data-observation="true"]')).to_have_count(1)
        assert sheet(source_id) == original_source
        assert sheet(graph_id)["graph"]["dataset_styles"] == expected_styles
        check("Duplicate sheet remaps styles without aliasing; new graph keeps them through first-view chooser")

        page.get_by_role("button", name="Export…", exact=True).click()
        export = page.get_by_role("dialog", name="Export", exact=True)
        export.get_by_label("File Format:", exact=True).select_option("svg")
        with page.expect_download(timeout=300000) as pending:
            export.get_by_role("button", name="Export", exact=True).click()
        assert pending.value.failure() is None
        pending.value.save_as(OUT / "copied-styles.svg")
        svg = (OUT / "copied-styles.svg").read_text()
        assert all(color in svg for color in COLORS[:4]) and COLORS[4] not in svg
        sent = requests + page.evaluate("window.__styleExportRequests || []")
        assert sent, "the real export must send its resolved appearance"
        styles = sent[-1]["graph"]["styles"]
        assert [style["symbol_shape"] for style in styles] == SHAPES
        assert [style["symbol_size"] for style in styles] == SIZES
        assert [style["symbol_color"] for style in styles] == COLORS
        assert [style["symbols"] for style in styles] == [True, True, True, True, False]
        check("current Export dialog sends copied appearance and SVG renders visible colors only")

        dense_source, dense_graph = import_fixture(True)
        dense_before = copy.deepcopy(dense_source)
        expect(page.locator('svg.plot canvas[aria-label^="5,008 observations"]')).to_have_count(1)
        expect(page.locator('svg.plot [data-observation="true"]')).to_have_count(0)
        dense_samples = raster_samples(True)
        validate_samples(dense_samples)
        report["dense_samples"] = dense_samples
        for sparse, dense in zip(sparse_samples, dense_samples):
            if sparse["inside"]:
                assert sparse["rgba"] == dense["rgba"], (sparse, dense)
        page.screenshot(path=str(OUT / "dense.png"))
        check("canvas draws 5,008 visible of 6,261 total observations with sparse symbol shape/size/color")

        # Hidden last-series points overlap Circle; they cannot intercept hits.
        point = point_location(20, 50, center=True)
        page.mouse.click(point["x"], point["y"])
        details = page.get_by_role("group", name="Point details", exact=True)
        expect(details).to_contain_text("Circle · Row 1")
        details.get_by_role("button", name="Go to cell", exact=True).click()
        expect(page.get_by_label("Circle, row 1", exact=True)).to_be_focused()
        expect(page.get_by_label("Circle, row 1", exact=True)).to_have_value("50")
        select(dense_graph["id"])
        point = point_location(90, 20, center=True)
        page.mouse.click(point["x"], point["y"])
        expect(details).to_have_count(0)
        page.get_by_label("Graph zoom preset", exact=True).select_option("200")
        expect(page.get_by_label("Graph zoom", exact=True)).to_have_value("200")
        # The tip is 11 graph units from center, outside the old 6-unit hit
        # tolerance at 200%, but inside a size-10 diamond's 12.24-unit extent.
        point = point_location(80, 50, dx=11, center=True)
        page.mouse.click(point["x"], point["y"])
        expect(details).to_contain_text("Diamond · Row 4")
        assert sheet(dense_source["id"]) == dense_before
        check("hidden overlap/isolated hits are excluded; large diamond tip selects correct source row at 200%")

        assert not report["page_errors"], report["page_errors"]
        assert not report["console_errors"], report["console_errors"]
        report["status"] = "passed"
    except Exception:
        report["status"] = "failed"
        report["failure"] = traceback.format_exc()
        try:
            page.screenshot(path=str(OUT / "failure.png"), full_page=True)
            report["failure_workbook"] = book()
        except Exception as capture_error:
            report["capture_error"] = str(capture_error)
        raise
    finally:
        report["finished_utc"] = datetime.now(timezone.utc).isoformat()
        report["elapsed_seconds"] = round(time.monotonic() - started, 3)
        report["artifacts"] = {path.name: {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                               for path in sorted(OUT.iterdir()) if path.is_file() and path.name != "report.json"}
        (OUT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        browser.close()
        print(f"Evidence: {OUT / 'report.json'}", flush=True)
