import io
import math
import os
import re
import threading
from decimal import Decimal, ROUND_HALF_UP, localcontext
from pathlib import Path
import numpy as np
os.environ.setdefault("MPLCONFIGDIR", str(Path("/tmp/gp-matplotlib")))
import matplotlib
matplotlib.use("Agg")
from matplotlib import colors, rc_context
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.patches import Patch, Rectangle
from matplotlib.ticker import FixedLocator, FuncFormatter, NullFormatter
from .models import EXPORT_SIZE, RASTER_FORMATS
from .statistics import AnalysisError, analyze, descriptive, pairs, values

PLOT_LOCK = threading.Lock()
MARKERS = {"circle": "o", "square": "s", "triangle": "^", "diamond": "D"}
# Browser geometry in category slots of 70 px: bars are 46 px, error bar caps
# 14 px and the scatter mean line 40 px wide.
BAR_WIDTH, CAP_HALF, MEAN_HALF = .66, .1, 20 / 70


def _style(graph, i):
    """The resolved Format Graph style for plotted data set i, or None when the
    request carries none (earlier clients), which keeps the fixed styling."""
    return graph.styles[i] if i < len(graph.styles) else None


def _bar_kwargs(style, color, graph):
    # An explicit Column spacing sets the bar width as a share of its slot.
    spaced = None if graph.column_space_percent is None else 1 / (1 + graph.column_space_percent / 100)
    if style is None:
        return {"color": color, "edgecolor": "black", "linewidth": 1.5, "width": spaced or .6}
    return {"color": style.fill, "edgecolor": style.color, "linewidth": style.border_width,
            "width": spaced or BAR_WIDTH, "hatch": "///" if style.pattern else None}


def _box_kwargs(style, color):
    if style is None:
        line = {"color": "black", "linewidth": 1.5}
        return {"boxprops": {"facecolor": colors.to_rgba(color, .35), "edgecolor": "black", "linewidth": 1.5},
                "whiskerprops": line, "capprops": line, "medianprops": line}
    line = {"color": style.color, "linewidth": style.border_width}
    return {"boxprops": {"facecolor": style.fill, "edgecolor": style.color, "linewidth": style.border_width,
                         "hatch": "///" if style.pattern else None},
            "whiskerprops": line, "capprops": line, "medianprops": line}


def _point_kwargs(style, color, size=22):
    if style is None:
        return {"s": size, "color": color, "edgecolors": (0, 0, 0, .35), "linewidths": .6}
    # Browser symbol radius is size + 0.2 CSS px; 1 px = 0.75 pt.
    diameter = 2 * (style.symbol_size + .2) * .75
    return {"s": diameter * diameter, "color": style.symbol_color, "marker": MARKERS[style.symbol_shape],
            "edgecolors": "none", "linewidths": 0}


def _styled_errors(axis, i, mean, error, style, floor=None):
    """Draw one styled error bar: direction, cap and thickness follow the style.
    With a logarithmic axis, `floor` clips the bar and nonpositive ends are skipped."""
    up, down = style.error_direction != "below", style.error_direction != "above"
    lo, hi = (mean - error if down else mean), (mean + error if up else mean)
    kwargs = {"color": style.error_color, "linewidth": style.error_width, "zorder": 4, "solid_capstyle": "butt"}
    if floor is None or hi > floor:
        axis.plot([i, i], [lo if floor is None else max(lo, floor), hi], **kwargs)
    if style.error_cap == "T":
        for value, shown in ((hi, up), (lo, down)):
            if shown and (floor is None or value > 0):
                axis.plot([i - CAP_HALF, i + CAP_HALF], [value, value], **kwargs)


def _legend(axis, data, graph, xy):
    shown = graph.show_legend if graph.show_legend is not None else xy
    if not shown:
        return
    if not graph.styles:
        axis.legend(frameon=False)
        return
    handles = []
    names = [c.name for c in (data.columns[1:] if xy else data.columns)]
    for name, style in zip(names, graph.styles):
        if not xy and graph.type in {"bar", "box"}:
            handles.append(Patch(facecolor=style.fill, edgecolor=style.color, linewidth=style.border_width,
                                 hatch="///" if style.pattern else None, label=name))
        else:
            handles.append(Line2D([], [], color=style.color, linewidth=style.line_width,
                                  linestyle="-" if xy and graph.type == "line" else "none",
                                  marker=MARKERS[style.symbol_shape] if style.symbols else None,
                                  markerfacecolor=style.symbol_color, markeredgecolor="none",
                                  markersize=2 * (style.symbol_size + .2) * .75, label=name))
    axis.legend(handles=handles, frameon=False, loc="upper left", bbox_to_anchor=(1.02, 1), borderaxespad=0)


