"""Check GP axis dialog/label geometry in Chromium; not native visual parity."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.set_default_timeout(120000)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(sys.argv[1])
    page.get_by_role("button", name="Show graph", exact=True).click()
    page.locator('[data-axis="y"] text').first.dblclick()
    dialog = page.get_by_role("dialog", name="Format Axes", exact=True)
    dialog.get_by_label("Tick number format", exact=True).select_option("decimal")
    dialog.get_by_label("Tick prefix", exact=True).fill("$")
    dialog.get_by_label("Tick suffix", exact=True).fill(" µM")
    dialog.get_by_label("Axis title", exact=True).fill("Response")
    body = dialog.locator(".desktop-dialog-body")
    assert body.evaluate("(el) => el.scrollHeight <= el.clientHeight + 1"), "Desktop dialog needs vertical scrolling"
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1"), "Dialog overflows horizontally"
    folder = os.environ.get("GP_AXIS_LAYOUT_EVIDENCE")
    if folder:
        Path(folder).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(Path(folder) / "desktop-dialog.png"))
    dialog.get_by_role("button", name="OK", exact=True).click()
    # Measure the actual SVG text, including its transform and rendered font.
    page.wait_for_function("""() => {
      const title = [...document.querySelectorAll('svg.plot .axis-label')].find(e => e.textContent === 'Response');
      const ticks = [...document.querySelectorAll('[data-axis="y"] text')];
      if (!title || !ticks.length) return false;
      const right = title.getBoundingClientRect().right;
      return ticks.every(e => e.getBoundingClientRect().left >= right + 3);
    }""")
    if folder:
        page.screenshot(path=str(Path(folder) / "formatted-graph.png"))
    page.locator('[data-axis="y"] text').first.dblclick()
    page.set_viewport_size({"width": 390, "height": 844})
    expect(dialog).to_be_visible()
    assert dialog.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1"), "Narrow dialog overflows horizontally"
    box = dialog.bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 391
    dialog.get_by_label("Tick suffix", exact=True).fill(" mg")
    dialog.get_by_role("button", name="OK", exact=True).click()
    expect(dialog).not_to_be_visible()
    assert errors == [], errors
    browser.close()
    print("PASS: compact desktop dialog, readable Y labels, narrow-screen editing; zero page errors")
