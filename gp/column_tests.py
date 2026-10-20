"""t tests and one-way ANOVA laid out like Prism's column analyses.

Methods are standard published procedures computed with NumPy/SciPy. Result
labels, the P-value style and option names follow Prism's column analyses;
defaults and conventions not confirmed by saved Prism output are GP choices
listed in docs/column-comparisons.md.
"""
from itertools import combinations, zip_longest
import numpy as np
from scipy import integrate, optimize, special, stats


class ColumnTestError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ColumnTestError(message)


def p_summary(p):
    """Prism's default "GP" style: ns, *, **, ***, ****."""
    return "****" if p <= 1e-4 else "***" if p <= 1e-3 else "**" if p <= 0.01 else "*" if p <= 0.05 else "ns"


def p_text(p):
    return "<0.0001" if p < 1e-4 else ">0.9999" if p > 0.9999 else f"{p:.4f}"


def p_equation(p):
    text = p_text(p)
    return f"P{text}" if text[0] in "<>" else f"P={text}"


def num(x):
    """Four significant digits without scientific notation for ordinary magnitudes."""
    if x is None:
        return "—"
    x = float(x)
    if x == 0:
        return "0"
    magnitude = abs(x)
    if magnitude >= 1e6 or magnitude < 1e-4:
        return f"{x:.3e}"
    return f"{x:.{max(0, 3 - int(np.floor(np.log10(magnitude))))}f}"


def count(x):
    return str(int(x)) if float(x).is_integer() else num(x)


def yes_no(flag):
    return "Yes" if flag else "No"


def finite(value, message="This dataset produces an undefined or numerically unstable result."):
    require(np.isfinite(value), message)
    return float(value)


def observed(column):
    return np.asarray([v for v in column.values if v is not None], dtype=float)


def complete_rows(columns):
    rows = [row for row in zip_longest(*(c.values for c in columns)) if all(v is not None for v in row)]
    return np.asarray(rows, dtype=float).reshape(-1, len(columns))


def incomplete_row_count(columns):
    """Count partially observed subjects, including ragged column ends, not empty padding."""
    return sum(any(v is not None for v in row) and any(v is None for v in row)
               for row in zip_longest(*(c.values for c in columns)))


def paired_sample_notice(columns, report):
    used = len(complete_rows(columns))
    omitted = incomplete_row_count(columns)
    report.add("Complete pairs analyzed", used)
    report.add("Incomplete pairs excluded", omitted)
    report.notices.append(f"Paired analysis used {used} complete row pairs and excluded {omitted} incomplete pairs. "
                          "Rows must identify the same subject in both columns; missing cells are not shifted together.")


class Report:
    """Collects numeric results (for programs/tests) and display tables (for the sheet)."""

    def __init__(self, options, confidence):
        self.options, self.confidence = options, confidence
        self.results, self.tables, self.comparisons, self.notices = [], [], [], []

    def add(self, label, value):
        if isinstance(value, (float, np.floating)):
            value = finite(value)
        if isinstance(value, np.integer):
            value = int(value)
        self.results.append(dict(label=label, value=value))

    def table(self, title, rows, columns=None):
        self.tables.append(dict(title=title, columns=columns or [title, ""], rows=rows))

    @property
    def alpha_text(self):
        return f"{self.options.alpha:g}"

    def significance_rows(self, p, question=None):
        return [["P value", p_text(p)], ["P value summary", p_summary(p)],
                [question or f"Significantly different (P < {self.alpha_text})?", yes_no(p < self.options.alpha)]]


def direction(options, names):
    """Default reports B − A; Prism's saved swapDirection flag selects the opposite order."""
    a, b = names
    return (-1.0, f"{a} - {b}", "A - B") if options.reverse_difference else (1.0, f"{b} - {a}", "B - A")


def tail_label(options):
    if options.tails == 2:
        return "Two-tailed"
    require(options.alternative in {"a_greater", "b_greater"},
            "A one-tailed test requires a prespecified direction: A greater than B or B greater than A.")
    return "One-tailed: A > B" if options.alternative == "a_greater" else "One-tailed: B > A"


def t_probability(options, t_b_minus_a, df):
    """Directional inference is independent of the displayed difference order."""
    label = tail_label(options)
    if options.tails == 2:
        return float(2 * stats.t.sf(abs(t_b_minus_a), df)), label
    p = stats.t.sf(t_b_minus_a, df) if options.alternative == "b_greater" else stats.t.cdf(t_b_minus_a, df)
    return float(p), label


def hodges_lehmann(a, b):
    return float(np.median(np.subtract.outer(b, a)))


