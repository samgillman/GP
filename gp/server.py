from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from .models import EXPORT_MEDIA_TYPES, AnalysisRequest, ExportRequest
from .statistics import AnalysisError, analyze
from .plotting import export_plot
from .import_prism import PrismImportRequest, import_prism
from .import_prism_zip import PrismZipImportRequest
from .advanced import SurvivalRequest
from .survival import SurvivalError
from .factorial_anova import FactorialAnovaRequest, analyze_factorial

app = FastAPI(title="GP scientific workbench", version="0.1.0")
DIST = Path(__file__).resolve().parents[1] / "web" / "dist"
MAX_BODY = 10*1024*1024


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH"}:
        limit = 24*1024*1024 if request.url.path == "/api/import-prism-zip" else MAX_BODY
        chunks, total = [], 0
        async for chunk in request.stream():
            total += len(chunk)
            if total > limit:
                return JSONResponse(status_code=413, content={"detail": f"Request body exceeds the {limit//1024//1024} MiB limit."})
            chunks.append(chunk)
        request._body = b"".join(chunks)
    return await call_next(request)


@app.exception_handler(SurvivalError)
@app.exception_handler(AnalysisError)
async def analysis_error(_request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def validation_error(_request, exc):
    # Do not echo raw non-finite numeric inputs back into a JSON error response.
    return JSONResponse(status_code=422, content={"detail": [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]})


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/analyze")
def analyze_route(request: AnalysisRequest):
    with np.errstate(over="raise", divide="raise", invalid="raise"):
        try:
            return analyze(request)
        except (FloatingPointError, OverflowError) as exc:
            raise AnalysisError("The data are numerically unstable at this scale. Rescale values and retry.") from exc


@app.post("/api/export")
def export_route(request: ExportRequest):
    try:
        content = export_plot(request)
    except (FloatingPointError, OverflowError) as exc:
        raise AnalysisError("The graph cannot be rendered at this numeric scale. Rescale values and retry.") from exc
    return Response(content=content, media_type=EXPORT_MEDIA_TYPES[request.format], headers={"Content-Disposition": f'attachment; filename="gp-graph.{request.format}"'})


@app.post("/api/import-prism")
def import_prism_route(request: PrismImportRequest):
    return import_prism(request.content)


@app.post("/api/survival")
def survival_route(request: SurvivalRequest):
    return request.analyze()


@app.post("/api/factorial")
def factorial_route(request: FactorialAnovaRequest):
    return analyze_factorial(request)


@app.post("/api/import-prism-zip")
def import_prism_zip_route(request: PrismZipImportRequest):
    return request.import_tables()


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Unknown API route.")
    target = (DIST/path).resolve()
    if target.is_relative_to(DIST.resolve()) and target.is_file():
        return FileResponse(target)
    index = DIST/"index.html"
    if index.is_file() and "." not in Path(path).name:
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend not built. Run npm run build in web/.")
