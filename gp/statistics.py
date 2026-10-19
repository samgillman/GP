"""Transparent, standard SciPy analyses; no proprietary implementation."""
import warnings
import numpy as np
from scipy import optimize, stats
from .models import AnalysisRequest
from .regression_models import fit_model, ModelFitError, _concentration_fraction, _concentration_grid
from .descriptive import extended_summary


class AnalysisError(ValueError):
    pass


def values(column):
    return np.asarray([v for v in column.values if v is not None], dtype=float)


def pairs(left, right):
    paired = [(x, y) for x, y in zip(left.values, right.values) if x is not None and y is not None]
    if not paired:
        return np.array([], dtype=float), np.array([], dtype=float)
    return np.asarray(paired, dtype=float).T


def descriptive(name, data, confidence):
    n = len(data)
    if not n:
        return dict(name=name, n=0, mean=None, sd=None, sem=None, median=None, min=None, max=None, ci_low=None, ci_high=None)
    mean = float(np.mean(data))
    sd = float(np.std(data, ddof=1)) if n > 1 else None
    sem = sd / np.sqrt(n) if sd is not None else None
    half = float(stats.t.ppf((1 + confidence) / 2, n - 1) * sem) if n > 1 else None
    return dict(name=name, n=n, mean=mean, sd=sd, sem=sem, median=float(np.median(data)), min=float(np.min(data)), max=float(np.max(data)), ci_low=mean-half if half is not None else None, ci_high=mean+half if half is not None else None)


def require(condition, message):
    if not condition:
        raise AnalysisError(message)


