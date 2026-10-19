"""Independent evaluations of selected equations observed in Prism 11 resources.

The registry cites archived equation records, not executable implementation.
Fitting uses GP's unweighted SciPy least_squares with normalized coordinates,
multiple starting points, positive rates/widths, and finite search bounds.
These choices are not recovered Prism optimizer settings. No parameter CIs,
weighting, robust losses, shared parameters, or constrained user fits are offered.
"""

from __future__ import annotations

import numpy as np
from scipy import optimize, special


class ModelFitError(ValueError):
    """Invalid data or a failed/undefined fit."""


MODEL_REGISTRY = {
    "one_phase_decay": {
        "name": "One phase decay",
        "parameters": ["Y0", "Plateau", "K"],
        "x_domain": "nonnegative",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Exponential",
            "equation_name": "One phase decay",
            "object_index": 6,
            "sha256": "086aec6497c311b736375096a68d730b5ec46efc32fe3f7cf391e75f30f704f1",
        },
        "parameter_domains": {"K": "strictly positive"},
        "fit_method": "GP scaled unweighted least_squares, finite bounds, multiple "
        "starts; not Prism optimizer parity",
    },
    "one_phase_association": {
        "name": "One-phase association",
        "parameters": ["Y0", "Plateau", "K"],
        "x_domain": "nonnegative",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Exponential",
            "equation_name": "One-phase association",
            "object_index": 155,
            "sha256": "086aec6497c311b736375096a68d730b5ec46efc32fe3f7cf391e75f30f704f1",
        },
        "parameter_domains": {"K": "strictly positive"},
        "fit_method": "GP scaled unweighted least_squares, finite bounds, "
        "multiple starts; not Prism optimizer parity",
    },
    "two_phase_decay": {
        "name": "Two phase decay",
        "parameters": ["Y0", "Plateau", "PercentFast", "KFast", "KSlow"],
        "x_domain": "nonnegative",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Exponential",
            "equation_name": "Two phase decay",
            "object_index": 84,
            "sha256": "086aec6497c311b736375096a68d730b5ec46efc32fe3f7cf391e75f30f704f1",
        },
        "parameter_domains": {
            "KFast": "strictly positive",
            "KSlow": "strictly positive",
            "PercentFast": "0 through 100; fitted components " "ordered KFast >= KSlow",
        },
        "fit_method": "GP scaled unweighted least_squares, finite bounds, multiple "
        "starts; not Prism optimizer parity",
    },
    "michaelis_menten": {
        "name": "Michaelis-Menten",
        "parameters": ["Vmax", "Km"],
        "x_domain": "nonnegative",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Enzyme kinetics - "
            "Velocity as a function of substrate",
            "equation_name": "Michaelis-Menten",
            "object_index": 6,
            "sha256": "fa84d19aedbe18642b04ca290ddcb6fab6abcd3879ebaf61ef11edeb391dd1d6",
        },
        "parameter_domains": {"Km": "strictly positive"},
        "fit_method": "GP scaled unweighted least_squares, finite bounds, multiple "
        "starts; not Prism optimizer parity",
    },
    "gaussian": {
        "name": "Gaussian",
        "parameters": ["Amplitude", "Mean", "SD"],
        "x_domain": "finite",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Gaussian",
            "equation_name": "Gaussian",
            "object_index": 6,
            "sha256": "7ad0d2895ef9ac19caf47647149cd19ff38821b887545061d744da8cdaf9ae11",
        },
        "parameter_domains": {"SD": "strictly positive"},
        "fit_method": "GP scaled unweighted least_squares, finite bounds, multiple starts; "
        "not Prism optimizer parity",
    },
    "straight_line": {
        "name": "Straight line",
        "parameters": ["YIntercept", "Slope"],
        "x_domain": "finite",
        "x_interpretation": "original units",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Lines",
            "equation_name": "Straight line",
            "object_index": 6,
            "sha256": "f8e82b7d31c9c73283140b9ac9dcd513d2c47f2d5ce2045ee6dd199c2b50b50d",
        },
        "parameter_domains": {},
        "fit_method": "GP scaled unweighted least_squares, finite bounds, multiple "
        "starts; not Prism optimizer parity",
    },
    "log_dose_stimulation": {
        "name": "log(agonist) vs. response -- Variable slope (four parameters)",
        "parameters": ["Bottom", "Top", "LogEC50", "HillSlope"],
        "x_domain": "finite",
        "x_interpretation": "log10 concentration",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Dose-response "
            "- Stimulation",
            "equation_name": "log(agonist) vs. response -- Variable slope "
            "(four parameters)",
            "object_index": 57,
            "sha256": "3ced987d8c87e3e1d1e75d10f1ccd44a30a68b645ef0ccd8d7dbbf88884e912e",
        },
        "parameter_domains": {
            "HillSlope": "any finite value; negative means "
            "inhibition, positive means "
            "stimulation"
        },
        "fit_method": "GP scaled unweighted least_squares, finite bounds, "
        "multiple starts; not Prism optimizer parity",
    },
    "log_dose_inhibition": {
        "name": "log(inhibitor) vs. response -- Variable slope (four parameters)",
        "parameters": ["Bottom", "Top", "LogIC50", "HillSlope"],
        "x_domain": "finite",
        "x_interpretation": "log10 concentration",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Dose-response "
            "- Inhibition",
            "equation_name": "log(inhibitor) vs. response -- Variable "
            "slope (four parameters)",
            "object_index": 57,
            "sha256": "b4e974d0d0a9a9a8117912d328b6288c8937028234bd0204d37430b1557d16b3",
        },
        "parameter_domains": {
            "HillSlope": "any finite value; negative means "
            "inhibition, positive means "
            "stimulation"
        },
        "fit_method": "GP scaled unweighted least_squares, finite bounds, "
        "multiple starts; not Prism optimizer parity",
    },
    "normalized_dose_inhibition": {
        "name": "[Inhibitor] vs. normalized response -- Variable slope ",
        "parameters": ["IC50", "HillSlope"],
        "x_domain": "nonnegative",
        "x_interpretation": "concentration (not log transformed)",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Dose-response - Inhibition",
            "equation_name": "[Inhibitor] vs. normalized response -- Variable slope ",
            "object_index": 209,
            "sha256": "b4e974d0d0a9a9a8117912d328b6288c8937028234bd0204d37430b1557d16b3",
        },
        "parameter_domains": {
            "IC50": "strictly positive",
            "HillSlope": "any finite value; negative means inhibition",
        },
        "fixed_plateaus": {"Bottom": 0.0, "Top": 100.0},
        "fit_method": "GP unweighted least_squares in scaled log10 coordinates; fixed 0/100 plateaus; no Prism optimizer or parameter CI parity",
    },
    "normalized_log_dose_inhibition": {
        "name": "log(inhibitor) vs. normalized response -- Variable slope",
        "parameters": ["LogIC50", "HillSlope"],
        "x_domain": "finite",
        "x_interpretation": "log10 concentration",
        "source": {
            "relative_path": "SharedSupport/Equations/Cache/Dose-response - Inhibition",
            "equation_name": "log(inhibitor) vs. normalized response -- Variable slope",
            "object_index": 108,
            "sha256": "b4e974d0d0a9a9a8117912d328b6288c8937028234bd0204d37430b1557d16b3",
        },
        "parameter_domains": {
            "HillSlope": "any finite value; negative means inhibition"
        },
        "fixed_plateaus": {"Bottom": 0.0, "Top": 100.0},
        "fit_method": "GP unweighted least_squares in scaled log10 coordinates; fixed 0/100 plateaus; no Prism optimizer or parameter CI parity",
    },
}


