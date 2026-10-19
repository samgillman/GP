#!/usr/bin/env python3
"""Assemble a self-contained static site; verify runtime wheels against Pyodide's lock."""
import concurrent.futures
import hashlib
import importlib.metadata
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "web/dist-static"
RUNTIME = ROOT / "web/node_modules/pyodide"
CACHE = ROOT / ".cache/pyodide"
VERSION = "0.29.3"


def build():
    if not (SITE / "index.html").is_file():
        raise SystemExit("Run npm --prefix web run build:static first.")
    assert json.loads((RUNTIME / "package.json").read_text())["version"] == VERSION
    destination = SITE / "runtime"
    destination.mkdir(exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]:
        shutil.copy2(RUNTIME / name, destination / name)
    packages = json.loads((RUNTIME / "pyodide-lock.json").read_text())["packages"]
    needed = set()

    def include(name):
        name = name.replace("_", "-").lower()
        if name in needed:
            return
        needed.add(name)
        for dependency in packages[name]["depends"]:
            include(dependency)

    for name in ["numpy", "scipy", "pydantic", "matplotlib"]:
        include(name)

    def fetch(name):
        package = packages[name]
        filename = package["file_name"]
        target = CACHE / filename
        valid = target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == package["sha256"]
        if not valid:
            with urllib.request.urlopen(f"https://cdn.jsdelivr.net/pyodide/v{VERSION}/full/{filename}", timeout=120) as response:
                content = response.read()
            if hashlib.sha256(content).hexdigest() != package["sha256"]:
                raise RuntimeError(f"Checksum mismatch: {filename}")
            target.write_bytes(content)
        shutil.copy2(target, destination / filename)
        return {"name": name, "version": package["version"], "sha256": package["sha256"]}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        manifest = list(pool.map(fetch, sorted(needed)))
    # Build from the same scientific implementation used by the server tests.
    # defusedxml is pure Python and retains its license in the distributed zip.
    distribution = importlib.metadata.distribution("defusedxml")
    assert distribution.version == "0.7.1"
    with zipfile.ZipFile(SITE / "gp-python.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in ["__init__.py", "models.py", "statistics.py", "descriptive.py", "plotting.py", "import_prism.py", "regression_models.py", "import_prism_zip.py", "survival.py", "factorial_anova.py", "advanced.py", "column_tests.py"]:
            archive.write(ROOT / "gp" / name, f"gp/{name}")
        for file in distribution.files:
            if str(file).startswith("defusedxml/") and str(file).endswith(".py"):
                archive.write(distribution.locate_file(file), str(file))
            elif str(file).endswith(".dist-info/LICENSE"):
                archive.write(distribution.locate_file(file), "licenses/defusedxml-LICENSE")
    (SITE / "runtime-manifest.json").write_text(json.dumps({"pyodide": VERSION, "packages": manifest}, indent=2) + "\n")
    # Use conservative caching for entry points so an updated site cannot mix runtimes.
    (SITE / "_headers").write_text("/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/runtime/*\n  Cache-Control: public, max-age=3600\n")
    print(f"Static site ready at {SITE}; {len(needed)} verified runtime packages.")


if __name__ == "__main__":
    build()
