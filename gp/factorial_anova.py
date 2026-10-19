"""Balanced fixed-effects two-way ANOVA with interaction.

Independent textbook decomposition, checked against a source-hashed saved Prism
example. This module does not implement repeated-measures or unbalanced ANOVA.
"""
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator
from scipy import stats

from .statistics import AnalysisError


class FactorialCell(BaseModel):
    model_config = ConfigDict(extra="forbid")
    row_level: str = Field(min_length=1, max_length=100)
    column_level: str = Field(min_length=1, max_length=100)
    values: list[FiniteFloat] = Field(min_length=2, max_length=10000)


class FactorialAnovaRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    analysis: Literal["two_way_anova"] = "two_way_anova"
    design: Literal["ordinary"] = "ordinary"
    row_factor_name: str = Field(default="Row factor", min_length=1, max_length=100)
    column_factor_name: str = Field(default="Column factor", min_length=1, max_length=100)
    row_levels: list[str] = Field(min_length=2, max_length=32)
    column_levels: list[str] = Field(min_length=2, max_length=32)
    cells: list[FactorialCell] = Field(min_length=4, max_length=1024)

    @model_validator(mode="after")
    def check_design(self):
        for levels in (self.row_levels, self.column_levels):
            if len(set(levels)) != len(levels) or any(not level.strip() or len(level) > 100 for level in levels):
                raise ValueError("Factor levels must have unique, nonempty names of at most 100 characters.")
        expected = {(row, column) for row in self.row_levels for column in self.column_levels}
        observed = [(cell.row_level, cell.column_level) for cell in self.cells]
        if len(set(observed)) != len(observed):
            raise ValueError("Each row/column factor combination must appear exactly once.")
        if set(observed) != expected:
            raise ValueError("Supply every combination of the explicit row and column levels; missing or unknown cells are unsupported.")
        if len({len(cell.values) for cell in self.cells}) != 1:
            raise ValueError("Only balanced designs with the same replicate count in every cell are supported.")
        if sum(len(cell.values) for cell in self.cells) > 100000:
            raise ValueError("At most 100,000 observations are supported.")
        if any(abs(value) > 1e100 for cell in self.cells for value in cell.values):
            raise ValueError("Values must have magnitude no greater than 1e100.")
        return self


def analyze_factorial(request: FactorialAnovaRequest):
    """Calculate ordinary balanced ANOVA; row/column ordering is explicit."""
    lookup = {(cell.row_level, cell.column_level): cell.values for cell in request.cells}
    data = np.asarray([[lookup[(row, column)] for column in request.column_levels]
                       for row in request.row_levels], dtype=float)
    a, b, n = data.shape
    # Center before taking marginal means to reduce cancellation for large offsets.
    center = float(data.flat[0])
    shifted = data - center
    grand = float(np.mean(shifted))
    cell_means = np.mean(shifted, axis=2)
    row_means = np.mean(cell_means, axis=1)
    col_means = np.mean(cell_means, axis=0)
    ss_row = float(b * n * np.sum((row_means - grand) ** 2))
    ss_col = float(a * n * np.sum((col_means - grand) ** 2))
    ss_interaction = float(n * np.sum((cell_means - row_means[:, None] - col_means[None, :] + grand) ** 2))
    ss_error = float(np.sum((shifted - cell_means[:, :, None]) ** 2))
    ss_total = float(np.sum((shifted - grand) ** 2))
    df_error = a * b * (n - 1)
    ms_error = ss_error / df_error
    if not all(np.isfinite(v) for v in (ss_row, ss_col, ss_interaction, ss_error, ss_total)):
        raise AnalysisError("The design produces numerically unstable sums of squares.")
    if ms_error <= 0 or ss_total <= 0:
        raise AnalysisError("Ordinary ANOVA requires positive within-cell residual variance; F tests are undefined for this design.")
    terms = []
    for term, label, ss, df in [
        ("row_factor", request.row_factor_name, ss_row, a - 1),
        ("column_factor", request.column_factor_name, ss_col, b - 1),
        ("interaction", f"{request.row_factor_name} × {request.column_factor_name}", ss_interaction, (a - 1) * (b - 1)),
    ]:
        ms = ss / df
        f = ms / ms_error
        p = float(stats.f.sf(f, df, df_error))
        if not np.isfinite(f) or not np.isfinite(p):
            raise AnalysisError("This design produces an undefined or numerically unstable F test.")
        terms.append(dict(term=term, label=label, ss=ss, df=df, ms=ms, f=f, p=p,
                          variation_percent=100 * ss / ss_total))
    terms.extend([
        dict(term="residual", label="Residual", ss=ss_error, df=df_error, ms=ms_error,
             f=None, p=None, variation_percent=None),
        dict(term="total", label="Total", ss=ss_total, df=a * b * n - 1, ms=None,
             f=None, p=None, variation_percent=None),
    ])
    results = []
    for term in terms:
        for field, label in [("ss", "sum of squares"), ("df", "df"), ("ms", "mean square"),
                             ("f", "F"), ("p", "p-value"), ("variation_percent", "% of total variation")]:
            if term[field] is not None:
                results.append(dict(label=f"{term['label']}: {label}", value=term[field]))
    means = dict(
        grand=float(grand + center),
        rows=[dict(level=level, mean=float(row_means[i] + center)) for i, level in enumerate(request.row_levels)],
        columns=[dict(level=level, mean=float(col_means[j] + center)) for j, level in enumerate(request.column_levels)],
        cells=[dict(row_level=row, column_level=column, n=n, mean=float(cell_means[i, j] + center))
               for i, row in enumerate(request.row_levels) for j, column in enumerate(request.column_levels)],
    )
    return dict(
        analysis="two_way_anova", summary=[], results=results, fit=[],
        anova_table=terms, means=means,
        design=dict(type="ordinary", interaction=True, balanced=True, row_levels=request.row_levels,
                    column_levels=request.column_levels, replicates_per_cell=n, observations=a * b * n),
        warnings=[
            "Balanced fixed-effects two-way ANOVA with interaction; observations must be independent, with approximately normal errors and equal residual variances.",
            "Repeated measures, random effects, unbalanced designs, missing observations, and post-hoc comparisons are unsupported.",
            "Percent of total variation is SS(term) / SS(total) × 100; it is not partial eta squared.",
        ],
    )