def _array(values, label):
    try:
        value = np.asarray(values, dtype=float)
    except (TypeError, ValueError) as error:
        raise ModelFitError(f"{label} must contain numbers.") from error
    if value.ndim != 1 or not len(value) or not np.all(np.isfinite(value)):
        raise ModelFitError(f"{label} must be a nonempty finite numeric vector.")
    if np.max(np.abs(value)) > 1e100:
        raise ModelFitError(f"{label} magnitudes must not exceed 1e100.")
    return value


def _model(model_id):
    if model_id not in MODEL_REGISTRY:
        raise ModelFitError(f"Unknown regression model: {model_id}.")
    return MODEL_REGISTRY[model_id]


def _concentration_fraction(x, log_midpoint, hill):
    """Logistic fraction on nonnegative concentrations, including the X=0 limit.

    Positive Hill reaches the lower plateau at zero; negative Hill reaches
    the upper plateau. Hill=0 is the constant halfway curve, defined by
    continuation from positive concentrations (its midpoint is unidentified).
    Evaluate logs only on positive doses, never log(0) or 0 * infinity.
    """
    x = np.asarray(x, dtype=float)
    zero_value = 0.5 if hill == 0 else float(hill < 0)
    fraction = np.full_like(x, zero_value)
    positive = x > 0
    fraction[positive] = special.expit(hill * (np.log(x[positive]) - log_midpoint))
    return fraction


