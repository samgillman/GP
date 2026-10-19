# Use GP as a browser app

GP has a static build that runs calculations in the browser using Pyodide (Python compiled to WebAssembly). Like SimpleCalcium's Shinylive deployment, it can run on Cloudflare Pages without an application server. This build includes the scientific runtime: input data is never sent to an analysis API, and no third-party CDN is contacted by the running app. The first calculation loads the runtime; the first figure export also loads plotting packages. Allow a little time on the first use.

## Build

With Node.js 24.18.0 and Python 3 available:

```bash
bash scripts/build_site.sh
```

The complete deployable directory is `web/dist-static` (about 42 MiB). Serve it over HTTP/HTTPS; opening `index.html` directly from disk does not support its worker/runtime loading. The output includes all 19 runtime packages, verified against the npm-pinned Pyodide package's SHA-256 lock entries. No individual file exceeds Cloudflare Pages' 25 MiB asset limit.

To try the build on your own computer, run this from the repository root:

```bash
python3 -m http.server 8001 --bind 127.0.0.1 --directory web/dist-static
```

Open **http://localhost:8001** on that same computer. Keep the terminal open while using the app, and press Ctrl+C to stop. These local instructions do not create a public link or a cloud-workspace preview. Running GP does not require the Prism installer or REA tools.

## Publish through Cloudflare Pages

For the same hosting service used by SimpleCalcium:

1. In Cloudflare, open **Workers & Pages**, create a **Pages** project, and choose the Git repository connection option.
2. Connect `samgillman/GP` and select the `main` branch.
3. Set **Build command** to `bash scripts/build_site.sh` and **Build output directory** to `web/dist-static` (root directory: repository root).
4. Set the build environment variable `NODE_VERSION` to `24.18.0`.
5. Deploy. Cloudflare supplies the actual `pages.dev` URL; a custom domain can be attached afterward.

Alternatively, upload the contents of the already-built `web/dist-static` directory as a Cloudflare Pages Direct Upload project. Unzip a build archive first and upload the folder containing `index.html`, `assets`, and `runtime`. You do not need to upload the Prism installer or any investigation evidence.

No website has been published by these build scripts. GitHub repository access and Cloudflare account access are separate; SimpleCalcium's deployment credentials are not available just because its source can be read.

## Try it

Open the URL issued by your host. With the included treatment example:

1. Click **Run analysis**. Control mean should be **41.5**.
2. Select **Data table** to edit observations. Existing result sheets become stale and can be recalculated. Use the navigator to move between tables, results, and graphs.
3. From a result sheet, create a graph with **New graph of existing data**, then use **Format Graph…** and export SVG, PNG, or PDF. Use **Save workbook** to keep a portable copy of all sheets and their links.
4. Load the **Dose response** example and run its 4PL fit, or import your own CSV, compatible Prism XML, or supported ZIP project tables.
5. Open **Grouped & survival** to run a Kaplan–Meier/logrank analysis or a balanced two-way ANOVA. Load an example or paste long-format data, confirm the column mappings, and run the analysis. Save this workspace with **Save analysis input JSON**; its inputs also persist across page reloads.

Workbooks autosave in the browser's local storage for that site's address. Clearing browser data removes that local copy. Saved JSON workbooks are portable, and earlier single-project files are migrated when opened. Imported data and results stay on the visitor's device in the static build. The optional FastAPI development build instead sends analysis/export requests to its own backend.

## Validation and limitations

The static build was exercised in Chromium with the backend disconnected: descriptive statistics, ANOVA, dose-response and exponential fitting, actual supplied Prism XML and ZIP table imports, Welch tests, linear regression, three figure formats, project save/open, reload persistence, invalid-data errors, and mobile layout. The workbook refactor was checked for selected-dataset results, separate tables and graphs, source-change invalidation and recalculation, graph Apply/Cancel, unfinished draft reload, and JSON round-trip. Normalized fits and the grouped workspace were rechecked after the refactor. The grouped workspace uses the installer's saved 135-subject survival and 36-observation two-way ANOVA examples, including numerical results, SVG export, input save/open, reload persistence, and mobile width. The network check allowed only GETs for static assets and observed no analysis API requests or external-host requests.

Browser packages are versions supported by the pinned Pyodide runtime (NumPy 2.2.5, SciPy 1.14.1, Matplotlib 3.8.4, Pydantic 2.12.5); server package versions differ. Both builds use the same GP source. Testing does not establish parity with the commercial Prism application. See the README for supported features and import limits.