def t_tests(columns, report):
    options, conf = report.options, report.confidence
    require(len(columns) == 2, "t tests compare exactly two data sets. Select two columns in Analyze Data.")
    names = [c.name for c in columns]
    tail_label(options)  # Refuse ambiguous saved/API one-sided settings before any calculation.
    if options.tails == 1:
        report.notices.append("The one-tailed alternative must be chosen before inspecting the observations. "
                              "Reversing the displayed difference does not change that alternative; confidence intervals remain two-sided.")
    sign, _, short = direction(options, names)
    header = [["Column B", names[1]], ["vs.", "vs."], ["Column A", names[0]], []]
    if options.paired:
        paired_sample_notice(columns, report)
        data = complete_rows(columns)
        n = len(data)
        a, b = data[:, 0], data[:, 1]
        d = sign * (b - a)
        if not options.gaussian:
            return wilcoxon(a, b, d, names, header, report)
        require(n >= 2, "A paired t test needs at least two rows with values in both columns.")
        sd = float(np.std(d, ddof=1))
        require(sd > 0, "The paired t test is undefined because every paired difference is identical.")
        sem, mean, df = sd / np.sqrt(n), float(np.mean(d)), n - 1
        t = mean / sem
        p, tail = t_probability(options, sign * t, df)
        half = float(stats.t.ppf((1 + conf) / 2, df) * sem)
        r_squared = t * t / (t * t + df)
        rows = header + [["Paired t test"], *report.significance_rows(p), ["One- or two-tailed P value?", tail],
                         ["t, df", f"t={num(abs(t))}, df={df}"], ["Number of pairs", str(n)], [],
                         ["How big is the difference?"], [f"Mean of differences ({short})", num(mean)],
                         ["SD of differences", num(sd)], ["SEM of differences", num(sem)],
                         [f"{conf:.0%} confidence interval", f"{num(mean - half)} to {num(mean + half)}"],
                         ["R squared (partial eta squared)", num(r_squared)]]
        for label, value in [("P value", p), ("t", abs(t)), ("df", df), ("Number of pairs", n), ("Mean of differences", mean),
                             ("SD of differences", sd), ("SEM of differences", sem), ("Difference CI lower", mean - half),
                             ("Difference CI upper", mean + half), ("R squared", r_squared)]:
            report.add(label, value)
        if n >= 3 and np.ptp(a) > 0 and np.ptp(b) > 0:
            r = float(np.corrcoef(a, b)[0, 1])
            r = min(1.0, max(-1.0, r))
            p_r = 0.0 if r >= 1 else 1.0 if r <= -1 else float(stats.t.sf(r * np.sqrt((n - 2) / (1 - r * r)), n - 2))
            rows += [[], ["How effective was the pairing?"], ["Correlation coefficient (r)", num(r)],
                     ["P value (one tailed)", p_text(p_r)], ["P value summary", p_summary(p_r)],
                     ["Was the pairing significantly effective?", yes_no(p_r < options.alpha)]]
            report.add("Pairing correlation r", r)
            report.add("Pairing P value (one tailed)", p_r)
        else:
            report.notices.append("Pairing effectiveness (correlation) needs at least three pairs with varying values in both columns.")
        report.table("Paired t test", rows)
        report.comparisons.append(dict(a=0, b=1, p=p, summary=p_summary(p)))
        return
    a, b = observed(columns[0]), observed(columns[1])
    if not options.gaussian:
        return mann_whitney(a, b, names, header, report)
    na, nb = len(a), len(b)
    require(na >= 2 and nb >= 2, "Unpaired t tests need at least two values in each column.")
    va, vb = float(np.var(a, ddof=1)), float(np.var(b, ddof=1))
    mean_a, mean_b = float(np.mean(a)), float(np.mean(b))
    diff = sign * (mean_b - mean_a)
    if options.equal_sd:
        pooled = ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2)
        require(pooled > 0, "The t test is undefined because both columns have zero variance.")
        se, df = float(np.sqrt(pooled * (1 / na + 1 / nb))), na + nb - 2
        title, t_label = "Unpaired t test", "t, df"
    else:
        require(va > 0 or vb > 0, "Welch's t test is undefined because both columns have zero variance.")
        wa, wb = va / na, vb / nb
        se = float(np.sqrt(wa + wb))
        df = float((wa + wb) ** 2 / (wa * wa / (na - 1) + wb * wb / (nb - 1)))
        title, t_label = "Unpaired t test with Welch's correction", "Welch-corrected t, df"
    t = diff / se
    p, tail = t_probability(options, sign * t, df)
    half = float(stats.t.ppf((1 + conf) / 2, df) * se)
    r_squared = t * t / (t * t + df)
    rows = header + [[title], *report.significance_rows(p), ["One- or two-tailed P value?", tail],
                     [t_label, f"t={num(abs(t))}, df={count(df)}"], [], ["How big is the difference?"],
                     ["Mean of column A", num(mean_a)], ["Mean of column B", num(mean_b)],
                     [f"Difference between means ({short}) ± SEM", f"{num(diff)} ± {num(se)}"],
                     [f"{conf:.0%} confidence interval", f"{num(diff - half)} to {num(diff + half)}"],
                     ["R squared (eta squared)", num(r_squared)]]
    for label, value in [("P value", p), ("t", abs(t)), ("df", df), ("Mean of column A", mean_a), ("Mean of column B", mean_b),
                         ("Difference between means", diff), ("SEM of difference", se), ("Difference CI lower", diff - half),
                         ("Difference CI upper", diff + half), ("R squared", r_squared)]:
        report.add(label, value)
    if options.equal_sd:
        if min(va, vb) > 0:
            big_v, big_n, small_v, small_n = (va, na, vb, nb) if va >= vb else (vb, nb, va, na)
            f_value, dfn, dfd = big_v / small_v, big_n - 1, small_n - 1
            p_f = min(1.0, float(2 * stats.f.sf(f_value, dfn, dfd)))
            rows += [[], ["F test to compare variances"], ["F, DFn, Dfd", f"{num(f_value)}, {dfn}, {dfd}"],
                     *report.significance_rows(p_f)]
            report.add("F", f_value)
            report.add("F test P value", p_f)
        else:
            report.notices.append("The F test to compare variances is undefined because one column has zero variance.")
    rows += [[], ["Data analyzed"], ["Sample size, column A", str(na)], ["Sample size, column B", str(nb)]]
    report.table(title, rows)
    report.comparisons.append(dict(a=0, b=1, p=p, summary=p_summary(p)))