def _concentration_grid(x, count=200):
    """Keep the zero endpoint separate from logarithmically spaced positive doses."""
    positive = x[x > 0]
    has_zero = bool(np.any(x == 0))
    grid = np.geomspace(np.min(positive), np.max(positive), count - int(has_zero))
    return np.concatenate(([0.0], grid)) if has_zero else grid


def _calculate(model_id, x, p):
    if model_id == "normalized_dose_inhibition":
        midpoint, hill = p
        return 100 * _concentration_fraction(x, np.log(midpoint), hill)
    if model_id == "normalized_log_dose_inhibition":
        midpoint, hill = p
        return 100 * special.expit(np.log(10) * hill * (x - midpoint))
    if model_id in {"one_phase_decay", "one_phase_association"}:
        y0, plateau, rate = p
        return y0 + (plateau - y0) * (-np.expm1(-rate * x))
    if model_id == "two_phase_decay":
        y0, plateau, percent, fast, slow = p
        return plateau + (y0 - plateau) * (
            percent * 0.01 * np.exp(-fast * x)
            + (1 - percent * 0.01) * np.exp(-slow * x)
        )
    if model_id == "michaelis_menten":
        vmax, km = p
        return vmax * (x / (km + x))
    if model_id == "gaussian":
        amplitude, mean, sd = p
        return amplitude * np.exp(-0.5 * ((x - mean) / sd) ** 2)
    if model_id == "straight_line":
        intercept, slope = p
        return intercept + slope * x
    bottom, top, midpoint, hill = p
    return bottom + (top - bottom) * special.expit(np.log(10) * hill * (x - midpoint))


def evaluate_model(model_id, x, parameters):
    """Evaluate named parameters in original units; log-dose X is already log10."""
    model = _model(model_id)
    x = _array(x, "X")
    if model["x_domain"] == "nonnegative" and np.any(x < 0):
        raise ModelFitError("This model requires nonnegative X values.")
    if model["x_domain"] == "positive" and np.any(x <= 0):
        raise ModelFitError(
            "This model requires strictly positive concentrations; zero-dose controls cannot be fitted."
        )
    if set(parameters) != set(model["parameters"]):
        raise ModelFitError(
            "Provide exactly these parameters: " + ", ".join(model["parameters"])
        )
    p = _array([parameters[key] for key in model["parameters"]], "Parameters")
    numeric_parameters = dict(zip(model["parameters"], p))
    for key in ("K", "KFast", "KSlow", "Km", "SD", "IC50"):
        if key in numeric_parameters and numeric_parameters[key] <= 0:
            raise ModelFitError(f"{key} must be strictly positive.")
    if (
        "PercentFast" in numeric_parameters
        and not 0 <= numeric_parameters["PercentFast"] <= 100
    ):
        raise ModelFitError("PercentFast must be between 0 and 100.")
    with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
        result = _calculate(model_id, x, p)
    if not np.all(np.isfinite(result)):
        raise ModelFitError("Model evaluation exceeded the finite numerical range.")
    return result