def analyze(request: AnalysisRequest):
    columns = request.columns
    data = [values(c) for c in columns]
    summary_columns, summary_data = columns, data
    if request.analysis == "descriptive" and request.table_type == "xy":
        summary_columns, summary_data = columns[1:], data[1:]
    require(any(len(d) for d in summary_data), "Enter at least one numeric observation in the series being analyzed.")
    output = dict(analysis=request.analysis, summary=[descriptive(c.name, d, request.confidence) for c, d in zip(summary_columns, summary_data)], results=[], warnings=[], fit=[])
    results, notices = output["results"], output["warnings"]
    def add(label, value):
        if isinstance(value, (float, np.floating)):
            require(np.isfinite(value), "This dataset produces an undefined or numerically unstable result.")
            value = float(value)
        if isinstance(value, np.integer):
            value = int(value)
        results.append(dict(label=label, value=value))
    if any(v is None for c in columns for v in c.values) or len({len(c.values) for c in columns}) > 1:
        notices.append("Missing observations are excluded; paired and XY analyses retain only complete row pairs.")
    notices.append(f"Mean confidence intervals use the Student t distribution ({request.confidence:.1%} confidence); SD is the sample standard deviation.")
    kind = request.analysis
    if kind == "descriptive":
        if request.table_type == "xy":
            notices.append("Descriptive statistics summarize each Y series independently, including Y observations whose X cell is missing; X is not summarized.")
        for summary, observations in zip(output["summary"], summary_data):
            extra = extended_summary(observations, request.confidence)
            for notice in extra.pop("warnings", []):
                notices.append(f"{summary['name']}: {notice}")
            summary.update(extra)
        notices.append("Quartiles and 10th/90th percentiles use type-6 interpolation. The 10th–90th interval contains the central 80%, not 90%.")
        notices.append("Geometric summaries require all observations to be positive; their confidence interval uses Student t on log values.")
    if kind in {"welch_t", "paired_t", "anova"}:
        require(request.table_type == "column", "Choose a column table for this group comparison.")
    if kind in {"linear_regression", "dose_response", "nonlinear_regression"}:
        require(request.table_type == "xy", "Choose an XY table for regression or dose response.")
    if kind in {"welch_t", "paired_t"}:
        require(len(columns) == 2, "A t-test requires exactly two columns.")
        a, b = data
        if kind == "paired_t":
            a, b = pairs(*columns)
            require(len(a) >= 2, "A paired t-test requires at least two complete row pairs.")
            differences = a-b
            se = float(np.std(differences, ddof=1)/np.sqrt(len(a)))
            df = len(a)-1
            notices.append("Two-sided paired t-test: rows must be matched; differences should be approximately normally distributed.")
            add("Complete pairs", len(a))
        else:
            require(len(a) >= 2 and len(b) >= 2, "Welch's t-test requires at least two observations in each group.")
            va, vb = np.var(a, ddof=1)/len(a), np.var(b, ddof=1)/len(b)
            se = float(np.sqrt(va+vb))
            require(se > 0, "The t-test is undefined because both groups have zero variance.")
            weight = va/(va+vb)
            df = float(1 / (weight**2/(len(a)-1) + (1-weight)**2/(len(b)-1)))
            notices.append("Two-sided Welch t-test assumes independent observations and approximately normal populations; equal variances are not required.")
        require(se > 0, "The paired t-test is undefined because paired differences have zero variance.")
        diff = float(np.mean(a-b)) if kind == "paired_t" else float(np.mean(a)-np.mean(b))
        t = diff/se
        half = float(stats.t.ppf((1+request.confidence)/2, df)*se)
        add("Mean difference (first − second)", diff)
        add("Difference CI lower", diff-half)
        add("Difference CI upper", diff+half)
        add("t statistic", abs(t) if kind == "paired_t" else t)
        add("Degrees of freedom", df)
        add("Two-sided p value", float(2*stats.t.sf(abs(t), df)))
        if kind == "paired_t":
            difference_sd = float(np.std(differences, ddof=1))
            cohen_d = diff / difference_sd
            add("SD of differences", difference_sd)
            add("SEM of differences", se)
            add("R squared", t*t/(t*t+df))
            add("Cohen d (paired differences)", cohen_d)
            add("Hedges g (paired differences)", cohen_d*(1-3/(4*df-1)) if df > 1 else None)
            if df <= 1:
                notices.append("Hedges g (paired differences) is undefined with fewer than three complete pairs: the bias correction requires residual degrees of freedom greater than one.")
            notices.append("Paired t is reported as a magnitude; the mean difference, interval, and effect sizes retain first-minus-second direction.")
    elif kind == "anova":
        require(len(data) >= 2 and all(len(d) >= 2 for d in data), "One-way ANOVA requires at least two groups with two observations each.")
        n = sum(map(len, data)); k = len(data)
        grand = np.mean(np.concatenate(data))
        ss_between = sum(len(d)*(np.mean(d)-grand)**2 for d in data)
        ss_within = sum(np.sum((d-np.mean(d))**2) for d in data)
        require(ss_within > 0, "ANOVA is undefined because within-group variance is zero.")
        f = (ss_between/(k-1))/(ss_within/(n-k))
        add("F statistic", f)
        add("Between-group degrees of freedom", k-1)
        add("Within-group degrees of freedom", n-k)
        add("p value", stats.f.sf(f, k-1, n-k))
        add("Eta squared", ss_between/(ss_between+ss_within))
        notices.append("Ordinary one-way ANOVA assumes independent observations, normally distributed residuals, and equal group variances. No post-hoc comparisons are performed.")
    elif kind == "nonlinear_regression":
        for column in columns[1:]:
            x, y = pairs(columns[0], column)
            try:
                fit = fit_model(request.regression_model, x, y)
            except ModelFitError as exc:
                raise AnalysisError(column.name + ": " + str(exc)) from exc
            for key, value in fit["parameters"].items():
                add(column.name + ": " + key, value)
            add(column.name + ": R squared", fit["r_squared"])
            add(column.name + ": Residual degrees of freedom", fit["residual_df"])
            notices.extend(column.name + ": " + warning for warning in fit["warnings"])
            output["fit"].append(dict(series=column.name, points=fit["points"], parameters=fit["parameters"]))
        notices.append("Model equations follow recovered Prism definitions. Fitting uses independent unweighted optimization; Prism optimizer defaults, parameter confidence intervals, weighting, and global fits are not reproduced.")
    elif kind in {"linear_regression", "dose_response"}:
        notices.append("Each Y series is fitted independently to complete XY row pairs; fits are unweighted and assume independent residuals. No multiple-comparison adjustment is applied.")
        for col in columns[1:]:
            x, y = pairs(columns[0], col)
            prefix = col.name + ": "
            require(len(x) >= 3, prefix + "at least three complete XY pairs are required.")
            require(np.ptp(x) > 0, prefix + "X values must vary.")
            if kind == "linear_regression":
                fit = stats.linregress(x, y)
                slope, intercept = float(fit.slope), float(fit.intercept)
                residual = y-(slope*x+intercept)
                sse = float(np.dot(residual, residual))
                sst = float(np.sum((y-np.mean(y))**2))
                half = float(stats.t.ppf((1+request.confidence)/2, len(x)-2)*fit.stderr) if sst > 0 else None
                params = dict(slope=slope, intercept=intercept)
                add(prefix+"Complete pairs", len(x))
                add(prefix+"Slope", slope)
                add(prefix+"Intercept", intercept)
                add(prefix+"Slope CI lower", slope-half if half is not None else None)
                add(prefix+"Slope CI upper", slope+half if half is not None else None)
                add(prefix+"R squared", 1-sse/sst if sst > 0 else None)
                add(prefix+"Two-sided slope p value", fit.pvalue if sst > 0 else None)
                if sst == 0:
                    notices.append(prefix+"Y is constant; R squared and the slope significance test are undefined.")
                grid = np.linspace(np.min(x), np.max(x), 200)
                predicted = intercept+slope*grid
            else:
                require(len(x) >= 6 and len(np.unique(x)) >= 4, prefix+"4PL fitting requires at least six pairs and four distinct X values.")
                require(np.all(x >= 0), prefix+"4PL dose response requires nonnegative concentrations.")
                positive_x = x[x > 0]
                require(len(np.unique(positive_x)) >= 3, prefix+"4PL fitting requires at least three distinct positive concentrations in addition to any zero controls.")
                has_zero = bool(np.any(x == 0))
                if np.ptp(y) == 0:
                    reason = "Dose-response fit is undefined because Y is constant; EC50 and Hill slope cannot be identified."
                    add(prefix+"Fit status", reason)
                    notices.append(prefix+reason)
                    continue
                # Fit dimensionless responses for numerical stability and constrained, positive EC50.
                ybase, yscale = float(np.min(y)), float(np.ptp(y))
                z = (y-ybase)/yscale
                positive_logx = np.log(positive_x)
                lo, hi = float(np.min(positive_logx)-np.log(1000)), float(np.max(positive_logx)+np.log(1000))
                def four_pl(doses, bottom, top, log_ec50, hill):
                    return bottom+(top-bottom)*_concentration_fraction(doses, log_ec50, hill)
                candidates = []
                # Try the observed monotone direction first. This is only a
                # starting order: noisy fits still compare both directions.
                positive_z = z[x > 0]
                trend = np.dot(positive_logx-np.mean(positive_logx), positive_z-np.mean(positive_z))
                first_direction = 1. if trend >= 0 else -1.
                # z spans one response unit. An average squared residual below
                # double-precision epsilon is an effectively exact curve (RMS
                # below sqrt(eps) of the response span). Another start cannot
                # improve the objective meaningfully at this numerical scale.
                exact_sse = np.finfo(float).eps * len(x)
                for direction in (first_direction, -first_direction):
                    try:
                        with warnings.catch_warnings(record=True):
                            # At zero dose the limiting plateau depends on the
                            # sign of Hill. Keep that sign fixed per candidate.
                            hill_low = 1e-8 if has_zero and direction > 0 else -10
                            hill_high = -1e-8 if has_zero and direction < 0 else 10
                            pars, covariance = optimize.curve_fit(four_pl, x, z, p0=[0, 1, np.median(positive_logx), direction], bounds=([-10, 0, lo, hill_low], [1, 11, hi, hill_high]), maxfev=20000)
                        score = float(np.sum((z-four_pl(x, *pars))**2))
                        candidates.append((score, pars, covariance))
                        if score <= exact_sse and pars[1] > pars[0] and abs(pars[3]) > 1e-8:
                            break
                    except (RuntimeError, ValueError, FloatingPointError):
                        pass
                require(bool(candidates), prefix+"4PL fit did not converge. Check dose coverage and observations.")
                _, pars, covariance = min(candidates, key=lambda item: item[0])
                bottom, top, log_ec50, hill = map(float, pars)
                require(top > bottom and abs(hill) > 1e-8, prefix+"A dose-response curve could not be identified from these observations.")
                params = dict(bottom=ybase+yscale*bottom, top=ybase+yscale*top, ec50=float(np.exp(log_ec50)), hill_slope=hill)
                observed_fit = ybase+yscale*four_pl(x, *pars)
                ss_res = np.sum((y-observed_fit)**2)
                ss_total = np.sum((y-np.mean(y))**2)
                add(prefix+"Complete pairs", len(x))
                for key, value in params.items():
                    add(prefix+("EC50" if key == "ec50" else key.replace("_", " ").title()), value)
                add(prefix+"R squared", 1-ss_res/ss_total)
                add(prefix+"Residual degrees of freedom", len(x)-4)
                grid = _concentration_grid(x)
                predicted = ybase+yscale*four_pl(grid, *pars)
                if has_zero:
                    notices.append(prefix+"Zero-dose observations are included in the fit. A logarithmic X axis cannot display X=0.")
                notices.append(prefix+"4PL: bottom + (top − bottom) / (1 + (EC50 / X)^Hill). Positive Hill increases; negative Hill decreases. Parameter confidence intervals are not estimated.")
                if not np.all(np.isfinite(covariance)) or np.linalg.cond(covariance) > 1e12:
                    notices.append(prefix+"The 4PL parameters are weakly identified; collect more observations spanning both plateaus.")
                if not np.min(x) <= params["ec50"] <= np.max(x):
                    notices.append(prefix+"Estimated EC50 lies outside the observed dose range and is extrapolated.")
                if abs(hill) > 9.99 or bottom < -9.99 or top > 10.99:
                    notices.append(prefix+"The fit reached a parameter bound and may be unreliable.")
            require(np.all(np.isfinite(predicted)) and all(np.isfinite(v) for v in params.values()), prefix+"Fit produced non-finite parameters.")
            output["fit"].append(dict(series=col.name, points=[dict(x=float(xx), y=float(yy)) for xx, yy in zip(grid, predicted)], parameters=params))
        if kind == "dose_response" and not output["fit"]:
            raise AnalysisError("No Y series could be fitted. " + " ".join(
                row["label"] + ": " + row["value"] for row in results if row["label"].endswith(": Fit status")
            ))
    return output
