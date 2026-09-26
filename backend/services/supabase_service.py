import os
from typing import Dict, List, Optional, Union
from dotenv import load_dotenv
from supabase import create_client, Client

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas import STARInput, BatchScoreResponse, StrengthGridScore
from strength_scorer import StrengthGridScorer

# Load environment variables (.env in backend or root or frontend)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))


def get_supabase_credentials() -> Dict[str, str]:
    """
    Extracts Supabase credentials from environment variables.
    Supports standard backend and Next.js public variables.
    """
    url = (
        os.getenv("SUPABASE_URL")
        or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    )
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    )
    return {"url": url, "key": key}


def create_supabase_client(user_token: Optional[str] = None) -> Client:
    """
    Creates and returns a Supabase client.
    If a user JWT access token is provided, it is attached to the client
    so that queries automatically respect Row-Level Security (RLS) policies.
    """
    creds = get_supabase_credentials()
    if not creds["url"] or not creds["key"]:
        raise ValueError(
            "Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_KEY in your .env file."
        )

    client: Client = create_client(creds["url"], creds["key"])
    if user_token:
        # Attach user token for RLS policy enforcement
        client.postgrest.auth(user_token)

    return client


def row_to_star_input(row: Dict[str, any]) -> STARInput:
    """Converts a Supabase 'stories' table row into a STARInput instance."""
    return STARInput(
        id=str(row.get("id", "")),
        title=row.get("title", "Untitled Story"),
        organization=row.get("organization", ""),
        role=row.get("role", ""),
        situation=row.get("situation", ""),
        task=row.get("task", ""),
        actions=row.get("actions", ""),
        result=row.get("result", ""),
        source=row.get("source", "manual"),
        updatedAt=str(row.get("updated_at", "")) if row.get("updated_at") else None
    )


def fetch_stories_from_supabase(
    user_token: Optional[str] = None,
    owner_id: Optional[str] = None
) -> List[STARInput]:
    """
    Fetches STAR stories from the Supabase 'stories' table.
    
    If user_token is passed: Supabase applies RLS ('Read own stories' policy).
    If owner_id is passed (service role): filters explicitly by owner_id.
    """
    client = create_supabase_client(user_token=user_token)
    query = client.from_("stories").select("*")

    if owner_id and not user_token:
        query = query.eq("owner_id", owner_id)

    query = query.order("created_at", desc=False)
    response = query.execute()

    if not response.data:
        return []

    return [row_to_star_input(r) for r in response.data]


def fetch_single_story_from_supabase(
    story_id: str,
    user_token: Optional[str] = None
) -> Optional[STARInput]:
    """Fetches a single story by UUID from the Supabase 'stories' table."""
    client = create_supabase_client(user_token=user_token)
    response = client.from_("stories").select("*").eq("id", story_id).single().execute()

    if not response.data:
        return None

    return row_to_star_input(response.data)


def score_stories_from_supabase(
    user_token: Optional[str] = None,
    owner_id: Optional[str] = None,
    scorer: Optional[StrengthGridScorer] = None
) -> BatchScoreResponse:
    """
    Fetches stories directly from Supabase, runs the ML Strength Grid scorer,
    and returns the evaluated 5-dimension percentages, category averages, and coverage gaps.
    """
    stories = fetch_stories_from_supabase(user_token=user_token, owner_id=owner_id)
    if not stories:
        return BatchScoreResponse(
            scores=[],
            category_averages={
                "teamwork": 0.0,
                "problem_solving": 0.0,
                "failure": 0.0,
                "leadership": 0.0,
                "ambiguity": 0.0,
            },
            coverage_gaps=["teamwork", "problem_solving", "failure", "leadership", "ambiguity"],
            recommended_focus="No stories found in Supabase. Create your first STAR story to evaluate your Strength Grid."
        )

    if scorer is None:
        scorer = StrengthGridScorer()

    return scorer.score_batch(stories)
