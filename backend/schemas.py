from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class STARInput(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = "Untitled Story"
    organization: Optional[str] = ""
    role: Optional[str] = ""
    situation: str = Field(..., description="Context, background, and environment")
    task: str = Field(..., description="Challenge, objective, or problem to solve")
    actions: Optional[str] = Field(None, description="Concrete steps taken (teammate's format)")
    action: Optional[str] = Field(None, description="Alias for actions")
    result: str = Field(..., description="Outcome, quantifiable impact, and learnings")
    source: Optional[str] = Field("manual", description="'manual' or 'resume'")
    userConfirmed: Optional[bool] = Field(False, description="Whether user reviewed/confirmed")
    updatedAt: Optional[str] = Field(None, description="ISO timestamp")

    @property
    def action_text(self) -> str:
        """Returns action or actions seamlessly."""
        return self.actions or self.action or ""

    def __init__(self, **data):
        # Normalize actions/action seamlessly
        if "actions" in data and ("action" not in data or not data["action"]):
            data["action"] = data["actions"]
        elif "action" in data and ("actions" not in data or not data["actions"]):
            data["actions"] = data["action"]
        super().__init__(**data)


class CategoryScoreDetail(BaseModel):
    category: str
    label: str
    percentage: float = Field(..., ge=0.0, le=100.0, description="Percentage match 0-100%")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score")
    level: str = Field(..., description="Low, Moderate, Strong, or Exemplary")
    signals_detected: List[str] = Field(default_factory=list, description="Key keywords or phrases triggering the score")
    evidence_sentences: List[str] = Field(default_factory=list, description="Sentences with the highest activation")
    improvement_tip: str = Field("", description="Actionable tip to increase score in this category")


class StrengthGridScore(BaseModel):
    id: Optional[str] = None
    title: str = ""
    organization: Optional[str] = ""
    role: Optional[str] = ""
    source: Optional[str] = "manual"
    userConfirmed: Optional[bool] = False
    updatedAt: Optional[str] = None
    teamwork: float = Field(..., ge=0.0, le=100.0)
    problem_solving: float = Field(..., ge=0.0, le=100.0)
    failure: float = Field(..., ge=0.0, le=100.0)
    leadership: float = Field(..., ge=0.0, le=100.0)
    ambiguity: float = Field(..., ge=0.0, le=100.0)
    dominant_category: str
    secondary_category: Optional[str] = None
    overall_strength_score: float
    details: Dict[str, CategoryScoreDetail]


class BatchScoreRequest(BaseModel):
    stories: List[STARInput]


class BatchScoreResponse(BaseModel):
    scores: List[StrengthGridScore]
    category_averages: Dict[str, float]
    coverage_gaps: List[str]
    recommended_focus: str
