"use client";

import { useState, useEffect, type FormEvent } from "react";

interface LandingPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onContinueGuest: () => void;
  busy: boolean;
  message: string;
  creating: boolean;
  setCreating: (creating: boolean) => void;
  currentUser?: { email?: string | null } | null;
  guestActive?: boolean;
  onOpenWorkspace?: () => void;
  onSignOut?: () => Promise<void>;
}

const DEMO_STORIES = [
  {
    id: "failure",
    title: "Production Database Migration Outage",
    category: "Failure & Resilience",
    pillarColor: "#f0cb84",
    score: "97.1%",
    level: "Exemplary",
    situation: "Early in my career at an e-commerce startup, our checkout service experienced a 45-minute total outage during Black Friday.",
    actions: "Discovered an unindexed migration locked the orders table. Took full ownership, rolled back immediately, and authored a pre-deployment linter blocking unindexed FK migrations.",
    result: "Prevented 4 similar outage incidents in subsequent quarters; praised by VP for transparency and proactive guardrails.",
  },
  {
    id: "problem_solving",
    title: "Scaling Payment Webhook Under 10x Load",
    category: "Problem Solving",
    pillarColor: "#60a5fa",
    score: "92.4%",
    level: "Exemplary",
    situation: "Our payment webhook began dropping 8% of transactions during flash sales due to synchronous ledger locking.",
    actions: "Profiled query locks, decoupled the ledger via an asynchronous Redis queue with Celery workers, and implemented idempotent deduplication.",
    result: "Webhook throughput surged by 400%, error rate dropped to 0%, saving ~$80k in weekly lost revenue.",
  },
  {
    id: "teamwork",
    title: "Cross-Functional API Schema Dispute",
    category: "Teamwork & Collaboration",
    pillarColor: "#4de1ff",
    score: "88.6%",
    level: "Strong",
    situation: "Frontend and backend teams reached a deadlock on REST vs. GraphQL for our mobile launch, threatening our release deadline.",
    actions: "Organized a whiteboard trade-off workshop, depersonalized arguments with client latency telemetry, and proposed a compromise protocol.",
    result: "Both teams reached consensus in 2 hours; shipped 3 days early with 0 integration regressions.",
  },
  {
    id: "leadership",
    title: "Rallying Skeptical Team on Micro-Frontend Migration",
    category: "Leadership & Initiative",
    pillarColor: "#a78bfa",
    score: "93.0%",
    level: "Exemplary",
    situation: "Team velocity had slowed to a crawl due to a 300k-line monolithic repo, but engineers feared migration risks.",
    actions: "Built a zero-friction spike in 48 hours, presented benchmarks demonstrating 5x faster CI build times, and pair-programmed with skeptics.",
    result: "Adopted org-wide within 6 weeks, cutting deployment cycles from 2 days to 15 minutes.",
  },
];