def mann_whitney(a, b, names, header, report):
    options = report.options
    na, nb = len(a), len(b)
    require(na >= 1 and nb >= 1 and na + nb >= 3, "The Mann-Whitney test needs values in both columns.")
    pooled = np.concatenate([a, b])
    require(np.ptp(pooled) > 0, "The Mann-Whitney test is undefined because every value is identical.")
    ranks = stats.rankdata(pooled)
    ties = len(np.unique(pooled)) < len(pooled)
    exact = not ties and max(na, nb) <= 50
    alternative = "two-sided" if options.tails == 2 else "greater" if options.alternative == "a_greater" else "less"
    test = stats.mannwhitneyu(a, b, method="exact" if exact else "asymptotic", alternative=alternative)
    u_a, p = float(test.statistic), float(test.pvalue)
    tail = tail_label(options)
    sign, _, short = direction(options, names)
    u = min(u_a, na * nb - u_a)
    median_a, median_b = float(np.median(a)), float(np.median(b))
    actual = sign * (median_b - median_a)
    hl = sign * hodges_lehmann(a, b)
    rows = header + [["Mann Whitney test"], ["P value", p_text(p)], ["Exact or approximate P value?", "Exact" if exact else "Approximate"],
                     ["P value summary", p_summary(p)], [f"Significantly different (P < {report.alpha_text})?", yes_no(p < options.alpha)],
                     ["One- or two-tailed P value?", tail], ["Sum of ranks in column A,B", f"{count(ranks[:na].sum())} , {count(ranks[na:].sum())}"],
                     ["Mann-Whitney U", count(u)], [], ["Difference between medians"], ["Median of column A", num(median_a)],
                     ["Median of column B", num(median_b)], [f"Difference: Actual ({short})", num(actual)],
                     [f"Difference: Hodges-Lehmann ({short})", num(hl)]]
    report.table("Mann Whitney test", rows)
    for label, value in [("P value", p), ("Mann-Whitney U", u), ("Sum of ranks A", ranks[:na].sum()), ("Sum of ranks B", ranks[na:].sum()),
                         ("Difference between medians", actual), ("Hodges-Lehmann difference", hl)]:
        report.add(label, value)
    report.comparisons.append(dict(a=0, b=1, p=p, summary=p_summary(p)))
    report.notices.append("Exact P values are used without ties when each column has at most 50 values; otherwise a normal approximation with tie and continuity corrections is used.")
    report.add("P value method", "Exact rank distribution" if exact else "Normal approximation with tie and continuity corrections")
    report.add("Ties present", yes_no(ties))
    if ties:
        report.notices.append("Mann-Whitney ties: GP uses an approximate P value, not a tie-aware exact calculation. "
                              "This differs from Prism's documented exact handling of small tied samples; native Prism equivalence is unverified.")
    elif not exact:
        report.notices.append("Mann-Whitney exact/approximate selection uses GP's 50-values-per-column limit; Prism documents a different threshold.")
    if not exact and min(na, nb) <= 8:
        report.notices.append("Small-sample Mann-Whitney warning: the normal approximation can change a significance decision. "
                              "Confirm inference with a tie-aware exact/permutation calculation before drawing a scientific conclusion.")
    report.notices.append("Mann-Whitney tests distributions/rank ordering. A difference in medians alone requires additional assumptions about distribution shapes.")


def wilcoxon(a, b, d, names, header, report):
    options = report.options
    n = len(d)
    nonzero = d[d != 0]
    require(len(nonzero) >= 1, "The Wilcoxon test needs at least one pair whose values differ.")
    ranks = stats.rankdata(np.abs(nonzero))
    positive, negative = float(ranks[nonzero > 0].sum()), float(ranks[nonzero < 0].sum())
    ties = len(np.unique(np.abs(nonzero))) < len(nonzero)
    exact = not ties and len(nonzero) <= 50
    # d follows the display order; map the prespecified group alternative back to it.
    positive_means_b_greater = not options.reverse_difference
    positive_alternative = (options.alternative == "b_greater") == positive_means_b_greater
    alternative = "two-sided" if options.tails == 2 else "greater" if positive_alternative else "less"
    p = float(stats.wilcoxon(nonzero, method="exact" if exact else "approx", alternative=alternative).pvalue)
    tail = tail_label(options)
    _, _, short = direction(options, names)
    rows = header + [["Wilcoxon matched-pairs signed rank test"], ["P value", p_text(p)],
                     ["Exact or approximate P value?", "Exact" if exact else "Approximate"], ["P value summary", p_summary(p)],
                     [f"Significantly different (P < {report.alpha_text})?", yes_no(p < options.alpha)],
                     ["One- or two-tailed P value?", tail], ["Sum of positive, negative ranks", f"{count(positive)} , {count(-negative)}"],
                     ["Sum of signed ranks (W)", count(positive - negative)], ["Number of pairs", str(n)],
                     ["Number of pairs with zero difference (excluded)", str(n - len(nonzero))], [],
                     ["Median of differences"], [f"Median ({short})", num(float(np.median(d)))]]
    report.table("Wilcoxon matched-pairs signed rank test", rows)
    for label, value in [("P value", p), ("Sum of positive ranks", positive), ("Sum of negative ranks", -negative),
                         ("Sum of signed ranks (W)", positive - negative), ("Number of pairs", n), ("Median of differences", float(np.median(d)))]:
        report.add(label, value)
    report.comparisons.append(dict(a=0, b=1, p=p, summary=p_summary(p)))
    report.notices.append("Pairs with a zero difference are excluded before ranking. Exact P values are used without ties for up to 50 nonzero pairs; otherwise a normal approximation is used.")
    report.add("P value method", "Exact signed-rank distribution" if exact else "Normal approximation with tie correction, without continuity correction")
    report.add("Nonzero pairs analyzed", len(nonzero))
    report.add("Zero differences excluded", n - len(nonzero))
    if ties:
        report.notices.append("Wilcoxon tied absolute differences: GP uses a normal approximation, not the exact signed-rank distribution with ties. "
                              "The result is not verified equivalent to Prism.")
    if not exact and len(nonzero) <= 13:
        report.notices.append("Small-sample Wilcoxon warning: the normal approximation can change a significance decision. "
                              "An exact sign-permutation calculation may give a materially different P value.")
    report.notices.append("Wilcoxon uses the Wilcox convention (drop zero differences); Pratt and split-zero methods are unsupported. "
                          "Inference assumes independent subjects and a symmetric distribution of paired differences. "
                          "Ties and zeros use exact numeric equality; subtraction roundoff can affect ranks.")


def comparison_pairs(options, k, names):
    if options.comparisons == "none":
        return []
    if options.comparisons == "vs_control":
        require(options.control < k, "The control column is not among the analyzed data sets.")
        return [(options.control, j) for j in range(k) if j != options.control]
    return list(combinations(range(k), 2))


METHOD_TITLES = {"tukey": "Tukey's", "bonferroni": "Bonferroni's", "sidak": "Šídák's", "fisher": "Uncorrected Fisher's LSD",
                 "dunnett": "Dunnett's", "games_howell": "Games-Howell's", "dunn": "Dunn's"}


def t_adjusted(method, p_raw, m, conf):
    """P adjustment and two-sided t-critical probability for Bonferroni, Šídák and Fisher LSD."""
    alpha = 1 - conf
    if method == "bonferroni":
        return min(1.0, p_raw * m), 1 - alpha / (2 * m)
    if method == "sidak":
        # log1p/expm1 preserve tiny nonzero probabilities that 1-(1-p)**m rounds to zero.
        adjusted = 1.0 if p_raw >= 1 else float(-np.expm1(m * np.log1p(-p_raw)))
        per_comparison_alpha = -np.expm1(np.log1p(-alpha) / m)
        return min(1.0, adjusted), 1 - per_comparison_alpha / 2
    return p_raw, 1 - alpha / 2


