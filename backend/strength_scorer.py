import re
from typing import Dict, List, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer

from schemas import STARInput, StrengthGridScore, CategoryScoreDetail, BatchScoreResponse


class StrengthGridScorer:
    """
    ML Scoring Engine for Behavioral Interview Stories.
    Evaluates STAR components against 5 core behavioral pillars:
    - Teamwork
    - Problem Solving
    - Failure / Resilience
    - Leadership
    - Ambiguity
    
    Produces calibrated 0% - 100% percentage scores.
    """

    CATEGORIES = {
        "teamwork": {
            "label": "Teamwork & Collaboration",
            "anchors": [
                "I collaborated closely with cross-functional teams including product managers, designers, and engineers to deliver the project.",
                "Navigated interpersonal conflict and disagreement within the team by facilitating open discussions, listening actively, and building consensus.",
                "Shared credit with team members, supported struggling peers, conducted constructive code reviews, and fostered a positive team culture.",
                "Partnered with external stakeholders, aligned conflicting priorities, and maintained transparent communication across departments."
            ],
            "signals": [
                r"\bcollaborat\w*", r"\bteam\w*", r"\bpartner\w*", r"\bcross-functional\b",
                r"\bconsensus\b", r"\bconflict\b", r"\bpair program\w*", r"\bstakeholder\w*",
                r"\bpeer\w*", r"\bsupport\w*", r"\bcredit\b", r"\bempathy\b", r"\balign\w*"
            ],
            "weights": {"situation": 0.15, "task": 0.15, "action": 0.45, "result": 0.25},
            "midpoint": 0.28,
            "steepness": 13.0,
            "low_tip": "Highlight how you collaborated with others, resolved differing opinions, or supported your teammates."
        },
        "problem_solving": {
            "label": "Problem Solving & Analytical Rigor",
            "anchors": [
                "I diagnosed a critical technical issue, identified the root cause using profiling and logs, and engineered a robust architectural solution.",
                "Solved a highly complex algorithmic and architectural challenge by breaking the problem down into manageable components and testing hypotheses.",
                "Overcame unexpected technical roadblocks and edge cases by implementing innovative algorithms, optimizing memory, and improving system efficiency.",
                "Analyzed trade-offs between competing technical solutions and selected the optimal balance between performance, scalability, and delivery time."
            ],
            "signals": [
                r"\bdiagnos\w*", r"\broot cause\b", r"\bdebug\w*", r"\barchitect\w*",
                r"\bsolv\w*", r"\balgorithm\w*", r"\btroubleshoot\w*", r"\bbottleneck\w*",
                r"\boptimiz\w*", r"\btrade-off\w*", r"\bhypothes\w*", r"\bprofil\w*", r"\bengineer\w*"
            ],
            "weights": {"situation": 0.15, "task": 0.25, "action": 0.45, "result": 0.15},
            "midpoint": 0.29,
            "steepness": 13.0,
            "low_tip": "Detail the technical diagnosis, root cause analysis, or systematic steps you took to overcome the obstacle."
        },
        "failure": {
            "label": "Failure & Resilience",
            "anchors": [
                "I made a critical mistake that caused an unexpected system outage or missed deadline, took full personal accountability, and quickly contained the damage.",
                "The initial approach failed to meet performance requirements or user expectations, requiring a candid post-mortem and total rethink.",
                "Conducted a thorough post-mortem without blame, identified the root cause of the failure, and implemented automated guardrails so it would never happen again.",
                "Reflected on what I could have done better, learned valuable lessons in humility and risk management, and grew as an engineer from the setback."
            ],
            "signals": [
                r"\bmistake\w*", r"\bfail\w*", r"\boutage\w*", r"\bpost-mortem\b",
                r"\baccountab\w*", r"\bregret\w*", r"\blesson\w*", r"\bsetback\w*",
                r"\boversight\w*", r"\bapologiz\w*", r"\bincident\w*", r"\brebound\w*", r"\bretrospect\w*"
            ],
            "weights": {"situation": 0.25, "task": 0.20, "action": 0.30, "result": 0.25},
            "midpoint": 0.25,
            "steepness": 14.0,
            "low_tip": "Include a candid vulnerability, mistake made, or unexpected setback, along with deep self-reflection and permanent safeguards put in place."
        },
        "leadership": {
            "label": "Leadership & Initiative",
            "anchors": [
                "I took initiative to lead the project from conception to launch, defining technical vision, milestones, and delegating responsibilities effectively.",
                "Mentored junior engineers and interns, guided them through technical hurdles, unblocked their progress, and helped them grow their skills.",
                "Influenced senior stakeholders and engineering leadership to adopt a new technical standard, building a compelling case with data.",
                "Demonstrated ownership by stepping up to resolve an ambiguous problem that had no clear owner, rallying others to support the initiative."
            ],
            "signals": [
                r"\bled\b", r"\blead\w*", r"\bmentor\w*", r"\bown\w*", r"\binitiat\w*",
                r"\bvision\b", r"\bdelegat\w*", r"\bunblock\w*", r"\binfluenc\w*",
                r"\brally\w*", r"\bchampion\w*", r"\bspearhead\w*", r"\bownership\b"
            ],
            "weights": {"situation": 0.10, "task": 0.15, "action": 0.50, "result": 0.25},
            "midpoint": 0.28,
            "steepness": 13.0,
            "low_tip": "Highlight where you took initiative, made decisions, steered others, mentored team members, or showed proactive ownership."
        },
        "ambiguity": {
            "label": "Dealing with Ambiguity",
            "anchors": [
                "I had to operate in an environment with missing specifications, unclear business requirements, and high uncertainty, formulating a plan from scratch.",
                "Made high-stakes technical decisions with incomplete information, creating prototypes and validating assumptions rapidly through iterative feedback.",
                "Navigated shifting priorities and vague goals by establishing clear milestones, asking probing questions, and creating structured roadmaps.",
                "Tackled an open-ended greenfield problem where the path forward was undefined, breaking it down into phased milestones."
            ],
            "signals": [
                r"\bunclear\b", r"\bambigu\w*", r"\buncertain\w*", r"\bvague\b",
                r"\bmissing spec\w*", r"\bincomplete data\b", r"\bopen-ended\b",
                r"\bgreenfield\b", r"\bundefined\b", r"\bpivot\w*", r"\bprototyp\w*", r"\bexplor\w*"
            ],
            "weights": {"situation": 0.30, "task": 0.30, "action": 0.30, "result": 0.10},
            "midpoint": 0.26,
            "steepness": 14.0,
            "low_tip": "Emphasize how you operated without clear instructions, made smart bets under uncertainty, or defined unclear project requirements."
        }
    }

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        print(f"Loading SentenceTransformer model: {model_name}...")
        self.model = SentenceTransformer(model_name)
        self._precompute_category_embeddings()
        print("StrengthGridScorer successfully initialized with precomputed anchor embeddings.")

    def _precompute_category_embeddings(self):
        """Precomputes normalized anchor embeddings for each behavioral pillar."""
        self.category_anchor_embeddings = {}
        for cat_key, config in self.CATEGORIES.items():
            anchors = config["anchors"]
            embeddings = self.model.encode(anchors, normalize_embeddings=True)
            # Mean anchor representation
            mean_embedding = np.mean(embeddings, axis=0)
            mean_embedding = mean_embedding / np.linalg.norm(mean_embedding)
            self.category_anchor_embeddings[cat_key] = {
                "all": embeddings,
                "mean": mean_embedding
            }

    @staticmethod
    def _split_into_sentences(text: str) -> List[str]:
        """Simple regex-based sentence splitter."""
        if not text:
            return []
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if len(s.strip()) > 8]

    def _count_signals(self, text: str, patterns: List[str]) -> Tuple[int, List[str]]:
        """Counts regex signal matches and returns matched terms."""
        matches = []
        for pat in patterns:
            found = re.findall(pat, text, flags=re.IGNORECASE)
            if found:
                matches.extend(found[:2])
        return len(matches), list(set(matches))[:5]

    @staticmethod
    def _compute_depth_factor(sections: Dict[str, str]) -> Tuple[float, List[str], str, int]:
        """
        Computes a Substance & Depth Multiplier (0.25 to 1.0) based on:
        1. Word count saturation curve (interviews expect 80-250 words)
        2. Per-section completeness (especially Actions & Result)
        3. Quantifiable impact markers (percentages, scale, numbers)
        """
        import math
        words_per_sec = {k: len(v.strip().split()) for k, v in sections.items()}
        total_words = sum(words_per_sec.values())

        # Word count saturation curve: reaches ~0.80 at 65 words, ~0.95 at 100 words
        base_depth = 1.0 - math.exp(-total_words / 50.0)
        base_depth = max(0.25, min(1.0, base_depth))

        penalties = 0.0
        warnings = []

        if words_per_sec.get("action", 0) < 12:
            penalties += 0.15
            warnings.append("Action is too brief; elaborate with concrete technical steps.")
        if words_per_sec.get("result", 0) < 8:
            penalties += 0.10
            warnings.append("Result is too brief; include quantifiable impact or learnings.")
        if words_per_sec.get("situation", 0) < 6:
            penalties += 0.05
            warnings.append("Situation needs more context about the team or environment.")

        # Bonus for quantifiable metrics in Result (e.g. 40%, 3 days, $100k, 5x)
        has_metrics = bool(re.search(r'\b\d+(\.\d+)?(%|[kKmMbB]|x|\s*(days?|weeks?|months?|users?|ms|seconds?))?\b', sections.get("result", "")))
        metric_bonus = 0.06 if has_metrics and total_words >= 40 else 0.0

        depth_multiplier = float(np.clip(base_depth - penalties + metric_bonus, 0.25, 1.0))

        if total_words < 35:
            tip = f"Story lacks depth ({total_words} words). Interviewers expect 80-250 words detailing your specific actions, technical trade-offs, and measurable outcomes."
        elif warnings:
            tip = " ".join(warnings)
        else:
            tip = ""

        return depth_multiplier, warnings, tip, total_words

    def score_single_story(self, story: STARInput) -> StrengthGridScore:
        """
        Evaluates a single STAR story and returns percentage scores (0.0 to 100.0)
        for all 5 categories.
        """
        act_text = story.action_text
        sections = {
            "situation": story.situation or "",
            "task": story.task or "",
            "action": act_text,
            "result": story.result or ""
        }
        
        full_text = f"Situation: {story.situation} Task: {story.task} Action: {act_text} Result: {story.result}"
        sentences = self._split_into_sentences(full_text)
        
        # 1. Encode sections and overall story
        section_texts = list(sections.values())
        section_keys = list(sections.keys())
        section_embeddings = self.model.encode(section_texts, normalize_embeddings=True)
        sec_emb_dict = {sec_keys: section_embeddings[i] for i, sec_keys in enumerate(section_keys)}
        
        full_embedding = self.model.encode(full_text, normalize_embeddings=True)
        
        # Encode sentences for evidence extraction if available
        sentence_embeddings = self.model.encode(sentences, normalize_embeddings=True) if sentences else None

        depth_multiplier, depth_warnings, depth_tip, total_words = self._compute_depth_factor(sections)

        category_scores: Dict[str, float] = {}
        category_details: Dict[str, CategoryScoreDetail] = {}

        for cat_key, config in self.CATEGORIES.items():
            cat_anchors = self.category_anchor_embeddings[cat_key]["all"]
            cat_mean = self.category_anchor_embeddings[cat_key]["mean"]
            weights = config["weights"]
            
            # Weighted section similarity
            weighted_sim = 0.0
            for sec_key, weight in weights.items():
                sec_emb = sec_emb_dict[sec_key]
                sims = np.dot(cat_anchors, sec_emb)
                max_sec_sim = float(np.max(sims))
                weighted_sim += weight * max_sec_sim

            # Full text direct similarity
            full_sim = float(np.dot(cat_mean, full_embedding))
            combined_raw_sim = 0.65 * weighted_sim + 0.35 * full_sim

            # Lexical signal boost
            signal_count, detected_signals = self._count_signals(full_text, config["signals"])
            # Up to +12% boost from concrete lexical keywords
            signal_boost = min(0.12, signal_count * 0.025)

            # Special case for Failure: if failure keywords are completely absent,
            # apply penalty so generic successful stories don't accidentally score 70% in Failure
            failure_penalty = 0.0
            if cat_key == "failure" and signal_count == 0:
                failure_penalty = 0.15

            # Calibrated Dynamic Sigmoid Rescaling
            # Replaces the restrictive linear floor (which artificially deflated scores on specialized text)
            # with an activation curve mapping real-world candidate responses to intuitive human rating bands.
            midpoint = config.get("midpoint", 0.28)
            steepness = config.get("steepness", 13.0)

            # Combine similarity with lexical signal boost and failure penalty
            effective_score = combined_raw_sim + signal_boost - failure_penalty

            # Logistic sigmoid activation
            calibrated_prob = 1.0 / (1.0 + np.exp(-steepness * (effective_score - midpoint)))

            # Substance & Depth Modulation:
            # Multiplies by depth factor (0.25 to 1.0) so shallow, 15-word answers cannot score 85%+
            final_prob = calibrated_prob * depth_multiplier
            percentage = round(float(np.clip(final_prob * 100.0, 0.0, 100.0)), 1)

            # Confidence score
            confidence = round(float(np.clip(0.65 + (combined_raw_sim * 0.3) + (depth_multiplier * 0.15), 0.65, 0.98)), 2)

            # Level classification
            if total_words < 35:
                level = "Insufficient Detail"
            elif percentage >= 82.0:
                level = "Exemplary"
            elif percentage >= 65.0:
                level = "Strong"
            elif percentage >= 45.0:
                level = "Moderate"
            else:
                level = "Low"

            # Top evidence sentences
            evidence_sents = []
            if sentence_embeddings is not None and len(sentences) > 0:
                sent_sims = np.dot(sentence_embeddings, cat_mean)
                top_indices = np.argsort(sent_sims)[::-1][:2]
                evidence_sents = [sentences[idx] for idx in top_indices if sent_sims[idx] > 0.25]

            if depth_tip and total_words < 45:
                tip = depth_tip
            elif percentage < 60.0:
                tip = config["low_tip"]
            else:
                tip = f"Great evidence of {config['label'].lower()}!"

            category_scores[cat_key] = percentage
            category_details[cat_key] = CategoryScoreDetail(
                category=cat_key,
                label=config["label"],
                percentage=percentage,
                confidence=confidence,
                level=level,
                signals_detected=detected_signals,
                evidence_sentences=evidence_sents,
                improvement_tip=tip
            )

        # Determine dominant and secondary competencies
        sorted_cats = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
        dominant_category = sorted_cats[0][0]
        secondary_category = sorted_cats[1][0] if len(sorted_cats) > 1 else None
        overall_strength = round(float(np.mean(list(category_scores.values()))), 1)

        return StrengthGridScore(
            id=story.id,
            title=story.title or "Untitled Story",
            organization=story.organization or "",
            role=story.role or "",
            source=story.source or "manual",
            userConfirmed=story.userConfirmed or False,
            updatedAt=story.updatedAt,
            teamwork=category_scores["teamwork"],
            problem_solving=category_scores["problem_solving"],
            failure=category_scores["failure"],
            leadership=category_scores["leadership"],
            ambiguity=category_scores["ambiguity"],
            dominant_category=dominant_category,
            secondary_category=secondary_category,
            overall_strength_score=overall_strength,
            details=category_details
        )

    def score_batch(self, stories: List[STARInput]) -> BatchScoreResponse:
        """Evaluates multiple stories and computes aggregate portfolio stats and coverage gaps."""
        scores = [self.score_single_story(story) for story in stories]

        if not scores:
            return BatchScoreResponse(
                scores=[],
                category_averages={"teamwork": 0.0, "problem_solving": 0.0, "failure": 0.0, "leadership": 0.0, "ambiguity": 0.0},
                coverage_gaps=["teamwork", "problem_solving", "failure", "leadership", "ambiguity"],
                recommended_focus="Please add at least one story to build your strength grid."
            )

        averages = {}
        for cat in ["teamwork", "problem_solving", "failure", "leadership", "ambiguity"]:
            cat_scores = [getattr(s, cat) for s in scores]
            averages[cat] = round(float(np.mean(cat_scores)), 1)

        # Coverage gap: any category where no single story achieves >= 65%
        coverage_gaps = []
        for cat in ["teamwork", "problem_solving", "failure", "leadership", "ambiguity"]:
            max_cat_score = max(getattr(s, cat) for s in scores)
            if max_cat_score < 65.0:
                coverage_gaps.append(cat)

        if coverage_gaps:
            recommended_focus = f"Critical coverage gap in {', '.join(coverage_gaps).upper()}. Prepare a story targeting these areas."
        else:
            recommended_focus = "Well-balanced story grid across all 5 core behavioral dimensions!"

        return BatchScoreResponse(
            scores=scores,
            category_averages=averages,
            coverage_gaps=coverage_gaps,
            recommended_focus=recommended_focus
        )

    def score_json_file(self, json_filepath: str, output_filepath: str = None) -> BatchScoreResponse:
        """
        Loads stories directly from a .json file, computes ML scores for all 5 categories,
        and optionally writes the resulting scored grid to an output .json file.

        Supports:
        - List of stories: [ {...}, {...} ]
        - Dict with 'stories' key: { "stories": [ {...}, ... ] }
        - Single story dict: { "situation": ..., "task": ..., "action": ..., "result": ... }
        """
        import json
        with open(json_filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        stories_raw = []
        if isinstance(data, list):
            stories_raw = data
        elif isinstance(data, dict):
            if "stories" in data and isinstance(data["stories"], list):
                stories_raw = data["stories"]
            else:
                stories_raw = [data]

        stories = [STARInput(**item) for item in stories_raw]
        response = self.score_batch(stories)

        if output_filepath:
            with open(output_filepath, "w", encoding="utf-8") as f:
                json.dump(response.model_dump(), f, indent=2)
            print(f"Successfully scored {len(stories)} stories and saved results to: {output_filepath}")

        return response


if __name__ == "__main__":
    import sys
    import json

    input_file = sys.argv[1] if len(sys.argv) > 1 else "sample_stories.json"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "strength_grid_results.json"

    print(f"Loading and scoring stories from: {input_file}")
    scorer = StrengthGridScorer()
    results = scorer.score_json_file(input_file, output_file)

    print("\n" + "=" * 70)
    print("STRENGTH GRID RESULTS SUMMARY:")
    print("=" * 70)
    for s in results.scores:
        print(f"\nStory: {s.title or 'Untitled'} (Dominant: {s.dominant_category.upper()})")
        print(f"  Teamwork:        {s.teamwork}%")
        print(f"  Problem Solving: {s.problem_solving}%")
        print(f"  Failure:         {s.failure}%")
        print(f"  Leadership:      {s.leadership}%")
        print(f"  Ambiguity:       {s.ambiguity}%")
    print("\nCategory Averages Across Stories:", results.category_averages)
    print("Coverage Gaps Identified:", results.coverage_gaps)
    print("Recommendation:", results.recommended_focus)
    print("=" * 70)
