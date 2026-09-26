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


@app.get("/test")
def test_dashboard():
    from fastapi.responses import HTMLResponse
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ML Strength Grid Tester | HackGT</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      </style>
    </head>
    <body class="bg-slate-950 text-slate-100 min-h-screen py-10 px-4">
      <div class="max-w-5xl mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between pb-8 border-b border-slate-800">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Tool 1: ML Strength Scorer
            </div>
            <h1 class="text-3xl font-extrabold tracking-tight text-white">Strength Grid ML Tester</h1>
            <p class="text-slate-400 text-sm mt-1">Evaluates STAR stories across 5 behavioral pillars using all-MiniLM-L6-v2 embeddings</p>
          </div>
          <a href="/docs" target="_blank" class="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            Swagger API Docs ↗
          </a>
        </div>

        <!-- Quick Load Samples -->
        <div class="mt-6 flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-400 font-medium">Load Preset:</span>
          <button onclick="loadSample(1)" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition">
            🤝 Sample: Teamwork & Conflict
          </button>
          <button onclick="loadSample(2)" class="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition">
            ⚠️ Sample: Outage & Failure
          </button>
          <button onclick="loadSample(3)" class="px-3 py-1.5 text-xs font-medium rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition">
            🌫️ Sample: Greenfield Ambiguity
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          <!-- Left: Story Input Form -->
          <div class="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-bold text-white flex items-center gap-2">
                <span>📝</span> Story Input (STAR)
              </h2>
              <span class="text-xs text-slate-500">teammate Story format</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Story Title</label>
                <input id="title" type="text" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="e.g. Scaling Payment Webhook">
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">Organization / Role</label>
                <input id="orgRole" type="text" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="e.g. Stripe • Software Engineer">
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-sky-400 mb-1">Situation (Context & Environment)</label>
              <textarea id="situation" rows="2" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500" placeholder="What was the situation?"></textarea>
            </div>

            <div>
              <label class="block text-xs font-medium text-amber-400 mb-1">Task (Challenge or Objective)</label>
              <textarea id="task" rows="2" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500" placeholder="What needed to be solved?"></textarea>
            </div>

            <div>
              <label class="block text-xs font-medium text-emerald-400 mb-1">Actions (Concrete steps you took)</label>
              <textarea id="actions" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" placeholder="What specific actions did you take?"></textarea>
            </div>

            <div>
              <label class="block text-xs font-medium text-purple-400 mb-1">Result (Outcome & Learnings)</label>
              <textarea id="result" rows="2" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500" placeholder="What was the measurable impact?"></textarea>
            </div>

            <button id="scoreBtn" onclick="evaluateStory()" class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition transform active:scale-98 flex items-center justify-center gap-2">
              <span>⚡ Run ML Strength Evaluation</span>
            </button>
          </div>

          <!-- Right: Visual Strength Grid Output -->
          <div class="lg:col-span-5 space-y-4">
            <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div class="flex items-center justify-between pb-4 border-b border-slate-800">
                <h2 class="text-base font-bold text-white flex items-center gap-2">
                  <span>📊</span> Strength Grid (0% - 100%)
                </h2>
                <div id="dominantBadge" class="hidden px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  -
                </div>
              </div>

              <!-- Overall Score -->
              <div class="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="text-xs text-slate-400">Overall Behavioral Score</div>
                  <div id="overallScore" class="text-2xl font-black text-white mt-0.5">--%</div>
                </div>
                <div id="secondaryPillar" class="text-right text-xs text-slate-400">
                  Secondary: <span class="text-slate-200 font-semibold">--</span>
                </div>
              </div>

              <!-- 5 Category Bars -->
              <div class="mt-6 space-y-4" id="barsContainer">
                <!-- Teamwork -->
                <div>
                  <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-blue-400">🤝 Teamwork & Collaboration</span>
                    <span id="score-teamwork" class="text-white font-bold">0.0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div id="bar-teamwork" class="h-full bg-blue-500 rounded-full transition-all duration-700" style="width: 0%"></div>
                  </div>
                </div>

                <!-- Problem Solving -->
                <div>
                  <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-indigo-400">🧩 Problem Solving & Analysis</span>
                    <span id="score-problem_solving" class="text-white font-bold">0.0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div id="bar-problem_solving" class="h-full bg-indigo-500 rounded-full transition-all duration-700" style="width: 0%"></div>
                  </div>
                </div>

                <!-- Failure -->
                <div>
                  <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-rose-400">⚠️ Failure & Resilience</span>
                    <span id="score-failure" class="text-white font-bold">0.0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div id="bar-failure" class="h-full bg-rose-500 rounded-full transition-all duration-700" style="width: 0%"></div>
                  </div>
                </div>

                <!-- Leadership -->
                <div>
                  <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-emerald-400">👑 Leadership & Initiative</span>
                    <span id="score-leadership" class="text-white font-bold">0.0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div id="bar-leadership" class="h-full bg-emerald-500 rounded-full transition-all duration-700" style="width: 0%"></div>
                  </div>
                </div>

                <!-- Ambiguity -->
                <div>
                  <div class="flex justify-between text-xs font-semibold mb-1">
                    <span class="text-purple-400">🌫️ Dealing with Ambiguity</span>
                    <span id="score-ambiguity" class="text-white font-bold">0.0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div id="bar-ambiguity" class="h-full bg-purple-500 rounded-full transition-all duration-700" style="width: 0%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Details & Signals Card -->
            <div id="feedbackCard" class="hidden bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">🔍 Detected Signals & Insights</h3>
              <div id="signalsList" class="flex flex-wrap gap-1.5"></div>
              <div class="pt-3 border-t border-slate-800">
                <span class="text-xs font-semibold text-amber-400">💡 Improvement Tip:</span>
                <p id="improvementTip" class="text-xs text-slate-300 mt-1 leading-relaxed"></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script>
        const samples = {
          1: {
            title: "Cross-Functional Launch Conflict",
            orgRole: "Acme Corp • Software Engineer",
            situation: "During our quarterly sprint, our front-end and backend teams had conflicting specifications for the API schema, threatening our launch deadline.",
            task: "I needed to align both teams, resolve the technical dispute, and establish a shared contract so neither team was blocked.",
            actions: "I scheduled an urgent cross-functional workshop where we mapped out all edge cases together on a virtual whiteboard. I facilitated constructive discussion, listened to both sides' architectural concerns, and proposed a compromise protocol using protobufs. I also paired with a junior frontend engineer who was struggling with the new contract.",
            result: "Both teams agreed to the schema, reached consensus within 2 hours, and we delivered the release 3 days ahead of schedule with 0 integration bugs."
          },
          2: {
            title: "Production Database Outage",
            orgRole: "ShopFast • Backend Engineer",
            situation: "Early in my career at an e-commerce startup, our checkout service experienced a 45-minute total outage during Black Friday.",
            task: "As the on-call engineer, I was responsible for diagnosing the incident, bringing the system back online, and explaining what happened.",
            actions: "I discovered that an unindexed migration I had authored and pushed earlier that morning locked the orders table under heavy load. I took full personal accountability, quickly rolled back the migration, and restored checkout. Afterwards, I conducted a blameless post-mortem with the entire engineering org, walked through my mistake, and wrote a pre-deployment linter rule that blocks unindexed foreign key migrations.",
            result: "The linter prevented 4 similar outage incidents in subsequent quarters, and my manager commended my transparency and ownership. I learned the critical importance of load-testing migrations and never pushing to production without automated guardrails."
          },
          3: {
            title: "Greenfield Zero-to-One Prototype",
            orgRole: "NextGen Labs • AI Engineer",
            situation: "Our company wanted to explore integrating generative AI into our legacy workflow product, but there were no customer specs, no architecture roadmap, and leadership had only vague expectations.",
            task: "I was tasked with exploring the space from scratch, validating technical feasibility, and proposing a concrete product direction under high uncertainty.",
            actions: "Since requirements were completely undefined, I interviewed 12 internal account managers to discover their primary friction points. Working with incomplete documentation, I rapidly built 3 lightweight proof-of-concept prototypes in 2 weeks. I set up measurable evaluation rubrics, tested latency trade-offs, and presented a data-driven proposal to our VP of Engineering.",
            result: "My prototype was greenlit as the company's Q3 flagship initiative, securing $500k in initial budget and cutting manual workflow time by 65% for our pilot customers."
          }
        };

        function loadSample(num) {
          const s = samples[num];
          document.getElementById('title').value = s.title;
          document.getElementById('orgRole').value = s.orgRole;
          document.getElementById('situation').value = s.situation;
          document.getElementById('task').value = s.task;
          document.getElementById('actions').value = s.actions;
          document.getElementById('result').value = s.result;
          evaluateStory();
        }

        async function evaluateStory() {
          const btn = document.getElementById('scoreBtn');
          btn.innerHTML = '<span>⏳ Evaluating with ML Model...</span>';
          btn.disabled = true;

          const payload = {
            title: document.getElementById('title').value || "Custom Story",
            situation: document.getElementById('situation').value,
            task: document.getElementById('task').value,
            actions: document.getElementById('actions').value,
            result: document.getElementById('result').value
          };

          try {
            const res = await fetch('/api/strength-grid/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            // Update Overall
            document.getElementById('overallScore').textContent = data.overall_strength_score + '%';
            document.getElementById('secondaryPillar').innerHTML = 'Secondary: <span class="text-indigo-300 font-semibold">' + (data.secondary_category || 'N/A').toUpperCase() + '</span>';
            
            const badge = document.getElementById('dominantBadge');
            badge.textContent = '🏆 Dominant: ' + data.dominant_category.toUpperCase();
            badge.classList.remove('hidden');

            // Update Bars
            ['teamwork', 'problem_solving', 'failure', 'leadership', 'ambiguity'].forEach(cat => {
              const val = data[cat] || 0.0;
              document.getElementById('score-' + cat).textContent = val.toFixed(1) + '%';
              document.getElementById('bar-' + cat).style.width = Math.min(100, Math.max(2, val)) + '%';
            });

            // Update Feedback
            const feedbackCard = document.getElementById('feedbackCard');
            feedbackCard.classList.remove('hidden');

            const signalsList = document.getElementById('signalsList');
            signalsList.innerHTML = '';
            
            let allSignals = [];
            Object.values(data.details).forEach(d => {
              if (d.signals_detected) {
                d.signals_detected.forEach(sig => {
                  allSignals.push({ sig, cat: d.category });
                });
              }
            });

            if (allSignals.length > 0) {
              allSignals.slice(0, 10).forEach(item => {
                const chip = document.createElement('span');
                chip.className = 'px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700';
                chip.textContent = '#' + item.sig;
                signalsList.appendChild(chip);
              });
            } else {
              signalsList.innerHTML = '<span class="text-xs text-slate-500">Semantic contextual activation</span>';
            }

            // Lowest category tip
            let minCat = Object.values(data.details).reduce((prev, curr) => prev.percentage < curr.percentage ? prev : curr);
            document.getElementById('improvementTip').textContent = minCat.label + ' (' + minCat.percentage + '%): ' + minCat.improvement_tip;

          } catch (err) {
            alert('Error evaluating: ' + err.message);
          } finally {
            btn.innerHTML = '<span>⚡ Run ML Strength Evaluation</span>';
            btn.disabled = false;
          }
        }
      </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


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