def _starts_and_bounds(model_id, x, y):
    """All bounds are GP choices in normalized coordinates."""
    low, high = float(np.min(y)), float(np.max(y))
    order = np.argsort(x)
    first, last = float(y[order[0]]), float(y[order[-1]])
    if model_id in {"one_phase_decay", "one_phase_association"}:
        return (
            [[first, last, k] for k in (0.2, 1, 4, 16)],
            [-100, -100, 1e-8],
            [100, 100, 1e4],
        )
    if model_id == "two_phase_decay":
        return (
            [
                [first, last, percent, fast, slow]
                for percent in (25, 75)
                for fast, slow in ((2, 0.2), (10, 1), (40, 4))
            ],
            [-100, -100, 0, 1e-8, 1e-8],
            [100, 100, 100, 1e4, 1e4],
        )
    if model_id == "michaelis_menten":
        return [[last * 1.2, km] for km in (0.05, 0.5, 2)], [-100, 1e-8], [100, 1e4]
    if model_id == "gaussian":
        peak = int(np.argmax(np.abs(y)))
        return (
            [[float(y[peak]), float(x[peak]), sd] for sd in (0.05, 0.2, 0.5)],
            [-100, -5, 1e-6],
            [100, 5, 100],
        )
    if model_id == "straight_line":
        return [[float(np.mean(y)), last - first]], [-1e4, -1e4], [1e4, 1e4]
    return (
        [
            [low, high, midpoint, hill]
            for midpoint in (-0.25, 0, 0.25)
            for hill in (-2, 2)
        ],
        [-100, -100, -5, -100],
        [100, 100, 5, 100],
    )


def _original_parameters(model_id, p, xoffset, xscale, yscale):
    p = p.copy()
    if model_id in {"one_phase_decay", "one_phase_association"}:
        p[:2] *= yscale
        p[2] /= xscale
    elif model_id == "two_phase_decay":
        p[:2] *= yscale
        p[3:] /= xscale
        if p[3] < p[4]:
            p[3], p[4] = p[4], p[3]
            p[2] = 100 - p[2]
    elif model_id == "michaelis_menten":
        p[0] *= yscale
        p[1] *= xscale
    elif model_id == "gaussian":
        p[0] *= yscale
        p[1] = p[1] * xscale + xoffset
        p[2] *= xscale
    elif model_id == "straight_line":
        p[1] *= yscale / xscale
        p[0] = p[0] * yscale - p[1] * xoffset
    else:
        p[:2] *= yscale
        p[2] = p[2] * xscale + xoffset
        p[3] /= xscale
        if p[0] > p[1]:
            p[0], p[1] = p[1], p[0]
            p[3] *= -1
    return dict(zip(MODEL_REGISTRY[model_id]["parameters"], map(float, p)))


