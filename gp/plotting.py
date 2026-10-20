import io
import math
import os
import threading
from pathlib import Path
import numpy as np
os.environ.setdefault("MPLCONFIGDIR", str(Path("/tmp/gp-matplotlib")))
import matplotlib
matplotlib.use("Agg")
from matplotlib import colors, rc_context
from matplotlib.figure import Figure
from matplotlib.patches import Rectangle
from matplotlib.ticker import FixedLocator
from .statistics import AnalysisError, analyze, descriptive, pairs, values

PLOT_LOCK = threading.Lock()
PALETTE = ["#315efb", "#dd7e44", "#309c88", "#a56ad1", "#cd5868", "#75913a"]


def _major_ticks(low, high, interval):
    """Zero-anchored ticks, with validation before allocating or iterating."""
    span = high - low
    if span / interval > 201 or not math.isfinite(low / interval):
        raise AnalysisError("Major tick interval is too small; no more than 200 ticks are supported.")
    first, last = math.ceil(low / interval), math.floor(high / interval)
    count = max(0, last-first+1)
    if count > 200:
        raise AnalysisError("Major tick interval would generate more than 200 ticks.")
    if max(abs(first), abs(last)) > 2**53-1:
        raise AnalysisError("Major tick interval is below numerical precision at these axis limits.")
    ticks = [float(format((first+i)*interval, ".15g")) for i in range(count)]
    if any(not math.isfinite(v) for v in ticks) or any(b <= a for a, b in zip(ticks, ticks[1:])):
        raise AnalysisError("Major tick interval is below numerical precision at these axis limits.")
    return [v for v in ticks if low <= v <= high]


def _linear_extent(low, high):
    raw = (high-low)/5
    power = 10.**math.floor(math.log10(raw)) if raw > 0 else 0
    if not power:
        return low, high, [low, high]
    fraction = raw/power
    step = next(v for v in (1, 2, 2.5, 5, 10) if fraction <= v)*power
    first, last = math.floor(low/step), math.ceil(high/step)
    ticks = [(first+i)*step for i in range(min(20, last-first+1))]
    return ticks[0], ticks[-1], ticks


def _automatic_ticks(low, high, logarithmic):
    if not logarithmic:
        return [v for v in _linear_extent(low, high)[2] if low <= v <= high]
    first, last = math.floor(math.log10(low)), math.ceil(math.log10(high))
    stride = max(1, math.ceil((last-first)/6))
    ticks = []
    for exponent in range(first, last+1, stride):
        for factor in ((1, 2, 5) if last-first <= 2 else (1,)):
            value = factor*10.**exponent
            if low <= value <= high:
                ticks.append(value)
    return ticks


def _configured_limits(coordinates, settings, logarithmic, name, bar=False):
    eligible = [float(v) for v in coordinates if np.isfinite(v) and (not logarithmic or v > 0)]
    if not eligible:
        eligible = [1., 10.] if logarithmic else [0., 1.]
        empty = True
    else:
        empty = False
    low, high = min(eligible), max(eligible)
    automatic_ticks = None
    if logarithmic:
        lo, hi = math.log10(low), math.log10(high)
        if low == high:
            lo, hi = lo-1, hi+1
        lower_pad, upper_pad = ((.07, .07) if name == "X" else (.05, .15))
        try:
            low = 10.**(lo-(hi-lo)*lower_pad) if not empty else 1.
            high = 10.**(hi+(hi-lo)*upper_pad) if not empty else 10.
        except OverflowError:
            high = math.inf
    else:
        if name == "X" and low == high:
            padding = max(1., abs(low)*.1)
            low, high = low-padding, high+padding
        if bar:
            low, high = min(low, 0.), max(high, 0.)
        span = high-low or abs(high)*.2 or 1.
        if not bar or low != 0:
            low -= span*(.07 if name == "X" else .05)
        if not bar or high != 0:
            high += span*(.07 if name == "X" else .15)
        low, high, automatic_ticks = _linear_extent(low, high)
    low = settings.minimum if settings.minimum is not None else low
    high = settings.maximum if settings.maximum is not None else high
    if not math.isfinite(low) or not math.isfinite(high) or low >= high:
        raise AnalysisError(f"{name} axis minimum must be less than its resolved maximum; adjust the manual limit.")
    if logarithmic and low <= 0:
        raise AnalysisError(f"{name} logarithmic axis limits must be positive.")
    if logarithmic or settings.minimum is not None or settings.maximum is not None:
        automatic_ticks = _automatic_ticks(low, high, logarithmic)
    return (low, high), automatic_ticks


