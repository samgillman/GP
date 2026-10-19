import io
import os
import threading
from pathlib import Path
import numpy as np
os.environ.setdefault("MPLCONFIGDIR", str(Path("/tmp/gp-matplotlib")))
import matplotlib
matplotlib.use("Agg")
from matplotlib import colors, rc_context
from matplotlib.figure import Figure
from .statistics import AnalysisError, analyze, descriptive, pairs, values

PLOT_LOCK = threading.Lock()
PALETTE = ["#315efb", "#dd7e44", "#309c88", "#a56ad1", "#cd5868", "#75913a"]


def export_plot(request):
    data, graph = request.data, request.graph
    if sum(len(c.values) for c in data.columns) > 20000:
        raise AnalysisError("Graph export is limited to 20,000 cells per request.")
    palette = graph.colors or PALETTE
    if any(len(c) > 64 or not colors.is_color_like(c) for c in palette):
        raise AnalysisError("Graph colors must be valid CSS-style hex or named colors.")
    outcome = analyze(data)
    # Matplotlib's global configuration is not thread-safe. Keep all rendering in a lock.
    with PLOT_LOCK, rc_context({"text.usetex": False, "text.parse_math": False, "svg.fonttype": "none", "font.family": "DejaVu Sans", "axes.spines.top": False, "axes.spines.right": False, "font.size": 11}):
        figure = Figure(figsize=(7.5, 5.0), dpi=160, layout="constrained")
        axis = figure.subplots()
        if data.table_type == "xy":
            if graph.type in {"bar", "box"}:
                raise AnalysisError("XY graphs support scatter or line; choose a column table for bar or box graphs.")
            for i, column in enumerate(data.columns[1:]):
                x, y = pairs(data.columns[0], column)
                color = palette[i % len(palette)]
                if graph.type == "line":
                    order = np.argsort(x, kind="stable")
                    axis.plot(x[order], y[order], color=color, marker="o" if graph.show_points else None, markersize=4, linewidth=1.5, label=column.name)
                else:
                    axis.scatter(x, y, color=color, s=26, alpha=.8, label=column.name)
                fit = next((fit for fit in outcome["fit"] if fit["series"] == column.name), None)
                if fit:
                    axis.plot([p["x"] for p in fit["points"]], [p["y"] for p in fit["points"]], color=color, linewidth=2)
            if data.analysis == "dose_response":
                axis.set_xscale("log")
            axis.set_xlabel(graph.x_label or data.columns[0].name)
            axis.legend(frameon=False)
        else:
            for i, column in enumerate(data.columns):
                y = values(column)
                if not len(y):
                    continue
                color = palette[i % len(palette)]
                summary = descriptive(column.name, y, data.confidence)
                error = summary[graph.error] if graph.error in {"sd", "sem"} else (summary["ci_high"]-summary["mean"] if graph.error == "ci" and summary["ci_high"] is not None else None)
                if graph.type == "bar":
                    axis.bar(i, summary["mean"], color=color, alpha=.65, width=.6)
                elif graph.type == "box":
                    axis.boxplot([y], positions=[i], widths=.5, whis=(0, 100), patch_artist=True, showfliers=not graph.show_points, boxprops={"facecolor": color, "alpha": .35}, medianprops={"color": color, "linewidth": 2}, manage_ticks=False)
                if graph.type != "box":
                    axis.errorbar(i, summary["mean"], yerr=error, color=color, fmt="_", markersize=18, capsize=5, elinewidth=1.5, zorder=4)
                if graph.show_points or graph.type == "scatter":
                    jitter = np.random.default_rng(i).uniform(-.13, .13, size=len(y))
                    axis.scatter(i+jitter, y, s=22, color=color, alpha=.75, edgecolors="white", linewidths=.4, zorder=3)
            if graph.type == "line":
                means = [s["mean"] if s["mean"] is not None else np.nan for s in outcome["summary"]]
                axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
            axis.set_xticks(range(len(data.columns)), [c.name for c in data.columns], rotation=20 if len(data.columns)>4 else 0)
            axis.set_xlabel(graph.x_label)
        axis.set_ylabel(graph.y_label or "Value")
        axis.set_title(graph.title, loc="left", pad=15, fontweight="bold")
        axis.tick_params(direction="out")
        output = io.BytesIO()
        figure.savefig(output, format=request.format, metadata={"Creator": "GP independent scientific workbench"})
        figure.clear()
        return output.getvalue()
