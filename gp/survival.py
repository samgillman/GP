"""Independent right-censored Kaplan–Meier and Mantel–Cox calculations.

Each row is one subject observed from time zero; event=1 is an event and
event=0 is right censoring. At a tied time, events use the risk set before
either events or censorings are removed. No delayed entry or weights.
Log-log Greenwood intervals match all saved interior intervals in one
bundled Prism example; this is not general Prism runtime parity.
"""

from collections.abc import Mapping

import numpy as np
from scipy import stats


class SurvivalError(ValueError):
    pass


def _observations(times, events):
    try:
        times, events = np.asarray(times, dtype=float), np.asarray(events, dtype=float)
    except (ValueError, TypeError) as error:
        raise SurvivalError("Times and event codes must be numeric.") from error
    if times.ndim != 1 or events.ndim != 1 or not 0 < len(times) <= 100000:
        raise SurvivalError(
            "Provide between 1 and 100,000 subjects as one-dimensional vectors."
        )
    if len(times) != len(events):
        raise SurvivalError("Each time must have one event code.")
    if not np.all(np.isfinite(times)) or np.any(times < 0) or np.any(times > 1e100):
        raise SurvivalError(
            "Times must be finite, nonnegative, and no greater than 1e100."
        )
    if not np.all(np.isin(events, (0, 1))):
        raise SurvivalError(
            "Use event=1 for events and event=0 for censoring; missing codes must be resolved first."
        )
    return times, events.astype(int)


def _confidence(confidence):
    if not isinstance(confidence, (float, int)) or not 0.5 <= confidence <= 0.999:
        raise SurvivalError("Confidence must be between 0.5 and 0.999.")
    return float(stats.norm.ppf((1 + confidence) / 2))


def _interval(survival, greenwood, critical):
    if survival in (0.0, 1.0):
        return None, None
    log_survival = np.log(survival)
    offset = critical * np.sqrt(greenwood) / abs(log_survival)
    # exp(-exp(log(-log(S)) +/- offset)) avoids exponentiating a large
    # positive value when numerical underflow would correctly give zero.
    loglog = np.log(-log_survival)
    lower = np.exp(-np.exp(min(709.0, loglog + offset)))
    upper = np.exp(-np.exp(min(709.0, loglog - offset)))
    return float(lower), float(upper)


def kaplan_meier(times, events, confidence=0.95):
    """Risk/event/censor table at each observed time, with post-event survival.

    ``table`` includes a time-zero baseline when no observation occurs there.
    Survival/CI values are fractions. Intervals at S=0 or S=1 are undefined
    for the selected log-log transform and are returned as None. Censor-only
    rows carry the preceding interval; a graph may suppress its error bar.
    Median is the first time survival reaches 0.5, with no interpolation.
    Median interval endpoints are first crossings of the confidence bounds.
    """
    times, events = _observations(times, events)
    critical = _confidence(confidence)
    unique, inverse, totals = np.unique(times, return_inverse=True, return_counts=True)
    deaths = np.bincount(inverse, weights=events).astype(int)
    table = []
    risk = len(times)
    survival, greenwood = 1.0, 0.0
    if unique[0] > 0:
        table.append(
            dict(
                time=0.0,
                at_risk=risk,
                events=0,
                censored=0,
                survival=1.0,
                ci_lower=None,
                ci_upper=None,
            )
        )
    median = median_lower = median_upper = None
    for time, total, death in zip(unique, totals, deaths):
        if death:
            survival *= 1 - death / risk
            if death < risk:
                greenwood += death / (risk * (risk - death))
        lower, upper = _interval(survival, greenwood, critical)
        row = dict(
            time=float(time),
            at_risk=risk,
            events=int(death),
            censored=int(total - death),
            survival=float(survival),
            ci_lower=lower,
            ci_upper=upper,
        )
        table.append(row)
        if median is None and survival <= 0.5:
            median = float(time)
        if median_lower is None and (
            lower is not None and lower <= 0.5 or survival == 0
        ):
            median_lower = float(time)
        if median_upper is None and (
            upper is not None and upper <= 0.5 or survival == 0
        ):
            median_upper = float(time)
        risk -= int(total)
    warnings = []
    if not np.any(events):
        warnings.append(
            "No events were observed; survival remains 1 and the median is not reached."
        )
    elif median is None:
        warnings.append("Median survival was not reached during observation.")
    return dict(
        n=len(times),
        events=int(np.sum(events)),
        censored=int(len(times) - np.sum(events)),
        median=median,
        median_ci_lower=median_lower,
        median_ci_upper=median_upper,
        confidence=confidence,
        ci_method="log-log Greenwood",
        table=table,
        warnings=warnings,
    )