COMPARISON_NOTES = {
    "pooled": "comparisons use the pooled residual variance from the ANOVA.",
    "pair": "each comparison uses only the two columns being compared.",
    "rm_pooled": "comparisons use the repeated-measures pooled residual variance and residual degrees of freedom; sphericity is assumed.",
    "rm_pair": "comparisons use paired differences and n - 1 degrees of freedom for each pair; the omnibus Geisser-Greenhouse epsilon is not applied to these paired tests.",
    "dunn": "ranks are computed from all analyzed values with a tie correction; P values are Bonferroni-adjusted.",
    "friedman": "rank sums come from ranks within each row; P values are Bonferroni-adjusted.",
}


def comparison_table(report, method, names, pairs, rows, scope, rank_label=None):
    conf, rank = report.confidence, rank_label is not None
    title = f"{METHOD_TITLES[method]} multiple comparisons test"
    columns = [title, rank_label or "Mean Diff.", *([] if rank else [f"{conf * 100:.2f}% CI of diff."]),
               "Below threshold?", "Summary", "Unadjusted P Value" if method == "fisher" else "Adjusted P Value"]
    body = []
    for (i, j), (diff, low, high, p) in zip(pairs, rows):
        p = min(1.0, max(0.0, finite(p, "The comparison produced an undefined P value.")))
        body.append([f"{names[i]} vs. {names[j]}", num(diff), *([] if rank else [f"{num(low)} to {num(high)}"]),
                     yes_no(p < report.options.alpha), p_summary(p), p_text(p)])
        report.comparisons.append(dict(a=i, b=j, p=p, summary=p_summary(p)))
        report.add(f"{names[i]} vs. {names[j]}: {'unadjusted' if method == 'fisher' else 'adjusted'} P", p)
        report.add(f"{names[i]} vs. {names[j]}: difference", diff)
        if not rank:
            report.add(f"{names[i]} vs. {names[j]}: CI lower", low)
            report.add(f"{names[i]} vs. {names[j]}: CI upper", high)
    report.table("Multiple comparisons", body, columns)
    report.notices.append(f"{METHOD_TITLES[method]} test compares {len(pairs)} pair(s); {COMPARISON_NOTES[scope]}")
    report.add("Comparison family size", len(pairs))
    report.add("Multiple comparison method", method)
    if method == "fisher":
        report.notices.append("Fisher's LSD comparisons are unadjusted and are not gated on the omnibus ANOVA P value. "
                              "They do not control the familywise error rate; their confidence intervals are individual, not simultaneous.")
    else:
        report.notices.append(f"The correction family contains the {len(pairs)} requested comparisons in this analysis. "
                              "Hiding graph brackets does not change that family. Selecting columns or comparisons after looking at the results invalidates the intended error control.")


_HERMITE = np.polynomial.hermite_e.hermegauss(96)
_LEGENDRE = np.polynomial.legendre.leggauss(256)


def studentized_range_cdf(q, k, df):
    """P(Q <= q) for the studentized range of k means with df error degrees of freedom.

    Vectorized fixed quadrature replacing SciPy's per-value adaptive integration
    (too slow in the browser): Gauss-Hermite over the standard normal and
    Gauss-Legendre over the pooled-SD ratio u = s / sigma. Accuracy is tested
    against scipy.stats.studentized_range.
    """
    q = np.atleast_1d(np.asarray(q, dtype=float))
    if k == 2:
        # Q(2, df) = sqrt(2) * |T(df)|, also at very small df or extreme tails.
        return np.asarray(1 - 2 * stats.t.sf(q / np.sqrt(2), df))
    if df < 2 and np.any(q > 100):
        return np.asarray(stats.studentized_range.cdf(q, k, df))
    nodes, weights = _HERMITE
    weights = weights / np.sqrt(2 * np.pi)
    x, w = _LEGENDRE
    scale = np.sqrt(df)
    low, high = stats.chi.ppf([1e-14, 1 - 1e-14], df) / scale
    u = (high - low) / 2 * x + (high + low) / 2
    density = stats.chi.pdf(u * scale, df) * scale * w * (high - low) / 2
    spread = q[:, None, None] * u[None, :, None]
    inner = np.clip(stats.norm.cdf(nodes) - stats.norm.cdf(nodes - spread), 0, 1)
    range_cdf = k * np.einsum("z,quz->qu", weights, inner ** (k - 1))
    return np.clip(range_cdf @ density, 0, 1)


def studentized_range_sf(q, k, df):
    if k == 2:
        tail = 2 * stats.t.sf(np.asarray(q) / np.sqrt(2), df)
        return float(tail) if np.ndim(q) == 0 else tail
    tail = 1 - studentized_range_cdf(q, k, df)
    return float(tail[0]) if np.ndim(q) == 0 else tail


def studentized_range_ppf(p, k, df):
    if k == 2:
        return float(np.sqrt(2) * stats.t.ppf((1 + p) / 2, df))
    if df < 2 and p > 0.99:
        return float(stats.studentized_range.ppf(p, k, df))
    upper = 8.0
    while studentized_range_cdf(upper, k, df)[0] < p:
        upper *= 2
        require(upper <= 1e6, "The studentized-range critical value could not be computed reliably for these degrees of freedom.")
    return optimize.brentq(lambda q: studentized_range_cdf(q, k, df)[0] - p, 0, upper, xtol=1e-10)


