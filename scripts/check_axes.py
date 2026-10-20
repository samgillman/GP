"""Exercise GP's axis editing/persistence in a real browser (not native parity).
GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_axes.py URL
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

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

    def workbook():
        return json.loads(page.evaluate('localStorage.getItem("gp.workbook.v2")'))

    before = workbook()
    data_before = [s for s in before["sheets"] if s["kind"] == "data"]
    page.locator('[data-axis="y"] text').first.dblclick()
    dialog = page.get_by_role("dialog", name="Format Axes", exact=True)
    expect(dialog).to_be_visible()
    expect(dialog.get_by_role("tab", name="Left Y axis")).to_have_attribute("aria-selected", "true")
    dialog.get_by_label("Axis minimum", exact=True).fill("20")
    dialog.get_by_label("Axis maximum", exact=True).fill("10")
    expect(dialog.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    dialog.get_by_label("Axis maximum", exact=True).fill("80")
    dialog.get_by_label("Major tick interval", exact=True).fill("10")
    dialog.get_by_label("Axis direction", exact=True).select_option("reverse")
    dialog.get_by_label("Tick number format", exact=True).select_option("decimal")
    dialog.get_by_label("Tick decimal places", exact=True).select_option("2")
    dialog.get_by_label("Tick thousands separator", exact=True).select_option(",")
    dialog.get_by_label("Tick decimal separator", exact=True).select_option(",")
    expect(dialog.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    dialog.get_by_label("Tick decimal separator", exact=True).select_option("·")
    dialog.get_by_label("Tick prefix", exact=True).fill("$")
    dialog.get_by_label("Tick suffix", exact=True).fill(" µM")
    expect(dialog.get_by_label("Tick label example", exact=True)).to_have_text("$1,234·57 µM")
    dialog.get_by_label("Show major grid lines", exact=True).check()
    hostile = '<img src=x onerror="window.__axisInjected=1">'
    dialog.get_by_label("Axis title", exact=True).fill(hostile)
    dialog.get_by_role("button", name="OK", exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(page.locator("svg.plot")).to_contain_text(hostile)
    assert page.evaluate("window.__axisInjected") is None
    ticks = page.locator('[data-axis="y"] text')
    assert ticks.all_text_contents() == [f"${value}·00 µM" for value in range(20, 81, 10)]
    assert float(ticks.first.get_attribute("y")) < float(ticks.last.get_attribute("y"))
    after = workbook()
    assert [s for s in after["sheets"] if s["kind"] == "data"] == data_before
    graph = next(s for s in after["sheets"] if s["id"] == after["activeSheetId"])
    assert graph["graph"]["axes"]["y"]["reverse"]
    assert graph["graph"]["axes"]["y"]["numberFormat"] == {
        "decimals": 2, "decimalSeparator": "·", "thousandsSeparator": ",", "prefix": "$", "suffix": " µM",
    }
    page.get_by_role("button", name="Undo", exact=True).click()
    undone = workbook()
    assert next(s for s in undone["sheets"] if s["id"] == graph["id"])["graph"] == next(
        s for s in before["sheets"] if s["id"] == graph["id"])["graph"]
    page.get_by_role("button", name="Redo", exact=True).click()
    assert workbook() == after
    for format_name, signature in [("SVG", b"<?xml"), ("PNG", b"\x89PNG"), ("PDF", b"%PDF")]:
        print("Checking export", format_name, flush=True)
        page.locator(".desktop-menu > summary").filter(has_text="File").first.click()
        page.get_by_role("menuitem", name="Export…", exact=True).click()
        page.get_by_role("dialog", name="Export", exact=True).get_by_label("File Format:", exact=True).select_option(format_name.lower())
        try:
            with page.expect_download(timeout=int(os.environ.get("GP_AXES_EXPORT_TIMEOUT", "300000"))) as pending:
                page.get_by_role("dialog", name="Export", exact=True).get_by_role("button", name="Export", exact=True).click()
        except Exception:
            print("Page at export failure:", page.locator("body").inner_text(), flush=True)
            print("Page errors:", errors, flush=True)
            raise
        download = pending.value
        assert download.failure() is None
        content = Path(download.path()).read_bytes()
        assert content.startswith(signature), format_name
        if format_name == "SVG":
            assert b"window.__axisInjected" in content
        assert workbook() == after
    page.locator('[data-axis="y"] text').first.dblclick()
    dialog.get_by_label("Tick number format", exact=True).select_option("auto")
    expect(dialog.get_by_label("Tick prefix", exact=True)).to_have_count(0)
    dialog.get_by_role("button", name="OK", exact=True).click()
    automatic = workbook()
    assert "numberFormat" not in next(s for s in automatic["sheets"] if s["id"] == graph["id"])["graph"]["axes"]["y"]
    assert page.locator('[data-axis="y"] text').all_text_contents() == [str(v) for v in range(20, 81, 10)]
    page.get_by_role("button", name="Undo", exact=True).click()
    assert workbook() == after
    page.reload()
    page.locator("svg.plot").wait_for()
    assert workbook() == after
    page.locator('[data-axis="x"] text').first.dblclick()
    expect(dialog.get_by_role("tab", name="X axis", exact=True)).to_have_attribute("aria-selected", "true")
    expect(dialog.get_by_label("Axis minimum", exact=True)).to_have_count(0)
    dialog.get_by_label("Show axis line, ticks and tick labels", exact=True).uncheck()
    dialog.get_by_role("button", name="Cancel", exact=True).click()
    expect(page.locator('[data-axis="x"]')).to_have_count(1)
    assert workbook() == after
    if os.environ.get("GP_AXES_EVIDENCE"):
        destination = Path(os.environ["GP_AXES_EVIDENCE"])
        destination.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(destination / "configured-axes.png"))
        (destination / "browser-check.json").write_text(json.dumps({
            "url": sys.argv[1], "scope": "GP browser implementation, not native Prism parity",
            "export_timeout_ms": int(os.environ.get("GP_AXES_EXPORT_TIMEOUT", "300000")),
            "checks": ["axis entry/tabs", "invalid limits", "reversed ticks", "hostile title", "decimal numbering and separator validation", "restore automatic numbering",
                       "unchanged source", "undo/redo", "reload", "Cancel", "SVG/PNG/PDF downloads"],
            "page_errors": errors, "graph_axes": graph["graph"]["axes"],
        }, indent=2) + "\n")
    assert not errors, errors
    print("PASS: axis controls, validation, hostile title, source preservation, undo/redo, reload, Cancel and SVG/PNG/PDF exports")
    browser.close()