def _fit_normalized_inhibition(model_id, x, y):
    """Fit the fixed 0/100 equation without rescaling its plateau values.

    The six starts and finite midpoint/slope bounds are independent GP choices.
    Raw-concentration IC50 positivity is enforced by fitting its logarithm.
    """
    raw_dose = model_id == "normalized_dose_inhibition"
    positive = x > 0 if raw_dose else np.ones(len(x), dtype=bool)
    has_zero = raw_dose and bool(np.any(~positive))
    if raw_dose and len(np.unique(x[positive])) < 2:
        raise ModelFitError(
            "The normalized dose fit needs at least two distinct positive concentrations; "
            "zero controls do not identify the midpoint or Hill slope."
        )
    # Zero controls have a fixed model endpoint; they enter the residual vector
    # and SSE/df, but never logarithmic scaling or initial midpoint estimates.
    observed_logx = np.log10(x[positive]) if raw_dose else x
    offset = float(np.min(observed_logx) + np.ptp(observed_logx) / 2)
    scale = float(np.ptp(observed_logx))
    logx = np.full_like(x, offset)
    logx[positive] = observed_logx
    if scale == 0:
        raise ModelFitError(
            "Concentrations are indistinguishable at logarithmic numerical precision."
        )
    normalized_x, normalized_y = (logx - offset) / scale, y / 100

    def residual(p):
        predicted = special.expit(np.log(10) * p[1] * (normalized_x - p[0]))
        if has_zero:
            predicted[~positive] = float(p[1] < 0)
        return predicted - normalized_y

    candidates = []
    for midpoint in (-0.25, 0.0, 0.25):
        for hill in (-2.0, 2.0):
            try:
                fit = optimize.least_squares(
                    residual,
                    [midpoint, hill],
                    # With zero controls the endpoint changes discontinuously
                    # across Hill=0; optimize each direction separately.
                    bounds=(
                        [-5.0, 1e-8 if has_zero and hill > 0 else -100.0],
                        [5.0, -1e-8 if has_zero and hill < 0 else 100.0],
                    ),
                    max_nfev=4000,
                    ftol=1e-12,
                    xtol=1e-12,
                    gtol=1e-12,
                )
                if fit.success and np.all(np.isfinite(fit.fun)):
                    candidates.append(fit)
            except (ValueError, FloatingPointError):
                continue
    if not candidates:
        raise ModelFitError("The normalized inhibition fit did not converge.")
    best = min(candidates, key=lambda fit: fit.cost)
    midpoint, hill = float(best.x[0] * scale + offset), float(best.x[1] / scale)
    with np.errstate(over="ignore", under="ignore"):
        converted_midpoint = float(np.power(10.0, midpoint)) if raw_dose else midpoint
    if not np.isfinite(converted_midpoint) or raw_dose and converted_midpoint <= 0:
        raise ModelFitError("The fitted IC50 exceeds the finite numerical range.")
    parameters = {
        "IC50" if raw_dose else "LogIC50": converted_midpoint,
        "HillSlope": hill,
    }
    predicted = evaluate_model(model_id, x, parameters)
    sse = float(np.sum((y - predicted) ** 2))
    sst = float(np.sum((y - np.mean(y)) ** 2))
    notices = [
        "Independent GP unweighted least-squares fit with fixed 0% and 100% plateaus; observations are not renormalized. Prism optimizer behavior and profile-likelihood confidence intervals have not been reproduced."
    ]
    singular = np.linalg.svd(best.jac, compute_uv=False)
    if singular[-1] <= singular[0] * 1e-6:
        notices.append(
            "Parameters are weakly identified; collect observations around the midpoint."
        )
    if np.any(best.active_mask):
        notices.append(
            "The fit reached a GP search bound; parameters may be unreliable."
        )
    if has_zero:
        notices.append(
            "Zero-dose observations are included in the fit. A logarithmic X axis cannot display X=0."
        )
    if not np.min(observed_logx) <= midpoint <= np.max(observed_logx):
        notices.append(
            "The fitted midpoint lies outside the measured concentration range."
        )
    if hill > 0:
        notices.append(
            "The fitted direction increases with concentration, opposite to the inhibition label."
        )
    grid = (
        _concentration_grid(x)
        if raw_dose
        else np.linspace(np.min(x), np.max(x), 200)
    )
    curve = evaluate_model(model_id, grid, parameters)
    return dict(
        model_id=model_id,
        parameters=parameters,
        points=[dict(x=float(a), y=float(b)) for a, b in zip(grid, curve)],
        r_squared=1 - sse / sst if sst else None,
        sse=sse,
        residual_df=len(x) - 2,
        warnings=notices,
        source=dict(MODEL_REGISTRY[model_id]["source"]),
    )


