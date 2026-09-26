from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from schemas import STARInput, StrengthGridScore, BatchScoreRequest, BatchScoreResponse
from strength_scorer import StrengthGridScorer
from resume_routes import router as resume_router

app = FastAPI(
    title="Behavioral Interview AI Engine",
    description="ML-powered behavioral interview intelligence & STAR strength evaluation",
    version="1.0.0"
)

app.include_router(resume_router)

# Enable CORS for Next.js frontend and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML Scorer (loaded once on startup)
scorer: StrengthGridScorer = None


@app.on_event("startup")
def startup_event():
    global scorer
    print("Starting ML Strength Scorer engine...")
    scorer = StrengthGridScorer()
    app.state.scorer = scorer
    print("ML Strength Scorer ready.")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": scorer is not None,
        "categories": ["teamwork", "problem_solving", "failure", "leadership", "ambiguity"]
    }


@app.post("/api/strength-grid/score", response_model=StrengthGridScore)
def score_story(story: STARInput):
    """
    Score a single behavioral story across the 5 core pillars:
    - teamwork (0% - 100%)
    - problem_solving (0% - 100%)
    - failure (0% - 100%)
    - leadership (0% - 100%)
    - ambiguity (0% - 100%)

    Accepts situation, task, action (or actions), and result.
    """
    if scorer is None:
        raise HTTPException(status_code=503, detail="ML model is still loading")
    try:
        return scorer.score_single_story(story)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")


@app.post("/api/strength-grid/score-batch", response_model=BatchScoreResponse)
def score_batch(request: BatchScoreRequest):
    """
    Score multiple stories at once, returning individual grades,
    portfolio category averages, and identifying coverage gaps.
    """
    if scorer is None:
        raise HTTPException(status_code=503, detail="ML model is still loading")
    try:
        return scorer.score_batch(request.stories)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch scoring error: {str(e)}")


# ============================================================================
# SUPABASE INTEGRATION ENDPOINTS
# ============================================================================

# pyrefly: ignore [missing-import]
from services.supabase_service import (
    fetch_stories_from_supabase,
    fetch_single_story_from_supabase,
    score_stories_from_supabase
)


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Helper to extract JWT token from Authorization header."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.split("Bearer ")[1].strip()
    return None


@app.get("/api/supabase/stories", response_model=List[STARInput])
def get_stories_from_supabase(
    authorization: Optional[str] = Header(None),
    owner_id: Optional[str] = Query(None, description="Optional owner_id if using service role")
):
    """
    Fetches candidate STAR stories directly from the Supabase 'stories' table.
    Pass 'Authorization: Bearer <user_access_token>' to enforce Row Level Security (RLS).
    """
    token = _extract_bearer_token(authorization)
    try:
        return fetch_stories_from_supabase(user_token=token, owner_id=owner_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase fetch error: {str(e)}")


@app.post("/api/supabase/score-stories", response_model=BatchScoreResponse)
def score_all_supabase_stories(
    authorization: Optional[str] = Header(None),
    owner_id: Optional[str] = Query(None, description="Optional owner_id if using service role")
):
    """
    Pulls STAR stories directly from the Supabase database for the authenticated user,
    runs the ML Strength Grid Scorer, and returns:
    - 5-category percentage scores per story
    - Portfolio category averages
    - Identified coverage gaps
    """
    if scorer is None:
        raise HTTPException(status_code=503, detail="ML model is still loading")
    token = _extract_bearer_token(authorization)
    try:
        return score_stories_from_supabase(user_token=token, owner_id=owner_id, scorer=scorer)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase scoring error: {str(e)}")


@app.post("/api/supabase/score-story/{story_id}", response_model=StrengthGridScore)
def score_single_supabase_story(
    story_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Fetches a specific story by UUID from the Supabase database and evaluates it with ML.
    """
    if scorer is None:
        raise HTTPException(status_code=503, detail="ML model is still loading")
    token = _extract_bearer_token(authorization)
    try:
        story = fetch_single_story_from_supabase(story_id=story_id, user_token=token)
        if not story:
            raise HTTPException(status_code=404, detail=f"Story with id '{story_id}' not found in Supabase")
        return scorer.score_single_story(story)
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase scoring error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
