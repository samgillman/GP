# Prism 11.1 packaged resource reconstruction

This pass recovers concrete model definitions, analysis configuration surfaces, and saved numerical results from the supplied Prism 11.1.0 application. It does **not** establish complete Prism compatibility. Resources show what the package contains; saved results show what the shipped examples recorded. Neither is a fresh execution of the Mac application.

## Evidence boundary and reproducibility

Target: `/workspace/gp-inputs/prism11-image/GraphPad Prism 11/Prism 11.app/Contents`.

The read-only pass inventories every regular file beneath `Resources/` and `SharedSupport/`, excluding extracted macOS named streams (filenames containing `:`). It hashes 950 files. Frameworks, extension bundles, and native executables are outside this resource pass. They remain covered by the original bundle inventory or separate native investigation.

Evidence lives outside the GP source tree in `/workspace/gp-evidence/resources-pass2/`. Proprietary binaries, previews, localized UI text, and full original templates have not been copied into GP.

| Artifact | Bounded coverage |
|---|---|
| `manifest.json` | 950 exact paths, sizes, SHA-256 digests |
| `equations.json` | All 18 equation caches; 152 archived equation records, variables, definitions, derived transforms and metadata |
| `nibs.json`, `nib-*.json` | All 323 Prism resource NIBs; parsed object classes, properties, references, text and byte offsets; zero parse failures |
| `localizations.json` | Four resource localization files; 8,028 quoted key/value entries |
| `transforms.json` | Complete structured in-table function reference: 82 functions, operators, arguments, examples and notes |
| `schemas.json` | Prism XML schema declarations, attributes and enumerations |
| `feature-map.json` | Source-hashed analysis/UI evidence grouped by subsystem; exact NIB text offsets and binding names |
| `project-oracles.json`, `oracle-*.json` | All 14 ZIP-format sample/portfolio projects; 16 saved analyses with original parameters/results and linked input CSV tables |
| `validation.json` | Independent parser cross-check against REA, plus explicit parser coverage |

Reproduce with `python3 /workspace/gp-evidence/resources-pass2/extract_resources.py`, then `extract_oracles.py`, then `build_feature_map.py` in the same directory. These scripts parse formats as data; they never instantiate archived Objective-C classes or execute equations, scripts, transformations or HTML.

REA corroboration: `rea inspect-keyed-archive` on `SharedSupport/Equations/Cache/Exponential` produced Evidence **`ev_aabbaa1a43fb026eec06a396027e90ab2c45cab2b190e184bc36aca00ec664fc`**, retained in `rea-exponential-archive.json`. Its SHA-256 is `086aec6497c311b736375096a68d730b5ec46efc32fe3f7cf391e75f30f704f1`. All 261 object-table records were returned without truncation. The custom parser's name, definition, description, tip and help-link fields for all eight exponential equations match REA's original object indexes exactly. REA explicitly leaves class-specific semantics unknown.

## Recovered equation catalog

The caches are binary property lists using `NSKeyedArchiver`. Their `PSXNativeCurveEquation` objects expose equation definitions and parameter names directly, rather than requiring guesses from screenshots. Opaque `nativeStruct` payloads are hashed but not interpreted as validated defaults or constraints.

| Family | Records |
|---|---:|
| Binding: competitive / kinetics / saturation | 7 / 5 / 8 |
| Dose response: inhibition / stimulation | 8 / 8 |
| Dose response special: concentration / log concentration | 11 / 11 |
| Enzyme kinetics: inhibition / substrate velocity | 6 / 3 |
| Exponential | 8 |
| Gaussian | 8 |
| Growth curves | 6 |
| Linear-quadratic curves | 6 |
| Lines | 12 |
| Polynomial | 12 |
| Sine waves | 4 |
| Standard-curve interpolation | 10 |
| Legacy equations | 19 |

These are 152 archived records, not 152 distinct algorithms: families contain related parameterizations and duplicates. Archived formulas mix parameter-name casing. The separate in-table function reference explicitly documents case-insensitive function names; the equation cache alone does not fully establish the nonlinear expression parser's rules. Expression syntax and optimization semantics still require separate reconstruction.

High-value, directly observed definitions include:

| Model | Observed mathematical form | Parameter evidence |
|---|---|---|
| Straight line | `Y = YIntercept + Slope*X` | `Lines`, object 6 |
| One-phase decay | `Y = (Y0-Plateau)*exp(-K*X)+Plateau` | `Exponential`, object 6 |
| One-phase association | `Y = Y0+(Plateau-Y0)*(1-exp(-K*X))` | `Exponential`, object 155 |
| Two-phase decay/association | Weighted fast and slow exponentials using `PercentFast`, `KFast`, `KSlow` | `Exponential`, objects 84 / 204 |
| Michaelis–Menten | `Y = Vmax*X/(Km+X)` | `Enzyme kinetics - Velocity as a function of substrate`, object 6 |
| Gaussian | `Y = Amplitude*exp(-0.5*((X-Mean)/SD)^2)` | `Gaussian`, object 6 |
| Log-dose 4PL stimulation | `Y = Bottom+(Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))` | `Dose-response - Stimulation`, object 57 |
| Concentration 4PL stimulation | `Y = Bottom+X^HillSlope*(Top-Bottom)/(X^HillSlope+EC50^HillSlope)` | Same family, object 159 |
| Normalized inhibition | `Y = 100/(1+(IC50/X)^HillSlope)` | `Dose-response - Inhibition`, object 209 |

The exponential records also explicitly define half-life as `ln(2)/K` and time constant as `1/K`. These formulas support independent implementations. They do not, by themselves, recover Prism's initial guesses, constraints, optimizer stopping criteria, robust fitting or profile-likelihood confidence intervals.

## Saved numerical reference cases

Unlike the older XML examples, newer ZIP projects contain both input CSV and structured saved analysis results. Every oracle retains the enclosing archive hash, exact member paths and member hashes, original analysis settings, source sheet/dataset relationships and original input rows. They are historical bundled results, not newly executed tests.

The ZIP structure separates `analyses/<id>/parameters.json`, `results.json` and `sheet.json` from `data/sheets/<id>/sheet.json`, `data/sets/<id>.json` and `data/tables/<table-id>/data.csv`. A source sheet's `table.uid` links to the CSV. Analysis `inputSheets` and `inputDataSets` retain their original order and grouping identities. Result tables must not be mistaken for original input data.

| Reference | Evidence fixture | What can be compared |
|---|---|---|
| Paired t test | `oracle-f646c6534e62e874.json` | 15 paired subjects; t, df, two-sided P, difference, SD/SEM, CI, effect sizes, descriptive statistics |
| Normalized inhibition, three groups | `oracle-7542324edcdb7eb2.json` | Replicate-level data; IC50/Hill-slope estimates; fitted values; uncertainty and fit diagnostics |
| Log-dose four-parameter curves | `oracle-fcfaf2f38f55b212.json` | Two groups; log-transformed X, unequal replicate counts, four parameter estimates, diagnostics |
| Kaplan–Meier survival | `oracle-92bcb76d9b925cbf.json` | Censor/event mapping, survival estimates and saved comparison results |
| Ordinary two-way ANOVA | `oracle-16b725a16c722d4c.json` | Grouped table, original options and saved tests |
| Multifactor ANOVA | `oracle-ad971afdff0d3111.json`, `oracle-7f4ac95c59fde6e6.json`, `oracle-96cb4ee486268fd6.json` | Model definitions, effects, comparisons and saved numerical output |
| Column statistics | `oracle-c34b7b8cd50d881a.json` | Geometric-mean example and saved summaries |

The remaining saved analyses cover transformation, extraction/rearrangement, hierarchical clustering, k-means and PCA. Their inputs and original flags are preserved in the same index.

The paired example records `swapDirection=true`, a two-tailed test and significance level 0.05. Its saved mean difference is −9.466666666666667, CI [−16.424025314361142, −2.509308018972191], t **+2.918346124408894**, df 14 and P 0.011227414728918878. The positive t alongside a negative difference is a concrete compatibility detail: a signed SciPy t statistic should not be called identical without explaining the display/sign convention.

The normalized inhibition example explicitly stores an `IC50 > 0` constraint, a Hill-slope initial-value rule based on the direction of Y, and an IC50 initial-value rule at the Y midpoint. Its fits use individual replicates, least squares, no weighting and no outlier handling. For Inhibitor A it records IC50 11.760561613215039 and HillSlope −0.868406235205411. The saved log-dose 4PL example has no parameter constraints and records initial-value rules from Y minimum, Y maximum, response direction and midpoint X. These are **observed settings of those examples**, not proof of every newly created analysis's defaults.

## Reconstructed analysis option surfaces

The following are observed serialized UI choices/bindings. They establish available packaged controls; they do not prove which option is selected at runtime, how feature gating affects it, or how the numerical implementation works. `feature-map.json` links each statement to exact paths, hashes and offsets.

