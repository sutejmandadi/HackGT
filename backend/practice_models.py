from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, model_validator

PIPELINE = "interview-mri-1.0"
RUBRIC = "coaching-3.0"
STAR = Literal["situation", "task", "actions", "result", "unknown"]

class Metadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    question_id: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=5, max_length=1500)
    competency: Literal["leadership", "teamwork", "problem_solving", "failure", "ambiguity"]
    linked_story_id: UUID | None = None

class Word(BaseModel):
    text: str = Field(min_length=1, max_length=150)
    start: float = Field(ge=0, le=301)
    end: float = Field(ge=0, le=301)
    confidence: float = Field(ge=0, le=1, default=1)
    @model_validator(mode="after")
    def order(self):
        if self.end < self.start:
            raise ValueError("Invalid word timestamps")
        return self

class Segment(BaseModel):
    index: int
    start: float
    end: float
    text: str
    words: list[Word]
    star: STAR = "unknown"
    relevance: float | None = None
    evidence: bool = False
    vague: bool = False
    wpm: float = 0

class Feedback(BaseModel):
    kind: Literal["observation", "inference", "recommendation"]
    text: str
    segments: list[int]

class Analysis(BaseModel):
    scores: dict[str, float]
    score_explanation: str
    summary: str
    strengths: list[Feedback]
    improvements: list[Feedback]
    exercise: str
    outline: list[dict]
    intersections: list[Feedback]
    confidence: Literal["limited", "moderate"]
    limitations: list[str]
    semantic_method: str
    intent_assessment: str
    ownership_clarity: str
    action_depth: str
    result_strength: str
    coherence: str

class Report(BaseModel):
    id: str
    question_id: str
    prompt: str
    competency: str
    linked_story_id: str | None
    created_at: str
    status: Literal["completed"] = "completed"
    duration: float
    transcript: str
    segments: list[Segment]
    metrics: dict
    analysis: Analysis
    pipeline_version: str = PIPELINE
    rubric_version: str = RUBRIC
    is_mock: bool = False
    error: str | None = None