def dunnett_coverage(c, lambdas, df):
    """P(max |T_i| <= c) for Dunnett's statistics (Dunnett, 1955).

    The correlation between comparisons is lambda_i * lambda_j with
    lambda_i = sqrt(n_i / (n_i + n_control)), so the multivariate t probability
    reduces to a two-dimensional integral: Gauss-Hermite over the control mean
    and Gauss-Legendre over the pooled-SD ratio u = s / sigma.
    """
    if len(lambdas) == 1:
        return float(1 - 2 * stats.t.sf(c, df))
    nodes, weights = _HERMITE
    weights = weights / np.sqrt(2 * np.pi)
    x, w = _LEGENDRE
    scale = np.sqrt(df)
    low, high = stats.chi.ppf([1e-14, 1 - 1e-14], df) / scale
    u = (high - low) / 2 * x + (high + low) / 2
    density = stats.chi.pdf(u * scale, df) * scale * w * (high - low) / 2
    if max(lambdas) > 0.9:
        # A small control and large treatment groups create near-perfectly
        # correlated contrasts. Fixed Hermite nodes miss the narrow transition
        # regions. Integrate the control-normal coordinate adaptively instead.
        lam = np.asarray(lambdas, dtype=float)[:, None]
        root = np.sqrt(1 - lam * lam)
        half = c * u[None, :]

        def conditional(z):
            centre = lam * z
            inside = np.prod(special.ndtr((centre + half) / root) - special.ndtr((centre - half) / root), axis=0)
            return inside * np.exp(-z * z / 2) / np.sqrt(2 * np.pi)

        probability, error = integrate.quad_vec(conditional, 0, 10, epsabs=1e-10, epsrel=1e-10)
        require(np.isfinite(error) and error < 1e-7, "Dunnett integration did not converge for these unequal sample sizes; use Bonferroni instead.")
        return min(1.0, max(0.0, float(2 * probability @ density)))
    lam = np.asarray(lambdas, dtype=float)[:, None, None]
    root = np.sqrt(1 - lam * lam)
    centre, half = lam * nodes[None, None, :], c * u[None, :, None]
    inside = np.prod(stats.norm.cdf((centre + half) / root) - stats.norm.cdf((centre - half) / root), axis=0)
    return min(1.0, max(0.0, float((inside @ weights) @ density)))


def dunnett_rows(means, ns, mse, df, control, others, conf):
    """Two-sided Dunnett comparisons of control minus each other column."""
    lambdas = [np.sqrt(ns[j] / (ns[j] + ns[control])) for j in others]
    if len(others) == 1:
        critical = float(stats.t.ppf((1 + conf) / 2, df))
    else:
        upper = 8.0
        while dunnett_coverage(upper, lambdas, df) < conf:
            upper *= 2
            require(upper <= 1e6, "The Dunnett critical value could not be computed reliably for this design.")
        critical = optimize.brentq(lambda c: dunnett_coverage(c, lambdas, df) - conf, 0, upper, xtol=1e-10)
    rows = []
    for j in others:
        diff = means[control] - means[j]
        se = np.sqrt(mse * (1 / ns[control] + 1 / ns[j]))
        p = (float(2 * stats.t.sf(abs(diff) / se, df)) if len(others) == 1
             else 1 - dunnett_coverage(abs(diff) / se, lambdas, df))
        rows.append((diff, diff - critical * se, diff + critical * se, p))
    return rows


def require_method(options, allowed):
    method = options.method or allowed[0]
    require(method in allowed, f"{METHOD_TITLES.get(method, method)} comparisons are not available for this design.")
    return method


def pooled_comparisons(report, means, ns, mse, df, method, pairs):
    conf = report.confidence
    k, m, rows = len(means), len(pairs), []
    q_critical = studentized_range_ppf(conf, k, df) if method == "tukey" else None
    for i, j in pairs:
        diff = means[i] - means[j]
        if method == "tukey":
            se = np.sqrt(mse / 2 * (1 / ns[i] + 1 / ns[j]))
            p = studentized_range_sf(abs(diff) / se, k, df)
            half = q_critical * se
        else:
            se = np.sqrt(mse * (1 / ns[i] + 1 / ns[j]))
            p_raw = 2 * stats.t.sf(abs(diff) / se, df)
            p, critical = t_adjusted(method, p_raw, m, conf)
            half = stats.t.ppf(critical, df) * se
        rows.append((diff, diff - half, diff + half, p))
    return rows


