"use client";

import { useRef, useState } from "react";
import { missingSections, type Story } from "./story";
import { cloudConfigured, getSupabase } from "./supabase";

const categories = [
  ["teamwork", "Teamwork"],
  ["problem_solving", "Problem Solving"],
  ["failure", "Resilience"],
  ["leadership", "Leadership"],
  ["ambiguity", "Ambiguity"],
] as const;

type Category = (typeof categories)[number][0];
type Detail = {
  level: string;
  improvement_tip: string;
  evidence_sentences: string[];
  signals_detected: string[];
};
type Score = {
  id: string;
  title: string;
  details: Record<Category, Detail>;
} & Record<Category, number>;
type Result = {
  scores: Score[];
  category_averages: Record<Category, number>;
  coverage_gaps: string[];
  recommended_focus: string;
};

export default function StrengthMatrix({
  stories,
  ready,
  storageError,
  dirty,
  onEdit,
}: {
  stories: Story[];
  ready: boolean;
  storageError: string;
  dirty: boolean;
  onEdit: (story: Story) => void;
}) {
  const [result, setResult] = useState<{ data: Result; signature: string } | null>(null);
  const [selection, setSelection] = useState<{ id: string; category: Category } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestLock = useRef(false);
  const signature = JSON.stringify(stories);
  const current = result?.signature === signature ? result.data : null;
  const selectedScore = current?.scores.find((score) => score.id === selection?.id);
  const detail = selectedScore && selection ? selectedScore.details[selection.category] : null;

  async function analyze() {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cloudConfigured) {
        const { data, error } = await getSupabase().auth.getSession();
        if (error || !data.session) throw new Error("Sign in again before analyzing stories.");
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/strength-grid", {
        method: "POST",
        headers,
        body: JSON.stringify({ stories }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
      if (
        !Array.isArray(data.scores) ||
        data.scores.length !== stories.length ||
        data.scores.some(
          (score: Score) =>
            !stories.some((story) => story.id === score.id) ||
            categories.some(
              ([key]) =>
                typeof score[key] !== "number" ||
                !Number.isFinite(score[key]) ||
                !score.details?.[key]
            )
        )
      ) {
        throw new Error("The scorer returned an unexpected response. Please retry.");
      }
      setResult({ data, signature });
      setSelection(null);
    } catch (error) {
      setError(
        error instanceof Error && error.name === "TimeoutError"
          ? "Scoring timed out. The model may still be loading; try again shortly."
          : error instanceof Error
          ? error.message
          : "Unable to reach the scorer."
      );
    } finally {
      setBusy(false);
      requestLock.current = false;
    }
  }

  return (
    <div className="matrix-container">
      {/* Unified Minimalist Page Header */}
      <div className="page-heading-clean">
        <div className="heading-copy">
          <div className="eyebrow-pill">
            <span className="eyebrow-dot" /> STORY COVERAGE MATRIX
          </div>
          <h1 className="heading-title">
            Story coverage.<br />
            <span>Know what your portfolio proves.</span>
          </h1>
          <p className="intro">
            Uses SentenceTransformers semantic embeddings to score stories against benchmark behavioral rubrics.
          </p>
        </div>

        <div className="matrix-header-action">
          <button
            className="raycast-btn-glow pair-btn"
            disabled={busy || !ready || !!storageError || !stories.length || dirty}
            onClick={analyze}
          >
            {busy ? "Analyzing Stories…" : current ? "Refresh Analysis" : "Analyze Saved Stories"}
          </button>
        </div>
      </div>

      {/* Notices & Alerts */}
      {dirty && (
        <div className="workspace-alert-box warning" role="status">
          <span>You have unsaved story edits. Return to Stories and save them before analyzing.</span>
        </div>
      )}
      {storageError && (
        <div className="workspace-alert-box error" role="alert">
          <span>Stories could not be loaded. Return to Stories and retry the connection.</span>
        </div>
      )}
      {error && (
        <div className="workspace-alert-box error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {busy && (
        <div className="workspace-alert-box info" role="status">
          <span>Comparing your stories against competency rubrics. First-time model loading takes ~3 seconds.</span>
        </div>
      )}

      {!ready ? (
        <div className="matrix-glass-card matrix-empty-card">
          <p className="muted">Loading saved stories…</p>
        </div>
      ) : !stories.length ? (
        <div className="matrix-glass-card matrix-empty-card">
          <div className="empty-bar-indicator" />
          <h2>Your stories power this matrix</h2>
          <p className="muted">Add and save a story in the Stories tab, then return here to analyze it.</p>
        </div>
      ) : (
        <>
          {result && !current && (
            <div className="workspace-alert-box warning" role="status">
              <span>Your saved stories changed since last analysis. Run analysis again to update scores.</span>
            </div>
          )}

          <p className="matrix-disclaimer">
            Scores reflect vector semantic similarity to hiring rubrics. Select any score cell to inspect exact evidence sentences.
          </p>

          {/* Glassmorphic Heatmap Table */}
          <div className="matrix-glass-card" role="region" aria-label="Story competency scores" tabIndex={0}>
            <table className="matrix-table-modern">
              <thead>
                <tr>
                  <th scope="col" className="matrix-th-story">Story</th>
                  {categories.map(([key, label]) => (
                    <th scope="col" key={key} className="matrix-th-cat">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => {
                  const score = current?.scores.find((item) => item.id === story.id);
                  const missing = missingSections(story);
                  return (
                    <tr key={story.id} className="matrix-row">
                      <th scope="row" className="matrix-story-cell">
                        <button
                          type="button"
                          className="matrix-story-title-btn"
                          onClick={() => onEdit(story)}
                          title="Open in Story Editor"
                        >
                          {story.title || "Untitled Story"}
                        </button>
                        <span className="matrix-story-status">
                          {missing.length
                            ? `${missing.length} STAR sections missing`
                            : "STAR outline filled"}
                        </span>
                      </th>
                      {categories.map(([key, label]) => {
                        const val = score ? score[key] : null;
                        const isSelected = selection?.id === story.id && selection.category === key;
                        const scoreClass =
                          val === null
                            ? "empty"
                            : val >= 65
                            ? "strong"
                            : val >= 35
                            ? "moderate"
                            : "low";
                        return (
                          <td key={key} className="matrix-cell">
                            {score ? (
                              <button
                                type="button"
                                className={`matrix-score-pill ${scoreClass} ${isSelected ? "selected" : ""}`}
                                aria-label={`${story.title}, ${label}: ${score[key].toFixed(1)} percent. Show evidence`}
                                aria-pressed={isSelected}
                                onClick={() => setSelection({ id: story.id, category: key })}
                              >
                                {score[key].toFixed(1)}%
                              </button>
                            ) : (
                              <span className="matrix-empty-dash" aria-label="Not analyzed">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {current && (
                <tfoot>
                  <tr className="matrix-footer-row">
                    <th scope="row" className="matrix-story-cell">
                      <strong>Portfolio Average</strong>
                    </th>
                    {categories.map(([key]) => (
                      <td key={key} className="matrix-cell">
                        <strong className="matrix-avg-val">
                          {current.category_averages[key].toFixed(1)}%
                        </strong>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Interactive Inspection & Coverage Panel */}
          {current && (
            <div className="matrix-summary-grid">
              {/* Left Column: Coverage Gaps & Strategic Advice */}
              <section className="matrix-glass-card matrix-detail-card" aria-label="Coverage Gaps">
                <div className="matrix-card-header">
                  <span className="matrix-card-tag">PORTFOLIO DIAGNOSIS</span>
                  <h3>Coverage Gaps</h3>
                </div>
                <p className="matrix-card-desc">
                  Competencies where no saved story reaches the 65% threshold:
                </p>
                {current.coverage_gaps.length ? (
                  <ul className="matrix-gaps-list">
                    {current.coverage_gaps.map((key) => (
                      <li key={key} className="matrix-gap-item">
                        <span className="gap-indicator-dot" />
                        <span>{categories.find(([id]) => id === key)?.[1] || key}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="matrix-perfect-coverage">
                    <span className="perfect-dot" />
                    <span>Every competency has at least one story meeting or exceeding the 65% benchmark.</span>
                  </div>
                )}
                <div className="matrix-focus-box">
                  <span className="focus-label">Recommended Focus</span>
                  <p>{current.recommended_focus}</p>
                </div>
              </section>

              {/* Right Column: "Behind the Score" Evidence Inspector */}
              <section className="matrix-glass-card matrix-detail-card" aria-live="polite" aria-label="Behind the Score">
                <div className="matrix-card-header">
                  <span className="matrix-card-tag">EVIDENCE INSPECTOR</span>
                  <h3>
                    {selection && selectedScore
                      ? `${categories.find(([key]) => key === selection.category)?.[1]} · ${selectedScore.title}`
                      : "Behind the Score"}
                  </h3>
                </div>

                {detail ? (
                  <div className="matrix-inspector-content">
                    <div className="inspector-level-row">
                      <span className={`inspector-level-badge ${detail.level.toLowerCase()}`}>
                        {detail.level} Strength
                      </span>
                    </div>
                    <p className="inspector-tip">{detail.improvement_tip}</p>

                    <div className="inspector-evidence-group">
                      <h4>Evidence Identified from Story</h4>
                      {detail.evidence_sentences.length ? (
                        <div className="evidence-quotes-list">
                          {detail.evidence_sentences.map((sentence, index) => (
                            <blockquote key={index} className="evidence-quote-box">
                              “{sentence}”
                            </blockquote>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No specific evidence sentence detected for this pillar.</p>
                      )}
                    </div>

                    {detail.signals_detected.length > 0 && (
                      <div className="inspector-signals-group">
                        <span className="signals-label">Signals Detected:</span>
                        <div className="signals-tags-row">
                          {detail.signals_detected.map((signal, index) => (
                            <span key={index} className="signal-pill">
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="matrix-inspector-empty">
                    <p className="muted">
                      Click any percentage pill in the matrix above to inspect its exact evidence sentences, signals detected, and tailored improvement tips.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
