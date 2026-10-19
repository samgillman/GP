from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    values: list[FiniteFloat | None] = Field(min_length=1, max_length=10000)


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    table_type: Literal["column", "xy"] = "column"
    columns: list[Column] = Field(min_length=1, max_length=32)
    analysis: Literal["descriptive", "welch_t", "paired_t", "anova", "linear_regression", "dose_response", "nonlinear_regression"] = "descriptive"
    regression_model: str = Field(default="one_phase_decay", min_length=1, max_length=100)
    confidence: float = Field(default=0.95, ge=0.5, le=0.999)

    @model_validator(mode="after")
    def check_data(self):
        if sum(len(c.values) for c in self.columns) > 100000:
            raise ValueError("At most 100,000 cells are supported per request.")
        if len({c.name for c in self.columns}) != len(self.columns):
            raise ValueError("Column names must be unique.")
        if any(abs(v) > 1e100 for c in self.columns for v in c.values if v is not None):
            raise ValueError("Values must have magnitude no greater than 1e100.")
        if self.table_type == "xy" and len(self.columns) < 2:
            raise ValueError("XY tables require an X column and at least one Y column.")
        return self


class GraphOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["scatter", "bar", "box", "line"] = "scatter"
    error: Literal["sd", "sem", "ci", "none"] = "sem"
    title: str = Field(default="", max_length=200)
    x_label: str = Field(default="", max_length=100)
    y_label: str = Field(default="", max_length=100)
    colors: list[str] = Field(default_factory=list, max_length=32)
    show_points: bool = True


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data: AnalysisRequest
    graph: GraphOptions = Field(default_factory=GraphOptions)
    format: Literal["svg", "png", "pdf"] = "svg"
