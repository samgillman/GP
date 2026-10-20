from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictBool, field_validator, model_validator


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    values: list[FiniteFloat | None] = Field(min_length=1, max_length=10000)


class ComparisonOptions(BaseModel):
    """Parameters for t tests and one-way ANOVA (see gp.column_tests)."""
    model_config = ConfigDict(extra="forbid")
    paired: bool = False
    gaussian: bool = True
    equal_sd: bool = True
    sphericity: Literal["geisser_greenhouse", "assume"] = "geisser_greenhouse"
    tails: Literal[1, 2] = 2
    # Direction is a prespecified hypothesis about the named columns, independent
    # of the display-only reverse_difference setting. Legacy one-tailed requests
    # without a direction are refused by the analysis engine, never guessed.
    alternative: Literal["a_greater", "b_greater"] | None = None
    reverse_difference: bool = False
    comparisons: Literal["none", "all_pairs", "vs_control"] = "all_pairs"
    control: int = Field(default=0, ge=0, le=29)
    method: Literal["tukey", "bonferroni", "sidak", "fisher", "dunnett", "games_howell", "dunn"] | None = None
    alpha: float = Field(default=0.05, gt=0, lt=0.5)


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    table_type: Literal["column", "xy"] = "column"
    columns: list[Column] = Field(min_length=1, max_length=30)
    analysis: Literal["descriptive", "welch_t", "paired_t", "anova", "t_test", "one_way_anova", "linear_regression", "dose_response", "nonlinear_regression"] = "descriptive"
    regression_model: str = Field(default="one_phase_decay", min_length=1, max_length=100)
    confidence: float = Field(default=0.95, ge=0.5, le=0.999)
    options: ComparisonOptions = Field(default_factory=ComparisonOptions)

    @model_validator(mode="after")
    def check_data(self):
        if sum(len(c.values) for c in self.columns) > 300000:
            raise ValueError("At most 300,000 cells are supported per request.")
        if len({c.name for c in self.columns}) != len(self.columns):
            raise ValueError("Column names must be unique.")
        if any(abs(v) > 1e100 for c in self.columns for v in c.values if v is not None):
            raise ValueError("Values must have magnitude no greater than 1e100.")
        if self.table_type == "xy" and len(self.columns) < 2:
            raise ValueError("XY tables require an X column and at least one Y column.")
        return self


class GraphAnnotation(BaseModel):
    """A significance bracket between two column-graph datasets (0-based)."""
    model_config = ConfigDict(extra="forbid")
    a: int = Field(ge=0, le=29)
    b: int = Field(ge=0, le=29)
    label: str = Field(min_length=1, max_length=40)


class AxisNumberFormat(BaseModel):
    """GP's explicit decimal display contract; not native automatic precision."""
    model_config = ConfigDict(extra="forbid", strict=True)
    decimals: int = Field(ge=0, le=9)
    decimalSeparator: Literal[".", ",", "·"]
    thousandsSeparator: Literal["", ",", " ", "'"]
    prefix: str = Field(max_length=32)
    suffix: str = Field(max_length=32)

    @field_validator("prefix", "suffix")
    @classmethod
    def check_literal_characters(cls, value):
        for character in value:
            codepoint = ord(character)
            if not (codepoint in (9, 10, 13) or 0x20 <= codepoint <= 0xD7FF
                    or 0xE000 <= codepoint <= 0xFFFD or 0x10000 <= codepoint <= 0x10FFFF):
                raise ValueError("Prefix and suffix must not contain unsupported control characters.")
        return value

    @model_validator(mode="after")
    def check_separators(self):
        if self.decimalSeparator == self.thousandsSeparator:
            raise ValueError("Decimal and thousands separators must differ.")
        return self


class AxisSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    scale: Literal["auto", "linear", "log10"] = "auto"
    minimum: FiniteFloat | None = None
    maximum: FiniteFloat | None = None
    majorInterval: FiniteFloat | None = Field(default=None, gt=0)
    reverse: bool = False
    showAxis: bool = True
    showGrid: bool = False
    numberFormat: AxisNumberFormat | None = Field(default=None, exclude_if=lambda value: value is None)

    @field_validator("numberFormat", mode="before")
    @classmethod
    def reject_explicit_null_format(cls, value):
        if value is None:
            raise ValueError("Number format must be a complete object when provided.")
        return value

    @model_validator(mode="after")
    def check_axis(self):
        if any(abs(v) > 1e100 for v in (self.minimum, self.maximum, self.majorInterval) if v is not None):
            raise ValueError("Axis values must have magnitude no greater than 1e100.")
        if self.minimum is not None and self.maximum is not None and self.minimum >= self.maximum:
            raise ValueError("Axis minimum must be less than maximum.")
        if self.scale == "log10":
            if any(v <= 0 for v in (self.minimum, self.maximum) if v is not None):
                raise ValueError("Logarithmic axis limits must be positive.")
            if self.majorInterval is not None:
                raise ValueError("Major intervals are supported only on linear axes.")
        return self


HexColor = Field(pattern=r"^#[0-9a-fA-F]{6}$")
LineWeight = Literal[0.25, 0.5, 1, 1.5, 2, 3, 4]


class DatasetStyle(BaseModel):
    """One plotted data set's Format Graph appearance, fully resolved by the
    browser (web/src/graph-style.ts) so exports draw what the page shows."""
    model_config = ConfigDict(extra="forbid", strict=True)
    color: str = HexColor
    fill: str = HexColor
    pattern: bool
    border_width: LineWeight
    symbols: bool
    symbol_color: str = HexColor
    symbol_shape: Literal["circle", "square", "triangle", "diamond"]
    symbol_size: int = Field(ge=1, le=10)
    error_bars: bool
    error_color: str = HexColor
    error_cap: Literal["T", "I"]
    error_direction: Literal["above", "below", "both"]
    error_width: LineWeight
    line_width: LineWeight


class GraphAxes(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: AxisSettings = Field(default_factory=AxisSettings)
    y: AxisSettings = Field(default_factory=AxisSettings)


class GraphOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["scatter", "bar", "box", "line"] = "scatter"
    error: Literal["sd", "sem", "ci", "none"] = "sem"
    title: str = Field(default="", max_length=200)
    x_label: str = Field(default="", max_length=100)
    y_label: str = Field(default="", max_length=100)
    colors: list[str] = Field(default_factory=list, max_length=32)
    show_points: bool = True
    # XY line rendering only; never masks a measurement from scientific analyses.
    gap_at_missing_y: StrictBool = False
    annotations: list[GraphAnnotation] = Field(default_factory=list, max_length=435)
    axes: GraphAxes | None = None
    # Per plotted data set, in drawing order. Empty keeps the earlier styling.
    styles: list[DatasetStyle] = Field(default_factory=list, max_length=32)
    # None keeps the earlier rule: XY graphs have a legend, column graphs do not.
    show_legend: StrictBool | None = None
    # Category labels slant 45 degrees when they are wider than their slot.
    x_tick_rotation: Literal[0, 45] = 0


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data: AnalysisRequest
    graph: GraphOptions = Field(default_factory=GraphOptions)
    format: Literal["svg", "png", "pdf"] = "svg"

    @model_validator(mode="after")
    def check_axes(self):
        if self.graph.axes is None:
            return self
        x = self.graph.axes.x
        if self.data.table_type == "column":
            if x.scale != "auto" or any(v is not None for v in (x.minimum, x.maximum, x.majorInterval, x.numberFormat)):
                raise ValueError("Categorical X supports only reverse, axis visibility and grid settings.")
        elif x.scale == "auto" and self.data.analysis == "dose_response":
            if any(v <= 0 for v in (x.minimum, x.maximum) if v is not None):
                raise ValueError("Automatic dose-response X uses log scale; axis limits must be positive.")
            if x.majorInterval is not None:
                raise ValueError("Major intervals are supported only on linear axes.")
        return self
