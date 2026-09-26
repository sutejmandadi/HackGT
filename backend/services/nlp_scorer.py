"""
NLP Scorer Service with Calibrated Dynamic Sigmoid Rescaling.

Resolves artificial score deflation caused by:
1. High linear cosine floors ((sim - 0.15) / (0.65 - 0.15)) which compress technical text scores below 45%.
2. DeBERTa 3-way softmax neutral distribution mass swallowing genuine entailment signal.
3. Linear probability blending missing realistic human rating activation curves.
"""

import math
from typing import Dict, Any, Union
import numpy as np

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas import STARInput, StrengthGridScore
from strength_scorer import StrengthGridScorer

# Shared singleton instance
_default_scorer: StrengthGridScorer = None


def get_scorer() -> StrengthGridScorer:
    global _default_scorer
    if _default_scorer is None:
        _default_scorer = StrengthGridScorer()
    return _default_scorer


def sigmoid_rescale(score: float, midpoint: float = 0.28, steepness: float = 13.0) -> float:
    """
    Applies calibrated sigmoid rescaling to raw cosine similarity or entailment scores.
    Maps:
      - Raw < 0.20 -> 5% - 22% (Minimal relevance)
      - Raw ~ 0.26 - 0.30 -> 40% - 55% (Moderate baseline)
      - Raw ~ 0.36 - 0.42 -> 72% - 85% (Strong behavioral presence)
      - Raw >= 0.45 -> 88% - 98% (Exemplary presence)
    """
    prob = 1.0 / (1.0 + math.exp(-steepness * (score - midpoint)))
    return round(float(np.clip(prob * 100.0, 0.0, 100.0)), 1)


def normalize_nli_entailment(p_entail: float, p_contra: float, p_neutral: float = 0.0) -> float:
    """
    Normalizes DeBERTa / MNLI entailment probability over non-neutral mass
    to eliminate the suppression caused by neutral explanatory fluff in candidate stories.
    """
    denominator = p_entail + p_contra + 1e-9
    normalized_entailment = p_entail / denominator
    return sigmoid_rescale(normalized_entailment, midpoint=0.50, steepness=6.0)


def evaluate_star_story(story: Union[STARInput, Dict[str, Any]]) -> StrengthGridScore:
    """
    Evaluates a STAR story using the calibrated sigmoid rescaling engine.
    Accepts either a STARInput instance or a dictionary.
    """
    if isinstance(story, dict):
        story = STARInput(**story)

    scorer = get_scorer()
    return scorer.score_single_story(story)
