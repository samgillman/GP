"""Browser acceptance for GP workbook identity and frozen-sheet contracts.

GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_workbook_foundations.py URL
GP_FOUNDATIONS_EVIDENCE selects the artifact directory (default /tmp/gp-foundations).
Run against dev/server first, then the completed static build. No API is mocked.
Only the deliberate v2 migration fixture is installed through browser storage;
all subsequent edits, calculation, freeze, save/open and export use the UI.
These checks establish GP behavior, not native Prism runtime equivalence.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import traceback
import xml.etree.ElementTree as ET

from playwright.sync_api import expect, sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5174"
OUT = Path(os.environ.get("GP_FOUNDATIONS_EVIDENCE", "/tmp/gp-foundations"))
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = "gp.workbook.v2"


def without_identity(book):
    """Recreate a genuine v2 fixture from a modern workbook.

    Older files have neither stable dataset IDs nor graph-local datasetColors,
    which was introduced after v2; leaving that modern metadata attached to
    generated v2 columns makes the legacy fixture internally contradictory.
    """
    result = copy.deepcopy(book)
    result["version"] = 2
    for sheet in result["sheets"]:
        if sheet["kind"] == "data":
            sheet.pop("rowIds", None)
            for column in sheet["project"]["columns"]:
                column.pop("id", None)
        else:
            sheet.pop("datasetIds", None)
            if sheet["kind"] == "graph":
                sheet.pop("datasetColors", None)
    return result


def svg_geometry(path):
    """Ignore renderer dates/random IDs, but retain all geometry, colors and text."""
    tree = ET.parse(path)
    items = []
    for node in tree.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag in {"path", "circle", "rect", "line", "polyline", "polygon", "text", "use"}:
            attrs = {key: value for key, value in node.attrib.items()
                     if key not in {"id", "clip-path"} and not key.endswith("}href")}
            items.append((tag, sorted(attrs.items()), node.text if tag == "text" else None))
    assert items, "Export contains no SVG geometry"
    return items


def main():
    checks, errors = [], []
    diagnostics = []
    last_book = None
    started = time.monotonic()
    with sync_playwright() as driver:
        browser = driver.chromium.launch(
            executable_path=os.environ.get("GP_CHROMIUM", "/usr/bin/chromium"),
            headless=True, args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(20000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        def diagnostic(kind, value):
            diagnostics.append({"kind": kind, "value": value})
            (OUT / "browser-events.json").write_text(json.dumps(diagnostics, indent=2))
        page.on("console", lambda message: diagnostic("console", {"type": message.type, "text": message.text}))
        page.on("requestfailed", lambda request: diagnostic("requestfailed", {"url": request.url, "failure": request.failure}))
        page.on("response", lambda response: diagnostic("http", {"url": response.url, "status": response.status}) if response.status >= 400 else None)
        page.on("worker", lambda worker: diagnostic("worker", worker.url))

        def book():
            nonlocal last_book
            last_book = page.evaluate("key => JSON.parse(localStorage.getItem(key))", STORAGE)
            return last_book

        def wait_book(predicate, description, timeout=120):
            (OUT / "progress.json").write_text(json.dumps({"pending": description, "passed": checks,
                "elapsed_seconds": round(time.monotonic() - started, 2)}, indent=2))
            deadline = time.monotonic() + timeout
            latest = None
            while time.monotonic() < deadline:
                latest = book()
                if latest is not None and predicate(latest):
                    return latest
                page.wait_for_timeout(80)
            raise AssertionError(f"Timed out: {description}; alerts={page.locator('.alert').all_text_contents()}")

        def sheet(identity, current=None):
            return next(s for s in (current or book())["sheets"] if s["id"] == identity)

        def select(identity):
            page.get_by_label("Current sheet", exact=True).select_option(identity)
            wait_book(lambda w: w["activeSheetId"] == identity, "selected sheet persisted")

        def cell(row, column):
            return page.locator(f'input[data-row="{row}"][data-column="{column}"]')

        def current_result(identity):
            return wait_book(lambda w: sheet(identity, w)["status"] == "current"
                             and sheet(identity, w)["result"] is not None,
                             "actual linked analysis completed")

        def toggle(frozen):
            page.get_by_role("button", name="Unfreeze sheet" if frozen else "Freeze sheet", exact=True).click()
            active = book()["activeSheetId"]
            wait_book(lambda w: bool(sheet(active, w).get("frozen")) is not frozen,
                      "freeze state persisted")

        def menu_action(menu, action):
            page.locator(".desktop-menu > summary").filter(has_text=re.compile(f"^{re.escape(menu)}$")).click()
            page.get_by_role("menu", name=f"{menu} menu", exact=True).get_by_role("menuitem", name=action, exact=True).click()

        def row_action(row, action):
            page.get_by_role("button", name=f"Select row {row + 1}", exact=True).click(button="right")
            page.get_by_role("menuitem", name=action, exact=True).click()

        def column_action(letter, action):
            page.get_by_role("button", name=f"Select column {letter}", exact=True).click(button="right")
            page.get_by_role("menuitem", name=action, exact=True).click()

        def copy_cells():
            return page.evaluate("""() => {
              const data = new DataTransfer();
              document.activeElement.dispatchEvent(new ClipboardEvent('copy', {
                clipboardData:data, bubbles:true, cancelable:true}));
              return data.getData('text/plain');
            }""")

        def paste_cells(text):
            page.evaluate("""text => {
              const data = new DataTransfer(); data.setData('text/plain', text);
              document.activeElement.dispatchEvent(new ClipboardEvent('paste', {
                clipboardData:data, bubbles:true, cancelable:true}));
            }""", text)

        def export_svg(filename):
            with page.expect_download(timeout=120000) as pending:
                menu_action("File", "Export graph as SVG…")
            destination = OUT / filename
            pending.value.save_as(destination)
            return svg_geometry(destination)

        def save(filename):
            with page.expect_download() as pending:
                page.get_by_role("button", name="Save workbook", exact=True).click()
            destination = OUT / filename
            pending.value.save_as(destination)
            return destination

        def duplicate(identity):
            select(identity)
            previous_ids = {s["id"] for s in book()["sheets"]}
            menu_action("Edit", "Duplicate sheet")
            after = wait_book(lambda w: len(w["sheets"]) == len(previous_ids) + 1,
                              "duplicated sheet persisted")
            return next(s for s in after["sheets"] if s["id"] not in previous_ids)

        try:
            page.goto(BASE)
            page.wait_for_selector(".data-grid-viewport")
            initial = wait_book(lambda w: w["version"] == 4, "initial v4 workbook")
            draft_id = initial["activeSheetId"]
            cell(0, 0).fill("-")
            wait_book(lambda w: sheet(draft_id, w)["project"]["columns"][0]["values"][0] == "-", "numeric draft saved")
            page.get_by_role("button", name="New Data Table and Graph", exact=True).click()
            new_table = page.get_by_role("dialog", name="New Data Table and Graph", exact=True)
            new_table.get_by_role("button", name="XY", exact=True).click()
            new_table.get_by_role("radio", name="Start with sample data", exact=True).check()
            new_table.get_by_role("button", name="Create table and graph", exact=True).click()
            ready = wait_book(lambda w: len([s for s in w["sheets"] if s["kind"] == "data"]) == 2, "XY sample created")
            data_id = ready["activeSheetId"]
            page.get_by_role("button", name="Analyze Data…", exact=True).click()
            analyze_dialog = page.get_by_role("dialog", name="Analyze Data", exact=True)
            analyze_dialog.get_by_role("radio", name="Linear regression", exact=True).check()
            analyze_dialog.get_by_role("button", name="Create analysis", exact=True).click()
            ready = wait_book(lambda w: any(s["kind"] == "results" and s["status"] == "current" for s in w["sheets"]), "UI analysis computed")
            result_id = next(s["id"] for s in ready["sheets"] if s["kind"] == "results")
            assert sheet(result_id)["result"]["fit"], "Actual linear fit must produce curves"
            select(result_id)
            page.get_by_role("button", name="New graph of existing data", exact=True).click()
            ready = wait_book(lambda w: any(s["kind"] == "graph" and s["resultId"] == result_id for s in w["sheets"]), "linked fitted graph created")
            graph_id = ready["activeSheetId"]
            page.get_by_role("button", name="Format Graph…", exact=True).first.click()
            dialog = page.get_by_role("dialog", name="Format Graph", exact=True)
            dialog.get_by_label("Title", exact=True).fill("Frozen fitted graph acceptance")
            dialog.get_by_role("button", name="OK", exact=True).click()
            ready = wait_book(lambda w: sheet(graph_id, w)["graph"]["title"] == "Frozen fitted graph acceptance", "graph settings saved")

            # The sole storage write: derive a legacy fixture from real UI outputs.
            legacy = without_identity(ready)
            (OUT / "legacy-v2.json").write_text(json.dumps(legacy, indent=2))
            page.evaluate("args => localStorage.setItem(args.key, JSON.stringify(args.book))", {"key": STORAGE, "book": legacy})
            page.reload()
            migrated = wait_book(lambda w: w["version"] == 4, "legacy v2 migrated")
            assert without_identity(migrated) == legacy, "Migration changed drafts, settings, results or references"
            ids = []
            for item in migrated["sheets"]:
                ids.append(item["id"])
                if item["kind"] == "data":
                    assert len(item["rowIds"]) == max(len(c["values"]) for c in item["project"]["columns"])
                    ids.extend(item["rowIds"])
                    ids.extend(c["id"] for c in item["project"]["columns"])
                else:
                    parent = sheet(item["dataId"], migrated)
                    assert item["datasetIds"] == [parent["project"]["columns"][i]["id"] for i in item["columnIndices"]]
            assert len(ids) == len(set(ids)) and all(isinstance(i, str) and i for i in ids)
            checks.append("v2 migration preserves exact drafts, graph settings, computed results and references; v3 identities are unique")

            select(data_id)
            data_before = copy.deepcopy(sheet(data_id))
            toggle(False)
            expect(cell(0, 1)).to_have_attribute("readonly", "")
            cell(0, 1).click()
            page.keyboard.type("999")
            page.keyboard.press("Delete")
            paste_cells("888\t777\n666\t555")
            expect(cell(0, 1)).to_have_value("3")
            assert copy_cells() == "3"
            page.keyboard.press("ArrowDown")
            expect(page.locator(".data-grid-cell.is-active input")).to_have_attribute("data-row", "1")
            expect(page.get_by_role("button", name="Exclude values", exact=True)).to_be_disabled()
            page.get_by_role("button", name="Select row 1", exact=True).click(button="right")
            for action in ["Insert row above", "Delete row", "Clear row"]:
                expect(page.get_by_role("menuitem", name=action, exact=True)).to_be_disabled()
            page.keyboard.press("Escape")
            page.get_by_role("button", name="Select column B", exact=True).click(button="right")
            for action in ["Insert column before", "Delete column", "Clear column"]:
                expect(page.get_by_role("menuitem", name=action, exact=True)).to_be_disabled()
            page.keyboard.press("Escape")
            assert sheet(data_id)["project"] == data_before["project"] and sheet(data_id)["rowIds"] == data_before["rowIds"]
            checks.append("frozen data rejects typing, Delete, paste and structure edits while copy and navigation work")
            page.get_by_role("button", name="Undo", exact=True).click()
            wait_book(lambda w: not sheet(data_id, w).get("frozen"), "freeze undo")
            page.get_by_role("button", name="Redo", exact=True).click()
            wait_book(lambda w: sheet(data_id, w).get("frozen"), "freeze redo")
            data_copy = duplicate(data_id)
            assert data_copy.get("frozen") and data_copy["rowIds"] != data_before["rowIds"]
            assert not ({c["id"] for c in data_copy["project"]["columns"]} & {c["id"] for c in data_before["project"]["columns"]})
            assert [c["values"] for c in data_copy["project"]["columns"]] == [c["values"] for c in data_before["project"]["columns"]]
            select(data_id)
            toggle(True)
            checks.append("freeze participates in undo/redo; duplicate frozen data retains values with independent identities")

            select(result_id)
            toggle(False)
            frozen_result = copy.deepcopy(sheet(result_id))
            result_copy = duplicate(result_id)
            assert result_copy.get("frozen")
            assert result_copy["result"] == frozen_result["result"]
            assert result_copy["frozenSource"] == frozen_result["frozenSource"]
            select(graph_id)
            toggle(False)
            frozen_graph = copy.deepcopy(sheet(graph_id))
            assert frozen_graph["frozenResult"]["result"] == frozen_result["result"]
            assert frozen_graph["frozenResult"]["result"]["fit"]
            expect(page.get_by_role("button", name="Format Graph…", exact=True).first).to_be_disabled()
            expect(page.get_by_role("button", name="Change Graph Type…", exact=True)).to_be_disabled()
            before_geometry = export_svg("frozen-before.svg")
            graph_copy = duplicate(graph_id)
            for key in ["graph", "frozenSource", "frozenResult", "datasetIds"]:
                assert graph_copy[key] == frozen_graph[key]
            assert graph_copy.get("frozen")
            checks.append("frozen fitted graph captures source, style and computed curves; duplication retains capture")

            select(data_id)
            cell(0, 1).fill("13")
            wait_book(lambda w: sheet(data_id, w)["project"]["columns"][1]["values"][0] == "13", "live source edited")
            assert sheet(data_id)["rowIds"] == data_before["rowIds"]
            assert [c["id"] for c in sheet(data_id)["project"]["columns"]] == [c["id"] for c in data_before["project"]["columns"]]
            assert sheet(result_id) == frozen_result and sheet(graph_id) == frozen_graph
            select(result_id)
            expect(page.get_by_role("button", name="Recalculate analysis", exact=True).first).to_be_disabled()
            toggle(True)
            current_result(result_id)
            thawed_result = sheet(result_id)
            assert thawed_result["result"] != frozen_result["result"]
            assert thawed_result["sourceRevision"] == sheet(data_id)["revision"]
            assert sheet(graph_id) == frozen_graph
            checks.append("frozen result survives source edit; unfreeze automatically recomputes actual fit without changing frozen graph")

            # Insertions shift positional indices, but existing scientific identities stay attached.
            select(data_id)
            stable = copy.deepcopy(sheet(data_id))
            row_action(0, "Insert row above")
            wait_book(lambda w: len(sheet(data_id, w)["rowIds"]) == len(stable["rowIds"]) + 1, "row inserted")
            after_row = sheet(data_id)
            assert after_row["rowIds"][1:] == stable["rowIds"]
            assert after_row["rowIds"][0] not in stable["rowIds"]
            column_action("B", "Insert column before")
            wait_book(lambda w: len(sheet(data_id, w)["project"]["columns"]) == 4, "column inserted")
            after_column = sheet(data_id)
            assert [c["id"] for c in after_column["project"]["columns"]][2:] == [c["id"] for c in stable["project"]["columns"]][1:]
            assert sheet(result_id)["datasetIds"] == thawed_result["datasetIds"]
            assert sheet(result_id)["columnIndices"] == [2, 3]
            select(graph_id)
            assert sheet(graph_id) == frozen_graph
            page.locator("circle").filter(has_text="Compound A, row 3:").click()
            page.get_by_role("button", name="Go to cell", exact=True).click()
            expect(page.locator(".data-grid-cell.is-active input")).to_have_attribute("data-row", "3")
            expect(page.locator(".data-grid-cell.is-active input")).to_have_attribute("data-column", "2")
            expect(cell(3, 2)).to_have_value("22")
            select(graph_id)
            expect(page.locator('[data-selected-point="true"]')).to_have_count(1)
            highlighted = page.locator('[data-selected-point="true"]')
            original_point = page.locator("circle").filter(has_text="Compound A, row 3:")
            assert highlighted.get_attribute("cx") == original_point.get_attribute("cx")
            assert highlighted.get_attribute("cy") == original_point.get_attribute("cy")
            select(data_id)
            checks.append("row and dataset insertion preserves identities and result selections; frozen graph Go to cell resolves shifted live identities")

            # Deleting an inserted row/column preserves every surviving original identity.
            row_action(0, "Delete row")
            wait_book(lambda w: sheet(data_id, w)["rowIds"] == stable["rowIds"], "inserted row deleted")
            column_action("B", "Delete column")
            wait_book(lambda w: len(sheet(data_id, w)["project"]["columns"]) == 3, "inserted column deleted")
            assert [c["id"] for c in sheet(data_id)["project"]["columns"]] == [c["id"] for c in stable["project"]["columns"]]
            assert sheet(result_id)["datasetIds"] == thawed_result["datasetIds"]
            row_action(2, "Delete row")
            wait_book(lambda w: stable["rowIds"][2] not in sheet(data_id, w)["rowIds"], "original point row deleted")
            select(graph_id)
            page.locator("circle").filter(has_text="Compound A, row 3:").click()
            page.get_by_role("button", name="Go to cell", exact=True).click()
            expect(page.get_by_text("This point's original source cell no longer exists in the current data table.", exact=True)).to_be_visible()
            assert book()["activeSheetId"] == graph_id
            checks.append("deletions preserve surviving identities; deleted snapshot point is rejected instead of navigating to a different observation")

            current_result(result_id)
            saved = save("frozen-workbook-v3.json")
            persisted = json.loads(saved.read_text())
            assert persisted["version"] == 4 and sheet(graph_id, persisted) == frozen_graph
            page.reload()
            wait_book(lambda w: w["activeSheetId"] == graph_id, "frozen graph restored")
            assert sheet(graph_id) == frozen_graph
            after_geometry = export_svg("frozen-after-reload.svg")
            assert before_geometry == after_geometry, "Frozen export geometry changed after live data edits/reload"
            page.locator('input[type=file][accept=".json"]').set_input_files(saved)
            wait_book(lambda w: w == persisted, "saved workbook reopened exactly")
            assert export_svg("frozen-after-open.svg") == before_geometry
            checks.append("frozen source/style/fit survive JSON save, reload and reopen; SVG exports retain snapshot geometry")
            page.screenshot(path=str(OUT / "frozen-graph.png"))
            toggle(True)
            thawed_graph = sheet(graph_id)
            assert not thawed_graph.get("frozen") and "frozenSource" not in thawed_graph and "frozenResult" not in thawed_graph
            expect(page.get_by_role("button", name="Format Graph…", exact=True).first).to_be_enabled()
            assert export_svg("thawed-current.svg") != before_geometry
            checks.append("unfreezing graph restores live source/result rendering and editable graph controls")
            assert not errors, errors
            report = {"url": BASE, "passed": checks, "page_errors": errors,
                      "elapsed_seconds": round(time.monotonic() - started, 2),
                      "artifacts": [p.name for p in OUT.iterdir() if p.is_file()],
                      "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
            (OUT / "results.json").write_text(json.dumps(report, indent=2))
            print(json.dumps(report, indent=2))
        except Exception as error:
            # Persist the original failure before diagnostic browser calls: an
            # overloaded/crashed renderer may also fail to capture a screenshot.
            failure = {"url": BASE, "passed": checks, "error": repr(error),
                       "traceback": traceback.format_exc(), "page_errors": errors}
            (OUT / "failure.json").write_text(json.dumps(failure, indent=2))
            (OUT / "failure-workbook.json").write_text(json.dumps(last_book, indent=2))
            try:
                (OUT / "failure-body.txt").write_text(page.locator("body").inner_text(timeout=3000))
            except Exception as diagnostic_error:
                failure["body_error"] = repr(diagnostic_error)
            try:
                page.screenshot(path=str(OUT / "failure.png"), full_page=True, timeout=3000)
            except Exception as diagnostic_error:
                failure["screenshot_error"] = repr(diagnostic_error)
            (OUT / "failure.json").write_text(json.dumps(failure, indent=2))
            raise
        finally:
            browser.close()


if __name__ == "__main__":
    main()