def one_way(columns, report):
    options, conf = report.options, report.confidence
    require(len(columns) >= 2, "One-way ANOVA compares two or more data sets. Select them in Analyze Data.")
    names, k = [c.name for c in columns], len(columns)
    header = [["Data sets analyzed", f"{names[0]} – {names[-1]}" if k > 2 else f"{names[0]}, {names[1]}"], []]
    if options.paired:
        missing = incomplete_row_count(columns)
        require(missing == 0,
                f"The matched analysis contains {missing} incomplete subject row(s). GP does not implement a mixed-effects model "
                "or automatically discard partially observed subjects. Resolve the missing data with an appropriate analysis plan; "
                "remove a subject explicitly only when a complete-case analysis is justified.")
        data = complete_rows(columns)
        require(len(data) >= 2, "Matched analyses need at least two rows with values in every selected column.")
        report.notices.append(f"Matched analysis used {len(data)} complete subject rows. Fully empty padding rows are ignored. "
                              "Mixed-effects models and missing-data estimation are unsupported.")
        return friedman(data, names, header, report) if not options.gaussian else repeated_measures(data, names, header, report)
    groups = [observed(c) for c in columns]
    if not options.gaussian:
        return kruskal_wallis(groups, names, header, report)
    require(all(len(g) >= 1 for g in groups), "Every selected column needs at least one value.")
    ns = np.array([len(g) for g in groups], dtype=float)
    means = np.array([np.mean(g) for g in groups])
    n_total = int(ns.sum())
    require(n_total > k, "One-way ANOVA needs more values than columns.")
    grand = float(np.mean(np.concatenate(groups)))
    ss_between = float(np.sum(ns * (means - grand) ** 2))
    ss_within = float(sum(np.sum((g - np.mean(g)) ** 2) for g in groups))
    df_between, df_within = k - 1, n_total - k
    if not options.equal_sd:
        return welch_brown_forsythe(groups, names, header, report)
    require(ss_within > 0, "One-way ANOVA is undefined because every column has zero variance.")
    ms_between, ms_within = ss_between / df_between, ss_within / df_within
    f_value = ms_between / ms_within
    p = float(stats.f.sf(f_value, df_between, df_within))
    r_squared = ss_between / (ss_between + ss_within)
    rows = header + [["ANOVA summary"], ["F", num(f_value)], ["P value", p_text(p)], ["P value summary", p_summary(p)],
                     [f"Significant diff. among means (P < {report.alpha_text})?", yes_no(p < options.alpha)], ["R squared", num(r_squared)]]
    for label, value in [("F", f_value), ("P value", p), ("DFn", df_between), ("DFd", df_within), ("R squared", r_squared),
                         ("SS treatment", ss_between), ("SS residual", ss_within)]:
        report.add(label, value)
    if all(len(g) >= 2 for g in groups):
        z = [np.abs(g - np.median(g)) for g in groups]
        z_means = np.array([np.mean(zi) for zi in z])
        z_grand = float(np.mean(np.concatenate(z)))
        within = float(sum(np.sum((zi - np.mean(zi)) ** 2) for zi in z))
        if within > 0:
            bf = (df_within / df_between) * float(np.sum(ns * (z_means - z_grand) ** 2)) / within
            p_bf = float(stats.f.sf(bf, df_between, df_within))
            rows += [[], ["Brown-Forsythe test"], ["F (DFn, DFd)", f"{num(bf)} ({df_between}, {df_within})"],
                     ["P value", p_text(p_bf)], ["P value summary", p_summary(p_bf)],
                     [f"Are SDs significantly different (P < {report.alpha_text})?", yes_no(p_bf < options.alpha)]]
            report.add("Brown-Forsythe F", bf)
            report.add("Brown-Forsythe P value", p_bf)
        else:
            report.notices.append("The Brown-Forsythe test is undefined because absolute deviations from each median do not vary.")
        if any(len(g) < 5 for g in groups):
            # Guide: the corrected Bartlett test is reported only with five or more values per column.
            report.notices.append("Bartlett's test is reported only when every column has at least five values.")
        elif all(np.var(g, ddof=1) > 0 for g in groups):
            bartlett = stats.bartlett(*groups)
            rows += [[], ["Bartlett's test"], ["Bartlett's statistic (corrected)", num(bartlett.statistic)],
                     ["P value", p_text(bartlett.pvalue)], ["P value summary", p_summary(bartlett.pvalue)],
                     [f"Are SDs significantly different (P < {report.alpha_text})?", yes_no(bartlett.pvalue < options.alpha)]]
            report.add("Bartlett statistic", float(bartlett.statistic))
            report.add("Bartlett P value", float(bartlett.pvalue))
        else:
            report.notices.append("Bartlett's test is undefined because a column has zero variance.")
    else:
        report.notices.append("Tests for equal SDs need at least two values in every column.")
    report.table("ANOVA results", rows)
    report.table("ANOVA table", [["Treatment (between columns)", num(ss_between), str(df_between), num(ms_between),
                                  f"F ({df_between}, {df_within}) = {num(f_value)}", p_equation(p)],
                                 ["Residual (within columns)", num(ss_within), str(df_within), num(ms_within), "", ""],
                                 ["Total", num(ss_between + ss_within), str(n_total - 1), "", "", ""]],
                 ["ANOVA table", "SS", "DF", "MS", "F (DFn, DFd)", "P value"])
    pairs = comparison_pairs(options, k, names)
    if pairs:
        allowed = ["dunnett", "bonferroni", "sidak", "fisher"] if options.comparisons == "vs_control" else ["tukey", "bonferroni", "sidak", "fisher"]
        method = require_method(options, allowed)
        if method == "dunnett":
            others = [j for j in range(k) if j != options.control]
            rows_mc = dunnett_rows(means, ns, ms_within, df_within, options.control, others, conf)
        else:
            rows_mc = pooled_comparisons(report, means, ns, ms_within, df_within, method, pairs)
        comparison_table(report, method, names, pairs, rows_mc, "pooled")


def welch_brown_forsythe(groups, names, header, report):
    options, k = report.options, len(groups)
    require(all(len(g) >= 2 for g in groups), "Brown-Forsythe and Welch ANOVA need at least two values in every column.")
    ns = np.array([len(g) for g in groups], dtype=float)
    means = np.array([np.mean(g) for g in groups])
    variances = np.array([np.var(g, ddof=1) for g in groups])
    require(np.all(variances > 0), "Welch's ANOVA is undefined because a column has zero variance.")
    n_total = ns.sum()
    weights = ns / variances
    total_weight = weights.sum()
    weighted_mean = float(np.sum(weights * means) / total_weight)
    lam = float(np.sum((1 - weights / total_weight) ** 2 / (ns - 1)))
    welch = float(np.sum(weights * (means - weighted_mean) ** 2) / (k - 1) / (1 + 2 * (k - 2) / (k * k - 1) * lam))
    welch_df = (k * k - 1) / (3 * lam)
    p_welch = float(stats.f.sf(welch, k - 1, welch_df))
    grand = float(np.sum(ns * means) / n_total)
    denominator = (1 - ns / n_total) * variances
    bf = float(np.sum(ns * (means - grand) ** 2) / denominator.sum())
    shares = denominator / denominator.sum()
    bf_df = float(1 / np.sum(shares ** 2 / (ns - 1)))
    p_bf = float(stats.f.sf(bf, k - 1, bf_df))
    question = f"Significant diff. among means (P < {report.alpha_text})?"
    rows = header + [["Brown-Forsythe ANOVA test"], ["F* (DFn, DFd)", f"{num(bf)} ({k - 1}, {num(bf_df)})"],
                     *report.significance_rows(p_bf, question), [], ["Welch's ANOVA test"],
                     ["W (DFn, DFd)", f"{num(welch)} ({k - 1}, {num(welch_df)})"], *report.significance_rows(p_welch, question)]
    report.table("ANOVA results", rows)
    for label, value in [("Brown-Forsythe F*", bf), ("Brown-Forsythe DFd", bf_df), ("Brown-Forsythe P value", p_bf),
                         ("Welch W", welch), ("Welch DFd", welch_df), ("Welch P value", p_welch)]:
        report.add(label, value)
    report.notices.append("Brown-Forsythe ANOVA uses the original k - 1 numerator degrees of freedom, not the Mehrotra adjustment. "
                          "It tests means and is distinct from the Brown-Forsythe test of equal SDs reported with ordinary ANOVA. "
                          "Native Prism numerical equivalence has not been verified.")
    pairs = comparison_pairs(options, k, names)
    if pairs:
        require(options.comparisons == "all_pairs", "With unequal SDs, GP offers Games-Howell comparisons of every pair of columns.")
        method = require_method(options, ["games_howell"])
        rows_mc = []
        for i, j in pairs:
            wi, wj = variances[i] / ns[i], variances[j] / ns[j]
            se = np.sqrt(wi + wj)
            df = (wi + wj) ** 2 / (wi * wi / (ns[i] - 1) + wj * wj / (ns[j] - 1))
            diff = means[i] - means[j]
            p = studentized_range_sf(np.sqrt(2) * abs(diff) / se, k, df)
            half = studentized_range_ppf(report.confidence, k, df) / np.sqrt(2) * se
            rows_mc.append((diff, diff - half, diff + half, p))
        comparison_table(report, method, names, pairs, rows_mc, "pair")


