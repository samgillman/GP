"""Validated request boundaries shared by browser and server analysis modes."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator
from .survival import analyze_survival


class SurvivalGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    times: list[FiniteFloat] = Field(min_length=1, max_length=100000)
    events: list[Literal[0, 1]] = Field(min_length=1, max_length=100000)


class SurvivalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    groups: dict[str, SurvivalGroup] = Field(min_length=1, max_length=32)
    confidence: float = Field(default=.95, ge=.5, le=.999)

    @model_validator(mode="after")
    def total_subjects(self):
        if sum(len(group.times) for group in self.groups.values()) > 100000:
            raise ValueError("At most 100,000 subjects are supported across groups.")
        return self

    def analyze(self):
        return analyze_survival({name: group.model_dump() for name, group in self.groups.items()}, self.confidence)