| Subsystem | Observed choices | Principal resource paths under `Contents/Resources/` |
|---|---|---|
| Descriptive statistics | Mean/SD/SEM, median/quartiles, geometric mean, confidence intervals, skewness/kurtosis, normality tests | `Base.lproj/ColumnStatistics.nib` |
| Two-sample tests | Pairing, normal/lognormal/nonparametric assumptions, tail choice, direction, Wilcoxon zero handling, effect sizes | `Base.lproj/TTests.nib` |
| One-way ANOVA | Ordinary/repeated measures, lognormal/nonparametric assumptions, sphericity correction, mixed-effects choices, selected/all/control comparisons | `Base.lproj/OneWayANOVA.nib` |
| Multiple comparisons | Tukey, Dunnett, Šídák, Holm–Šídák, Bonferroni, FDR methods; unequal-variance options including Games–Howell, Dunnett T3 and Tamhane T2 | `Base.lproj/OneWayANOVA.nib`, `Base.lproj/TwoWayANOVA.nib` |
| Two-/three-/multifactor models | Factor definitions, interactions, matching direction, main/simple/cell comparisons, comparison families, diagnostics | `Base.lproj/TwoWayANOVA.nib`, `Base.lproj/ThreeWayANOVA.nib`, `NWayOrdinaryANOVA.nib` |
| Nonlinear fitting | Least squares, Poisson and robust methods; weights; initial values; fixed/shared/bounded parameters; global fits; outlier handling; asymptotic/profile intervals; AICc/extra-sum-of-squares comparison | `Base.lproj/NonlinearRegression.nib` |
| Linear/Deming regression | Replicate policy, intercept constraints, standard-curve interpolation, residuals, confidence/prediction bands, X/Y error SD for Deming | `Base.lproj/LinearRegression.nib`, `Base.lproj/DemingLinearRegression.nib` |
| Correlation | Pearson/Spearman, selected pairs versus matrix, optional whole-row exclusion, heatmap | `Base.lproj/Correlation.nib` |
| Survival | Kaplan–Meier; censor/event code selection; logrank/Mantel–Cox, Gehan–Breslow–Wilcoxon and trend tests; curve display | `Base.lproj/SurvivalCurve.nib` |
| Cox regression | Outcome/predictor/reference-level mapping; exact/approximate ties choices; model comparison and diagnostic choices | `MultipleCoxRegression.nib`, `CoxRCategories.nib` |
| Graphing | Box/violin and summary figures; errors; fitted bands; heatmaps; confidence ellipses; grouped and survival settings | `PSX*`, `GDO*`, `Base.lproj/FormatGraph*` NIBs |

The transform JSON adds an unusually specific implementation target: 82 named functions with syntax, argument types and examples, including arithmetic/trigonometry, distributions and inverses, special functions, conditional logic, aggregation, missing-value checks and text concatenation. Its notes explicitly describe case-insensitive names, blank propagation in arithmetic and blank results for invalid calculations. A future expression evaluator should use a bounded parser rather than executing these strings as Python or JavaScript.

## Reconstruction priorities and unresolved questions

1. **Reference-tested core statistics and regressions.** Use the paired test and two nonlinear oracles to test independently implemented behavior, preserving input grouping, exclusions, replicate rules and original options. Report tolerance and sign/rounding differences explicitly.
2. **Modern project import.** The linked JSON/CSV structure provides a stronger foundation than treating every `.pzt` or `.prismt` as opaque. Preserve raw data, subject/factor structure and unsupported analyses before adding graph/state compatibility.
3. **Model catalog and settings.** Recovered mathematical definitions support expanding browser models. Archived descriptions and UI choices do not prove optimizer behavior; implement and label any independently chosen constraints and initial guesses.
4. **Grouped analysis and survival.** Saved ANOVA and survival projects provide concrete regression oracles. Repeated-measures/mixed-effects fitting, multiple-comparison families, censor/tie conventions and missing-data behavior require additional implementation and comparisons.
5. **Formula columns.** The structured function reference supports a bounded, testable language subset, followed by documented unsupported functions.

Still unresolved by this resource pass: native optimizer/decomposition code, exact algorithms behind most options, full native binary project formats, default selection under every table configuration, licensing-dependent feature availability, native rendering/export parity, and actual Mac application runtime behavior. No complete Prism reconstruction is claimed.

## Full-equivalence work ledger