def _groups(groups):
    if not isinstance(groups, Mapping) or not 1 <= len(groups) <= 32:
        raise SurvivalError("Provide 1 through 32 named survival groups.")
    validated = {}
    for name, data in groups.items():
        if not isinstance(name, str) or not name.strip() or len(name) > 100:
            raise SurvivalError(
                "Each group needs a nonempty name of at most 100 characters."
            )
        if not isinstance(data, Mapping) or "times" not in data or "events" not in data:
            raise SurvivalError("Each group needs times and events vectors.")
        validated[name] = _observations(data["times"], data["events"])
    if sum(len(t) for t, _ in validated.values()) > 100000:
        raise SurvivalError("At most 100,000 subjects are supported across groups.")
    return validated


def logrank(groups):
    """Unweighted Mantel–Cox test using tied-time hypergeometric covariance.

    A rank-deficient covariance uses its estimable rank as df and emits a
    warning. With no comparison information, statistic/p_value are None.
    No pairwise multiplicity adjustment or proportional-hazards estimate.
    """
    data = _groups(groups)
    if len(data) < 2:
        raise SurvivalError("Logrank comparison requires at least two groups.")
    names = list(data)
    event_times = np.unique(np.concatenate([t[e == 1] for t, e in data.values()]))
    risk = np.empty((len(event_times), len(data)))
    deaths = np.zeros_like(risk)
    for column, (times, events) in enumerate(data.values()):
        risk[:, column] = len(times) - np.searchsorted(
            np.sort(times), event_times, side="left"
        )
        if np.any(events):
            location = np.searchsorted(event_times, times[events == 1])
            deaths[:, column] = np.bincount(location, minlength=len(event_times))
    n, d = np.sum(risk, axis=1), np.sum(deaths, axis=1)
    fractions = risk / n[:, None]
    expected = np.sum(fractions * d[:, None], axis=0)
    observed = np.sum(deaths, axis=0)
    factors = np.zeros_like(n)
    valid = n > 1
    factors[valid] = d[valid] * (n[valid] - d[valid]) / (n[valid] - 1)
    covariance = np.diag(np.sum(factors[:, None] * fractions, axis=0)) - fractions.T @ (
        factors[:, None] * fractions
    )
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    tolerance = max(float(np.max(np.abs(eigenvalues))), 1.0) * 1e-12
    identifiable = eigenvalues > tolerance
    df = int(np.sum(identifiable))
    warnings = []
    statistic = p_value = None
    if df:
        difference = observed - expected
        scores = eigenvectors[:, identifiable].T @ difference
        statistic = float(np.sum(scores**2 / eigenvalues[identifiable]))
        p_value = float(stats.chi2.sf(statistic, df))
    if df < len(data) - 1:
        warnings.append(
            "The groups do not provide a full-rank survival comparison; only estimable contrasts contribute."
        )
    undefined_reason = None
    if not df:
        undefined_reason = (
            "Logrank test is undefined because no events were observed in any group."
            if not len(event_times) else
            "Logrank test is undefined because there is no event-time comparison information."
        )
        warnings.append(undefined_reason)
    return dict(
        status="defined" if df else "undefined",
        undefined_reason=undefined_reason,
        statistic=statistic,
        df=df,
        p_value=p_value,
        observed=dict(zip(names, map(float, observed))),
        expected=dict(zip(names, map(float, expected))),
        group_order=names,
        covariance=covariance.tolist(),
        warnings=warnings,
    )


def analyze_survival(groups, confidence=0.95):
    """Return named KM curves and an optional global logrank comparison."""
    validated = _groups(groups)
    comparison = logrank(groups) if len(validated) > 1 else None
    return dict(
        curves={
            name: kaplan_meier(t, e, confidence) for name, (t, e) in validated.items()
        },
        logrank=comparison,
        warnings=[
            "Right-censored observations from time zero; no delayed entry, competing risks, hazard ratios, trend tests, or pairwise post-tests are computed."
        ] + (comparison["warnings"] if comparison else []),
    )