def _draw_configured(axis, data, graph, outcome, palette):
    """Formatting-only view of the already analyzed data. No mask reaches analysis."""
    xy = data.table_type == "xy"
    if xy and graph.type in {"bar", "box"}:
        raise AnalysisError("XY graphs support scatter or line; choose a column table for bar or box graphs.")
    settings = graph.axes
    logx = xy and (settings.x.scale == "log10" or settings.x.scale == "auto" and data.analysis == "dose_response")
    logy = settings.y.scale == "log10"
    series, xs, ys = [], [], []
    for i, column in enumerate(data.columns[1:] if xy else data.columns):
        if xy:
            x, y = pairs(data.columns[0], column)
            summary, error = None, None
        else:
            y = values(column)
            x = np.full(len(y), i, dtype=float)
            summary = descriptive(column.name, y, data.confidence)
            error = summary[graph.error] if graph.error in {"sd", "sem"} else (summary["ci_high"]-summary["mean"] if graph.error == "ci" and summary["ci_high"] is not None else None)
            if summary["mean"] is not None and graph.type != "box":
                ys.extend([summary["mean"], summary["mean"]-(error or 0), summary["mean"]+(error or 0)])
        visible = ((not logx) | (x > 0)) & ((not logy) | (y > 0))
        xs.extend(x[visible]); ys.extend(y[visible])
        fit = next((f for f in outcome["fit"] if f["series"] == column.name), None) if xy else None
        if fit:
            for point in fit["points"]:
                if (not logx or point["x"] > 0) and (not logy or point["y"] > 0):
                    xs.append(point["x"]); ys.append(point["y"])
        series.append((column, x, y, visible, summary, error, fit))
    xlim, xticks = _configured_limits(xs, settings.x, logx, "X") if xy else ((-.6, len(series)-.4), None)
    annotation_placed, annotation_step = [], 0.
    if not xy and graph.annotations:
        annotation_tops = {}
        for i, (_, _, y, _, summary, error, _) in enumerate(series):
            if len(y):
                annotation_tops[i] = max(float(np.max(y)), summary["mean"]+(error or 0))
        if annotation_tops:
            extent = [v for v in ys if np.isfinite(v) and (not logy or v > 0)]
            if not extent:
                extent = [1., 10.] if logy else [0., 1.]
            if graph.type == "bar" and not logy:
                extent.append(0.)
            span = max(extent)-min(extent)
            annotation_step = (span or abs(max(extent))*.2 or 1)*.09
            annotation_placed = [p for p in bracket_levels(graph.annotations, annotation_tops, annotation_step) if not logy or p[2] > 0]
            ys.extend(p[2]+annotation_step*.5 for p in annotation_placed)
    ylim, yticks = _configured_limits(ys, settings.y, logy, "Y", bar=not xy and graph.type == "bar")
    if logx:
        axis.set_xscale("log", nonpositive="mask")
    if logy:
        axis.set_yscale("log", nonpositive="mask")
    floor = ylim[0]
    for i, (column, x, y, visible, summary, error, fit) in enumerate(series):
        color = palette[i % len(palette)]
        if xy:
            if graph.type == "line":
                order = np.argsort(x, kind="stable")
                # NaNs break paths at invalid log coordinates; filtering the
                # vectors would incorrectly join across an omitted observation.
                xx, yy = np.where(visible, x, np.nan), np.where(visible, y, np.nan)
                axis.plot(xx[order], yy[order], color=color, marker="o" if graph.show_points else None, markersize=4, linewidth=1.5, label=column.name)
            else:
                axis.scatter(x[visible], y[visible], color=color, s=26, edgecolors=(0, 0, 0, .35), linewidths=.6, label=column.name)
            if fit:
                xx = np.array([p["x"] for p in fit["points"]])
                yy = np.array([p["y"] for p in fit["points"]])
                valid = ((not logx) | (xx > 0)) & ((not logy) | (yy > 0))
                axis.plot(np.where(valid, xx, np.nan), np.where(valid, yy, np.nan), color=color, linewidth=1.5)
            continue
        if not len(y):
            continue
        mean = summary["mean"]
        if graph.type == "bar" and (not logy or mean > 0):
            baseline = floor if logy else 0
            if not logy or mean > floor:
                axis.bar(i, mean-baseline, bottom=baseline, color=color, edgecolor="black", linewidth=1.5, width=.6)
        elif graph.type == "box":
            # Quantiles use all observations, including nonpositive ones. Only
            # geometric drawing is clipped to the displayed log domain.
            lo, q1, median, q3, hi = np.quantile(y, [0, .25, .5, .75, 1])
            if not logy:
                axis.boxplot([y], positions=[i], widths=[.5], whis=(0, 100), patch_artist=True, showfliers=not graph.show_points, boxprops={"facecolor": colors.to_rgba(color, .35), "edgecolor": "black", "linewidth": 1.5}, whiskerprops={"color": "black", "linewidth": 1.5}, capprops={"color": "black", "linewidth": 1.5}, medianprops={"color": "black", "linewidth": 1.5}, manage_ticks=False)
            else:
                if q3 > floor:
                    axis.add_patch(Rectangle((i-.25, max(q1, floor)), .5, q3-max(q1, floor), facecolor=colors.to_rgba(color, .35), edgecolor="none"))
                    for side in (i-.25, i+.25):
                        axis.plot([side, side], [max(q1, floor), q3], color="black", linewidth=1.5)
                for value, width in ((q1, .25), (q3, .25), (median, .25), (lo, .125), (hi, .125)):
                    if value > 0:
                        axis.plot([i-width, i+width], [value, value], color="black", linewidth=1.5)
                for start, end in ((lo, q1), (q3, hi)):
                    if end > floor:
                        axis.plot([i, i], [max(start, floor), end], color="black", linewidth=1.5)
        if graph.type != "box":
            if not logy or mean > 0:
                axis.plot([i], [mean], color="black", marker="_", markersize=22, markeredgewidth=2, zorder=4)
            if error is not None:
                lo, hi = mean-error, mean+error
                if not logy:
                    axis.errorbar(i, mean, yerr=error, color="black", fmt="none", capsize=5, elinewidth=1.5, capthick=1.5, zorder=4)
                else:
                    if hi > floor:
                        axis.plot([i, i], [max(lo, floor), hi], color="black", linewidth=1.5, zorder=4)
                    for value in (lo, hi):
                        if value > 0:
                            axis.plot([i], [value], color="black", marker="_", markersize=10, markeredgewidth=1.5, zorder=4)
        if graph.show_points or graph.type == "scatter":
            jitter = np.random.default_rng(i).uniform(-.13, .13, size=len(y))
            axis.scatter(i+jitter[visible], y[visible], s=22, color=color, edgecolors=(0, 0, 0, .35), linewidths=.6, zorder=3)
    if not xy and graph.type == "line":
        means = [s["mean"] if s["mean"] is not None and (not logy or s["mean"] > 0) else np.nan for s in outcome.get("graph_summary", outcome["summary"])]
        axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
    for lo, hi, y, label in annotation_placed:
        yy = np.array([y-annotation_step*.25, y, y, y-annotation_step*.25])
        axis.plot([lo, lo, hi, hi], np.where(yy > 0, yy, np.nan) if logy else yy,
                  color="black", linewidth=1.2, solid_capstyle="butt", zorder=5)
        text = axis.text((lo+hi)/2, y+annotation_step*.08, label, ha="center", va="bottom", fontsize=10, zorder=5, clip_on=True)
        text.set_clip_path(axis.patch)
    if xy:
        axis.legend(frameon=False)
        axis.set_xlabel(graph.x_label or data.columns[0].name)
    else:
        axis.set_xticks(range(len(data.columns)), [c.name for c in data.columns], rotation=20 if len(data.columns)>4 else 0)
        axis.set_xlabel(graph.x_label)
    for name, config, limits in (("x", settings.x, xlim), ("y", settings.y, ylim)):
        if config.majorInterval is not None:
            getattr(axis, f"{name}axis").set_major_locator(FixedLocator(_major_ticks(*limits, config.majorInterval)))
        elif name == "y" or xy:
            getattr(axis, f"{name}axis").set_major_locator(FixedLocator(xticks if name == "x" else yticks))
        getattr(axis, f"set_{name}lim")(*(limits[::-1] if config.reverse else limits))
        axis.spines["bottom" if name == "x" else "left"].set_visible(config.showAxis)
        axis.tick_params(axis=name, which="both", **({"bottom": config.showAxis, "labelbottom": config.showAxis} if name == "x" else {"left": config.showAxis, "labelleft": config.showAxis}))
        getattr(axis, f"{name}axis").label.set_visible(config.showAxis)
        axis.grid(config.showGrid, axis=name, which="major", color="#dddddd", linewidth=.6) if config.showGrid else axis.grid(False, axis=name)


