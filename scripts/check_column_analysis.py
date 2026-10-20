"""Exercise the Column t test / one-way ANOVA workflow in Chromium with actual calculations.
Run: GP_CHROMIUM=/usr/bin/chromium python3 scripts/check_column_analysis.py URL
Covers Analyze -> parameters dialog -> tabbed results, changing parameters on an existing
result, pairwise brackets on the linked graph that follow data edits, reload persistence,
bracket export, directional tests, rank-test disclosures, repeated-measures safeguards,
and (static build) engine warm-up. These checks do not establish native Prism parity.
Reference values come from SciPy or independent identities, not from GP.
Optional GP_COLUMN_EVIDENCE=path.json records the observations.
"""
import json
import math
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
ANOVA = "One-way ANOVA (and nonparametric tests)"


def check(name, **details):
    evidence["checks"].append({"name": name, **details})
    print("PASS", name, flush=True)


def p_text(p):
    return "<0.0001" if p < 1e-4 else ">0.9999" if p > .9999 else f"{p:.4f}"


def p_label(p):
    text = p_text(p)
    return "P" + text if text[0] in "<>" else "P=" + text


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

    def capture(name, locator):
        """Retain the specific warning being tested beside the JSON evidence."""
        if os.environ.get("GP_COLUMN_EVIDENCE"):
            destination = Path(os.environ["GP_COLUMN_EVIDENCE"])
            destination = destination.with_name(f"{destination.stem}-{name}.png")
            destination.parent.mkdir(parents=True, exist_ok=True)
            locator.screenshot(path=str(destination))
            evidence.setdefault("screenshots", []).append({"name": name, "path": str(destination)})

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
        page.wait_for_function('(id) => JSON.parse(localStorage.getItem("gp.workbook.v2")).activeSheetId === id', arg=sheet_id)

    def wait_result(analysis, source_id):
        """Each scenario creates one result of this family on its own source table.

        Scope the wait to that source, so a stale/failed unrelated analysis can
        neither satisfy the wait nor make a global result count hang.
        """
        page.wait_for_function(
            '([a, id]) => JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets'
            '.some(s => s.kind === "results" && s.analysis === a && s.dataId === id && s.status === "current" && s.result)',
            arg=[analysis, source_id], timeout=300000)
        found = [s for s in book()["sheets"] if s["kind"] == "results" and s["analysis"] == analysis and s["dataId"] == source_id]
        assert len(found) == 1, [(s["id"], s["status"]) for s in found]
        return found[0]

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
    t_result = wait_result("t_test", data_id)
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
    anova = wait_result("one_way_anova", data_id)
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
    dialog.get_by_label("Show comparisons that do not meet the analysis alpha", exact=True).uncheck()
    dialog.get_by_role("button", name="OK", exact=True).click()
    significant = sorted(p_label(pv) for pv in expected.values() if pv < .05)
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
    significant = sorted(p_label(pv) for pv in expected.values() if pv < .05)
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

    # Fixed star thresholds must not decide which comparisons meet user alpha.
    original_comparisons = sheet(anova["id"])["result"]["comparisons"]
    original_ps = [c["p"] for c in original_comparisons]
    assert any(.05 < pv < .1 for pv in original_ps), "alpha=.10 must reveal a comparison labeled ns"
    assert any(.01 < pv < .05 for pv in original_ps), "alpha=.01 must hide a comparison labeled with a star"
    for alpha in (0.1, 0.01):
        show(anova["id"])
        page.get_by_role("button", name="Parameters…", exact=True).click()
        parameters = page.get_by_role("dialog", name=f"Parameters: {ANOVA}", exact=True)
        parameters.get_by_role("tab", name="Options", exact=True).click()
        parameters.get_by_label("Significance level (alpha)", exact=True).select_option(str(alpha))
        expect(parameters).to_contain_text("confidence intervals remain 95%")
        parameters.get_by_role("button", name="OK", exact=True).click()
        page.wait_for_function(
            '([id, a]) => {const s=JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s=>s.id===id);'
            'return s.status === "current" && s.options.alpha === a}', arg=[anova["id"], alpha], timeout=300000)
        current = sheet(anova["id"])
        assert current["options"]["method"] == "tukey" and current["options"]["comparisons"] == "all_pairs"
        assert current["result"]["comparisons"] == original_comparisons
        show(graph_id)
        alpha_labels = sorted(p_label(pv) for pv in expected.values() if pv < alpha)
        expect(labels).to_have_count(len(alpha_labels))
        assert sorted(labels.all_text_contents()) == alpha_labels
    check("bracket visibility uses selected alpha without changing the correction family or P values")

    show(t_result["id"])
    page.get_by_role("button", name="Parameters…", exact=True).click()
    parameters = page.get_by_role("dialog", name=f"Parameters: {T_TEST}", exact=True)
    parameters.get_by_role("tab", name="Options", exact=True).click()
    parameters.get_by_role("radio", name="One-tailed P value", exact=True).check()
    expect(parameters.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    expect(parameters.get_by_role("alert")).to_contain_text("prespecified direction")
    parameters.get_by_label("Prespecified directional hypothesis", exact=True).select_option("a_greater")
    expect(parameters.get_by_role("button", name="OK", exact=True)).to_be_enabled()
    parameters.get_by_role("button", name="OK", exact=True).click()
    page.wait_for_function(
        '(id) => {const s=JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s=>s.id===id);'
        'return s.status === "current" && s.options.alternative === "a_greater"}', arg=t_result["id"], timeout=300000)
    directional = sheet(t_result["id"])
    directional_p = next(r["value"] for r in directional["result"]["results"] if r["label"] == "P value")
    reference_p = stats.ttest_ind(edited["Control"], edited["Drug A"], equal_var=False, alternative="greater").pvalue
    assert directional_p > 0.5 and abs(directional_p - reference_p) < 1e-10
    expect(page.get_by_role("tab", name="Unpaired t test with Welch's correction", exact=True)).to_be_visible()
    assert value(page_rows("Unpaired t test with Welch's correction"), "One- or two-tailed P value?") == "One-tailed: A > B"
    check("one-tailed analysis requires direction and uses the opposite-effect tail", p=directional_p)

    # Version metadata must invalidate old cached numeric outputs, not relabel them.
    expect(status).to_have_text("Saved in browser")
    page.evaluate('''(id) => {
      const key="gp.workbook.v2", b=JSON.parse(localStorage.getItem(key));
      const s=b.sheets.find(s=>s.id===id);
      delete s.result.analysis_revision;
      s.result.results.find(r=>r.label==="P value").value=0.123456789;
      localStorage.setItem(key, JSON.stringify(b));
    }''', t_result["id"])
    seeded = sheet(t_result["id"])["result"]
    assert "analysis_revision" not in seeded
    assert next(r["value"] for r in seeded["results"] if r["label"] == "P value") == 0.123456789
    network.clear()
    page.reload()
    page.wait_for_function(
        '(id) => {const s=JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.find(s=>s.id===id);'
        'return s.status === "current" && s.result?.analysis_revision === 2}', arg=t_result["id"], timeout=300000)
    restored_p = next(r["value"] for r in sheet(t_result["id"])["result"]["results"] if r["label"] == "P value")
    assert abs(restored_p - reference_p) < 1e-10
    assert any(body.get("analysis") == "t_test" and body.get("options", {}).get("alternative") == "a_greater"
               for body in requests("/api/analyze")), "old numeric output was not recalculated through the analysis engine"
    check("pre-audit cached results are recalculated on reopen")

    def import_audit_table(name, groups):
        rows = max(map(len, groups.values()))
        csv = ",".join(groups) + "\n" + "\n".join(
            ",".join(str(v[i]) if i < len(v) and v[i] is not None else "" for v in groups.values()) for i in range(rows))
        page.locator('input[type=file]:not([accept=".json"])').set_input_files(
            {"name": name + ".csv", "mimeType": "text/csv", "buffer": csv.encode()})
        page.wait_for_function('(name)=>JSON.parse(localStorage.getItem("gp.workbook.v2")).sheets.some(s=>s.kind==="data"&&s.name===name)', arg=name)
        source_id = next(s["id"] for s in book()["sheets"] if s["kind"] == "data" and s["name"] == name)
        show(source_id)
        return source_id

    for name, groups, family, paired, expected_p, warning, table_name in [
        ("audit-mw-ties", {"A": [1, 1, 1], "B": [2, 2, 2]}, T_TEST, False, 0.04685417760387376, "Mann-Whitney ties", "Mann Whitney test"),
        ("audit-kw-small", {"A": [1, 2], "B": [3, 4], "C": [5, 6, 7]}, ANOVA, False, 0.06866117151308508, "Small-sample Kruskal-Wallis", "Kruskal-Wallis test"),
        ("audit-friedman-ties", {"A": [1, 1, 1], "B": [1, 1, 1], "C": [2, 2, 2]}, ANOVA, True, 0.04978706836786395, "Small-design Friedman", "Friedman test"),
    ]:
        source_id = import_audit_table(name, groups)
        analysis = "t_test" if family == T_TEST else "one_way_anova"
        parameters = analyze(family)
        parameters.get_by_role("radio", name="No. Use nonparametric test.", exact=True).check()
        if paired:
            parameters.get_by_role("radio", name="Each row represents matched, or repeated measures, data", exact=True).check()
        parameter_notes = parameters.locator(".analysis-method-notes")
        expect(parameter_notes).to_be_visible()
        expect(parameter_notes).to_contain_text("approximation")
        if family == ANOVA:
            parameters.get_by_role("tab", name="Multiple Comparisons", exact=True).click()
            parameters.get_by_role("radio", name="No multiple comparisons", exact=True).check()
        parameters.get_by_role("button", name="OK", exact=True).click()
        out = wait_result(analysis, source_id)
        p_value = next(r["value"] for r in out["result"]["results"] if r["label"] == "P value")
        assert abs(p_value - expected_p) < 1e-10
        assert any(warning in w for w in out["result"]["warnings"])
        result_notes = page.locator('.result-notes[role="note"][aria-label="Method and limitations"]')
        expect(result_notes).to_be_visible()
        expect(result_notes).to_contain_text(warning)
        page.get_by_role("tab", name=table_name, exact=True).click()
        assert value(page_rows(table_name), "Exact or approximate P value?") == "Approximate"
        if name == "audit-mw-ties":
            capture("mann-whitney-ties-notice", page.locator(".results-card"))
        check(name + " shows approximation disclosure with the actual numerical result", p=p_value)

    # A two-observation control makes the Dunnett correlations nearly one.
    # This exercises adaptive integration in both server SciPy and Pyodide;
    # an integration error above .05 would reverse the reference conclusion.
    control_sd = math.sqrt(.5)
    treatment_sd = math.sqrt(999 / 1000)
    treatment_mean = 2 * math.sqrt(.501)
    treatment = [treatment_mean + (-treatment_sd if i % 2 == 0 else treatment_sd) for i in range(1000)]
    dunnett_id = import_audit_table("audit-dunnett-unbalanced", {
        "A": [-control_sd, control_sd], "B": treatment, "C": treatment,
    })
    parameters = analyze(ANOVA)
    parameters.get_by_role("tab", name="Multiple Comparisons", exact=True).click()
    parameters.get_by_role("radio", name="Compare the mean of each column with the mean of a control column", exact=True).check()
    parameters.get_by_label("Control column", exact=True).select_option("0")
    parameters.get_by_role("tab", name="Options", exact=True).click()
    parameters.get_by_label("Multiple comparisons test", exact=True).select_option("dunnett")
    parameters.get_by_role("button", name="OK", exact=True).click()
    dunnett = wait_result("one_way_anova", dunnett_id)
    comparisons = dunnett["result"]["comparisons"]
    assert [(c["a"], c["b"]) for c in comparisons] == [(0, 1), (0, 2)]
    for comparison in comparisons:
        assert abs(comparison["p"] - 0.04836123459) < 2e-6, comparisons
        assert comparison["p"] < .05 and comparison["summary"] == "*", comparisons
    page.get_by_role("tab", name="Multiple comparisons", exact=True).click()
    for row in page_rows("Multiple comparisons"):
        assert row[-3:] == ["Yes", "*", "0.0484"], row
    check("unbalanced Dunnett adaptive integration preserves the .05 significance decision", adjusted_p=[c["p"] for c in comparisons])

    rm_id = import_audit_table("audit-rm", {"A": [0] * 6, "B": [1, 2, 1, 2, 1, 2], "C": [-10, 10, -20, 20, -30, 30]})
    parameters = analyze(ANOVA)
    parameters.get_by_role("radio", name="Each row represents matched, or repeated measures, data", exact=True).check()
    # A previously chosen Tukey method must remain visibly unsupported under GG.
    expect(parameters.get_by_role("button", name="OK", exact=True)).to_be_disabled()
    expect(parameters.get_by_role("alert")).to_contain_text("Tukey is not supported")
    parameters.get_by_role("tab", name="Options", exact=True).click()
    method = parameters.get_by_label("Multiple comparisons test", exact=True)
    expect(method).to_have_value("tukey")
    expect(method.locator("option:checked")).to_contain_text("unsupported for this design")
    parameters.get_by_role("alert").scroll_into_view_if_needed()
    capture("unsupported-rm-tukey", parameters)
    parameters.get_by_role("tab", name="Experimental Design", exact=True).click()
    parameters.get_by_role("radio", name="Yes. No correction.", exact=True).check()
    parameters.get_by_role("tab", name="Options", exact=True).click()
    parameters.get_by_label("Multiple comparisons test", exact=True).select_option("bonferroni")
    parameters.get_by_role("button", name="OK", exact=True).click()
    rm = wait_result("one_way_anova", rm_id)
    rm_p = next(r["value"] for r in rm["result"]["results"] if r["label"] == "A vs. B: adjusted P")
    assert rm_p == 1.0, rm_p
    expect(page.locator('.result-notes[aria-label="Method and limitations"]')).to_contain_text("repeated-measures pooled residual variance")
    check("repeated-measures sphericity mode uses pooled error for comparisons", p=rm_p)
    show(rm_id)
    page.get_by_label("B, row 3", exact=True).fill("")
    show(rm["id"])
    failure = page.get_by_role("status").filter(has_text="Recalculation failed:")
    expect(failure).to_be_visible(timeout=300000)
    expect(failure).to_contain_text("incomplete subject row")
    assert sheet(rm["id"])["status"] == "stale" and sheet(rm["id"])["result"] is None
    expect(page.get_by_role("table", name="ANOVA results", exact=True)).to_have_count(0)
    check("incomplete repeated measures fail visibly instead of deleting a subject")

    assert not errors, errors
    browser.close()

if os.environ.get("GP_COLUMN_EVIDENCE"):
    Path(os.environ["GP_COLUMN_EVIDENCE"]).parent.mkdir(parents=True, exist_ok=True)
    Path(os.environ["GP_COLUMN_EVIDENCE"]).write_text(json.dumps(evidence, indent=2) + "\n")
print("Column analysis workflow confirmed", flush=True)