def _category_ticks(axis, data, graph):
    names = [c.name for c in data.columns]
    if graph.styles:
        rotation = graph.x_tick_rotation
        axis.set_xticks(range(len(names)), names, rotation=rotation, ha="right" if rotation else "center",
                        rotation_mode="anchor" if rotation else "default", fontweight="bold")
        axis.tick_params(axis="y", labelsize=11)
        for label in axis.get_yticklabels():
            label.set_fontweight("bold")
    else:
        axis.set_xticks(range(len(names)), names, rotation=20 if len(names) > 4 else 0)
PALETTE = ["#315efb", "#dd7e44", "#309c88", "#a56ad1", "#cd5868", "#75913a"]


def format_tick_number(value, config):
    """Fixed-decimal GP display from the shortest decimal float representation.

    Decimal ties round away from zero, without binary toFixed-style surprises.
    This explicit policy is shared with the browser; native rounding is unknown.
    """
    if not math.isfinite(value):
        raise AnalysisError("Axis tick values must be finite.")
    decimal = Decimal(str(value))
    with localcontext() as context:
        context.prec = max(28, len(decimal.as_tuple().digits)+config.decimals+2,
                           decimal.adjusted()+config.decimals+3)
        rounded = decimal.quantize(Decimal(1).scaleb(-config.decimals), rounding=ROUND_HALF_UP)
    sign = "-" if rounded < 0 else ""
    fixed = format(rounded.copy_abs(), "f")
    integer, _, fraction = fixed.partition(".")
    if config.thousandsSeparator:
        reversed_integer = integer[::-1]
        integer = config.thousandsSeparator.join(
            reversed_integer[i:i+3] for i in range(0, len(reversed_integer), 3))[::-1]
    fraction = config.decimalSeparator+fraction if config.decimals else ""
    return config.prefix+sign+integer+fraction+config.suffix


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