The ongoing target is **complete functional equivalence**, not merely catalog recovery or a graphing demonstration. [prism-coverage.json](prism-coverage.json) tracks 31 observed functional scopes plus all 152 equation records individually. It deliberately reports no percentage: this is a bounded inventory of known obligations, and a formula recovered or one passing test cannot establish whole-product parity. Every entry records its evidence boundary, implementation snapshot, remaining work and verification status. Source hashes and generation time make stale status visible.

At the initial ledger snapshot, core statistics, selected nonlinear models, raw-data import and basic graphs are partial implementations. Many statistical families, document workflows and advanced graph features remain unimplemented. Survival work is explicitly in progress. The log-dose 4PL comparison now has a saved reference case for eight parameter estimates and two sums of squared errors; this does not verify confidence intervals, global fits or optimizer behavior. The paired t-test reference and reversed-group checks pass, including Prism's positive t magnitude and signed difference convention.

The main blockers to closing the full-equivalence goal are:

- **A real document/dependency model.** Prism's workbooks link multiple tables, analyses, result sheets and graphs. The current single-table browser workflow cannot reproduce those relationships or losslessly reopen native documents.
- **Statistical breadth and settings.** Ordinary grouped ANOVA, repeated/mixed designs, posttests, survival/Cox, multivariable models, diagnostics and formula columns need independent implementations and source-bound comparison cases. Default/edge-case behavior remains a separate obligation.
- **Nonlinear uncertainty and global fitting.** Most of the 152 catalog records are not implemented. The independent fitter does not reproduce Prism's profile intervals, weighting, robust/Poisson losses, parameter sharing, constraints or comparison workflow.
- **Native formats and rendering.** ZIP/CSV input reconstruction covers only part of project state. Legacy `PCFFGRA4`, graph object state, page layouts, fonts and editable export need additional reconstruction and comparisons.
- **Runtime-only questions.** Exact interactive defaults, enablement rules, recalculation behavior and visual export output need observations from Prism on a supported Mac when static/saved artifacts cannot answer them. Unknowns must remain open until that evidence exists.

## ANOVA and survival design oracles

Compact files `design-oracle-*.json` in the external evidence directory retain exact source/member hashes, original settings, raw CSV rows, decoded factor/response mappings and saved numerical expectations. They remove irrelevant document UI metadata without weakening provenance. The generator is `compact_design_oracles.py`.

**Ordinary two-way ANOVA** (`design-oracle-two_way_anova.json`) is a balanced 3 × 3 design with four replicate observations per cell: age-category rows and exercise-category columns. Settings explicitly select ordinary ANOVA, include interaction and disable posttests. Row, column and interaction F statistics are respectively 97.1848260277159, 40.29152238210756 and 1.2753514339835832, with residual df 27. This is a strong first implementation oracle; it does not determine unbalanced sums-of-squares behavior or repeated-measures handling.

**Multifactor ANOVA** (`design-oracle-multifactor_anova.json`) includes 48 observations, fixed Fertilizer/Light/Water predictors, all recorded interaction terms, and control-versus-all comparisons using the saved Dunnett choice. The effect-size example (`design-oracle-anova_effect_sizes.json`) has 144 observations, Genotype/Sex/Diet and all pairwise interactions but no three-way interaction; its residual df is 130. `design-oracle-multifactor_extracted.json` links an additional long-format analysis to the grouped two-way example. The stored predictor-index term lists are preserved exactly. Interpreting the empty term as an intercept is identified as an inference, rather than a recovered implementation detail.

**Kaplan–Meier survival** (`design-oracle-survival_kaplan_meier.json`) includes 135 source rows, with 45 subjects in each of Vehicle, Drug_A and Drug_B. The source maps time to column 2, outcome to column 3 and treatment to column 1, with event code 1, censor code 0 and undefined outcomes treated as missing. The groups respectively contain 38/40/25 events and 7/5/20 censored subjects. Settings request asymmetrical 95% intervals, percentage survival, censored marks and a risk table.

The saved global logrank statistic is 115.99638345184422 (df 2, P = 6.481945468483883 × 10⁻²⁶); trend and Gehan–Breslow–Wilcoxon results are also retained. Median survival values are 19.5, 34.4 and 68.6 days. Pairwise settings compare Vehicle against both treatments with Holm–Šídák correction.

Four saved numeric output tables are preserved in the survival oracle: survival proportions, numbers at risk, deaths/events and censored subjects. Their original dataset metadata retains `CENSORED` cell attributes. The survival table uses `y_plus_minus` with three fields per series; those fields must be interpreted as the original value/error representation rather than assumed to be absolute confidence limits. Comparing all recorded rows, including tied event/censor times, is required before marking that component verified. A single global P-value match would be insufficient.
