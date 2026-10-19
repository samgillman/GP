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
    # Journal-style axes matching the on-screen graph: black 1.5 pt axes with
    # outward ticks, no grid, bold titles. Arial is used when installed.
    style = {"text.usetex": False, "text.parse_math": False, "svg.fonttype": "none",
             "font.family": "sans-serif", "font.sans-serif": ["Arial", "Helvetica", "Liberation Sans", "DejaVu Sans"],
             "axes.spines.top": False, "axes.spines.right": False, "font.size": 11,
             "axes.edgecolor": "black", "axes.linewidth": 1.5, "axes.labelweight": "bold", "axes.labelsize": 12,
             "xtick.color": "black", "ytick.color": "black", "xtick.direction": "out", "ytick.direction": "out",
             "xtick.major.width": 1.5, "ytick.major.width": 1.5, "xtick.major.size": 6, "ytick.major.size": 6}
    with PLOT_LOCK, rc_context(style):
        figure = Figure(figsize=(7.5, 5.0), dpi=160, layout="constrained")
        axis = figure.subplots()
        if data.table_type == "xy":
            if graph.type in {"bar", "box"}:
                raise AnalysisError("XY graphs support scatter or line; choose a column table for bar or box graphs.")
            for i, column in enumerate(data.columns[1:]):
                x, y = pairs(data.columns[0], column)
                if data.analysis == "dose_response":
                    # All pairs, including zero controls, were analyzed above.
                    # Filter only the log-coordinate drawing to avoid clipping
                    # zero to an artificial off-axis coordinate/line segment.
                    visible = x > 0
                    x, y = x[visible], y[visible]
                color = palette[i % len(palette)]
                if graph.type == "line":
                    order = np.argsort(x, kind="stable")
                    axis.plot(x[order], y[order], color=color, marker="o" if graph.show_points else None, markersize=4, linewidth=1.5, label=column.name)
                else:
                    axis.scatter(x, y, color=color, s=26, edgecolors=(0, 0, 0, .35), linewidths=.6, label=column.name)
                fit = next((fit for fit in outcome["fit"] if fit["series"] == column.name), None)
                if fit:
                    points = fit["points"]
                    if data.analysis == "dose_response":
                        points = [p for p in points if p["x"] > 0]
                    axis.plot([p["x"] for p in points], [p["y"] for p in points], color=color, linewidth=1.5)
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
                    axis.bar(i, summary["mean"], color=color, edgecolor="black", linewidth=1.5, width=.6)
                elif graph.type == "box":
                    axis.boxplot([y], positions=[i], widths=.5, whis=(0, 100), patch_artist=True, showfliers=not graph.show_points, boxprops={"facecolor": colors.to_rgba(color, .35), "edgecolor": "black", "linewidth": 1.5}, whiskerprops={"color": "black", "linewidth": 1.5}, capprops={"color": "black", "linewidth": 1.5}, medianprops={"color": "black", "linewidth": 1.5}, manage_ticks=False)
                if graph.type != "box":
                    axis.errorbar(i, summary["mean"], yerr=error, color="black", fmt="_", markersize=22, markeredgewidth=2, capsize=5, elinewidth=1.5, capthick=1.5, zorder=4)
                if graph.show_points or graph.type == "scatter":
                    jitter = np.random.default_rng(i).uniform(-.13, .13, size=len(y))
                    axis.scatter(i+jitter, y, s=22, color=color, edgecolors=(0, 0, 0, .35), linewidths=.6, zorder=3)
            if graph.type == "line":
                means = [s["mean"] if s["mean"] is not None else np.nan for s in outcome["summary"]]
                axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
            axis.set_xticks(range(len(data.columns)), [c.name for c in data.columns], rotation=20 if len(data.columns)>4 else 0)
            axis.set_xlabel(graph.x_label)
        axis.set_ylabel(graph.y_label or "Value")
        axis.set_title(graph.title, pad=15, fontweight="bold")
        axis.tick_params(direction="out")
        output = io.BytesIO()
        figure.savefig(output, format=request.format, metadata={"Creator": "GP independent scientific workbench"})
        figure.clear()
        return output.getvalue()