def _xy_lines_with_missing_y(xcolumn, ycolumn):
    """Retain numeric-X/missing-Y row positions for graphical line breaks.

    Other calls to pairs() keep their complete-observation scientific semantics.
    A missing X cannot be positioned on the XY axis and is omitted.
    """
    coords = [(x, np.nan if y is None else y)
              for x, y in zip(xcolumn.values, ycolumn.values) if x is not None]
    if not coords:
        return np.array([], dtype=float), np.array([], dtype=float)
    return np.asarray(coords, dtype=float).T


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
        style = _style(graph, i)
        if xy:
            if graph.type == "line":
                line_x, line_y = (_xy_lines_with_missing_y(data.columns[0], column)
                                  if graph.gap_at_missing_y else (x, y))
                line_visible = ((not logx) | (line_x > 0)) & ((not logy) | (line_y > 0))
                order = np.argsort(line_x, kind="stable")
                # NaNs preserve gaps from empty Y cells and invalid log coordinates.
                xx, yy = np.where(line_visible, line_x, np.nan), np.where(line_visible, line_y, np.nan)
                if style is None:
                    axis.plot(xx[order], yy[order], color=color, marker="o" if graph.show_points else None, markersize=4, linewidth=1.5, label=column.name)
                else:
                    axis.plot(xx[order], yy[order], color=style.color, linewidth=style.line_width, label=column.name)
                    if style.symbols:
                        axis.scatter(x[visible], y[visible], zorder=3, **_point_kwargs(style, color))
            elif style is None or style.symbols:
                axis.scatter(x[visible], y[visible], label=column.name, **_point_kwargs(style, color, 26))
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
                axis.bar(i, mean-baseline, bottom=baseline, **_bar_kwargs(style, color, graph))
        elif graph.type == "box":
            # Quantiles use all observations, including nonpositive ones. Only
            # geometric drawing is clipped to the displayed log domain.
            lo, q1, median, q3, hi = np.quantile(y, [0, .25, .5, .75, 1])
            half = BAR_WIDTH / 2 if style else .25
            if not logy:
                axis.boxplot([y], positions=[i], widths=[half * 2], whis=(0, 100), patch_artist=True, showfliers=not graph.show_points, manage_ticks=False, **_box_kwargs(style, color))
            else:
                edge = {"color": style.color if style else "black", "linewidth": style.border_width if style else 1.5}
                if q3 > floor:
                    axis.add_patch(Rectangle((i-half, max(q1, floor)), half * 2, q3-max(q1, floor), facecolor=style.fill if style else colors.to_rgba(color, .35), edgecolor="none"))
                    for side in (i-half, i+half):
                        axis.plot([side, side], [max(q1, floor), q3], **edge)
                for value, width in ((q1, half), (q3, half), (median, half), (lo, half / 2), (hi, half / 2)):
                    if value > 0:
                        axis.plot([i-width, i+width], [value, value], **edge)
                for start, end in ((lo, q1), (q3, hi)):
                    if end > floor:
                        axis.plot([i, i], [max(start, floor), end], **edge)
        if graph.type != "box" and style is not None:
            if graph.type == "scatter" and (not logy or mean > 0):
                axis.plot([i - MEAN_HALF, i + MEAN_HALF], [mean, mean], color=style.error_color, linewidth=1.5, zorder=4)
            if error is not None and style.error_bars:
                _styled_errors(axis, i, mean, error, style, floor if logy else None)
        elif graph.type != "box":
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
        if (style.symbols if style else graph.show_points or graph.type == "scatter"):
            jitter = np.random.default_rng(i).uniform(-.13, .13, size=len(y))
            axis.scatter(i+jitter[visible], y[visible], zorder=3, **_point_kwargs(style, color))
    if not xy and graph.type == "line":
        means = [s["mean"] if s["mean"] is not None and (not logy or s["mean"] > 0) else np.nan for s in outcome.get("graph_summary", outcome["summary"])]
        axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
    for lo, hi, y, label in annotation_placed:
        yy = np.array([y-annotation_step*.25, y, y, y-annotation_step*.25])
        axis.plot([lo, lo, hi, hi], np.where(yy > 0, yy, np.nan) if logy else yy,
                  color="black", linewidth=1.2, solid_capstyle="butt", zorder=5)
        text = axis.text((lo+hi)/2, y+annotation_step*.08, label, ha="center", va="bottom", fontsize=10, zorder=5, clip_on=True)
        text.set_clip_path(axis.patch)
    _legend(axis, data, graph, xy)
    if xy:
        axis.set_xlabel(graph.x_label or data.columns[0].name)
    else:
        _category_ticks(axis, data, graph)
        axis.set_xlabel(graph.x_label)
    for name, config, limits in (("x", settings.x, xlim), ("y", settings.y, ylim)):
        if config.majorInterval is not None:
            getattr(axis, f"{name}axis").set_major_locator(FixedLocator(_major_ticks(*limits, config.majorInterval)))
        elif name == "y" or xy:
            getattr(axis, f"{name}axis").set_major_locator(FixedLocator(xticks if name == "x" else yticks))
        if config.numberFormat is not None:
            tick_axis = getattr(axis, f"{name}axis")
            tick_axis.set_major_formatter(FuncFormatter(
                lambda value, position, spec=config.numberFormat: format_tick_number(value, spec)))
            # Browser labels only major ticks. Keep minor marks, but do not
            # leak an unrelated scientific formatter into explicit decimals.
            tick_axis.set_minor_formatter(NullFormatter())
            for tick in tick_axis.get_major_ticks():
                tick.label1.set_parse_math(False)
                tick.label2.set_parse_math(False)
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
    if graph.styles and len(graph.styles) != len(data.columns) - (data.table_type == "xy"):
        raise AnalysisError("Graph styles must match the plotted data sets.")
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
        figure = Figure(figsize=EXPORT_SIZE, dpi=160, layout="constrained")
        axis = figure.subplots()
        if graph.axes is not None:
            _draw_configured(axis, data, graph, outcome, palette)
        elif data.table_type == "xy":
            if graph.type in {"bar", "box"}:
                raise AnalysisError("XY graphs support scatter or line; choose a column table for bar or box graphs.")
            for i, column in enumerate(data.columns[1:]):
                x, y = (_xy_lines_with_missing_y(data.columns[0], column)
                        if graph.type == "line" and graph.gap_at_missing_y
                        else pairs(data.columns[0], column))
                if data.analysis == "dose_response":
                    # All pairs, including zero controls, were analyzed above.
                    # Filter only the log-coordinate drawing to avoid clipping
                    # zero to an artificial off-axis coordinate/line segment.
                    visible = x > 0
                    if graph.type == "line" and graph.gap_at_missing_y:
                        # Preserve missing and nonpositive log-X positions as
                        # gaps; removing rows would reconnect neighbors.
                        x, y = np.where(visible, x, np.nan), np.where(visible, y, np.nan)
                    else:
                        x, y = x[visible], y[visible]
                color = palette[i % len(palette)]
                style = _style(graph, i)
                if graph.type == "line":
                    order = np.argsort(x, kind="stable")
                    if style is None:
                        axis.plot(x[order], y[order], color=color, marker="o" if graph.show_points else None, markersize=4, linewidth=1.5, label=column.name)
                    else:
                        axis.plot(x[order], y[order], color=style.color, linewidth=style.line_width, label=column.name)
                        if style.symbols:
                            axis.scatter(x, y, zorder=3, **_point_kwargs(style, color))
                elif style is None or style.symbols:
                    axis.scatter(x, y, label=column.name, **_point_kwargs(style, color, 26))
                fit = next((fit for fit in outcome["fit"] if fit["series"] == column.name), None)
                if fit:
                    points = fit["points"]
                    if data.analysis == "dose_response":
                        points = [p for p in points if p["x"] > 0]
                    axis.plot([p["x"] for p in points], [p["y"] for p in points], color=color, linewidth=1.5)
            if data.analysis == "dose_response":
                axis.set_xscale("log")
            axis.set_xlabel(graph.x_label or data.columns[0].name)
            _legend(axis, data, graph, True)
        else:
            tops, lows = {}, [0.0] if graph.type == "bar" else []
            for i, column in enumerate(data.columns):
                y = values(column)
                if not len(y):
                    continue
                color = palette[i % len(palette)]
                style = _style(graph, i)
                summary = descriptive(column.name, y, data.confidence)
                error = summary[graph.error] if graph.error in {"sd", "sem"} else (summary["ci_high"]-summary["mean"] if graph.error == "ci" and summary["ci_high"] is not None else None)
                tops[i] = max(float(np.max(y)), summary["mean"] + (error or 0))
                lows.append(min(float(np.min(y)), summary["mean"] - (error or 0)))
                if graph.type == "bar":
                    axis.bar(i, summary["mean"], **_bar_kwargs(style, color, graph))
                elif graph.type == "box":
                    axis.boxplot([y], positions=[i], widths=BAR_WIDTH if style else .5, whis=(0, 100), patch_artist=True, showfliers=not graph.show_points, manage_ticks=False, **_box_kwargs(style, color))
                if graph.type != "box" and style is not None:
                    if graph.type == "scatter":
                        axis.plot([i - MEAN_HALF, i + MEAN_HALF], [summary["mean"]] * 2, color=style.error_color, linewidth=1.5, zorder=4)
                    if error is not None and style.error_bars:
                        _styled_errors(axis, i, summary["mean"], error, style)
                elif graph.type != "box":
                    axis.errorbar(i, summary["mean"], yerr=error, color="black", fmt="_", markersize=22, markeredgewidth=2, capsize=5, elinewidth=1.5, capthick=1.5, zorder=4)
                if (style.symbols if style else graph.show_points or graph.type == "scatter"):
                    jitter = np.random.default_rng(i).uniform(-.13, .13, size=len(y))
                    axis.scatter(i+jitter, y, zorder=3, **_point_kwargs(style, color))
            if graph.type == "line":
                means = [s["mean"] if s["mean"] is not None else np.nan
                         for s in outcome.get("graph_summary", outcome["summary"])]
                axis.plot(range(len(means)), means, color=palette[0], linewidth=1.5)
            if tops and graph.annotations:
                draw_brackets(axis, graph.annotations, tops, min(lows + list(tops.values())))
            _category_ticks(axis, data, graph)
            _legend(axis, data, graph, False)
            axis.set_xlabel(graph.x_label)
        axis.set_ylabel(graph.y_label or "Value")
        axis.set_title(graph.title, pad=15, fontweight="bold")
        axis.tick_params(direction="out")
        output = io.BytesIO()
        figure.savefig(output, **_save_options(request))
        figure.clear()
        content = output.getvalue()
        if request.format == "svg" and request.width_inches is not None:
            content = _scale_svg(content, request.width_inches / EXPORT_SIZE[0])
        return content