def dunn_rows(pairs, mean_ranks, se_pair):
    m, rows = len(pairs), []
    for i, j in pairs:
        diff = mean_ranks[i] - mean_ranks[j]
        p = min(1.0, float(2 * stats.norm.sf(abs(diff) / se_pair(i, j))) * m)
        rows.append((diff, None, None, p))
    return rows


def kruskal_wallis(groups, names, header, report):
    options, k = report.options, len(groups)
    require(all(len(g) >= 1 for g in groups), "Every selected column needs at least one value.")
    pooled = np.concatenate(groups)
    n_total = len(pooled)
    require(n_total > k and np.ptp(pooled) > 0, "The Kruskal-Wallis test needs varying values and more values than columns.")
    h, p = stats.kruskal(*groups)
    h, p = finite(h), finite(p)
    ranks = stats.rankdata(pooled)
    edges = np.cumsum([0] + [len(g) for g in groups])
    mean_ranks = [float(np.mean(ranks[edges[i]:edges[i + 1]])) for i in range(k)]
    rows = header + [["Kruskal-Wallis test"], ["P value", p_text(p)], ["Exact or approximate P value?", "Approximate"],
                     ["P value summary", p_summary(p)], [f"Do the distributions differ (P < {report.alpha_text})?", yes_no(p < options.alpha)],
                     ["Kruskal-Wallis statistic", num(h)], [], ["Data summary"], ["Number of treatments (columns)", str(k)],
                     ["Number of values (total)", str(n_total)]]
    report.table("Kruskal-Wallis test", rows)
    report.add("Kruskal-Wallis statistic", h)
    report.add("P value", p)
    report.add("P value method", "Tie-corrected chi-square approximation")
    report.notices.append("Kruskal-Wallis uses a tie-corrected chi-square approximation. GP does not compute exact Kruskal-Wallis P values; "
                          "Prism documents exact calculations for some small designs. Native Prism equivalence is unverified. "
                          "Interpreting this as a median test requires comparable distribution shapes.")
    if any(len(g) < 5 for g in groups):
        report.notices.append("Small-sample Kruskal-Wallis warning: at least one column has fewer than five observations. "
                              "The chi-square approximation can change the significance decision compared with an exact permutation test.")
    pairs = comparison_pairs(options, k, names)
    if pairs:
        method = require_method(options, ["dunn"])
        _, tie_counts = np.unique(pooled, return_counts=True)
        tie_term = float(np.sum(tie_counts ** 3 - tie_counts)) / (12 * (n_total - 1))
        variance = n_total * (n_total + 1) / 12 - tie_term
        ns = [len(g) for g in groups]
        rows_mc = dunn_rows(pairs, mean_ranks, lambda i, j: np.sqrt(variance * (1 / ns[i] + 1 / ns[j])))
        comparison_table(report, method, names, pairs, rows_mc, "dunn", "Mean rank diff.")


def repeated_measures(data, names, header, report):
    options, conf = report.options, report.confidence
    n, k = data.shape
    grand = float(data.mean())
    col_means, row_means = data.mean(axis=0), data.mean(axis=1)
    ss_subjects = float(k * np.sum((row_means - grand) ** 2))
    ss_total = float(np.sum((data - grand) ** 2))
    # Direct residuals avoid cancellation when between-subject variability is
    # much larger than the treatment-by-subject residual variation.
    within_subject = data - row_means[:, None]
    ss_treat = float(n * np.sum(within_subject.mean(axis=0) ** 2))
    residuals = within_subject - within_subject.mean(axis=0)
    ss_resid = float(np.sum(residuals ** 2))
    require(ss_resid > 1e-24 * max(float(np.sum(within_subject ** 2)), 1e-300),
            "Repeated-measures ANOVA is undefined because the residual variation is zero.")
    df_treat, df_subjects, df_resid = k - 1, n - 1, (n - 1) * (k - 1)
    ms_treat, ms_subjects, ms_resid = ss_treat / df_treat, ss_subjects / df_subjects, ss_resid / df_resid
    f_value = ms_treat / ms_resid
    # Epsilon is invariant to units. Normalize before forming and squaring the
    # covariance, so supported tiny/large measurements do not under/overflow.
    covariance = np.cov(within_subject / np.max(np.abs(within_subject)), rowvar=False)
    centered = covariance - covariance.mean(axis=0) - covariance.mean(axis=1)[:, None] + covariance.mean()
    denominator = float((k - 1) * np.sum(centered ** 2))
    epsilon = 1.0 if denominator <= 0 else min(1.0, max(1 / (k - 1), float(np.trace(centered)) ** 2 / denominator))
    correct = options.sphericity == "geisser_greenhouse"
    e = epsilon if correct else 1.0
    p = float(stats.f.sf(f_value, e * df_treat, e * df_resid))
    f_subjects = ms_subjects / ms_resid
    p_subjects = float(stats.f.sf(f_subjects, df_subjects, df_resid))
    question = f"Statistically significant (P < {report.alpha_text})?"
    rows = header + [["Repeated measures ANOVA summary"], ["Assume sphericity (equal variability of differences)?", "No" if correct else "Yes"],
                     ["F", num(f_value)], *report.significance_rows(p, question), ["Geisser-Greenhouse's epsilon", num(epsilon)],
                     ["R squared", num(ss_treat / (ss_treat + ss_resid))], [], ["Was the matching effective?"],
                     ["F", num(f_subjects)], *report.significance_rows(p_subjects, f"Is there significant matching (P < {report.alpha_text})?"),
                     ["R squared", num(ss_subjects / ss_total)], [], ["Data summary"], ["Number of treatments (columns)", str(k)],
                     ["Number of subjects (rows)", str(n)]]
    report.table("ANOVA results", rows)
    dfs = (f"{num(e * df_treat)}, {num(e * df_resid)}" if correct else f"{df_treat}, {df_resid}")
    report.table("ANOVA table", [["Treatment (between columns)", num(ss_treat), str(df_treat), num(ms_treat), f"F ({dfs}) = {num(f_value)}", p_equation(p)],
                                 ["Individual (between rows)", num(ss_subjects), str(df_subjects), num(ms_subjects), f"F ({df_subjects}, {df_resid}) = {num(f_subjects)}", p_equation(p_subjects)],
                                 ["Residual", num(ss_resid), str(df_resid), num(ms_resid), "", ""],
                                 ["Total", num(ss_total), str(n * k - 1), "", "", ""]],
                 ["ANOVA table", "SS", "DF", "MS", "F (DFn, DFd)", "P value"])
    for label, value in [("F", f_value), ("P value", p), ("Geisser-Greenhouse epsilon", epsilon), ("SS treatment", ss_treat),
                         ("SS subjects", ss_subjects), ("SS residual", ss_resid), ("Matching F", f_subjects), ("Matching P value", p_subjects),
                         ("DFn", e * df_treat), ("DFd", e * df_resid), ("Number of subjects", n)]:
        report.add(label, value)
    pairs = comparison_pairs(options, k, names)
    if pairs:
        allowed = (["bonferroni", "sidak", "fisher"] if correct or options.comparisons == "vs_control"
                   else ["tukey", "bonferroni", "sidak", "fisher"])
        if correct:
            require(options.method != "tukey", "Tukey comparisons without assumed sphericity are not supported in GP. "
                    "Use paired comparisons with Bonferroni correction, or assume sphericity only when scientifically justified.")
        method = require_method(options, allowed)
        if not correct:
            rows_mc = pooled_comparisons(report, col_means, np.full(k, n), ms_resid, df_resid, method, pairs)
            comparison_table(report, method, names, pairs, rows_mc, "rm_pooled")
            return
        rows_mc, m = [], len(pairs)
        for i, j in pairs:
            d = data[:, i] - data[:, j]
            sd = float(np.std(d, ddof=1))
            require(sd > 0, f"{names[i]} vs. {names[j]}: every paired difference is identical, so the comparison is undefined.")
            se, diff, df = sd / np.sqrt(n), float(d.mean()), n - 1
            p_mc, critical = t_adjusted(method, 2 * stats.t.sf(abs(diff) / se, df), m, conf)
            half = stats.t.ppf(critical, df) * se
            rows_mc.append((diff, diff - half, diff + half, p_mc))
        comparison_table(report, method, names, pairs, rows_mc, "rm_pair")
    if correct:
        report.notices.append("The Geisser-Greenhouse correction scales both degrees of freedom by epsilon; it does not assume sphericity.")