def fit_model(model_id, x, y):
    """Return a JSON-safe independent least-squares fit and its limitations."""
    model = _model(model_id)
    x, y = _array(x, "X"), _array(y, "Y")
    count = len(model["parameters"])
    if len(x) != len(y) or len(x) <= count:
        raise ModelFitError(
            f"This fit needs matching X/Y vectors and at least {count+1} observations."
        )
    if len(np.unique(x)) < count or np.ptp(x) == 0:
        raise ModelFitError(f"This fit needs at least {count} distinct X values.")
    if model["x_domain"] == "nonnegative" and np.any(x < 0):
        raise ModelFitError("This model requires nonnegative X values.")
    if model["x_domain"] == "positive" and np.any(x <= 0):
        raise ModelFitError(
            "This model requires strictly positive concentrations; zero-dose controls cannot be fitted."
        )
    if np.ptp(y) == 0 and model_id != "straight_line":
        raise ModelFitError("Constant Y does not identify this nonlinear model.")
    if model_id in {"normalized_dose_inhibition", "normalized_log_dose_inhibition"}:
        return _fit_normalized_inhibition(model_id, x, y)
    xoffset = (
        0.0 if model["x_domain"] == "nonnegative" else float(np.min(x) + np.ptp(x) / 2)
    )
    xscale = (
        float(np.max(x)) if model["x_domain"] == "nonnegative" else float(np.ptp(x))
    )
    yscale = float(np.max(np.abs(y))) or 1.0
    xn, yn = (x - xoffset) / xscale, y / yscale
    starts, lower, upper = _starts_and_bounds(model_id, xn, yn)
    candidates = []
    for start in starts:
        try:
            result = optimize.least_squares(
                lambda p: _calculate(model_id, xn, p) - yn,
                start,
                bounds=(lower, upper),
                max_nfev=4000,
                ftol=1e-12,
                xtol=1e-12,
                gtol=1e-12,
            )
            if result.success and np.all(np.isfinite(result.fun)):
                candidates.append(result)
        except (ValueError, FloatingPointError):
            continue
    if not candidates:
        raise ModelFitError(
            "The fit did not converge; check the range and shape of the observations."
        )
    best = min(candidates, key=lambda fit: fit.cost)
    parameters = _original_parameters(model_id, best.x, xoffset, xscale, yscale)
    predicted = evaluate_model(model_id, x, parameters)
    residual = (y - predicted) / yscale
    sse_scaled = float(residual @ residual)
    sst_scaled = float(np.sum((yn - np.mean(yn)) ** 2))
    notices = [
        "Independent GP unweighted least-squares fit; Prism optimizer defaults have not been reproduced. Parameter confidence intervals are not estimated."
    ]
    singular = np.linalg.svd(best.jac, compute_uv=False)
    if singular[-1] <= singular[0] * 1e-6:
        notices.append(
            "Parameters are weakly identified; widen the X range and collect observations spanning the curve."
        )
    if np.any(best.active_mask):
        notices.append(
            "The fit reached a GP search bound; parameters may be unreliable."
        )
    if model_id == "two_phase_decay":
        notices.append(
            "Two-phase fits can have competing solutions; fast and slow components are ordered by fitted rate."
        )
        if (
            parameters["KFast"] / parameters["KSlow"] < 1.5
            or min(parameters["PercentFast"], 100 - parameters["PercentFast"]) < 1
        ):
            notices.append(
                "The two decay components are weakly separated or one component has negligible amplitude."
            )
    if model_id.startswith("log_dose"):
        midpoint = parameters[
            "LogEC50" if model_id.endswith("stimulation") else "LogIC50"
        ]
        if not np.min(x) <= midpoint <= np.max(x):
            notices.append("The fitted midpoint lies outside the measured X range.")
        if (
            parameters["HillSlope"] * (1 if model_id.endswith("stimulation") else -1)
            < 0
        ):
            notices.append(
                "The fitted direction is opposite to the selected model's stimulation/inhibition label."
            )
    if model_id == "michaelis_menten" and parameters["Km"] > np.max(x):
        notices.append(
            "Km exceeds the measured substrate range; the saturation plateau is extrapolated."
        )
    if model_id == "gaussian" and not np.min(x) <= parameters["Mean"] <= np.max(x):
        notices.append("The fitted Gaussian center lies outside the measured X range.")
    if sst_scaled == 0:
        notices.append("Y is constant; R squared is undefined.")
    grid = np.linspace(np.min(x), np.max(x), 200)
    curve = evaluate_model(model_id, grid, parameters)
    return dict(
        model_id=model_id,
        parameters=parameters,
        points=[dict(x=float(a), y=float(b)) for a, b in zip(grid, curve)],
        r_squared=1 - sse_scaled / sst_scaled if sst_scaled else None,
        sse=sse_scaled * yscale**2,
        residual_df=len(x) - count,
        warnings=notices,
        source=dict(model["source"]),
    )
