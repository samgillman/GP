"""Exercise the Column t test / one-way ANOVA workflow in Chromium with actual calculations.
Run: GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_column_analysis.py URL
Covers Analyze -> parameters dialog -> tabbed results, changing parameters on an existing
result, pairwise brackets on the linked graph that follow data edits, reload persistence,
bracket export, and (static build) the background engine warm-up. Reference values come
from SciPy, not from GP. Optional GP_COLUMN_EVIDENCE=path.json records the observations.
"""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from scipy import stats

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
evidence = {"url": base, "checks": []}
KEY = "gp.workbook.v2"
GROUPS = {"Control": [4.1, 5.2, 4.8, 5.5, 4.9], "Drug A": [5.0, 6.1, 5.4, 6.4, 5.2], "Drug B": [6.3, 7.0, 6.1, 7.6, 6.2]}
T_TEST = "t tests (and nonparametric tests)"
ANOVA = "One-way ANOVA (and nonparametric or mixed)"


def check(name, **details):
    evidence["checks"].append({"name": name, **details})
    print("PASS", name, flush=True)


def p_text(p):
    return "<0.0001" if p < 1e-4 else f"{p:.4f}"


def summary(p):
    return "****" if p <= 1e-4 else "***" if p <= 1e-3 else "**" if p <= .01 else "*" if p <= .05 else "ns"


