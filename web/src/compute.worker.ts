import type { PyodideInterface } from "pyodide";

let engine: Promise<PyodideInterface> | null = null;
let renderReady = false;
function initialize(base: string) {
  if (!engine) {
    engine = (async () => {
      const indexURL = new URL("runtime/", base).href;
      const { loadPyodide } = await import(
        /* @vite-ignore */ `${indexURL}pyodide.mjs`
      );
      const py: PyodideInterface = await loadPyodide({ indexURL });
      await py.loadPackage(["numpy", "scipy", "pydantic"]);
      const response = await fetch(new URL("gp-python.zip", base));
      if (!response.ok)
        throw new Error(
          "Unable to load the analysis code. Reload and try again.",
        );
      py.unpackArchive(await response.arrayBuffer(), "zip", {
        extractDir: "/home/pyodide",
      });
      await py.runPythonAsync(`
import json, numpy as np
from pydantic import ValidationError
from gp.models import AnalysisRequest, ExportRequest
from gp.statistics import analyze, AnalysisError
from gp.import_prism import import_prism, PrismImportRequest
from gp.import_prism_zip import PrismZipImportRequest
from gp.advanced import SurvivalRequest
from gp.factorial_anova import FactorialAnovaRequest, analyze_factorial

def gp_dispatch(path, payload):
    data = json.loads(payload)
    if path == '/api/analyze':
        with np.errstate(over='raise', divide='raise', invalid='raise'):
            return json.dumps(analyze(AnalysisRequest.model_validate(data)), allow_nan=False)
    if path == '/api/import-prism':
        request = PrismImportRequest.model_validate(data)
        return json.dumps(import_prism(request.content), allow_nan=False)
    if path == '/api/import-prism-zip':
        return json.dumps(PrismZipImportRequest.model_validate(data).import_tables(), allow_nan=False)
    if path == '/api/survival':
        return json.dumps(SurvivalRequest.model_validate(data).analyze(), allow_nan=False)
    if path == '/api/factorial':
        return json.dumps(analyze_factorial(FactorialAnovaRequest.model_validate(data)), allow_nan=False)
    if path == '/api/export':
        from gp.plotting import export_plot
        return export_plot(ExportRequest.model_validate(data))
    raise AnalysisError('Unknown operation.')
`);
      return py;
    })();
    engine.catch(() => {
      engine = null;
    });
  }
  return engine;
}

// Serialize Python calls because the interpreter is shared by all requests.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    const { id, path, body, base } = data;
    try {
      const py = await initialize(base);
      if (path === "/api/export" && !renderReady) {
        await py.loadPackage("matplotlib");
        renderReady = true;
      }
      py.globals.set("gp_path", path);
      py.globals.set("gp_payload", JSON.stringify(body));
      const value = await py.runPythonAsync("gp_dispatch(gp_path, gp_payload)");
      if (path === "/api/export") {
        const bytes = value.toJs();
        value.destroy();
        self.postMessage({
          id,
          status: 200,
          bytes,
          mime: {
            svg: "image/svg+xml",
            png: "image/png",
            pdf: "application/pdf",
          }[body.format as string],
        });
      } else {
        self.postMessage({ id, status: 200, body: JSON.parse(value) });
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const detail =
        raw
          .split("\n")
          .filter(Boolean)
          .at(-1)
          ?.replace(/^(AnalysisError|ValueError|FloatingPointError): /, "") ||
        "Analysis failed. Check your data and try again.";
      self.postMessage({ id, status: 422, body: { detail } });
    }
  });
};