export default function LandingPage({
  onSignIn,
  onSignUp,
  onContinueGuest,
  busy,
  message,
  creating,
  setCreating,
  currentUser,
  guestActive,
  onOpenWorkspace,
  onSignOut,
}: LandingPageProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [phaseKey, setPhaseKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStories = DEMO_STORIES.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.situation.toLowerCase().includes(q) ||
      item.actions.toLowerCase().includes(q)
    );
  });

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && authOpen) {
        setAuthOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (creating) {
      await onSignUp(email, password);
    } else {
      await onSignIn(email, password);
    }
  }

  function openAuth(isNew: boolean) {
    setCreating(isNew);
    setAuthOpen(true);
  }

  const activeDemo = filteredStories[selectedDemoIndex] || DEMO_STORIES[0];

  return (
    <div className="raycast-root">
      {/* Background glow effects */}
      <div className="raycast-glow-top" aria-hidden="true" />
      <div className="raycast-glow-ambient" aria-hidden="true" />

      {/* Top Navigation */}
      <header className="raycast-nav">
        <div className="raycast-nav-inner">
          <button
            type="button"
            className="raycast-brand raycast-brand-btn"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            title="MeCode Home · Scroll to top"
            aria-label="MeCode Home"
          >
            <span className="raycast-logo-box">
              <span className="raycast-logo-glyph">m.</span>
            </span>
            <span className="raycast-brand-name">MeCode</span>
          </button>

          <nav className="raycast-nav-links" aria-label="Main Navigation">
            <a href="#demo-preview" className="raycast-link">Demo</a>
            <a href="#features" className="raycast-link">Pillars</a>
            <button
              type="button"
              className="raycast-link raycast-nav-btn"
              onClick={() => {
                if (currentUser) {
                  onOpenWorkspace?.();
                } else {
                  openAuth(true);
                }
              }}
              title={currentUser ? "Open 50 Questions in workspace" : "Sign up to unlock 50 Questions"}
            >
              50 Questions
            </button>
          </nav>

          <div className="raycast-nav-actions">
            {currentUser ? (
              <>
                <span className="raycast-user-pill" title={`Logged in as ${currentUser.email ?? "User"}`}>
                  {currentUser.email ?? "Logged In"}
                </span>
                {onSignOut && (
                  <button
                    className="raycast-btn-ghost"
                    onClick={onSignOut}
                    disabled={busy}
                  >
                    Sign Out
                  </button>
                )}
                <button
                  className="raycast-btn-primary"
                  onClick={onOpenWorkspace}
                >
                  Open Workspace
                </button>
              </>
            ) : guestActive ? (
              <>
                <button
                  className="raycast-btn-ghost"
                  onClick={() => openAuth(false)}
                >
                  Sign In
                </button>
                <button
                  className="raycast-btn-primary"
                  onClick={onOpenWorkspace}
                >
                  Return to Workspace
                </button>
              </>
            ) : (
              <>
                <button
                  className="raycast-btn-ghost"
                  onClick={() => openAuth(false)}
                >
                  Sign In
                </button>
                <button
                  className="raycast-btn-primary"
                  onClick={() => openAuth(true)}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="raycast-hero" key={phaseKey}>
        <div
          className="raycast-badge-wrapper raycast-phase-item"
          style={{ animationDelay: "80ms" }}
          onClick={() => setPhaseKey((k) => k + 1)}
          title="Click to replay reveal animation"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setPhaseKey((k) => k + 1);
          }}
        >
          <span className="raycast-badge">
            <span className="raycast-badge-dot" />
            Next-Gen Behavioral Interview Intelligence
          </span>
        </div>

        <h1 className="raycast-hero-title" aria-label="LeetCode solved technicals. MeCode solves the rest.">
          <span className="raycast-title-line raycast-title-line-1">
            <span className="raycast-phase-word" style={{ animationDelay: "160ms" }}>LeetCode</span>{" "}
            <span className="raycast-phase-word" style={{ animationDelay: "280ms" }}>solved</span>{" "}
            <span className="raycast-phase-word" style={{ animationDelay: "400ms" }}>technicals.</span>
          </span>
          <br className="raycast-title-break" />
          <span
            className="raycast-title-line raycast-title-line-2 raycast-hero-gradient raycast-phase-item"
            style={{ animationDelay: "580ms" }}
          >
            MeCode solves the rest.
          </span>
        </h1>

        <p className="raycast-hero-subtitle raycast-phase-item" style={{ animationDelay: "800ms" }}>
          Master interviews by practicing structured STAR stories scored by ML rubrics across the 5 core behavioral pillars.
        </p>

        <div className="raycast-hero-cta-group raycast-phase-item" style={{ animationDelay: "980ms" }}>
          {currentUser ? (
            <>
              <button
                className="raycast-btn-glow"
                onClick={onOpenWorkspace}
              >
                Open Your Workspace
              </button>
              <a
                href="#demo-preview"
                className="raycast-btn-secondary"
              >
                Explore Features & Prompts
              </a>
            </>
          ) : guestActive ? (
            <>
              <button
                className="raycast-btn-glow"
                onClick={onOpenWorkspace}
              >
                Return to Workspace
              </button>
              <button
                className="raycast-btn-secondary"
                onClick={() => openAuth(true)}
              >
                Connect Cloud Account
              </button>
            </>
          ) : (
            <>
              <button
                className="raycast-btn-glow"
                onClick={() => openAuth(true)}
              >
                Start Free with Cloud Sync
              </button>
              <button
                className="raycast-btn-secondary"
                onClick={onContinueGuest}
                title="Explore stories, questions, and scoring immediately in local browser storage"
              >
                Explore Live Demo Workspace
              </button>
            </>
          )}
        </div>

        <div className="raycast-pill-row raycast-phase-item" style={{ animationDelay: "1140ms" }}>
          <button
            type="button"
            className="raycast-pill-item raycast-pill-btn"
            onClick={() => {
              if (currentUser) onOpenWorkspace?.();
              else openAuth(true);
            }}
            title="Sign up to access 50 Big-Tech questions"
          >
            50 Curated Big-Tech Prompts
          </button>
          <span className="raycast-pill-dot">•</span>
          <span className="raycast-pill-item">ML Strength Rubric</span>
          <span className="raycast-pill-dot">•</span>
          <span className="raycast-pill-item">PDF Resume Autofill</span>
          <span className="raycast-pill-dot">•</span>
          <span className="raycast-pill-item">2-Min Practice Stopwatch</span>
        </div>

        {/* Raycast-style Interactive Command Bar & Story Preview */}
        <div id="demo-preview" className="raycast-launcher-window raycast-phase-launcher" style={{ animationDelay: "1280ms" }}>
          <div className="raycast-launcher-bar">
            <input
              type="text"
              className="raycast-search-input"
              placeholder="Search stories, competency rubrics, or interview prompts…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedDemoIndex(0);
              }}
              aria-label="Filter demo stories"
            />
            {searchQuery ? (
              <button
                type="button"
                className="raycast-kbd-hint clickable"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            ) : (
              <span className="raycast-kbd-hint">Type to filter</span>
            )}
          </div>

          <div className="raycast-launcher-body">
            {/* Left list of items */}
            <div className="raycast-launcher-list">
              <div className="raycast-list-header">
                <span>SAVED STAR EXPERIENCES ({filteredStories.length})</span>
                <span>ML SCORE</span>
              </div>
              {filteredStories.length === 0 ? (
                <div className="raycast-no-results">No stories matching “{searchQuery}”</div>
              ) : (
                filteredStories.map((item, index) => {
                  const isSelected = index === selectedDemoIndex;
                  return (
                    <button
                      key={item.id}
                      className={`raycast-list-item ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedDemoIndex(index)}
                    >
                      <div className="raycast-item-main">
                        <span
                          className="raycast-pillar-dot"
                          style={{ backgroundColor: item.pillarColor }}
                        />
                        <span className="raycast-item-title">{item.title}</span>
                      </div>
                      <div className="raycast-item-meta">
                        <span
                          className="raycast-cat-badge"
                          style={{ color: item.pillarColor }}
                        >
                          {item.category}
                        </span>
                        <span className="raycast-item-score">{item.score}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Right preview pane */}
            <div className="raycast-launcher-preview">
              <div className="raycast-preview-header">
                <div>
                  <span
                    className="raycast-cat-badge-lg"
                    style={{
                      color: activeDemo.pillarColor,
                      backgroundColor: `${activeDemo.pillarColor}15`,
                      borderColor: `${activeDemo.pillarColor}44`,
                    }}
                  >
                    {activeDemo.category}
                  </span>
                  <h3 className="raycast-preview-title">{activeDemo.title}</h3>
                </div>
                <div className="raycast-preview-score-box">
                  <span className="raycast-score-big">{activeDemo.score}</span>
                  <span className="raycast-score-level">{activeDemo.level}</span>
                </div>
              </div>

              <div className="raycast-preview-section">
                <h4>SITUATION & PROBLEM</h4>
                <p>{activeDemo.situation}</p>
              </div>

              <div className="raycast-preview-section">
                <h4>INDIVIDUAL ACTIONS TAKEN</h4>
                <p>{activeDemo.actions}</p>
              </div>

              <div className="raycast-preview-section highlight">
                <h4>MEASURABLE IMPACT & RESULT</h4>
                <p>{activeDemo.result}</p>
              </div>
            </div>
          </div>

          <div className="raycast-launcher-footer">
            <div className="raycast-footer-left">
              <span>Navigate with arrows</span>
              <span>Open Story</span>
              <span>Actions</span>
            </div>
            <div className="raycast-footer-right">
              <span>ML Scorer: all-MiniLM-L6-v2 active</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section id="features" className="raycast-bento-section">
        <div className="raycast-section-header">
          <p className="raycast-eyebrow">Complete Behavioral Toolkit</p>
          <h2 className="raycast-section-title">Everything you need to nail the loop.</h2>
          <p className="raycast-section-desc">Designed with the speed, precision, and minimalism engineering teams love.</p>
        </div>

        <div className="raycast-bento-grid">
          {/* Card 1 */}
          <div className="raycast-bento-card span-2">
            <span className="raycast-bento-num">01 · RUBRIC</span>
            <h3>ML Strength Matrix</h3>
            <p>
              Uses deep semantic similarity embeddings (SentenceTransformers) against benchmark interview rubrics to score your stories from 0% to 100% across Teamwork, Problem Solving, Failure, Leadership, and Ambiguity.
            </p>
            <div className="raycast-bento-tags">
              <span>Coverage Gap Detection</span>
              <span>Signal Keyword Extractor</span>
              <span>Tailored Feedback Tips</span>
            </div>
          </div>

          {/* Card 2 */}
          <div
            id="questions"
            className="raycast-bento-card raycast-bento-card-clickable"
            onClick={() => {
              if (currentUser) {
                onOpenWorkspace?.();
              } else {
                openAuth(true);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (currentUser) onOpenWorkspace?.();
                else openAuth(true);
              }
            }}
            title={currentUser ? "Open questions in workspace" : "Sign up to unlock all 50 questions"}
          >
            <span className="raycast-bento-num">02 · PROMPTS</span>
            <h3>50 Big-Tech Questions</h3>
            <p>
              Curated behavioral prompts asked by Google, Meta, Apple, and Amazon. Filter by competency or search by concept.
            </p>
            <span className="raycast-card-action-link">
              {currentUser ? "Open in workspace" : "Sign up to practice"}
            </span>
          </div>

          {/* Card 3 */}
          <div className="raycast-bento-card">
            <span className="raycast-bento-num">03 · DRILL</span>
            <h3>Mock Drill Stopwatch</h3>
            <p>
              Practice speaking your answers aloud with a built-in 90–120s sweet-spot timer, response scratchpad, and mental STAR checklist.
            </p>
          </div>

          {/* Card 4 */}
          <div className="raycast-bento-card span-2">
            <span className="raycast-bento-num">04 · PARSER</span>
            <h3>PDF Resume-to-STAR Autofill</h3>
            <p>
              Upload your resume PDF. MeCode extracts your projects and bullet points, organizing raw experience into reviewable, editable STAR outlines with zero manual copy-pasting.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="raycast-bottom-cta">
        <div className="raycast-bottom-inner">
          <h2>Ready to stand out in your next behavioral round?</h2>
          <p>Prepare real moments you can draw upon with total confidence.</p>
          <div className="raycast-bottom-btns">
            {currentUser ? (
              <button className="raycast-btn-glow" onClick={onOpenWorkspace}>
                Go to Your Workspace
              </button>
            ) : guestActive ? (
              <button className="raycast-btn-glow" onClick={onOpenWorkspace}>
                Return to Your Workspace
              </button>
            ) : (
              <>
                <button className="raycast-btn-glow" onClick={() => openAuth(true)}>
                  Create Your Free Account
                </button>
                <button className="raycast-btn-secondary" onClick={onContinueGuest}>
                  Launch Demo Workspace
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="raycast-footer">
        <div className="raycast-footer-inner">
          <div className="raycast-brand">
            <span className="raycast-logo-glyph">m.</span>
            <span>MeCode</span>
          </div>
          <span className="raycast-footer-copy">LeetCode solved technicals. MeCode solves the rest.</span>
          <span className="raycast-footer-tag">HackGT 2026</span>
        </div>
      </footer>

      {/* Raycast-style Auth Modal */}
      {authOpen && (
        <div className="raycast-modal-backdrop" onClick={() => setAuthOpen(false)}>
          <div
            className="raycast-modal-window"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <button
              className="raycast-modal-close"
              onClick={() => setAuthOpen(false)}
              aria-label="Close modal"
            >
              Close
            </button>

            <div className="raycast-modal-header">
              <span className="raycast-logo-box">
                <span className="raycast-logo-glyph">m.</span>
              </span>
              <h2 id="auth-modal-title">
                {creating ? "Create your account" : "Welcome back"}
              </h2>
              <p className="raycast-modal-sub">
                {creating
                  ? "Save your STAR stories securely and sync across devices."
                  : "Sign in to access your saved stories and strength grid."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="raycast-auth-form">
              <label className="raycast-form-label">
                Email
                <input
                  type="email"
                  className="raycast-input"
                  autoComplete="email"
                  required
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="raycast-form-label">
                Password
                <input
                  type="password"
                  className="raycast-input"
                  minLength={creating ? 8 : 1}
                  autoComplete={creating ? "new-password" : "current-password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {message && (
                <div className="raycast-auth-message" role="alert">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="raycast-btn-glow full-width"
                disabled={busy}
              >
                {busy ? "Connecting…" : creating ? "Create Account" : "Sign In"}
              </button>
            </form>

            <div className="raycast-modal-footer">
              <button
                type="button"
                className="raycast-switch-btn"
                onClick={() => setCreating(!creating)}
              >
                {creating
                  ? "Already have an account? Sign in"
                  : "New to MeCode? Create an account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