def tukey(groups):
    names = list(groups)
    result = stats.tukey_hsd(*[list(map(float, v)) for v in groups.values()])
    return {(i, j): float(result.pvalue[i, j]) for i in range(len(names)) for j in range(i + 1, len(names))}


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("GP_CHROMIUM"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
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

    def requests(path):
        sent = network + page.evaluate("window.__gpRequests || []")
        return [item["body"] for item in sent if item["path"] == path]

    page.goto(base)
    page.wait_for_function(f'localStorage.getItem("{KEY}") !== null')
    static = page.evaluate("window.__gpRequests.length") > 0 or not page.evaluate(
        "fetch('/api/health').then(r => r.ok).catch(() => false)")

    def book():
        return page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')

    def sheet(sheet_id):
        return next(s for s in book()["sheets"] if s["id"] == sheet_id)

    def menu(name, action):
        page.locator(".desktop-menu > summary").filter(has_text=name).first.click()
        page.get_by_role("menu", name=f"{name} menu", exact=True).get_by_role("menuitem", name=action, exact=True).click()

    def show(sheet_id):
        page.get_by_label("Current sheet", exact=True).select_option(sheet_id)

    def wait_result(analysis, count):
        """Wait until `count` current results of `analysis` exist; return the newest."""
        page.wait_for_function(
            '([a, n]) => JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets'
            '.filter(s => s.kind === "results" && s.analysis === a && s.status === "current").length === n',
            arg=[analysis, count], timeout=300000)
        return [s for s in book()["sheets"] if s["kind"] == "results" and s["analysis"] == analysis][-1]

    def wait_current(sheet_id):
        page.wait_for_function(
            '(id) => JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s => s.id === id)?.status === "current"',
            arg=sheet_id, timeout=300000)
        return sheet(sheet_id)

    def page_rows(title):
        return page.get_by_role("table", name=title, exact=True).evaluate(
            "(t) => [...t.tBodies[0].rows].map(r => [...r.cells].slice(1).map(c => c.textContent.trim()))")

    def value(rows, label):
        return next(r[1] for r in rows if len(r) > 1 and r[0] == label)

    def tabs():
        return page.get_by_role("tablist", name="Results pages", exact=True).get_by_role("tab").all_text_contents()

    def analyze(choice, uncheck=()):
        page.get_by_role("button", name="Analyze Data…", exact=True).click()
        dialog = page.get_by_role("dialog", name="Analyze Data", exact=True)
        dialog.get_by_role("radio", name=choice, exact=True).check()
        for name in uncheck:
            dialog.get_by_label(name, exact=True).uncheck()
        dialog.get_by_role("button", name="Create analysis", exact=True).click()
        parameters = page.get_by_role("dialog", name=f"Parameters: {choice}", exact=True)
        expect(parameters).to_be_visible()
        return parameters

    # Warm-up: the website starts its Python engine before the first analysis.
    status = page.locator(".status-save")
    if static:
        expect(status).not_to_have_text("Loading analysis engine…", timeout=300000)
        assert requests("/api/warmup"), "static build did not warm up its engine"
    else:
        expect(status).not_to_have_text("Loading analysis engine…")
        assert not requests("/api/warmup")
    check("engine warm-up", static=static, warmup_requests=len(requests("/api/warmup")))

    csv = ",".join(GROUPS) + "\n" + "\n".join(",".join(str(v[i]) for v in GROUPS.values()) for i in range(5))
    page.locator('input[type=file]:not([accept=".json"])').set_input_files(
        {"name": "groups.csv", "mimeType": "text/csv", "buffer": csv.encode()})
    page.wait_for_function('JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.some(s => s.name === "groups")')
    data_id = next(s["id"] for s in book()["sheets"] if s["kind"] == "data" and s["name"] == "groups")
    graph_id = next(s["id"] for s in book()["sheets"] if s["kind"] == "graph" and s["dataId"] == data_id)

    # A t test needs exactly two data sets; the dialog says so before any calculation.
    parameters = analyze(T_TEST)
    expect(parameters.get_by_text("t tests compare exactly two data sets; 3 are selected.")).to_be_visible()
    expect(parameters.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    parameters.get_by_role("button", name="Cancel", exact=True).click()
    assert not [s for s in book()["sheets"] if s["kind"] == "results" and s["analysis"] == "t_test"]
    check("t test parameters refuse three data sets before calculating")

    parameters = analyze(T_TEST, uncheck=["Drug B"])
    assert parameters.get_by_role("tab").all_text_contents() == ["Experimental Design", "Options"]
    expect(parameters.get_by_role("radio", name="Unpaired", exact=True)).to_be_checked()
    expect(parameters).to_contain_text("Test: Unpaired t test")
    parameters.get_by_role("button", name="OK", exact=True).click()
    t_result = wait_result("t_test", 1)
    assert t_result["name"] == "Unpaired t test of groups", t_result["name"]
    assert tabs() == ["Unpaired t test", "Descriptive statistics"], tabs()
    rows = page_rows("Unpaired t test")
    reference = stats.ttest_ind(GROUPS["Drug A"], GROUPS["Control"])
    assert rows[0] == ["Table Analyzed", "groups"], rows[0]
    assert value(rows, "P value") == p_text(reference.pvalue), rows
    assert value(rows, "t, df") == f"t={reference.statistic:.4g}, df=8", rows
    check("unpaired t test result page matches SciPy", p=value(rows, "P value"), t=value(rows, "t, df"))

    # Changing parameters keeps the same result sheet and recalculates it.
    page.get_by_role("button", name="Parameters…", exact=True).click()
    parameters = page.get_by_role("dialog", name=f"Parameters: {T_TEST}", exact=True)
    parameters.get_by_role("radio", name="Unpaired t test with Welch's correction. Do not assume equal SDs.", exact=True).check()
    parameters.get_by_role("button", name="OK", exact=True).click()
    page.wait_for_function(
        '(id) => {const s = JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s => s.id === id);'
        ' return s.status === "current" && s.options.equal_sd === false}', arg=t_result["id"], timeout=300000)
    welch = sheet(t_result["id"])
    assert welch["name"] == "Welch's t test of groups", welch["name"]
    assert len([s for s in book()["sheets"] if s["kind"] == "results" and s["analysis"] == "t_test"]) == 1
    expect(page.get_by_role("tab", name="Unpaired t test with Welch's correction", exact=True)).to_be_visible()
    rows = page_rows("Unpaired t test with Welch's correction")
    reference = stats.ttest_ind(GROUPS["Drug A"], GROUPS["Control"], equal_var=False)
    assert value(rows, "P value") == p_text(reference.pvalue), rows
    check("Parameters… changes the existing result to Welch's t test", p=value(rows, "P value"))

    # One-way ANOVA with Tukey's comparisons on all three groups.
    show(data_id)
    parameters = analyze(ANOVA)
    assert parameters.get_by_role("tab").all_text_contents() == ["Experimental Design", "Multiple Comparisons", "Options"]
    expect(parameters).to_contain_text("Test: Ordinary one-way ANOVA")
    parameters.get_by_role("tab", name="Options", exact=True).click()
    expect(parameters.get_by_label("Multiple comparisons test", exact=True)).to_have_value("tukey")
    parameters.get_by_role("button", name="OK", exact=True).click()
    anova = wait_result("one_way_anova", 1)
    assert anova["name"] == "Ordinary one-way ANOVA of groups", anova["name"]
    assert tabs() == ["ANOVA results", "ANOVA table", "Multiple comparisons", "Descriptive statistics"], tabs()
    reference = stats.f_oneway(*GROUPS.values())
    rows = page_rows("ANOVA results")
    shown_f = float(value(rows, "F"))
    assert abs(shown_f / reference.statistic - 1) < 1e-3, rows
    assert value(rows, "P value") == p_text(reference.pvalue), rows
    page.get_by_role("tab", name="Multiple comparisons", exact=True).click()
    rows = page_rows("Multiple comparisons")
    expected = tukey(GROUPS)
    names = list(GROUPS)
    shown = {r[0]: (r[-2], float(r[-1])) for r in rows}
    for (i, j), pvalue in expected.items():
        label, adjusted = shown[f"{names[i]} vs. {names[j]}"]
        assert abs(adjusted - pvalue) < 6e-5 and label == summary(pvalue), (rows, expected)
    check("one-way ANOVA tabs, F and Tukey adjusted P values match SciPy", F=shown_f,
          tukey={f"{names[i]} vs. {names[j]}": round(pv, 4) for (i, j), pv in expected.items()})

    # Pairwise comparisons on the graph come from the ANOVA result.
    show(graph_id)
    page.get_by_role("button", name="Add Pairwise Comparisons…", exact=True).click()
    dialog = page.get_by_role("dialog", name="Add Pairwise Comparisons", exact=True)
    dialog.get_by_label("Comparison analysis", exact=True).select_option(anova["id"])
    dialog.get_by_role("button", name="OK", exact=True).click()
    labels = page.locator("svg.plot .pairwise-label")
    expect(labels).to_have_count(3)
    assert sorted(labels.all_text_contents()) == sorted(summary(pv) for pv in expected.values())
    assert page.locator("svg.plot .pairwise-bracket").count() == 3
    saved_graph = sheet(graph_id)
    assert saved_graph["resultId"] == anova["id"] and saved_graph["graph"]["pairwise"] == {"style": "asterisks", "show_ns": True}
    check("graph shows one bracket per Tukey comparison", labels=sorted(labels.all_text_contents()))

    menu("Change", "Add Pairwise Comparisons…")
    dialog = page.get_by_role("dialog", name="Add Pairwise Comparisons", exact=True)
    dialog.get_by_role("radio", name="P values", exact=True).check()
    dialog.get_by_label("Show non-significant comparisons", exact=True).uncheck()
    dialog.get_by_role("button", name="OK", exact=True).click()
    significant = sorted(f"P={pv:.4f}" for pv in expected.values() if pv <= .05)
    expect(labels).to_have_count(len(significant))
    assert sorted(labels.all_text_contents()) == significant, labels.all_text_contents()
    check("P-value labels and hidden non-significant comparisons", labels=significant)

    # Editing the data recalculates the ANOVA, and the brackets follow it.
    show(data_id)
    page.get_by_label("Drug A, row 1", exact=True).fill("8.4")
    page.wait_for_function(
        '(id) => {const s = JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s => s.id === id);'
        ' return s.status === "current" && s.result.summary[1].mean > 6}', arg=anova["id"], timeout=300000)
    edited = {**GROUPS, "Drug A": [8.4] + GROUPS["Drug A"][1:]}
    expected = tukey(edited)
    significant = sorted(f"P={pv:.4f}" for pv in expected.values() if pv <= .05)
    show(graph_id)
    expect(labels).to_have_count(len(significant))
    assert sorted(labels.all_text_contents()) == significant, (labels.all_text_contents(), significant)
    check("brackets follow the recalculated ANOVA after a data edit", labels=significant)

    page.reload()
    show(graph_id)
    expect(labels).to_have_count(len(significant))
    check("pairwise brackets persist across reload")

    with page.expect_download(timeout=300000) as pending:
        menu("File", "Export graph as SVG…")
    sent = requests("/api/export")[-1]
    assert "pairwise" not in sent["graph"], sent["graph"]
    assert sorted(a["label"] for a in sent["graph"]["annotations"]) == significant, sent["graph"]
    svg = Path(pending.value.path()).read_text()
    assert all(label in svg for label in significant), "exported SVG lacks bracket labels"
    check("SVG export draws the same brackets", annotations=sent["graph"]["annotations"])

    assert not errors, errors
    browser.close()

if os.environ.get("GP_COLUMN_EVIDENCE"):
    Path(os.environ["GP_COLUMN_EVIDENCE"]).parent.mkdir(parents=True, exist_ok=True)
    Path(os.environ["GP_COLUMN_EVIDENCE"]).write_text(json.dumps(evidence, indent=2) + "\n")
print("Column analysis workflow confirmed", flush=True)
