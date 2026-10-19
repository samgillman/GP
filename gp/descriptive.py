"""Additional independently calculated descriptive outputs.

Two saved 14-observation Prism columns corroborate these formulas. Small-n,
nonpositive, and numerical-limit behavior below is explicit GP behavior,
not recovered Prism runtime behavior. This helper does not replace the
existing count/mean/SD/SEM/median/min/max/arithmetic-CI summary fields.
"""

import math

import numpy as np
from scipy import stats


class DescriptiveError(ValueError):
    pass


EXTRA_FIELDS = (
    "sum",
    "range",
    "cv_percent",
    "skewness",
    "excess_kurtosis",
    "q1",
    "q3",
    "p10",
    "p90",
    "geometric_mean",
    "geometric_sd_factor",
    "geometric_ci_low",
    "geometric_ci_high",
    "qc_mean_minus_1sd",
    "qc_mean_plus_1sd",
    "qc_mean_minus_2sd",
    "qc_mean_plus_2sd",
    "qc_mean_minus_3sd",
    "qc_mean_plus_3sd",
)


def extended_summary(data, confidence=0.95):
    """Return extra numeric/null outputs, field reasons, and unique warnings.

    Quantiles use Hyndman–Fan type 6: one-based rank (n+1)*p, with
    endpoint clipping. P10 and P90 are the 10th and 90th percentiles;
    they are not the endpoints of a central 90% interval (P5/P95).
    Geometric statistics use all observations and require every value >0.
    Shape moments require n>=3/n>=4 and nonzero variance. CV is reported
    only for positive means. QC fields are mean +/- sample SD multiples,
    not a fitted quality-control model or pass/fail thresholds.
    """
    try:
        x = np.asarray(data, dtype=float)
    except (TypeError, ValueError) as error:
        raise DescriptiveError("Observations must be numeric.") from error
    if x.ndim != 1 or len(x) > 100000 or not np.all(np.isfinite(x)):
        raise DescriptiveError(
            "Provide a finite vector of at most 100,000 observations; resolve missing values first."
        )
    if np.any(np.abs(x) > 1e100):
        raise DescriptiveError("Observation magnitudes must not exceed 1e100.")
    if not isinstance(confidence, (float, int)) or not 0.5 <= confidence <= 0.999:
        raise DescriptiveError("Confidence must be between 0.5 and 0.999.")
    result = dict.fromkeys(EXTRA_FIELDS)
    reasons = {}

    def unavailable(fields, reason):
        for field in fields:
            reasons[field] = reason

    def assign(field, value):
        value = float(value)
        if math.isfinite(value):
            result[field] = value
        else:
            reasons[field] = "The result exceeds finite numerical precision."

    def exponentiate(field, exponent):
        with np.errstate(over="ignore", under="ignore"):
            value = float(np.exp(exponent))
        if not math.isfinite(value) or value <= 0:
            reasons[field] = (
                "The positive geometric result exceeds the representable numerical range."
            )
        else:
            result[field] = value

    def finish():
        result["undefined_reasons"] = reasons
        result["warnings"] = list(dict.fromkeys(reasons.values()))
        return result

    n = len(x)
    if not n:
        unavailable(EXTRA_FIELDS, "No observations are available.")
        return finish()
    assign("sum", np.sum(x))
    assign("range", np.ptp(x))
    q1, q3, p10, p90 = np.quantile(x, [0.25, 0.75, 0.1, 0.9], method="weibull")
    for field, value in zip(("q1", "q3", "p10", "p90"), (q1, q3, p10, p90)):
        assign(field, value)

    # Normalize before forming powers, so tiny/large unit scales do not
    # underflow/overflow moments or the sample variance.
    differences = x - x[0]
    scale = float(np.max(np.abs(differences))) or 1.0
    centered = differences / scale - np.mean(differences / scale)
    moment2 = float(np.mean(centered**2))
    mean = float(np.mean(x))
    sd = math.sqrt(moment2 * n / (n - 1)) * scale if n > 1 else None
    qc_fields = [field for field in EXTRA_FIELDS if field.startswith("qc_")]
    if n < 2:
        unavailable(
            ["cv_percent", *qc_fields],
            "Sample-SD-based statistics require at least two observations.",
        )
    else:
        if mean <= 0:
            unavailable(
                ["cv_percent"],
                "GP reports coefficient of variation only for a positive arithmetic mean.",
            )
        else:
            with np.errstate(over="ignore", divide="ignore"):
                assign("cv_percent", np.float64(sd) / mean * 100)
        for multiple in (1, 2, 3):
            assign(f"qc_mean_minus_{multiple}sd", mean - multiple * sd)
            assign(f"qc_mean_plus_{multiple}sd", mean + multiple * sd)

    for field, minimum in (("skewness", 3), ("excess_kurtosis", 4)):
        if n < minimum:
            unavailable(
                [field],
                f"Unbiased {field.replace('_', ' ')} requires at least {minimum} observations.",
            )
        elif moment2 == 0:
            unavailable(
                [field],
                "Skewness and kurtosis are undefined when all observations are equal.",
            )
        else:
            # Standardize before computing powers to avoid a tiny moment2
            # denominator when a large baseline accompanies small variation.
            standardized = centered / math.sqrt(moment2)
            if field == "skewness":
                value = math.sqrt(n * (n - 1)) / (n - 2) * np.mean(standardized**3)
            else:
                excess = np.mean(standardized**4) - 3
                value = (n - 1) / ((n - 2) * (n - 3)) * ((n + 1) * excess + 6)
            assign(field, value)

    geometric_fields = [
        field for field in EXTRA_FIELDS if field.startswith("geometric_")
    ]
    if np.any(x <= 0):
        unavailable(
            geometric_fields,
            "Geometric statistics require every observation to be strictly positive; zero or negative observations are not discarded.",
        )
    else:
        logs = np.log(x)
        log_mean = float(np.mean(logs))
        exponentiate("geometric_mean", log_mean)
        if n < 2:
            unavailable(
                ["geometric_sd_factor", "geometric_ci_low", "geometric_ci_high"],
                "Geometric SD and confidence intervals require at least two observations.",
            )
        else:
            log_sd = float(np.std(logs, ddof=1))
            half = float(
                stats.t.ppf((1 + confidence) / 2, n - 1) * log_sd / math.sqrt(n)
            )
            exponentiate("geometric_sd_factor", log_sd)
            exponentiate("geometric_ci_low", log_mean - half)
            exponentiate("geometric_ci_high", log_mean + half)
    return finish()