def bracket_levels(annotations, tops, step):
    """Mirror web/src/plot-geometry.ts: shorter spans sit lowest and overlapping
    brackets stack one step higher. Returns (lo, hi, y, label), 0-based."""
    placed = []
    spans = sorted(((min(a.a, a.b), max(a.a, a.b), a.label) for a in annotations
                    if a.a != a.b and a.a in tops and a.b in tops), key=lambda p: (p[1]-p[0], p[0]))
    for lo, hi, label in spans:
        y = max(tops[i] for i in range(lo, hi+1) if i in tops) + step*.6
        for other in placed:
            if other[0] <= hi and other[1] >= lo:
                y = max(y, other[2] + step)
        placed.append((lo, hi, y, label))
    return placed


def draw_brackets(axis, annotations, tops, bottom):
    span = max(tops.values()) - bottom
    step = (span or abs(max(tops.values()))*.2 or 1)*.09
    placed = bracket_levels(annotations, tops, step)
    for lo, hi, y, label in placed:
        axis.plot([lo, lo, hi, hi], [y-step*.25, y, y, y-step*.25], color="black", linewidth=1.2, solid_capstyle="butt", zorder=5)
        axis.text((lo+hi)/2, y + step*.08, label, ha="center", va="bottom", fontsize=10, zorder=5)
    if placed:
        low, high = axis.get_ylim()
        axis.set_ylim(low, max(high, max(p[2] for p in placed) + step))


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
        if graph.axes is not None:
            _draw_configured(axis, data, graph, outcome, palette)
        elif data.table_type == "xy":
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
            tops, lows = {}, [0.0] if graph.type == "bar" else []
            for i, column in enumerate(data.columns):
                y = values(column)
                if not len(y):
                    continue
                color = palette[i % len(palette)]
                summary = descriptive(column.name, y, data.confidence)
                error = summary[graph.error] if graph.error in {"sd", "sem"} else (summary["ci_high"]-summary["mean"] if graph.error == "ci" and summary["ci_high"] is not None else None)
                tops[i] = max(float(np.max(y)), summary["mean"] + (error or 0))
                lows.append(min(float(np.min(y)), summary["mean"] - (error or 0)))
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
                means = [s["mean"] if s["mean"] is not None else np.nan
                         for s in outcome.get("graph_summary", outcome["summary"])]
                axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
            if tops and graph.annotations:
                draw_brackets(axis, graph.annotations, tops, min(lows + list(tops.values())))
            axis.set_xticks(range(len(data.columns)), [c.name for c in data.columns], rotation=20 if len(data.columns)>4 else 0)
            axis.set_xlabel(graph.x_label)
        axis.set_ylabel(graph.y_label or "Value")
        axis.set_title(graph.title, pad=15, fontweight="bold")
        axis.tick_params(direction="out")
        output = io.BytesIO()
        figure.savefig(output, format=request.format, metadata={"Creator": "GP independent scientific workbench"})
        figure.clear()
        return output.getvalue()