def friedman(data, names, header, report):
    options = report.options
    n, k = data.shape
    require(k >= 3, "GP's Friedman analysis requires at least three matched columns. Select a suitable two-column paired test for a two-condition design.")
    ranks = np.apply_along_axis(stats.rankdata, 1, data)
    rank_sums = ranks.sum(axis=0)
    tie_total = 0.0
    for row in data:
        _, counts = np.unique(row, return_counts=True)
        tie_total += float(np.sum(counts ** 3 - counts))
    correction = 1 - tie_total / (n * (k ** 3 - k))
    require(correction > 0, "The Friedman test is undefined because every row is completely tied.")
    q = (12 / (n * k * (k + 1)) * float(np.sum(rank_sums ** 2)) - 3 * n * (k + 1)) / correction
    p = float(stats.chi2.sf(q, k - 1))
    rows = header + [["Friedman test"], ["P value", p_text(p)], ["Exact or approximate P value?", "Approximate"],
                     ["P value summary", p_summary(p)], [f"Do the treatment ranks differ (P < {report.alpha_text})?", yes_no(p < options.alpha)],
                     ["Friedman statistic", num(q)], [], ["Data summary"], ["Number of treatments (columns)", str(k)],
                     ["Number of subjects (rows)", str(n)]]
    report.table("Friedman test", rows)
    report.add("Friedman statistic", q)
    report.add("P value", p)
    report.add("P value method", "Tie-corrected chi-square approximation")
    report.notices.append("Friedman uses a tie-corrected chi-square approximation, not an exact within-subject permutation distribution. "
                          "Prism documents exact P values for small tables, including ties. Native Prism equivalence is unverified.")
    if n <= 10 or k <= 6:
        report.notices.append("Small-design Friedman warning: the chi-square approximation is unreliable for small numbers of subjects or conditions "
                              "and can reverse a significance decision. Confirm with an exact within-subject permutation calculation when feasible.")
    pairs = comparison_pairs(options, k, names)
    if pairs:
        method = require_method(options, ["dunn"])
        se = np.sqrt(n * k * (k + 1) / 6)
        rows_mc = [(float(rank_sums[i] - rank_sums[j]), None, None, min(1.0, float(2 * stats.norm.sf(abs(rank_sums[i] - rank_sums[j]) / se)) * len(pairs)))
                   for i, j in pairs]
        comparison_table(report, method, names, pairs, rows_mc, "friedman", "Rank sum diff.")
        report.notices.append("Friedman/Dunn comparisons use average within-row ranks, the normal approximation, and Bonferroni correction. "
                              "Their standard error is sqrt(n*k*(k+1)/6) for rank-sum differences; it is not additionally reduced for ties. "
                              "This follows the published Prism guide formula but has not been compared with native Prism output.")


def analyze_columns(request, kind):
    report = Report(request.options, request.confidence)
    require(request.table_type == "column", "Choose a Column table for t tests and one-way ANOVA.")
    (t_tests if kind == "t_test" else one_way)(request.columns, report)
    report.add("Significance threshold alpha", request.options.alpha)
    report.add("Confidence level", request.confidence)
    report.notices.append(f"Confidence intervals use {request.confidence:.1%} confidence; decisions use alpha={request.options.alpha:g}. "
                          "Asterisks use fixed P-value cutoffs (0.05, 0.01, 0.001, 0.0001), independently of the selected alpha.")
    if not np.isclose(request.confidence, 1 - request.options.alpha):
        report.notices.append("The confidence level is not 1 - alpha, so interval exclusion of zero need not agree with the significance decision.")
    report.notices.append("Numerical reference tests do not establish GraphPad Prism equivalence. "
                          "Only one saved two-tailed paired-t dataset has been reproduced against native Prism output.")
    return report