def _save_options(request):
    """savefig arguments for File > Export: format, resolution, size, background."""
    options = {"format": request.format, "transparent": request.transparent}
    scale = (request.width_inches or EXPORT_SIZE[0]) / EXPORT_SIZE[0]
    if request.format in RASTER_FORMATS:
        dpi = request.dpi or 160
        # Rendering at a scaled resolution enlarges or shrinks everything,
        # text included; the file still records the chosen resolution.
        options["dpi"] = dpi * scale
        options["pil_kwargs"] = {"dpi": (dpi, dpi)}
        if request.format == "tiff" and _has_libtiff():
            options["pil_kwargs"]["compression"] = "tiff_lzw"
        if request.format == "jpeg":
            options["pil_kwargs"]["quality"] = 95
    if request.format in {"svg", "pdf"}:
        options["metadata"] = {"Creator": "GP independent scientific workbench"}
    return options


def _has_libtiff():
    """LZW-compressed TIFF needs Pillow's libtiff codec, which some builds
    (such as the browser runtime) may lack; those write uncompressed TIFF."""
    from PIL import features
    return bool(features.check_codec("libtiff"))


def _scale_svg(content, scale):
    """Enlarge or shrink an SVG uniformly by rewriting its outer size; the
    viewBox keeps every coordinate, so text and lines scale together."""
    text = content.decode("utf-8")
    start = text.index("<svg")
    end = text.index(">", start)
    tag = text[start:end]
    def size(match):
        return f'{match.group(1)}="{float(match.group(2)) * scale:.3f}pt"'
    scaled = re.sub(r'\b(width|height)="([0-9.]+)pt"', size, tag, count=2)
    return (text[:start] + scaled + text[end:]).encode("utf-8")
