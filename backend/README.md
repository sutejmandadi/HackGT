# Behavioral Interview Strength Grid ML Scorer (Tool 1)

This service takes a story segmented into **STAR** strings (`situation`, `task`, `action` / `actions`, `result`) and uses an ML model (`sentence-transformers/all-MiniLM-L6-v2` + semantic anchor rubrics + lexical signal analyzers) to score the story from **0% to 100%** across the 5 core behavioral pillars:

1. **Teamwork & Collaboration**
2. **Problem Solving & Analytical Rigor**
3. **Failure & Resilience**
4. **Leadership & Initiative**
5. **Dealing with Ambiguity**

---

## 1. Quick Usage in Python (Direct Import)

If your teammate wants to call the model directly in Python:

```python
from strength_scorer import StrengthGridScorer
from schemas import STARInput

scorer = StrengthGridScorer()

story = STARInput(
    title="Resolving API Schema Dispute",
    situation="Front-end and backend teams had conflicting specifications for the API schema...",
    task="I needed to align both teams and unblock the upcoming sprint release...",
    action="I organized a workshop, walked through trade-offs, and paired with junior devs...",
    result="Both teams agreed to the schema, and we shipped 3 days early with 0 bugs."
)

result = scorer.score_single_story(story)

print(result.teamwork)         # e.g., 84.5%
print(result.problem_solving)  # e.g., 62.0%
print(result.failure)          # e.g., 5.0%
print(result.leadership)       # e.g., 78.2%
print(result.ambiguity)        # e.g., 34.0%
print(result.dominant_category) # "teamwork"
```

---

## 2. API Usage (FastAPI HTTP Endpoint)

### Start the server:
```bash
uvicorn main:app --reload --port 8000
```

### Single Story Scoring:
`POST /api/strength-grid/score`

**Request Body:**
```json
{
  "title": "Scaling Payment Webhook",
  "situation": "Our payment webhook began dropping 8% of transactions during peak traffic hours.",
  "task": "I was assigned to find the bottleneck and prevent revenue loss without shutting down the service.",
  "action": "I profiled the database queries, identified an unindexed lock on the ledger table, and implemented an async queue with Redis and Celery.",
  "result": "Webhook throughput improved by 400%, error rate dropped to 0%, saving an estimated $80k in weekly revenue."
}
```

*Note: Accepts either `"action"` or `"actions"` as the key.*

**Response:**
```json
{
  "title": "Scaling Payment Webhook",
  "teamwork": 12.0,
  "problem_solving": 91.5,
  "failure": 18.2,
  "leadership": 42.0,
  "ambiguity": 28.4,
  "dominant_category": "problem_solving",
  "secondary_category": "leadership",
  "overall_strength_score": 38.4,
  "details": {
    "problem_solving": {
      "percentage": 91.5,
      "confidence": 0.94,
      "level": "Exemplary",
      "signals_detected": ["bottleneck", "profile", "optimiz", "fix"],
      "improvement_tip": "Great evidence of problem solving & analytical rigor!"
    }
    ...
  }
}
```

### Batch Scoring & Coverage Gaps:
`POST /api/strength-grid/score-batch`

Evaluates a list of stories and automatically returns:
- Individual scores for every story
- Overall category averages for the candidate's portfolio
- **Coverage gaps**: flags any pillar where the candidate has no story $\ge 65\%$ (e.g., *"Critical coverage gap in AMBIGUITY. Prepare a story targeting this area."*)
